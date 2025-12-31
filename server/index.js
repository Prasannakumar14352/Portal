
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

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Access Logger
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
        console.log(`✅ [DB SUCCESS] Connected to ${dbConfig.database}`);
        await initDb();
    } catch (err) {
        console.error('❌ [DB ERROR] CONNECTION FAILED:', err.message);
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
            { name: 'departments', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='departments' AND xtype='U') CREATE TABLE departments (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(255), description NVARCHAR(MAX), managerId NVARCHAR(50))` },
            { name: 'projects', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='projects' AND xtype='U') CREATE TABLE projects (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(255), description NVARCHAR(MAX), status NVARCHAR(50), tasks NVARCHAR(MAX), dueDate NVARCHAR(50))` },
            { name: 'leaves', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leaves' AND xtype='U') CREATE TABLE leaves (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(255), type NVARCHAR(100), startDate NVARCHAR(50), endDate NVARCHAR(50), durationType NVARCHAR(50), reason NVARCHAR(MAX), status NVARCHAR(50), approverId NVARCHAR(50), isUrgent BIT, managerComment NVARCHAR(MAX), notifyUserIds NVARCHAR(MAX))` },
            { name: 'attendance', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='attendance' AND xtype='U') CREATE TABLE attendance (id NVARCHAR(50) PRIMARY KEY, employeeId NVARCHAR(50), employeeName NVARCHAR(255), date NVARCHAR(50), checkIn NVARCHAR(50), checkOut NVARCHAR(50), checkInTime NVARCHAR(100), checkOutTime NVARCHAR(100), status NVARCHAR(50), notes NVARCHAR(MAX), workLocation NVARCHAR(100))` },
            { name: 'notifications', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U') CREATE TABLE notifications (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), title NVARCHAR(255), message NVARCHAR(MAX), time NVARCHAR(100), [read] BIT, type NVARCHAR(50))` },
            { name: 'invitations', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='invitations' AND xtype='U') CREATE TABLE invitations (id NVARCHAR(50) PRIMARY KEY, email NVARCHAR(255), firstName NVARCHAR(100), lastName NVARCHAR(100), role NVARCHAR(100), position NVARCHAR(100), department NVARCHAR(100), salary FLOAT, invitedDate NVARCHAR(50), token NVARCHAR(100), provisionInAzure BIT)` }
        ];
        for (const table of tables) {
            await request.query(table.query);
        }
        await request.query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('leaves') AND name = 'notifyUserIds') ALTER TABLE leaves ADD notifyUserIds NVARCHAR(MAX)`);
        console.log("✅ [DB INIT] All tables verified");
    } catch (err) { console.error("❌ [DB INIT ERROR]:", err.message); }
};

const apiRouter = express.Router();

