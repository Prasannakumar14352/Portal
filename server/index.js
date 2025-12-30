require('dotenv').config();
const path = require('path');
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

// Fallback: If running from server/ folder, try to load .env from root
if (!process.env.DB_NAME) {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

const app = express();
const PORT = process.env.PORT || 8000;

// --- SMTP CONFIGURATION ---
const SMTP_USER = process.env.GMAIL_USER || 'sprasannakris@gmail.com';
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: SMTP_USER,
        pass: process.env.GMAIL_APP_PASSWORD || 'izsf mcrs odmv jvib',
    },
});

// Verify SMTP connection on start
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ [SMTP] Connection failed:', error.message);
    } else {
        console.log('📧 [SMTP] Server is ready to deliver messages');
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Logging Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

const dbConfig = {
    user: process.env.DB_USER || 'DHLE',
    password: process.env.DB_PASSWORD || 'DHLE',
    server: process.env.DB_SERVER || 'isthydpc107', 
    database: process.env.DB_NAME || 'DHLEDB',
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
        encrypt: false, 
        trustServerCertificate: true, 
        enableArithAbort: true
    }
};

let pool;

const connectDb = async () => {
    try {
        pool = await sql.connect(dbConfig);
        console.log(`✅ [SQL] Connection successful.`);
        await initDb();
    } catch (err) {
        console.error('❌ [SQL] CONNECTION FAILED:', err.message);
    }
};

const toStr = (val) => val === null || val === undefined ? '' : String(val);
const toFloat = (val) => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };
const toBit = (val) => val ? 1 : 0;
const parseJSON = (str) => { try { return str ? JSON.parse(str) : null; } catch (e) { return null; } };

const initDb = async () => {
    try {
        const request = pool.request();
        const tables = [
            { name: 'employees', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='employees' AND xtype='U') CREATE TABLE employees (id NVARCHAR(50) PRIMARY KEY, employeeId NVARCHAR(50), firstName NVARCHAR(100), lastName NVARCHAR(100), email NVARCHAR(255), password NVARCHAR(255), role NVARCHAR(100), position NVARCHAR(100), department NVARCHAR(100), departmentId NVARCHAR(50), projectIds NVARCHAR(MAX), joinDate NVARCHAR(50), status NVARCHAR(50), salary FLOAT, avatar NVARCHAR(MAX), managerId NVARCHAR(50), phone NVARCHAR(50), workLocation NVARCHAR(100), jobTitle NVARCHAR(100))` },
            { name: 'invitations', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='invitations' AND xtype='U') CREATE TABLE invitations (id NVARCHAR(50) PRIMARY KEY, email NVARCHAR(255), firstName NVARCHAR(100), lastName NVARCHAR(100), role NVARCHAR(100), position NVARCHAR(100), department NVARCHAR(100), salary FLOAT, invitedDate NVARCHAR(50), token NVARCHAR(100), provisionInAzure BIT)` },
            { name: 'notifications', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U') CREATE TABLE notifications (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), title NVARCHAR(255), message NVARCHAR(MAX), time NVARCHAR(100), [read] BIT, type NVARCHAR(50))` }
        ];
        for (const table of tables) await request.query(table.query);
        console.log("✅ [DB] Tables verified.");
    } catch (err) { console.error("❌ [DB] Initialization FAILED:", err.message); }
};

const apiRouter = express.Router();

