
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
        const statusIcon = res.statusCode >= 400 ? '❌' : '✅';
        console.log(`${statusIcon} [${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
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
const toBit = (val) => val ? 1 : 0;

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
        await request.query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('leaves') AND name = 'notifyUserIds') ALTER TABLE leaves ADD notifyUserIds NVARCHAR(MAX)`);
        console.log("✅ [DB INIT] All tables verified");
    } catch (err) { console.error("❌ [DB INIT ERROR]:", err.message); }
};

const apiRouter = express.Router();

const registerStandardRoutes = (endpoint, table) => {
    // GET ALL
    apiRouter.get(`/${endpoint}`, async (req, res) => {
        try {
            const result = await pool.request().query(`SELECT * FROM ${table}`);
            res.json(result.recordset);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // POST NEW
    apiRouter.post(`/${endpoint}`, async (req, res) => {
        try {
            const data = req.body;
            const request = pool.request();
            const columns = Object.keys(data);
            columns.forEach(col => {
                let val = data[col];
                if (Array.isArray(val) || (typeof val === 'object' && val !== null)) val = JSON.stringify(val);
                request.input(col, val);
            });
            // Wrap column names in brackets to handle reserved keywords like 'read'
            const colList = columns.map(c => `[${c}]`).join(', ');
            const paramList = columns.map(c => `@${c}`).join(', ');
            const query = `INSERT INTO ${table} (${colList}) VALUES (${paramList})`;
            await request.query(query);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // PUT UPDATE
    apiRouter.put(`/${endpoint}/:id`, async (req, res) => {
        try {
            const data = req.body;
            const request = pool.request();
            request.input('id', req.params.id);
            // Wrap column names in brackets to handle reserved keywords like 'read'
            const sets = Object.keys(data).filter(k => k !== 'id').map(k => {
                let val = data[k];
                if (Array.isArray(val) || (typeof val === 'object' && val !== null)) val = JSON.stringify(val);
                request.input(k, val);
                return `[${k}]=@${k}`;
            }).join(', ');
            await request.query(`UPDATE ${table} SET ${sets} WHERE id=@id`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // DELETE
    apiRouter.delete(`/${endpoint}/:id`, async (req, res) => {
        try {
            const request = pool.request();
            request.input('id', req.params.id);
            await request.query(`DELETE FROM ${table} WHERE id=@id`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
};

// Register all endpoints systematically
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

// Special Routes
apiRouter.put('/notifications/:id/read', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', req.params.id);
        await request.query(`UPDATE notifications SET [read]=1 WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/notifications/read-all/:userId', async (req, res) => {
    try {
        const request = pool.request();
        request.input('userId', req.params.userId);
        await request.query(`UPDATE notifications SET [read]=1 WHERE userId=@userId`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/notify/leave-request', async (req, res) => {
    try {
        const { to, cc, employeeName, type, startDate, endDate, reason, isWithdrawal } = req.body;
        await transporter.sendMail({
            from: `"EmpowerCorp HR" <${SMTP_USER}>`,
            to, cc, 
            subject: `${isWithdrawal ? 'Withdrawn' : 'New'} Leave: ${employeeName}`,
            html: `<p><strong>${employeeName}</strong> has ${isWithdrawal ? 'withdrawn' : 'submitted'} a <strong>${type}</strong> request.</p><p>Dates: ${startDate} to ${endDate}</p><p>Reason: ${reason}</p>`
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api', apiRouter);
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` }));

app.listen(PORT, async () => {
    console.log(`🚀 [BACKEND] Running on http://localhost:${PORT}`);
    await connectDb();
});