// --- ATTENDANCE ROUTES ---
apiRouter.get('/attendance', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM attendance");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/attendance', async (req, res) => {
    try {
        const a = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(a.id));
        request.input('employeeId', sql.NVarChar, toStr(a.employeeId));
        request.input('employeeName', sql.NVarChar, toStr(a.employeeName));
        request.input('date', sql.NVarChar, toStr(a.date));
        request.input('checkIn', sql.NVarChar, toStr(a.checkIn));
        request.input('checkOut', sql.NVarChar, toStr(a.checkOut));
        request.input('checkInTime', sql.NVarChar, toStr(a.checkInTime));
        request.input('checkOutTime', sql.NVarChar, toStr(a.checkOutTime));
        request.input('status', sql.NVarChar, toStr(a.status));
        request.input('notes', sql.NVarChar, toStr(a.notes));
        request.input('workLocation', sql.NVarChar, toStr(a.workLocation));
        
        await request.query(`INSERT INTO attendance (id, employeeId, employeeName, date, checkIn, checkOut, checkInTime, checkOutTime, status, notes, workLocation) 
                             VALUES (@id, @employeeId, @employeeName, @date, @checkIn, @checkOut, @checkInTime, @checkOutTime, @status, @notes, @workLocation)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/attendance/:id', async (req, res) => {
    try {
        const a = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        request.input('checkOut', sql.NVarChar, toStr(a.checkOut));
        request.input('checkOutTime', sql.NVarChar, toStr(a.checkOutTime));
        request.input('status', sql.NVarChar, toStr(a.status));
        request.input('notes', sql.NVarChar, toStr(a.notes));
        
        await request.query(`UPDATE attendance SET checkOut=@checkOut, checkOutTime=@checkOutTime, status=@status, notes=@notes WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/attendance/:id', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        await request.query(`DELETE FROM attendance WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- LEAVE ROUTES ---
apiRouter.get('/leaves', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM leaves");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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
        request.input('status', sql.NVarChar, toStr(l.status));
        request.input('managerComment', sql.NVarChar, toStr(l.managerComment));
        await request.query(`UPDATE leaves SET status=@status, managerComment=@managerComment WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/leaves/:id', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        await request.query(`DELETE FROM leaves WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NOTIFICATION ROUTES ---
apiRouter.get('/notifications', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM notifications");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/notifications', async (req, res) => {
    try {
        const n = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(n.id));
        request.input('userId', sql.NVarChar, toStr(n.userId));
        request.input('title', sql.NVarChar, toStr(n.title));
        request.input('message', sql.NVarChar, toStr(n.message));
        request.input('time', sql.NVarChar, toStr(n.time));
        request.input('read', sql.Bit, toBit(n.read));
        request.input('type', sql.NVarChar, toStr(n.type));
        
        await request.query(`INSERT INTO notifications (id, userId, title, message, time, [read], type) VALUES (@id, @userId, @title, @message, @time, @read, @type)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/notifications/:id/read', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        await request.query(`UPDATE notifications SET [read]=1 WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/notifications/read-all/:userId', async (req, res) => {
    try {
        const request = pool.request();
        request.input('userId', sql.NVarChar, req.params.userId);
        await request.query(`UPDATE notifications SET [read]=1 WHERE userId=@userId`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NOTIFY (EMAIL) ENDPOINTS ---
apiRouter.post('/notify/leave-request', async (req, res) => {
    try {
        const { to, cc, employeeName, type, startDate, endDate, reason, isUpdate, isWithdrawal } = req.body;
        const subject = `${isWithdrawal ? 'Withdrawn' : isUpdate ? 'Updated' : 'New'} Leave: ${employeeName}`;
        await transporter.sendMail({
            from: `"EmpowerCorp HR" <${SMTP_USER}>`,
            to, cc, subject,
            html: `<p><strong>${employeeName}</strong> has ${isWithdrawal ? 'withdrawn' : 'submitted/updated'} a <strong>${type}</strong> request.</p><p>Dates: ${startDate} to ${endDate}</p><p>Reason: ${reason}</p>`
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/notify/leave-status', async (req, res) => {
    try {
        const { to, employeeName, status, type, managerComment } = req.body;
        await transporter.sendMail({
            from: `"EmpowerCorp HR" <${SMTP_USER}>`,
            to, subject: `Leave Status: ${status}`,
            html: `<p>The request for <strong>${employeeName}</strong> (${type}) is <strong>${status}</strong>.</p>${managerComment ? `<p>Comment: ${managerComment}</p>` : ''}`
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Generic routes for other entities
const setupSimpleCrud = (route, table) => {
    apiRouter.get(`/${route}`, async (req, res) => {
        try { const r = await pool.request().query(`SELECT * FROM ${table}`); res.json(r.recordset); } 
        catch (err) { res.status(500).json({ error: err.message }); }
    });
    apiRouter.delete(`/${route}/:id`, async (req, res) => {
        try { const r = pool.request(); r.input('id', sql.NVarChar, req.params.id); await r.query(`DELETE FROM ${table} WHERE id=@id`); res.json({ success: true }); } 
        catch (err) { res.status(500).json({ error: err.message }); }
    });
};

setupSimpleCrud('employees', 'employees');
setupSimpleCrud('departments', 'departments');
setupSimpleCrud('projects', 'projects');
setupSimpleCrud('invitations', 'invitations');

app.use('/api', apiRouter);
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` }));

app.listen(PORT, async () => {
    console.log(`🚀 [BACKEND] Running on http://localhost:${PORT}`);
    await connectDb();
});
