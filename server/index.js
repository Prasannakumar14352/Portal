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
        // Log body preview for debugging
        console.log(`[MOCK EMAIL BODY PREVIEW]:`, htmlBody.substring(0, 100) + '...');
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
        return { success: true, message: "Mock reminders sent", count: 1 };
    }

    try {
        // 1. Get All Active Employees
        const empResult = await pool.request()
            .query("SELECT id, firstName, lastName, email FROM employees WHERE status = 'Active'");
        const employees = empResult.recordset;

        // 2. Get Time Logs for the specific date
        const logResult = await pool.request()
            .input('date', sql.NVarChar, targetDate)
            .query("SELECT userId, durationMinutes, extraMinutes FROM time_entries WHERE date = @date");
        const logs = logResult.recordset;

        let sentCount = 0;

        // 3. Check each employee
        for (const emp of employees) {
            // Calculate total minutes logged by this user on this date
            const userLogs = logs.filter(l => String(l.userId) === String(emp.id));
            const totalMinutes = userLogs.reduce((sum, log) => sum + (log.durationMinutes || 0) + (log.extraMinutes || 0), 0);
            
            // Standard day is 8 hours = 480 minutes
            const STANDARD_MINUTES = 480;

            if (totalMinutes < STANDARD_MINUTES) {
                const hoursFilled = (totalMinutes / 60).toFixed(1);
                const hoursMissing = ((STANDARD_MINUTES - totalMinutes) / 60).toFixed(1);

                // Construct Email Matching the Screenshot
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                        <p>Dear ${emp.firstName} ${emp.lastName},</p>
                        
                        <p>Your timesheet for <strong>${targetDate}</strong> has not been completed. Please ensure it is completed and submitted by today.</p>
                        
                        <table style="border-collapse: collapse; width: 100%; max-width: 500px; margin: 20px 0;">
                            <thead>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="border: 1px solid #000; padding: 10px; text-align: left;">Date</th>
                                    <th style="border: 1px solid #000; padding: 10px; text-align: left;">Hours Filled</th>
                                    <th style="border: 1px solid #000; padding: 10px; text-align: left;">Hours Missing</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="border: 1px solid #000; padding: 10px;">${targetDate}</td>
                                    <td style="border: 1px solid #000; padding: 10px;">${hoursFilled}</td>
                                    <td style="border: 1px solid #000; padding: 10px;">${hoursMissing}</td>
                                </tr>
                            </tbody>
                        </table>

                        <p>Kindly update your timesheet at the earliest.</p>
                        
                        <p style="margin-top: 30px;">
                            Thanks,<br/>
                            HR Team
                        </p>
                    </div>
                `;

                // Send Email
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
        return { success: true, message: "Mock weekly compliance sent", count: 1 };
    }

    try {
        // Calculate Week Range (Monday to Friday of current week)
        const today = new Date();
        const day = today.getDay(); // 0-6
        const diffToMon = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
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

        // 1. Get Active Employees
        const empResult = await pool.request()
            .query("SELECT id, firstName, lastName, email FROM employees WHERE status = 'Active'");
        const employees = empResult.recordset;

        // 2. Get logs for the whole week
        const logResult = await pool.request()
            .input('start', sql.NVarChar, startStr)
            .input('end', sql.NVarChar, endStr)
            .query("SELECT userId, durationMinutes, extraMinutes FROM time_entries WHERE date >= @start AND date <= @end");
        const logs = logResult.recordset;

        let sentCount = 0;
        // Standard week: 5 days * 8 hours * 60 mins = 2400 mins
        // If checking mid-week (e.g. Friday 5pm), expectation is full week.
        const EXPECTED_WEEKLY_MINUTES = 2400; 

        for (const emp of employees) {
            const userLogs = logs.filter(l => String(l.userId) === String(emp.id));
            const totalMinutes = userLogs.reduce((sum, log) => sum + (log.durationMinutes || 0) + (log.extraMinutes || 0), 0);

            // Threshold: If less than 95% of expected hours, trigger warning
            if (totalMinutes < (EXPECTED_WEEKLY_MINUTES * 0.95)) {
                
                const loggedHours = (totalMinutes / 60).toFixed(1);
                
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                        <p>Dear ${emp.firstName},</p>
                        
                        <p style="color: #c2410c; font-weight: bold; font-size: 16px;">Action Required: Weekly TMS Compliance Warning</p>
                        
                        <p>Our records indicate incomplete Time Management System (TMS) logs for the week of <strong>${startStr} to ${endStr}</strong>.</p>
                        <p><strong>Total Hours Logged:</strong> ${loggedHours} / 40.0</p>

                        <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 15px; margin: 20px 0;">
                            <p style="margin: 0; font-weight: bold;">All employees are expected to complete and submit their TMS (time logs) on time without exception, as TMS data is directly linked to attendance, compliance, and reporting requirements.</p>
                            <br/>
                            <p style="margin: 0; font-weight: bold; color: #9f1239;">Please be advised that repeated non-compliance will be viewed seriously and may result in strict action, in line with company policy.</p>
                        </div>

                        <p>We appreciate your cooperation in ensuring timely and accurate TMS (time logs) updates.</p>
                        
                        <p style="margin-top: 30px;">
                            Regards,<br/>
                            HR & Compliance Team
                        </p>
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

// 1. Daily Check: 10:00 AM (server time)
// Checks for "Yesterday's" logs
cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Running Daily Timesheet Check...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Format YYYY-MM-DD using local time components to avoid UTC shift issues
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    const targetDate = `${y}-${m}-${d}`;

    await checkAndNotifyMissingTimesheets(targetDate);
});

// 2. Weekly Compliance Check: Friday 5:00 PM (server time)
cron.schedule('0 17 * * 5', async () => {
    console.log('[CRON] Running Weekly Compliance Audit...');
    await checkAndNotifyWeeklyCompliance();
});

// --- API Router Definition ---
const apiRouter = express.Router();

// 1. CUSTOM ROUTES

// -- Timesheet Reminder Route (Manual Trigger - Daily) --
apiRouter.post('/notify/missing-timesheets', async (req, res) => {
    const { targetDate } = req.body; // Expects YYYY-MM-DD
    try {
        const result = await checkAndNotifyMissingTimesheets(targetDate);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- Weekly Compliance Trigger (Manual) --
apiRouter.post('/notify/weekly-compliance', async (req, res) => {
    try {
        const result = await checkAndNotifyWeeklyCompliance();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- Notification Routes --
// Mark All Notifications as Read for User
apiRouter.post('/notifications/mark-all-read', async (req, res) => {
    const { userId } = req.body;
    console.log(`[API] Marking ALL notifications read for user: ${userId}`);
    try {
        if (!pool) throw new Error('DB disconnected');
        await pool.request()
            .input('userId', userId)
            .query('UPDATE notifications SET [read] = 1 WHERE userId = @userId');
        res.json({ success: true });
    } catch (err) {
        console.error("[API] Notification Read All Error:", err.message);
        res.json({ success: true, mock: true }); 
    }
});

// Mark Single Notification as Read
apiRouter.post('/notifications/mark-read', async (req, res) => {
    const { id } = req.body;
    console.log(`[API] Marking single notification read: ${id}`);
    try {
        if (!pool) throw new Error('DB disconnected');
        await pool.request()
            .input('id', id)
            .query('UPDATE notifications SET [read] = 1 WHERE id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error("[API] Notification Read Error:", err.message);
        res.json({ success: true, mock: true });
    }
});

// -- Auth Routes --

apiRouter.post('/auth/forgot-password', async (req, res) => {
    console.log(`[API] Forgot Password Request for: ${req.body.email}`);
    try {
        const { email } = req.body;
        
        let user = null;
        if (pool) {
            const result = await pool.request()
                .input('email', sql.NVarChar, email)
                .query('SELECT id, firstName FROM employees WHERE email = @email');
            user = result.recordset[0];
        } else {
            console.warn("[API] DB not connected, using mock user for forgot-password");
            user = { id: 1, firstName: 'User' }; 
        }

        if (!user) {
            return res.status(404).json({ message: `User not found`, status: "error" });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 60 * 60 * 1000); 

        if (pool) {
            try {
                await pool.request()
                    .input('token', sql.NVarChar, resetToken)
                    .input('expiry', sql.DateTime, expiry)
                    .input('id', user.id)
                    .query('UPDATE employees SET ResetToken = @token, ResetTokenExpiry = @expiry WHERE id = @id');
            } catch (dbErr) { 
                console.warn("DB Update Failed (Columns might be missing).", dbErr.message); 
            }
        }

        const frontendUrl = req.headers.origin || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
        
        const body = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #0f766e;">Password Reset</h2>
                <p>Hello ${user.firstName},</p>
                <p>We received a request to reset your password. Click the link below to create a new password:</p>
                <p>
                    <a href="${resetLink}" style="background-color: #0f766e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                </p>
            </div>
        `;

        await sendEmailAsync(email, "Reset Your Password - EmpowerCorp", body);
        res.json({ message: `Reset link sent to ${email}`, status: "success" });

    } catch (err) {
        console.error("[API] Forgot Password Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

apiRouter.post('/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ message: "Token and password are required.", status: "error" });

        if (pool) {
            const result = await pool.request()
                .input('token', sql.NVarChar, token)
                .query('SELECT id FROM employees WHERE ResetToken = @token AND ResetTokenExpiry > GETDATE()');
            
            const user = result.recordset[0];
            if (!user) return res.status(400).json({ message: "Invalid or expired reset token.", status: "error" });

            await pool.request()
                .input('password', sql.NVarChar, newPassword)
                .input('id', user.id)
                .query('UPDATE employees SET password = @password, ResetToken = NULL, ResetTokenExpiry = NULL WHERE id = @id');
            
            res.json({ message: "Password updated successfully. Please login.", status: "success" });
        } else {
            if (token === 'mock-token') return res.status(400).json({ message: "Invalid token (mock)", status: "error" });
            res.json({ message: "Password updated successfully (Mock).", status: "success" });
        }
    } catch (err) {
        console.error("[API] Reset Password Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// -- Notification System Routes --
apiRouter.post('/notify/leave-request', async (req, res) => { res.json({ success: true }); });
apiRouter.post('/notify/leave-status', async (req, res) => { res.json({ success: true }); });
apiRouter.post('/notify/project-assignment', async (req, res) => { res.json({ success: true }); });

// 2. REGISTER GENERIC CRUD ROUTES (Fallbacks)
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

// Mount API Router
app.use('/api', apiRouter);

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Routes registered. Cron jobs active (Daily + Weekly).`);
});