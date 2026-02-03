const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sql = require('mssql');
require('dotenv').config();
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Request Logger Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Database Configuration
const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'yourStrong(!)Password',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'EmpowerHR',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

// Email Configuration
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER || process.env.GMAIL_USER || 'hr@empowercorp.com';
const rawPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || 'password';
const SMTP_PASS = rawPass.replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
});

let isEmailServiceReady = false;
transporter.verify(function (error, success) {
    if (error) {
        console.warn('⚠️  Email service warning:', error.message);
    } else {
        console.log('✅ Email server is ready');
        isEmailServiceReady = true;
    }
});

const sendEmailAsync = async (to, subject, htmlBody) => {
    if (process.env.MOCK_EMAIL === 'true' || !isEmailServiceReady) {
        console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
        return;
    }
    try {
        await transporter.sendMail({
            from: `"EmpowerCorp HR" <${SMTP_USER}>`,
            to, subject, html: htmlBody
        });
        console.log(`[EMAIL SENT] To: ${to}`);
    } catch (ex) {
        console.error("Email send failed:", ex);
    }
};

let pool;
const connectDb = async () => {
    try {
        pool = await sql.connect(dbConfig);
        console.log('✅ Connected to MSSQL Database');
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
    }
};
connectDb();

// --- Core Business Logic ---

const checkAndNotifyMissingTimesheets = async (targetDate) => {
    console.log(`[Service] Checking missing timesheets for: ${targetDate}`);
    
    // If DB not connected (Mock Mode fallback)
    if (!pool) {
        console.warn("[Service] DB not connected. Simulating email sending for mock mode.");
        return { success: true, message: "Mock reminders sent (DB Offline)", count: 1 };
    }

    try {
        const empResult = await pool.request()
            .query("SELECT id, firstName, lastName, email FROM employees WHERE status = 'Active'");
        const employees = empResult.recordset;

        const logResult = await pool.request()
            .input('date', sql.NVarChar, targetDate)
            .query("SELECT userId, durationMinutes, extraMinutes FROM time_entries WHERE date = @date");
        const logs = logResult.recordset;

        let sentCount = 0;
        const STANDARD_MINUTES = 480;

        for (const emp of employees) {
            const userLogs = logs.filter(l => String(l.userId) === String(emp.id));
            const totalMinutes = userLogs.reduce((sum, log) => sum + (log.durationMinutes || 0) + (log.extraMinutes || 0), 0);
            
            if (totalMinutes < STANDARD_MINUTES) {
                const hoursFilled = (totalMinutes / 60).toFixed(1);
                const hoursMissing = ((STANDARD_MINUTES - totalMinutes) / 60).toFixed(1);

                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                        <p>Dear ${emp.firstName} ${emp.lastName},</p>
                        <p>Your timesheet for <strong>${targetDate}</strong> has not been completed. Please ensure it is submitted by today.</p>
                        <table style="width: 100%; max-width: 400px; border-collapse: collapse; margin: 20px 0;">
                            <tr style="background-color: #f3f4f6;"><td style="padding: 8px; border: 1px solid #ddd;">Date</td><td style="padding: 8px; border: 1px solid #ddd;">${targetDate}</td></tr>
                            <tr><td style="padding: 8px; border: 1px solid #ddd;">Hours Filled</td><td style="padding: 8px; border: 1px solid #ddd;">${hoursFilled}</td></tr>
                            <tr><td style="padding: 8px; border: 1px solid #ddd;">Hours Missing</td><td style="padding: 8px; border: 1px solid #ddd; color: red;">${hoursMissing}</td></tr>
                        </table>
                        <p>Regards,<br/>HR Team</p>
                    </div>
                `;
                await sendEmailAsync(emp.email, 'Action Required: Incomplete Timesheet', emailHtml);
                sentCount++;
            }
        }
        return { success: true, message: `Reminders sent to ${sentCount} employees.`, count: sentCount };
    } catch (err) {
        console.error("[Service] Error processing missing timesheets:", err);
        throw err;
    }
};

const checkAndNotifyWeeklyCompliance = async () => {
    console.log(`[Service] Running Weekly Compliance Check`);

    if (!pool) {
        console.warn("[Service] DB not connected. Simulating weekly compliance email.");
        return { success: true, message: "Mock weekly compliance sent (DB Offline)", count: 1 };
    }

    try {
        const today = new Date();
        const day = today.getDay(); 
        const diffToMon = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diffToMon));
        const friday = new Date(today.setDate(diffToMon + 4));

        const formatDate = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        };

        const startStr = formatDate(monday);
        const endStr = formatDate(friday);

        const empResult = await pool.request()
            .query("SELECT id, firstName, lastName, email FROM employees WHERE status = 'Active'");
        const employees = empResult.recordset;

        const logResult = await pool.request()
            .input('start', sql.NVarChar, startStr)
            .input('end', sql.NVarChar, endStr)
            .query("SELECT userId, durationMinutes, extraMinutes FROM time_entries WHERE date >= @start AND date <= @end");
        const logs = logResult.recordset;

        let sentCount = 0;
        const EXPECTED_WEEKLY_MINUTES = 2400; 

        for (const emp of employees) {
            const userLogs = logs.filter(l => String(l.userId) === String(emp.id));
            const totalMinutes = userLogs.reduce((sum, log) => sum + (log.durationMinutes || 0) + (log.extraMinutes || 0), 0);

            if (totalMinutes < (EXPECTED_WEEKLY_MINUTES * 0.95)) {
                const loggedHours = (totalMinutes / 60).toFixed(1);
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                        <p>Dear ${emp.firstName},</p>
                        <p style="color: #c2410c; font-weight: bold; font-size: 16px;">Action Required: Weekly TMS Compliance Warning</p>
                        <p>Our records indicate incomplete Time Management System (TMS) logs for the week of <strong>${startStr} to ${endStr}</strong>.</p>
                        <p><strong>Total Hours Logged:</strong> ${loggedHours} / 40.0</p>
                        <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 15px; margin: 20px 0;">
                            <p style="margin: 0; font-weight: bold;">All employees are expected to complete and submit their TMS (time logs) on time without exception.</p>
                            <br/>
                            <p style="margin: 0; font-weight: bold; color: #9f1239;">Repeated non-compliance will be viewed seriously and may result in strict action.</p>
                        </div>
                        <p>Regards,<br/>HR & Compliance Team</p>
                    </div>
                `;
                await sendEmailAsync(emp.email, 'URGENT: Weekly TMS Non-Compliance Notice', emailHtml);
                sentCount++;
            }
        }
        return { success: true, message: `Compliance warnings sent to ${sentCount} employees.`, count: sentCount };

    } catch (err) {
        console.error("Error in weekly compliance check:", err);
        throw err;
    }
}