// --- INVITATIONS ---
apiRouter.get('/invitations', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM invitations");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/invitations', async (req, res) => {
    try {
        const i = req.body;
        const request = pool.request();
        
        request.input('id', sql.NVarChar, toStr(i.id));
        request.input('email', sql.NVarChar, toStr(i.email));
        request.input('firstName', sql.NVarChar, toStr(i.firstName));
        request.input('lastName', sql.NVarChar, toStr(i.lastName));
        request.input('role', sql.NVarChar, toStr(i.role));
        request.input('position', sql.NVarChar, toStr(i.position));
        request.input('department', sql.NVarChar, toStr(i.department));
        request.input('salary', sql.Float, toFloat(i.salary));
        request.input('invitedDate', sql.NVarChar, toStr(i.invitedDate));
        request.input('token', sql.NVarChar, toStr(i.token));
        request.input('provisionInAzure', sql.Bit, toBit(i.provisionInAzure));
        
        await request.query(`INSERT INTO invitations (id, email, firstName, lastName, role, position, department, salary, invitedDate, token, provisionInAzure) 
                             VALUES (@id, @email, @firstName, @lastName, @role, @position, @department, @salary, @invitedDate, @token, @provisionInAzure)`);

        const acceptLink = `${req.headers.origin || 'http://localhost:5173'}/accept-invite?token=${i.token}`;
        
        const mailOptions = {
            from: `"EmpowerCorp HR" <${SMTP_USER}>`,
            to: i.email,
            subject: `Invitation to join EmpowerCorp HR Portal`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #0d9488;">Welcome to the Team, ${i.firstName}!</h2>
                    <p>You have been invited to join the EmpowerCorp HR Portal as a <strong>${i.role}</strong> (${i.position}).</p>
                    <p>Please click the button below to complete your registration and set up your account:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${acceptLink}" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Accept Invitation</a>
                    </div>
                    <p style="color: #64748b; font-size: 12px;">If the button doesn't work, copy and paste this link: <br/> ${acceptLink}</p>
                    <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
                    <p style="font-size: 11px; color: #94a3b8;">&copy; 2025 EmpowerCorp HR Solutions</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ [EMAIL] Invitation sent to ${i.email}`);

        res.json({ success: true, message: 'Invitation saved and email sent.' });
    } catch (err) { 
        console.error('❌ [INVITE ERROR]:', err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// --- PROJECT ASSIGNMENT EMAIL ---
apiRouter.post('/notify/project-assignment', async (req, res) => {
    try {
        const { email, firstName, projectName, projectDescription } = req.body;
        console.log(`📩 [EMAIL REQUEST] Sending assignment for project "${projectName}" to "${email}"`);
        
        const mailOptions = {
            from: `"EmpowerCorp Projects" <${SMTP_USER}>`,
            to: email,
            subject: `New Project Assignment: ${projectName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #0f766e;">Project Assignment: ${projectName}</h2>
                    <p>Hello ${firstName},</p>
                    <p>You have been officially assigned to a new project: <strong>${projectName}</strong>.</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #0f766e; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; font-size: 14px; color: #334155;">${projectDescription || 'No description provided.'}</p>
                    </div>
                    <p>Log in to the portal to view the project details and start logging your time.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${req.headers.origin || 'http://localhost:5173'}/time-logs" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Go to Time Logs</a>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
                    <p style="font-size: 11px; color: #94a3b8;">&copy; 2025 EmpowerCorp Project Management</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ [EMAIL SUCCESS] Sent to ${email}. ID: ${info.messageId}`);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ [EMAIL ERROR]:', err.message);
        res.status(500).json({ error: 'Failed to send assignment email: ' + err.message });
    }
});

apiRouter.delete('/invitations/:id', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        await request.query(`DELETE FROM invitations WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- EMPLOYEES ---
apiRouter.get('/employees', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM employees");
        res.json(result.recordset.map(e => ({ ...e, projectIds: parseJSON(e.projectIds) || [] })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/employees', async (req, res) => {
    try {
        const e = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(e.id));
        request.input('email', sql.NVarChar, toStr(e.email));
        request.input('firstName', sql.NVarChar, toStr(e.firstName));
        request.input('lastName', sql.NVarChar, toStr(e.lastName));
        request.input('password', sql.NVarChar, toStr(e.password));
        request.input('role', sql.NVarChar, toStr(e.role));
        request.input('position', sql.NVarChar, toStr(e.position));
        request.input('department', sql.NVarChar, toStr(e.department));
        request.input('status', sql.NVarChar, toStr(e.status));
        request.input('joinDate', sql.NVarChar, toStr(e.joinDate));
        request.input('salary', sql.Float, toFloat(e.salary));
        request.input('avatar', sql.NVarChar, toStr(e.avatar));
        request.input('employeeId', sql.NVarChar, toStr(e.employeeId));
        await request.query(`INSERT INTO employees (id, email, firstName, lastName, password, role, position, department, status, joinDate, salary, avatar, employeeId) VALUES (@id, @email, @firstName, @lastName, @password, @role, @position, @department, @status, @joinDate, @salary, @avatar, @employeeId)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mount the router on /api
app.use('/api', apiRouter);

// Catch-all for 404s
app.use((req, res) => {
    console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found on this server.` });
});

app.listen(PORT, async () => {
    console.log(`🚀 [BACKEND] API running on http://localhost:${PORT}`);
    await connectDb();
});