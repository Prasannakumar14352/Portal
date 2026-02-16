
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
            from: `"IST INFO" <${SMTP_USER}>`,
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
    
    // Check if targetDate is a weekend (0=Sun, 6=Sat)
    const dateObj = new Date(targetDate);
    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
        console.log(`[Service] Skipping ${targetDate} as it is a weekend.`);
        return { success: true, message: "Skipped weekend", count: 0 };
    }

    if (!pool) {
        console.warn("[Service] DB not connected. Simulation mode.");
        return { success: true, message: "DB Offline", count: 0 };
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
        const STANDARD_MINUTES = 480; // 8 hours

        for (const emp of employees) {
            const userLogs = logs.filter(l => String(l.userId) === String(emp.id));
            const totalMinutes = userLogs.reduce((sum, log) => sum + (log.durationMinutes || 0) + (log.extraMinutes || 0), 0);
            
            if (totalMinutes < STANDARD_MINUTES) {
                const filledMins = totalMinutes;
                const missingMins = STANDARD_MINUTES - totalMinutes;
                
                const hoursFilled = (filledMins / 60).toFixed(0);
                const hoursMissing = (missingMins / 60).toFixed(0);

                const emailHtml = `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-top: 5px solid #00adef; border-radius: 8px;">
                        <div style="margin-bottom: 25px;">
                            <h1 style="color: #003366; font-size: 24px; font-weight: bold; margin: 0;">IST INFO</h1>
                            <h2 style="color: #475569; font-size: 16px; margin: 5px 0 0 0;">Immediate Action Required: Timesheet Submission</h2>
                        </div>

                        <p>Dear ${emp.firstName} ${emp.lastName},</p>
                        
                        <p style="margin-top: 15px;">Your timesheet for the below-mentioned date(s) has not been completed. Please ensure it is completed and submitted by today, as timesheet data is directly linked to attendance records.</p>

                        <table style="width: 100%; border-collapse: collapse; margin: 25px 0; font-size: 14px;">
                            <thead>
                                <tr style="background-color: #ffffff;">
                                    <th style="padding: 10px; border: 1px solid #333; text-align: left; background-color: #f8fafc;">Date</th>
                                    <th style="padding: 10px; border: 1px solid #333; text-align: left; background-color: #f8fafc;">Hours Filled</th>
                                    <th style="padding: 10px; border: 1px solid #333; text-align: left; background-color: #f8fafc;">Hours Missing</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #333;">${targetDate}</td>
                                    <td style="padding: 10px; border: 1px solid #333;">${hoursFilled}</td>
                                    <td style="padding: 10px; border: 1px solid #333;">${hoursMissing}</td>
                                </tr>
                            </tbody>
                        </table>

                        <p>Kindly update your timesheet at the earliest.</p>

                        <p style="margin-top: 30px; line-height: 1.2;">
                            Thanks,<br/>
                            <strong>HR Team</strong>
                        </p>
                        
                        <div style="margin-top: 40px; padding-top: 10px; border-top: 1px solid #eee; font-size: 11px; color: #94a3b8;">
                            This is an automated system notification. Please do not reply directly to this email.
                        </div>
                    </div>
                `;
                await sendEmailAsync(emp.email, 'Immediate Action Required: Timesheet Submission', emailHtml);
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
    // ... logic remains for overall compliance reporting
}

// --- Scheduled Tasks ---

// Runs every working day (Mon-Fri) at 10:00 AM
cron.schedule('0 10 * * 1-5', async () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    let targetDate = new Date();

    if (dayOfWeek === 1) { 
        // If today is Monday, check the previous Friday
        targetDate.setDate(now.getDate() - 3);
    } else {
        // Otherwise check yesterday
        targetDate.setDate(now.getDate() - 1);
    }

    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    
    console.log(`[CRON] Daily check triggered at 10am. Target Date for missing logs: ${y}-${m}-${d}`);
    await checkAndNotifyMissingTimesheets(`${y}-${m}-${d}`);
});

// Weekly Compliance Audit: Friday at 5:00 PM
cron.schedule('0 17 * * 5', async () => {
    console.log('[CRON] Running Weekly Compliance Audit...');
    await checkAndNotifyWeeklyCompliance();
});

// --- API ROUTES ---

app.post('/api/notify/missing-timesheets', async (req, res) => {
    const { targetDate } = req.body;
    try {
        const result = await checkAndNotifyMissingTimesheets(targetDate);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generic Entity Routes Registration
const apiRouter = express.Router();
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

entities.forEach(e => registerStandardRoutes(e.route, e.table));

app.use('/api', apiRouter);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