// --- Scheduled Tasks ---

cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Running Daily Timesheet Check...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    await checkAndNotifyMissingTimesheets(`${y}-${m}-${d}`);
});

cron.schedule('0 17 * * 5', async () => {
    console.log('[CRON] Running Weekly Compliance Audit...');
    await checkAndNotifyWeeklyCompliance();
});

// --- API ROUTES (Defined Explicitly on App to avoid router issues) ---

// 1. Explicit Custom Routes (Priority)
app.post('/api/notify/missing-timesheets', async (req, res) => {
    const { targetDate } = req.body;
    console.log(`[API] Manual trigger: Missing Timesheets for ${targetDate}`);
    try {
        const result = await checkAndNotifyMissingTimesheets(targetDate);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notify/weekly-compliance', async (req, res) => {
    console.log(`[API] Manual trigger: Weekly Compliance`);
    try {
        const result = await checkAndNotifyWeeklyCompliance();
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Generic Router for Standard Entities
const apiRouter = express.Router();

// Define Standard Routes Helper
const registerStandardRoutes = (route, tableName) => {
    apiRouter.get(`/${route}`, async (req, res) => {
        try {
            if (!pool) throw new Error('DB disconnected');
            const result = await pool.request().query(`SELECT * FROM [${tableName}]`);
            res.json(result.recordset);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
    
    apiRouter.post(`/${route}`, async (req, res) => {
        try {
            if (!pool) throw new Error('DB disconnected');
            const data = req.body;
            const columns = Object.keys(data).map(k => `[${k}]`).join(', ');
            const paramNames = Object.keys(data).map((k, i) => `@p${i}`).join(', ');
            const request = pool.request();
            Object.keys(data).forEach((k, i) => {
                let val = data[k];
                if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
                request.input(`p${i}`, val);
            });
            await request.query(`INSERT INTO [${tableName}] (${columns}) VALUES (${paramNames})`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    apiRouter.put(`/${route}/:id`, async (req, res) => {
        try {
            if (!pool) throw new Error('DB disconnected');
            const { id } = req.params;
            const data = req.body;
            const keysToUpdate = Object.keys(data).filter(k => k !== 'id');
            const sets = keysToUpdate.map((k, i) => `[${k}]=@p${i}`).join(', ');
            const request = pool.request();
            request.input('id', id);
            keysToUpdate.forEach((k, i) => {
                let val = data[k];
                if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
                request.input(`p${i}`, val);
            });
            await request.query(`UPDATE [${tableName}] SET ${sets} WHERE id=@id`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    apiRouter.delete(`/${route}/:id`, async (req, res) => {
        try {
            if (!pool) throw new Error('DB disconnected');
            const { id } = req.params;
            const request = pool.request();
            request.input('id', id);
            await request.query(`DELETE FROM [${tableName}] WHERE id=@id`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
};

const entities = [
    { route: 'employees', table: 'employees' },
    { route: 'departments', table: 'departments' },
    { route: 'positions', table: 'positions' },
    { route: 'roles', table: 'roles' },
    { route: 'projects', table: 'projects' },
    { route: 'leaves', table: 'leaves' }, 
    { route: 'leave_types', table: 'leave_types' },
    { route: 'attendance', table: 'attendance' },
    { route: 'time_entries', table: 'time_entries' },
    { route: 'notifications', table: 'notifications' },
    { route: 'holidays', table: 'holidays' },
    { route: 'payslips', table: 'payslips' },
    { route: 'invitations', table: 'invitations' }
];

entities.forEach(e => registerStandardRoutes(e.route, e.table));

// Other explicit routes that might be needed
apiRouter.post('/auth/forgot-password', async (req, res) => {
    /* ... reuse existing logic or keep placeholder ... */
    res.json({ message: "Password reset link sent (Mock)", status: "success" });
});
apiRouter.post('/auth/reset-password', async (req, res) => {
    res.json({ message: "Password updated successfully (Mock).", status: "success" });
});
apiRouter.post('/notifications/mark-read', async (req, res) => res.json({ success: true }));
apiRouter.post('/notifications/mark-all-read', async (req, res) => res.json({ success: true }));

// Mount Generic Router
app.use('/api', apiRouter);

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Routes registered. Cron jobs active (Daily + Weekly).`);
});