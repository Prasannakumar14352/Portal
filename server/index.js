
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
            { name: 'leaves', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leaves' AND xtype='U') CREATE TABLE leaves (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(255), type NVARCHAR(100), startDate NVARCHAR(50), endDate NVARCHAR(50), durationType NVARCHAR(50), reason NVARCHAR(MAX), status NVARCHAR(50), approverId NVARCHAR(50), isUrgent BIT, managerComment NVARCHAR(MAX), notifyUserIds NVARCHAR(MAX))` },
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

// Improved setupCrud with POST and PUT support
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

    apiRouter.post(`/${route}`, async (req, res) => {
        try {
            const data = req.body;
            const request = pool.request();
            const keys = Object.keys(data);
            keys.forEach(k => {
                let val = data[k];
                if (typeof val === 'object') val = JSON.stringify(val);
                request.input(k, val);
            });
            const cols = keys.join(', ');
            const params = keys.map(k => `@${k}`).join(', ');
            await request.query(`INSERT INTO ${table} (${cols}) VALUES (${params})`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    apiRouter.put(`/${route}/:id`, async (req, res) => {
        try {
            const data = req.body;
            const request = pool.request();
            request.input('id', req.params.id);
            const sets = Object.keys(data).filter(k => k !== 'id').map(k => {
                let val = data[k];
                if (typeof val === 'object') val = JSON.stringify(val);
                request.input(k, val);
                return `${k}=@${k}`;
            }).join(', ');
            await request.query(`UPDATE ${table} SET ${sets} WHERE id=@id`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    apiRouter.delete(`/${route}/:id`, async (req, res) => {
        try {
            const request = pool.request();
            request.input('id', sql.NVarChar, req.params.id);
            await request.query(`DELETE FROM ${table} WHERE id=@id`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
};

// --- EMPLOYEES (Custom for Project List JSON) ---
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
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- LEAVES (Explicit handling for BIT and JSON) ---
apiRouter.post('/leaves', async (req, res) => {
    try {
        const l = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(l.id));
        request.input('userId', sql.NVarChar, toStr(l.userId));
        request.input('userName', sql.NVarChar, toStr(l.userName));
        request.input('type', sql.NVarChar, toStr(l.type));
        request.input('startDate', sql.NVarChar, toStr(l.startDate));
        request.input('endDate', sql.NVarChar, toStr(l.endDate));
        request.input('durationType', sql.NVarChar, toStr(l.durationType));
        request.input('reason', sql.NVarChar, toStr(l.reason));
        request.input('status', sql.NVarChar, toStr(l.status));
        request.input('approverId', sql.NVarChar, toStr(l.approverId));
        request.input('isUrgent', sql.Bit, toBit(l.isUrgent));
        request.input('notifyUserIds', sql.NVarChar, JSON.stringify(l.notifyUserIds || []));
        request.input('managerComment', sql.NVarChar, toStr(l.managerComment));
        
        await request.query(`INSERT INTO leaves (id, userId, userName, type, startDate, endDate, durationType, reason, status, approverId, isUrgent, notifyUserIds, managerComment) 
                             VALUES (@id, @userId, @userName, @type, @startDate, @endDate, @durationType, @reason, @status, @approverId, @isUrgent, @notifyUserIds, @managerComment)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/leaves/:id', async (req, res) => {
    try {
        const l = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        request.input('type', sql.NVarChar, toStr(l.type));
        request.input('startDate', sql.NVarChar, toStr(l.startDate));
        request.input('endDate', sql.NVarChar, toStr(l.endDate));
        request.input('durationType', sql.NVarChar, toStr(l.durationType));
        request.input('reason', sql.NVarChar, toStr(l.reason));
        request.input('status', sql.NVarChar, toStr(l.status));
        request.input('approverId', sql.NVarChar, toStr(l.approverId));
        request.input('isUrgent', sql.Bit, toBit(l.isUrgent));
        request.input('notifyUserIds', sql.NVarChar, JSON.stringify(l.notifyUserIds || []));
        request.input('managerComment', sql.NVarChar, toStr(l.managerComment));
        
        await request.query(`UPDATE leaves SET type=@type, startDate=@startDate, endDate=@endDate, durationType=@durationType, reason=@reason, status=@status, approverId=@approverId, isUrgent=@isUrgent, notifyUserIds=@notifyUserIds, managerComment=@managerComment WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NOTIFY ENDPOINTS ---
apiRouter.post('/notify/leave-request', async (req, res) => {
    try {
        const { to, cc, employeeName, type, startDate, endDate, reason, isUpdate, isWithdrawal } = req.body;
        let subjectPrefix = "New Leave Request";
        let statusTitle = "New Leave Request Submitted";
        let statusColor = "#0d9488";
        if (isWithdrawal) {
            subjectPrefix = "Leave Request Withdrawn";
            statusTitle = "Leave Request Withdrawn by Employee";
            statusColor = "#94a3b8";
        } else if (isUpdate) {
            subjectPrefix = "Updated Leave Request";
            statusTitle = "Leave Request Details Modified";
            statusColor = "#2563eb";
        }
        const mailOptions = {
            from: `"EmpowerCorp HR" <${SMTP_USER}>`,
            to: to, cc: cc, subject: `${subjectPrefix}: ${employeeName} - ${type}`,
            html: `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: ${statusColor};">${statusTitle}</h2>
                    <p><strong>Employee:</strong> ${employeeName}</p><p><strong>Type:</strong> ${type}</p><p><strong>Period:</strong> ${startDate} to ${endDate}</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid ${statusColor}; margin: 20px 0;"><p style="margin: 0; color: #334155;"><strong>Reason:</strong> ${reason}</p></div>
                    <p>${isWithdrawal ? 'No further action is required.' : 'Please review this request in the HR Portal.'}</p></div>`
        };
        await transporter.sendMail(mailOptions);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/notify/leave-status', async (req, res) => {
    try {
        const { to, employeeName, status, type, managerComment, hrAction } = req.body;
        const mailOptions = {
            from: `"EmpowerCorp HR" <${SMTP_USER}>`,
            to: to, subject: `Leave Request Update: ${employeeName} - ${status}`,
            html: `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: ${status === 'Approved' ? '#059669' : '#dc2626'};">Leave Request ${status}</h2>
                    <p>Hello,</p><p>The leave request for <strong>${employeeName}</strong> (${type}) has been <strong>${status.toLowerCase()}</strong>${hrAction ? ' by HR' : ' by the manager'}.</p>
                    ${managerComment ? `<div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #94a3b8; margin: 20px 0;"><p style="margin: 0;"><strong>Comment:</strong> ${managerComment}</p></div>` : ''}
                    <p>Login to the portal for more details.</p></div>`
        };
        await transporter.sendMail(mailOptions);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/notify/project-assignment', async (req, res) => {
    try {
        const { email, firstName, projectName, projectDescription } = req.body;
        const mailOptions = {
            from: `"EmpowerCorp Projects" <${SMTP_USER}>`,
            to: email, subject: `New Project Assignment: ${projectName}`,
            html: `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #0f766e;">Project Assignment: ${projectName}</h2><p>Hello ${firstName},</p><p>You have been assigned to a new project: <strong>${projectName}</strong>.</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #0f766e; margin: 20px 0;"><p style="margin: 0; color: #334155;">${projectDescription || 'No description provided.'}</p></div>
                    <div style="text-align: center;"><a href="${req.headers.origin || 'http://localhost:5173'}/time-logs" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Project Tasks</a></div></div>`
        };
        await transporter.sendMail(mailOptions);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Setup rest of CRUD
setupCrud('departments', 'departments');
setupCrud('positions', 'positions');
setupCrud('roles', 'roles');
setupCrud('projects', 'projects', ['tasks']);
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
