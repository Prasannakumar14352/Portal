const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sql = require('mssql');
require('dotenv').config();
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increased limit for file uploads (PDFs)

// Database Configuration
const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'yourStrong(!)Password',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'EmpowerHR',
    options: {
        encrypt: true,
        trustServerCertificate: true // For local dev
    }
};

// Email Configuration
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER || process.env.GMAIL_USER || 'hr@empowercorp.com';
const rawPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || 'password';
const SMTP_PASS = rawPass.replace(/\s+/g, '');

console.log(`[Email Config] Host: ${SMTP_HOST}, User: ${SMTP_USER}`);

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

let isEmailServiceReady = false;
transporter.verify(function (error, success) {
    if (error) {
        console.warn('⚠️  WARNING: Email service connection failed.', error.message);
        isEmailServiceReady = false;
    } else {
        console.log('✅ Email server is ready to send messages');
        isEmailServiceReady = true;
    }
});

// Helper: Send Email Async (Matches C# Signature logic)
const sendEmailAsync = async (to, subject, htmlBody) => {
    if (process.env.MOCK_EMAIL === 'true' || !isEmailServiceReady) {
        console.log('---------------------------------------------------');
        console.log(`[MOCK EMAIL] To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('---------------------------------------------------');
        return;
    }
    
    try {
        await transporter.sendMail({
            from: `"EmpowerCorp HR" <${SMTP_USER}>`,
            to: to,
            subject: subject,
            html: htmlBody
        });
    } catch (ex) {
        console.error("Error occurred while sending email", ex);
        // We log but don't throw to prevent crashing the API response if email fails
    }
};

// Helper: Replace Placeholders (Matches C# Logic)
const replacePlaceholders = (template, model) => {
    let result = template;
    Object.keys(model).forEach(key => {
        const placeholder = `{{${key}}}`;
        const value = model[key] !== null && model[key] !== undefined ? model[key] : '';
        result = result.replace(new RegExp(placeholder, 'g'), value);
    });
    return result;
};

// Database Connection Pool
let pool;
const connectDb = async () => {
    try {
        pool = await sql.connect(dbConfig);
        console.log('Connected to MSSQL Database');
    } catch (err) {
        console.error('Database connection failed:', err);
    }
};
connectDb();

const apiRouter = express.Router();

// Helper for Standard CRUD Operations
const registerStandardRoutes = (route, tableName) => {
    // GET ALL
    apiRouter.get(`/${route}`, async (req, res) => {
        try {
            if (!pool) throw new Error('Database not connected');
            const result = await pool.request().query(`SELECT * FROM [${tableName}]`);
            res.json(result.recordset);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST (Create)
    apiRouter.post(`/${route}`, async (req, res) => {
        try {
            if (!pool) throw new Error('Database not connected');
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
            res.json({ success: true, ...data });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST BULK
    apiRouter.post(`/${route}/bulk`, async (req, res) => {
        try {
            if (!pool) throw new Error('Database not connected');
            const items = req.body;
            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                for (const data of items) {
                    const columns = Object.keys(data).map(k => `[${k}]`).join(', ');
                    const values = Object.values(data).map(val => {
                        if (val === null) return 'NULL';
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                        return val;
                    }).join(', ');
                    await new sql.Request(transaction).query(`INSERT INTO [${tableName}] (${columns}) VALUES (${values})`);
                }
                await transaction.commit();
                res.json({ success: true, count: items.length });
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PUT (Update)
    apiRouter.put(`/${route}/:id`, async (req, res) => {
        try {
            if (!pool) throw new Error('Database not connected');
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
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // DELETE
    apiRouter.delete(`/${route}/:id`, async (req, res) => {
        try {
            if (!pool) throw new Error('Database not connected');
            const { id } = req.params;
            const request = pool.request();
            request.input('id', id);
            await request.query(`DELETE FROM [${tableName}] WHERE id=@id`);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
};

// Map routes. Note: 'leaves' is excluded here to be handled manually for email logic.
const entities = [
    { route: 'employees', table: 'employees' },
    { route: 'departments', table: 'departments' },
    { route: 'positions', table: 'positions' },
    { route: 'roles', table: 'roles' },
    { route: 'projects', table: 'projects' },
    // { route: 'leaves', table: 'leaves' }, // Manually handled below
    { route: 'leave_types', table: 'leave_types' },
    { route: 'attendance', table: 'attendance' },
    { route: 'time_entries', table: 'time_entries' },
    { route: 'notifications', table: 'notifications' },
    { route: 'holidays', table: 'holidays' },
    { route: 'payslips', table: 'payslips' },
    { route: 'invitations', table: 'invitations' }
];

entities.forEach(e => registerStandardRoutes(e.route, e.table));

// --- Custom Leave Routes (With Email Logic) ---

// GET Leaves
apiRouter.get('/leaves', async (req, res) => {
    try {
        if (!pool) throw new Error('Database not connected');
        const result = await pool.request().query('SELECT * FROM [leaves]');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE Leaves
apiRouter.delete('/leaves/:id', async (req, res) => {
    try {
        if (!pool) throw new Error('Database not connected');
        const { id } = req.params;
        const request = pool.request();
        request.input('id', id);
        await request.query('DELETE FROM [leaves] WHERE id=@id');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST Leave (Create + Notify Approver)
apiRouter.post('/leaves', async (req, res) => {
    try {
        if (!pool) throw new Error('Database not connected');
        const data = req.body;
        
        // 1. Save Leave to DB
        const columns = Object.keys(data).map(k => `[${k}]`).join(', ');
        const paramNames = Object.keys(data).map((k, i) => `@p${i}`).join(', ');
        const request = pool.request();
        Object.keys(data).forEach((k, i) => {
            let val = data[k];
            if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
            request.input(`p${i}`, val);
        });
        await request.query(`INSERT INTO [leaves] (${columns}) VALUES (${paramNames})`);

        // 2. Send Email to Approver
        if (data.approverId) {
            try {
                // Fetch Approver Email
                const approverRes = await pool.request()
                    .input('id', data.approverId)
                    .query('SELECT email, firstName FROM employees WHERE id = @id');
                const approver = approverRes.recordset[0];

                if (approver && approver.email) {
                    const template = `
                        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                            <h3 style="color: #0f766e;">New Leave Request</h3>
                            <p>Hello {{ApproverName}},</p>
                            <p><strong>{{EmployeeName}}</strong> has submitted a new leave request.</p>
                            <ul>
                                <li><strong>Type:</strong> {{Type}}</li>
                                <li><strong>Period:</strong> {{StartDate}} to {{EndDate}}</li>
                                <li><strong>Reason:</strong> {{Reason}}</li>
                            </ul>
                            <p>Please log in to the HR Portal to approve or reject this request.</p>
                        </div>
                    `;
                    
                    const model = {
                        ApproverName: approver.firstName,
                        EmployeeName: data.userName,
                        Type: data.type,
                        StartDate: data.startDate,
                        EndDate: data.endDate,
                        Reason: data.reason
                    };

                    const body = replacePlaceholders(template, model);
                    await sendEmailAsync(approver.email, `Leave Request: ${data.userName}`, body);
                }
            } catch (emailErr) {
                console.error("Failed to send leave request email", emailErr);
            }
        }

        res.json({ success: true, ...data });
    } catch (err) {
        console.error("POST /leaves error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Leave (Update + Notify Status Change)
apiRouter.put('/leaves/:id', async (req, res) => {
    try {
        if (!pool) throw new Error('Database not connected');
        const { id } = req.params;
        const data = req.body;

        // 1. Update DB
        const keysToUpdate = Object.keys(data).filter(k => k !== 'id');
        const sets = keysToUpdate.map((k, i) => `[${k}]=@p${i}`).join(', ');
        const request = pool.request();
        request.input('id', id);
        keysToUpdate.forEach((k, i) => {
            let val = data[k];
            if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
            request.input(`p${i}`, val);
        });
        await request.query(`UPDATE [leaves] SET ${sets} WHERE id=@id`);

        // 2. Send Status Email to Employee if Status Changed
        if (data.status && (data.status === 'Approved' || data.status === 'Rejected')) {
            try {
                // We need userId to find email. If not in body, fetch from DB first (or from employeeId if legacy)
                let userId = data.userId;
                
                if (!userId) {
                    const leaveRes = await pool.request().input('lid', id).query('SELECT userId FROM leaves WHERE id = @lid');
                    userId = leaveRes.recordset[0]?.userId;
                }

                if (userId) {
                    const empRes = await pool.request().input('uid', userId).query('SELECT email, firstName FROM employees WHERE id = @uid');
                    const employee = empRes.recordset[0];

                    if (employee && employee.email) {
                        const isApproved = data.status === 'Approved';
                        const color = isApproved ? '#10b981' : '#ef4444';
                        
                        const template = `
                            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                                <h3 style="color: {{Color}};">Leave Request {{Status}}</h3>
                                <p>Hello {{EmployeeName}},</p>
                                <p>Your request for <strong>{{Type}}</strong> has been <strong>{{Status}}</strong>.</p>
                                {{CommentSection}}
                                <p style="margin-top: 20px;">Check the portal for details.</p>
                            </div>
                        `;

                        const commentBlock = data.managerComment ? 
                            `<div style="background-color: #f9fafb; padding: 10px; margin: 10px 0;"><strong>Comment:</strong> ${data.managerComment}</div>` : '';

                        const model = {
                            Color: color,
                            Status: data.status,
                            EmployeeName: employee.firstName,
                            Type: data.type || 'Leave',
                            CommentSection: commentBlock
                        };

                        const body = replacePlaceholders(template, model);
                        await sendEmailAsync(employee.email, `Leave Status Update: ${data.status}`, body);
                    }
                }
            } catch (emailErr) {
                console.error("Failed to send leave status email", emailErr);
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Forgot Password - Matches C# Logic structure
apiRouter.post('/auth/forgot-password', async (req, res) => {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        const { email } = req.body;
        
        let user = null;
        if (pool) {
            const result = await pool.request()
                .input('email', sql.NVarChar, email)
                .query('SELECT id, firstName, lastName FROM employees WHERE email = @email');
            user = result.recordset[0];
        } else {
            user = { id: 1, firstName: 'User', lastName: 'Name' }; // Mock
        }

        if (!user) {
            return res.status(400).json({ message: `No user associated with email: ${email}`, status: "error" });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 15 * 60000);

        if (pool) {
            try {
                await pool.request()
                    .input('token', sql.NVarChar, resetToken)
                    .input('expiry', sql.DateTime, expiry)
                    .input('id', user.id)
                    .query('UPDATE employees SET ResetToken = @token, ResetTokenExpiry = @expiry WHERE id = @id');
            } catch (dbErr) { console.warn("DB Update Failed (Columns might be missing). Proceeding."); }
        }

        const frontendUrl = req.headers.origin || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
        
        const body = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h3>Password Reset Request</h3>
                <p><strong>You requested a password reset.</strong></p>
                <p>Click the link: <a href="${resetLink}">Reset Password</a></p>
            </div>
        `;

        await sendEmailAsync(email, "Password Reset Request", body);
        return res.json({ message: `Password reset instructions sent to ${email}`, status: "success" });

    } catch (err) {
        res.status(500).json({ message: "An unexpected error occurred." });
    }
});

// Legacy Notify Routes (Kept for backward compatibility if needed, but logic moved to Leaves CRUD)
apiRouter.post('/notify/leave-request', async (req, res) => { res.json({ success: true }); });
apiRouter.post('/notify/leave-status', async (req, res) => { res.json({ success: true }); });

// Project Assignment Notification
apiRouter.post('/notify/project-assignment', async (req, res) => {
    try {
        const { email, name, projectName, managerName } = req.body;
        const body = `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc;">
                <h2 style="color: #0f766e;">Project Assignment</h2>
                <p>Hello <strong>${name}</strong>,</p>
                <p>You have been assigned to: <strong>${projectName}</strong></p>
                <p>Assigned by: ${managerName}</p>
            </div>
        `;
        await sendEmailAsync(email, `New Project Assignment: ${projectName}`, body);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api', apiRouter);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
