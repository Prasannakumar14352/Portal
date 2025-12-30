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
    if (error) console.error('❌ [SMTP] Connection failed:', error.message);
    else console.log('📧 [SMTP] Server ready');
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

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
        console.log(`✅ [SQL] Connected to ${dbConfig.database}`);
        await initDb();
    } catch (err) {
        console.error('❌ [SQL] CONNECTION FAILED:', err.message);
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
        console.log("✅ [DB] All tables verified.");
    } catch (err) { console.error("❌ [DB] Initialization FAILED:", err.message); }
};

const apiRouter = express.Router();

// --- GENERIC CRUD HELPER FACTORY ---
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
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- DEPARTMENTS ---
apiRouter.get('/departments', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM departments");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/departments', async (req, res) => {
    try {
        const d = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(d.id));
        request.input('name', sql.NVarChar, toStr(d.name));
        request.input('description', sql.NVarChar, toStr(d.description));
        request.input('managerId', sql.NVarChar, toStr(d.managerId));
        await request.query(`INSERT INTO departments (id, name, description, managerId) VALUES (@id, @name, @description, @managerId)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/departments/:id', async (req, res) => {
    try {
        const d = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        request.input('name', sql.NVarChar, toStr(d.name));
        request.input('description', sql.NVarChar, toStr(d.description));
        request.input('managerId', sql.NVarChar, toStr(d.managerId));
        await request.query(`UPDATE departments SET name=@name, description=@description, managerId=@managerId WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- POSITIONS ---
setupCrud('positions', 'positions');
apiRouter.post('/positions', async (req, res) => {
    try {
        const p = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(p.id));
        request.input('title', sql.NVarChar, toStr(p.title));
        request.input('description', sql.NVarChar, toStr(p.description));
        await request.query(`INSERT INTO positions (id, title, description) VALUES (@id, @title, @description)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/positions/:id', async (req, res) => {
    try {
        const p = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        request.input('title', sql.NVarChar, toStr(p.title));
        request.input('description', sql.NVarChar, toStr(p.description));
        await request.query(`UPDATE positions SET title=@title, description=@description WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROLES ---
setupCrud('roles', 'roles');
apiRouter.post('/roles', async (req, res) => {
    try {
        const r = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(r.id));
        request.input('name', sql.NVarChar, toStr(r.name));
        request.input('description', sql.NVarChar, toStr(r.description));
        await request.query(`INSERT INTO roles (id, name, description) VALUES (@id, @name, @description)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PROJECTS ---
apiRouter.get('/projects', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM projects");
        res.json(result.recordset.map(p => ({ ...p, tasks: parseJSON(p.tasks) || [] })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/projects', async (req, res) => {
    try {
        const p = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(p.id));
        request.input('name', sql.NVarChar, toStr(p.name));
        request.input('description', sql.NVarChar, toStr(p.description));
        request.input('status', sql.NVarChar, toStr(p.status));
        request.input('tasks', sql.NVarChar, JSON.stringify(p.tasks || []));
        request.input('dueDate', sql.NVarChar, toStr(p.dueDate));
        await request.query(`INSERT INTO projects (id, name, description, status, tasks, dueDate) VALUES (@id, @name, @description, @status, @tasks, @dueDate)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/projects/:id', async (req, res) => {
    try {
        const p = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        request.input('name', sql.NVarChar, toStr(p.name));
        request.input('description', sql.NVarChar, toStr(p.description));
        request.input('status', sql.NVarChar, toStr(p.status));
        request.input('tasks', sql.NVarChar, JSON.stringify(p.tasks || []));
        request.input('dueDate', sql.NVarChar, toStr(p.dueDate));
        await request.query(`UPDATE projects SET name=@name, description=@description, status=@status, tasks=@tasks, dueDate=@dueDate WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- LEAVES ---
setupCrud('leaves', 'leaves');
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
        await request.query(`INSERT INTO leaves (id, userId, userName, type, startDate, endDate, durationType, reason, status, approverId, isUrgent) VALUES (@id, @userId, @userName, @type, @startDate, @endDate, @durationType, @reason, @status, @approverId, @isUrgent)`);
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

// --- LEAVE TYPES ---
setupCrud('leave_types', 'leave_types');
apiRouter.post('/leave_types', async (req, res) => {
    try {
        const t = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(t.id));
        request.input('name', sql.NVarChar, toStr(t.name));
        request.input('days', sql.Int, toInt(t.days));
        request.input('description', sql.NVarChar, toStr(t.description));
        request.input('isActive', sql.Bit, toBit(t.isActive));
        request.input('color', sql.NVarChar, toStr(t.color));
        await request.query(`INSERT INTO leave_types (id, name, days, description, isActive, color) VALUES (@id, @name, @days, @description, @isActive, @color)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ATTENDANCE ---
setupCrud('attendance', 'attendance');
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
        request.input('workLocation', sql.NVarChar, toStr(a.workLocation));
        await request.query(`INSERT INTO attendance (id, employeeId, employeeName, date, checkIn, checkOut, checkInTime, checkOutTime, status, workLocation) VALUES (@id, @employeeId, @employeeName, @date, @checkIn, @checkOut, @checkInTime, @checkOutTime, @status, @workLocation)`);
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
        await request.query(`UPDATE attendance SET checkOut=@checkOut, checkOutTime=@checkOutTime WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- TIME ENTRIES ---
setupCrud('time_entries', 'time_entries');
apiRouter.post('/time_entries', async (req, res) => {
    try {
        const t = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(t.id));
        request.input('userId', sql.NVarChar, toStr(t.userId));
        request.input('projectId', sql.NVarChar, toStr(t.projectId));
        request.input('task', sql.NVarChar, toStr(t.task));
        request.input('date', sql.NVarChar, toStr(t.date));
        request.input('durationMinutes', sql.Int, toInt(t.durationMinutes));
        request.input('extraMinutes', sql.Int, toInt(t.extraMinutes));
        request.input('description', sql.NVarChar, toStr(t.description));
        request.input('status', sql.NVarChar, toStr(t.status));
        request.input('isBillable', sql.Bit, toBit(t.isBillable));
        await request.query(`INSERT INTO time_entries (id, userId, projectId, task, date, durationMinutes, extraMinutes, description, status, isBillable) VALUES (@id, @userId, @projectId, @task, @date, @durationMinutes, @extraMinutes, @description, @status, @isBillable)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NOTIFICATIONS ---
setupCrud('notifications', 'notifications');
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

// --- HOLIDAYS ---
setupCrud('holidays', 'holidays');
apiRouter.post('/holidays', async (req, res) => {
    try {
        const h = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(h.id));
        request.input('name', sql.NVarChar, toStr(h.name));
        request.input('date', sql.NVarChar, toStr(h.date));
        request.input('type', sql.NVarChar, toStr(h.type));
        await request.query(`INSERT INTO holidays (id, name, date, type) VALUES (@id, @name, @date, @type)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PAYSLIPS ---
setupCrud('payslips', 'payslips');
apiRouter.post('/payslips', async (req, res) => {
    try {
        const p = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(p.id));
        request.input('userId', sql.NVarChar, toStr(p.userId));
        request.input('userName', sql.NVarChar, toStr(p.userName));
        request.input('month', sql.NVarChar, toStr(p.month));
        request.input('amount', sql.Float, toFloat(p.amount));
        request.input('currency', sql.NVarChar, toStr(p.currency));
        request.input('status', sql.NVarChar, toStr(p.status));
        request.input('generatedDate', sql.NVarChar, toStr(p.generatedDate));
        request.input('fileData', sql.NVarChar, toStr(p.fileData));
        request.input('fileName', sql.NVarChar, toStr(p.fileName));
        await request.query(`INSERT INTO payslips (id, userId, userName, month, amount, currency, status, generatedDate, fileData, fileName) VALUES (@id, @userId, @userName, @month, @amount, @currency, @status, @generatedDate, @fileData, @fileName)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NOTIFICATIONS & INVITATIONS ---
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
            html: `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #0d9488;">Welcome to the Team, ${i.firstName}!</h2>
                    <p>You have been invited to join the EmpowerCorp HR Portal as a <strong>${i.role}</strong>.</p>
                    <div style="text-align: center; margin: 30px 0;"><a href="${acceptLink}" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Accept Invitation</a></div>
                    <p style="color: #64748b; font-size: 11px;">&copy; 2025 EmpowerCorp HR Solutions</p>
                </div>`
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
            to: email,
            subject: `New Project Assignment: ${projectName}`,
            html: `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #0f766e;">Project Assignment: ${projectName}</h2>
                    <p>Hello ${firstName}, you have been assigned to: <strong>${projectName}</strong>.</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #0f766e; margin: 20px 0;">${projectDescription || 'No description provided.'}</div>
                    <div style="text-align: center;"><a href="${req.headers.origin || 'http://localhost:5173'}/time-logs" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Go to Time Logs</a></div>
                </div>`
        };
        await transporter.sendMail(mailOptions);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api', apiRouter);

app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

app.listen(PORT, async () => {
    console.log(`🚀 [BACKEND] API running on http://localhost:${PORT}`);
    await connectDb();
});