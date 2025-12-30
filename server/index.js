
require('dotenv').config();
const path = require('path');
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

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
    secure: false,
    auth: {
        user: SMTP_USER,
        pass: process.env.GMAIL_APP_PASSWORD || 'izsf mcrs odmv jvib',
    },
});

transporter.verify((error) => {
    if (error) console.error('❌ [SMTP ERROR] Connection failed:', error.message);
    else console.log('📧 [SMTP SUCCESS] Mail server is connected and ready');
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Enhanced Access Logger
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusColor = res.statusCode >= 400 ? '❌' : '✅';
        console.log(`${statusColor} [${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
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
        console.log(`✅ [DB SUCCESS] Connected to ${dbConfig.database}`);
        await initDb();
    } catch (err) {
        console.error('❌ [DB ERROR] CONNECTION FAILED:', err.message);
    }
};

const toStr = (val) => val === null || val === undefined ? '' : String(val);
const toFloat = (val) => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };
const toInt = (val) => { const n = parseInt(val); return isNaN(n) ? 0 : n; };
const toBit = (val) => val ? 1 : 0;
const parseJSON = (str) => { try { return str ? JSON.parse(str) : null; } catch (e) { return null; } };

const initDb = async () => {
    try {
        const request = pool.request();
        const tables = [
            { name: 'employees', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='employees' AND xtype='U') CREATE TABLE employees (id NVARCHAR(50) PRIMARY KEY, employeeId NVARCHAR(50), firstName NVARCHAR(100), lastName NVARCHAR(100), email NVARCHAR(255), password NVARCHAR(255), role NVARCHAR(100), position NVARCHAR(100), department NVARCHAR(100), departmentId NVARCHAR(50), projectIds NVARCHAR(MAX), joinDate NVARCHAR(50), status NVARCHAR(50), salary FLOAT, avatar NVARCHAR(MAX), managerId NVARCHAR(50), phone NVARCHAR(50), workLocation NVARCHAR(100), jobTitle NVARCHAR(100))` },
            { name: 'departments', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='departments' AND xtype='U') CREATE TABLE departments (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(255), description NVARCHAR(MAX), managerId NVARCHAR(50))` },
            { name: 'positions', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='positions' AND xtype='U') CREATE TABLE positions (id NVARCHAR(50) PRIMARY KEY, title NVARCHAR(255), description NVARCHAR(MAX))` },
            { name: 'roles', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U') CREATE TABLE roles (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(255), description NVARCHAR(MAX))` },
            { name: 'projects', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='projects' AND xtype='U') CREATE TABLE projects (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(255), description NVARCHAR(MAX), status NVARCHAR(50), tasks NVARCHAR(MAX), dueDate NVARCHAR(50))` },
            { name: 'leaves', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leaves' AND xtype='U') CREATE TABLE leaves (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(255), type NVARCHAR(100), startDate NVARCHAR(50), endDate NVARCHAR(50), durationType NVARCHAR(50), reason NVARCHAR(MAX), status NVARCHAR(50), approverId NVARCHAR(50), isUrgent BIT, managerComment NVARCHAR(MAX))` },
            { name: 'leave_types', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leave_types' AND xtype='U') CREATE TABLE leave_types (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), days INT, description NVARCHAR(MAX), isActive BIT, color NVARCHAR(50))` },
            { name: 'attendance', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='attendance' AND xtype='U') CREATE TABLE attendance (id NVARCHAR(50) PRIMARY KEY, employeeId NVARCHAR(50), employeeName NVARCHAR(255), date NVARCHAR(50), checkIn NVARCHAR(50), checkOut NVARCHAR(50), checkInTime NVARCHAR(100), checkOutTime NVARCHAR(100), status NVARCHAR(50), notes NVARCHAR(MAX), workLocation NVARCHAR(100))` },
            { name: 'time_entries', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='time_entries' AND xtype='U') CREATE TABLE time_entries (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), projectId NVARCHAR(50), task NVARCHAR(255), date NVARCHAR(50), durationMinutes INT, extraMinutes INT, description NVARCHAR(MAX), status NVARCHAR(50), isBillable BIT)` },
            { name: 'notifications', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U') CREATE TABLE notifications (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), title NVARCHAR(255), message NVARCHAR(MAX), time NVARCHAR(100), [read] BIT, type NVARCHAR(50))` },
            { name: 'holidays', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='holidays' AND xtype='U') CREATE TABLE holidays (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(255), date NVARCHAR(50), type NVARCHAR(50))` },
            { name: 'payslips', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='payslips' AND xtype='U') CREATE TABLE payslips (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(255), month NVARCHAR(50), amount FLOAT, currency NVARCHAR(10), status NVARCHAR(50), generatedDate NVARCHAR(50), fileData NVARCHAR(MAX), fileName NVARCHAR(255))` },
            { name: 'invitations', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='invitations' AND xtype='U') CREATE TABLE invitations (id NVARCHAR(50) PRIMARY KEY, email NVARCHAR(255), firstName NVARCHAR(100), lastName NVARCHAR(100), role NVARCHAR(100), position NVARCHAR(100), department NVARCHAR(100), salary FLOAT, invitedDate NVARCHAR(50), token NVARCHAR(100), provisionInAzure BIT)` }
        ];
        for (const table of tables) {
            await request.query(table.query);
        }
        console.log("✅ [DB INIT] All tables verified successfully");
    } catch (err) { console.error("❌ [DB INIT ERROR] Initialization FAILED:", err.message); }
};

const apiRouter = express.Router();

// Generic helper for tables
const setupCrud = (route, table, parseFields = []) => {
    apiRouter.get(`/${route}`, async (req, res) => {
        try {
            const result = await pool.request().query(`SELECT * FROM ${table}`);
            const data = result.recordset.map(row => {
                const item = { ...row };
                parseFields.forEach(f => { if(item[f]) item[f] = parseJSON(item[f]) || []; });
                return item;
            });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    apiRouter.delete(`/${route}/:id`, async (req, res) => {
        try {
            const request = pool.request();
            request.input('id', sql.NVarChar, req.params.id);
            await request.query(`DELETE FROM ${table} WHERE id=@id`);
            console.log(`🗑️ [DELETE SUCCESS] Removed record ${req.params.id} from ${table}`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
};

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
        request.input('employeeId', sql.NVarChar, toStr(e.employeeId));
        request.input('firstName', sql.NVarChar, toStr(e.firstName));
        request.input('lastName', sql.NVarChar, toStr(e.lastName));
        request.input('email', sql.NVarChar, toStr(e.email));
        request.input('password', sql.NVarChar, toStr(e.password));
        request.input('role', sql.NVarChar, toStr(e.role));
        request.input('position', sql.NVarChar, toStr(e.position));
        request.input('department', sql.NVarChar, toStr(e.department));
        request.input('departmentId', sql.NVarChar, toStr(e.departmentId));
        request.input('projectIds', sql.NVarChar, JSON.stringify(e.projectIds || []));
        request.input('joinDate', sql.NVarChar, toStr(e.joinDate));
        request.input('status', sql.NVarChar, toStr(e.status));
        request.input('salary', sql.Float, toFloat(e.salary));
        request.input('avatar', sql.NVarChar, toStr(e.avatar));
        request.input('managerId', sql.NVarChar, toStr(e.managerId));
        request.input('phone', sql.NVarChar, toStr(e.phone));
        request.input('workLocation', sql.NVarChar, toStr(e.workLocation));
        request.input('jobTitle', sql.NVarChar, toStr(e.jobTitle));
        
        await request.query(`INSERT INTO employees (id, employeeId, firstName, lastName, email, password, role, position, department, departmentId, projectIds, joinDate, status, salary, avatar, managerId, phone, workLocation, jobTitle) 
                             VALUES (@id, @employeeId, @firstName, @lastName, @email, @password, @role, @position, @department, @departmentId, @projectIds, @joinDate, @status, @salary, @avatar, @managerId, @phone, @workLocation, @jobTitle)`);
        console.log(`👤 [EMPLOYEE CREATED] ${e.firstName} ${e.lastName} (ID: ${e.employeeId})`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/employees/:id', async (req, res) => {
    try {
        const e = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        request.input('firstName', sql.NVarChar, toStr(e.firstName));
        request.input('lastName', sql.NVarChar, toStr(e.lastName));
        request.input('role', sql.NVarChar, toStr(e.role));
        request.input('position', sql.NVarChar, toStr(e.position));
        request.input('department', sql.NVarChar, toStr(e.department));
        request.input('departmentId', sql.NVarChar, toStr(e.departmentId));
        request.input('projectIds', sql.NVarChar, JSON.stringify(e.projectIds || []));
        request.input('status', sql.NVarChar, toStr(e.status));
        request.input('salary', sql.Float, toFloat(e.salary));
        request.input('avatar', sql.NVarChar, toStr(e.avatar));
        request.input('managerId', sql.NVarChar, toStr(e.managerId));
        request.input('phone', sql.NVarChar, toStr(e.phone));
        request.input('workLocation', sql.NVarChar, toStr(e.workLocation));
        request.input('jobTitle', sql.NVarChar, toStr(e.jobTitle));

        await request.query(`UPDATE employees SET firstName=@firstName, lastName=@lastName, role=@role, position=@position, department=@department, departmentId=@departmentId, projectIds=@projectIds, status=@status, salary=@salary, avatar=@avatar, managerId=@managerId, phone=@phone, workLocation=@workLocation, jobTitle=@jobTitle WHERE id=@id`);
        console.log(`📝 [EMPLOYEE UPDATED] ${e.firstName} ${e.lastName} (Project IDs: ${JSON.stringify(e.projectIds)})`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NOTIFY PROJECT ASSIGNMENT ---
apiRouter.post('/notify/project-assignment', async (req, res) => {
    try {
        const { email, firstName, projectName, projectDescription } = req.body;
        console.log(`📩 [EMAIL PROCESS] Attempting to notify ${email} for project "${projectName}"`);
        
        const mailOptions = {
            from: `"EmpowerCorp Projects" <${SMTP_USER}>`,
            to: email,
            subject: `New Project Assignment: ${projectName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #0f766e;">Project Assignment: ${projectName}</h2>
                    <p>Hello ${firstName},</p>
                    <p>You have been assigned to a new project: <strong>${projectName}</strong>.</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #0f766e; margin: 20px 0;">
                        <p style="margin: 0; color: #334155;">${projectDescription || 'No description provided.'}</p>
                    </div>
                    <div style="text-align: center;">
                        <a href="${req.headers.origin || 'http://localhost:5173'}/time-logs" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Project Tasks</a>
                    </div>
                </div>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ [EMAIL SUCCESS] Successfully sent to ${email} (MessageID: ${info.messageId})`);
        res.json({ success: true, messageId: info.messageId });
    } catch (err) { 
        console.error(`❌ [EMAIL ERROR] Failed to send to ${req.body.email}:`, err.message);
        res.status(500).json({ error: 'Mail delivery failed: ' + err.message }); 
    }
});

// --- LEAVE NOTIFICATIONS ---
apiRouter.post('/notify/leave-request', async (req, res) => {
    try {
        const { to, cc, employeeName, type, startDate, endDate, reason } = req.body;
        console.log(`📩 [LEAVE REQ] Notifying ${to} (CC: ${cc}) about ${employeeName}'s leave`);

        const mailOptions = {
            from: `"EmpowerCorp HR" <${SMTP_USER}>`,
            to: to,
            cc: cc,
            subject: `Leave Request: ${employeeName} - ${type}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #0d9488;">New Leave Request</h2>
                    <p><strong>Employee:</strong> ${employeeName}</p>
                    <p><strong>Type:</strong> ${type}</p>
                    <p><strong>Period:</strong> ${startDate} to ${endDate}</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #0d9488; margin: 20px 0;">
                        <p style="margin: 0; color: #334155;"><strong>Reason:</strong> ${reason}</p>
                    </div>
                    <p>Please review this request in the HR Portal.</p>
                </div>`
        };

        const info = await transporter.sendMail(mailOptions);
        res.json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error(`❌ [LEAVE REQ ERROR]:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

apiRouter.post('/notify/leave-status', async (req, res) => {
    try {
        const { to, employeeName, status, type, managerComment, hrAction } = req.body;
        console.log(`📩 [LEAVE STATUS] Notifying ${to} about ${employeeName}'s leave status: ${status}`);

        const mailOptions = {
            from: `"EmpowerCorp HR" <${SMTP_USER}>`,
            to: to,
            subject: `Leave Request Update: ${employeeName} - ${status}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: ${status === 'Approved' ? '#059669' : '#dc2626'};">Leave Request ${status}</h2>
                    <p>Hello,</p>
                    <p>The leave request for <strong>${employeeName}</strong> (${type}) has been <strong>${status.toLowerCase()}</strong>${hrAction ? ' by HR' : ' by the manager'}.</p>
                    ${managerComment ? `<div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #94a3b8; margin: 20px 0;"><p style="margin: 0;"><strong>Comment:</strong> ${managerComment}</p></div>` : ''}
                    <p>Login to the portal for more details.</p>
                </div>`
        };

        const info = await transporter.sendMail(mailOptions);
        res.json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error(`❌ [LEAVE STATUS ERROR]:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- DEPARTMENTS ---
apiRouter.get('/departments', async (req, res) => { try { const r = await pool.request().query("SELECT * FROM departments"); res.json(r.recordset); } catch (err) { res.status(500).json({ error: err.message }); } });
apiRouter.post('/departments', async (req, res) => { try { const d = req.body; const r = pool.request(); r.input('id', sql.NVarChar, toStr(d.id)); r.input('name', sql.NVarChar, toStr(d.name)); r.input('description', sql.NVarChar, toStr(d.description)); r.input('managerId', sql.NVarChar, toStr(d.managerId)); await r.query(`INSERT INTO departments (id, name, description, managerId) VALUES (@id, @name, @description, @managerId)`); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
setupCrud('positions', 'positions');
setupCrud('roles', 'roles');
apiRouter.get('/projects', async (req, res) => { try { const r = await pool.request().query("SELECT * FROM projects"); res.json(r.recordset.map(p => ({ ...p, tasks: parseJSON(p.tasks) || [] }))); } catch (err) { res.status(500).json({ error: err.message }); } });
apiRouter.post('/projects', async (req, res) => { try { const p = req.body; const r = pool.request(); r.input('id', sql.NVarChar, toStr(p.id)); r.input('name', sql.NVarChar, toStr(p.name)); r.input('description', sql.NVarChar, toStr(p.description)); r.input('status', sql.NVarChar, toStr(p.status)); r.input('tasks', sql.NVarChar, JSON.stringify(p.tasks || [])); r.input('dueDate', sql.NVarChar, toStr(p.dueDate)); await r.query(`INSERT INTO projects (id, name, description, status, tasks, dueDate) VALUES (@id, @name, @description, @status, @tasks, @dueDate)`); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
setupCrud('leaves', 'leaves');
setupCrud('leave_types', 'leave_types');
setupCrud('attendance', 'attendance');
setupCrud('time_entries', 'time_entries');
setupCrud('notifications', 'notifications');
setupCrud('holidays', 'holidays');
setupCrud('payslips', 'payslips');
setupCrud('invitations', 'invitations');

app.use('/api', apiRouter);
app.use((req, res) => { res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` }); });
app.listen(PORT, async () => {
    console.log(`🚀 [BACKEND STARTED] Server running on http://localhost:${PORT}`);
    await connectDb();
});
