
require('dotenv').config();
// Fallback: If running from server/ folder, try to load .env from root if variables are missing
if (!process.env.DB_NAME) {
    const path = require('path');
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// --- REQUEST LOGGER ---
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (res.statusCode >= 400) {
            console.error(`[HTTP ERROR] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
        } else {
            console.log(`[HTTP SUCCESS] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
        }
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
        console.log(`[SQL] Connecting to: ${dbConfig.server} | DB: ${dbConfig.database}`);
        pool = await sql.connect(dbConfig);
        console.log(`✅ [SQL] Connection successful.`);
        await initDb();
    } catch (err) {
        console.error('❌ [SQL] CONNECTION FAILED:', err.message);
    }
};

// --- DATA TYPE HELPERS ---
const parseJSON = (str) => {
    try { return str ? JSON.parse(str) : null; } catch (e) { return null; }
};

const toInt = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const cleaned = String(val).replace(/\D/g, '');
    const n = parseInt(cleaned);
    return isNaN(n) ? 0 : n;
};

const toFloat = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
};

const toStr = (val) => {
    if (val === null || val === undefined) return '';
    return String(val);
};

const initDb = async () => {
    try {
        const request = pool.request();
        console.log("[DB] Initializing schema and migrations...");

        const tables = [
            { name: 'employees', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='employees' AND xtype='U') CREATE TABLE employees (id NVARCHAR(50) PRIMARY KEY, employeeId INT, firstName NVARCHAR(100), lastName NVARCHAR(100), email NVARCHAR(255), password NVARCHAR(255), role NVARCHAR(50), department NVARCHAR(100), departmentId NVARCHAR(50), projectIds NVARCHAR(MAX), joinDate NVARCHAR(50), status NVARCHAR(50), salary FLOAT, avatar NVARCHAR(MAX), managerId NVARCHAR(50), location NVARCHAR(MAX), phone NVARCHAR(50), jobTitle NVARCHAR(100), workLocation NVARCHAR(100), position NVARCHAR(100))` },
            { name: 'departments', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='departments' AND xtype='U') CREATE TABLE departments (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX), managerId NVARCHAR(50))` },
            { name: 'projects', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='projects' AND xtype='U') CREATE TABLE projects (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX), status NVARCHAR(50), tasks NVARCHAR(MAX), dueDate NVARCHAR(50))` },
            { name: 'leaves', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leaves' AND xtype='U') CREATE TABLE leaves (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(100), type NVARCHAR(50), startDate NVARCHAR(50), endDate NVARCHAR(50), reason NVARCHAR(MAX), status NVARCHAR(50), attachmentUrl NVARCHAR(MAX), managerConsent BIT, notifyUserIds NVARCHAR(MAX), approverId NVARCHAR(50), isUrgent BIT, managerComment NVARCHAR(MAX), hrComment NVARCHAR(MAX), createdAt NVARCHAR(50))` },
            { name: 'leave_types', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leave_types' AND xtype='U') CREATE TABLE leave_types (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), days INT, description NVARCHAR(MAX), isActive BIT, color NVARCHAR(50))` },
            { name: 'attendance', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='attendance' AND xtype='U') CREATE TABLE attendance (id NVARCHAR(50) PRIMARY KEY, employeeId NVARCHAR(50), employeeName NVARCHAR(100), date NVARCHAR(50), checkIn NVARCHAR(50), checkOut NVARCHAR(50), checkInTime NVARCHAR(50), checkOutTime NVARCHAR(50), status NVARCHAR(50), notes NVARCHAR(MAX), workLocation NVARCHAR(100))` },
            { name: 'time_entries', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='time_entries' AND xtype='U') CREATE TABLE time_entries (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), projectId NVARCHAR(50), task NVARCHAR(100), date NVARCHAR(50), durationMinutes INT, extraMinutes INT, description NVARCHAR(MAX), status NVARCHAR(50), isBillable BIT, isExtra BIT)` },
            { name: 'notifications', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U') CREATE TABLE notifications (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), title NVARCHAR(255), message NVARCHAR(MAX), time NVARCHAR(50), [read] BIT, type NVARCHAR(50))` },
            { name: 'holidays', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='holidays' AND xtype='U') CREATE TABLE holidays (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), date NVARCHAR(50), type NVARCHAR(50))` },
            { name: 'payslips', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='payslips' AND xtype='U') CREATE TABLE payslips (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(100), month NVARCHAR(50), amount FLOAT, currency NVARCHAR(10), status NVARCHAR(50), generatedDate NVARCHAR(50), fileData NVARCHAR(MAX), fileName NVARCHAR(255))` },
            { name: 'roles', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U') CREATE TABLE roles (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX))` },
            { name: 'positions', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='positions' AND xtype='U') CREATE TABLE positions (id NVARCHAR(50) PRIMARY KEY, title NVARCHAR(100), description NVARCHAR(MAX))` }
        ];

        for (const table of tables) {
            await request.query(table.query);
        }
        
        const migrations = [
            { table: 'employees', column: 'employeeId', type: 'INT' }, 
            { table: 'employees', column: 'position', type: 'NVARCHAR(100)' },
            { table: 'positions', column: 'title', type: 'NVARCHAR(100)' }
        ];

        for (const m of migrations) {
            await request.query(`IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'${m.column}' AND Object_ID = Object_ID(N'${m.table}')) ALTER TABLE ${m.table} ADD ${m.column} ${m.type}`);
        }

        console.log("✅ [DB] Initialization complete.");
    } catch (err) {
        console.error("❌ [DB] Initialization FAILED:", err.message);
    }
};

const apiRouter = express.Router();

// --- POSITIONS ---
apiRouter.get('/positions', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM positions");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/positions', async (req, res) => {
    try {
        const p = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(p.id));
        request.input('title', sql.NVarChar, toStr(p.title));
        request.input('description', sql.NVarChar, toStr(p.description));
        await request.query("INSERT INTO positions (id, title, description) VALUES (@id, @title, @description)");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/positions/:id', async (req, res) => {
    try {
        const p = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(req.params.id));
        request.input('title', sql.NVarChar, toStr(p.title));
        request.input('description', sql.NVarChar, toStr(p.description));
        await request.query("UPDATE positions SET title=@title, description=@description WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/positions/:id', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(req.params.id));
        await request.query("DELETE FROM positions WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- EMPLOYEES ---
apiRouter.get('/employees', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM employees");
        res.json(result.recordset.map(e => ({
            ...e,
            projectIds: parseJSON(e.projectIds) || [],
            location: parseJSON(e.location)
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/employees', async (req, res) => {
    try {
        const e = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(e.id));
        request.input('employeeId', sql.Int, toInt(e.employeeId));
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
        request.input('location', sql.NVarChar, JSON.stringify(e.location));
        request.input('phone', sql.NVarChar, toStr(e.phone));
        request.input('jobTitle', sql.NVarChar, toStr(e.jobTitle));
        request.input('workLocation', sql.NVarChar, toStr(e.workLocation));

        await request.query(`INSERT INTO employees (id, employeeId, firstName, lastName, email, password, role, position, department, departmentId, projectIds, joinDate, status, salary, avatar, managerId, location, phone, jobTitle, workLocation) 
            VALUES (@id, @employeeId, @firstName, @lastName, @email, @password, @role, @position, @department, @departmentId, @projectIds, @joinDate, @status, @salary, @avatar, @managerId, @location, @phone, @jobTitle, @workLocation)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/employees/:id', async (req, res) => {
    try {
        const e = req.body;
        const request = pool.request();
        const targetId = toStr(req.params.id);
        request.input('id', sql.NVarChar, targetId);
        request.input('employeeId', sql.Int, toInt(e.employeeId));
        request.input('firstName', sql.NVarChar, toStr(e.firstName));
        request.input('lastName', sql.NVarChar, toStr(e.lastName));
        request.input('email', sql.NVarChar, toStr(e.email)); 
        request.input('role', sql.NVarChar, toStr(e.role));
        request.input('position', sql.NVarChar, toStr(e.position));
        request.input('department', sql.NVarChar, toStr(e.department));
        request.input('departmentId', sql.NVarChar, toStr(e.departmentId));
        request.input('projectIds', sql.NVarChar, JSON.stringify(e.projectIds || []));
        request.input('status', sql.NVarChar, toStr(e.status));
        request.input('salary', sql.Float, toFloat(e.salary));
        request.input('avatar', sql.NVarChar, toStr(e.avatar));
        request.input('managerId', sql.NVarChar, toStr(e.managerId));
        request.input('location', sql.NVarChar, JSON.stringify(e.location));
        request.input('phone', sql.NVarChar, toStr(e.phone));
        request.input('jobTitle', sql.NVarChar, toStr(e.jobTitle));
        request.input('workLocation', sql.NVarChar, toStr(e.workLocation));

        const result = await request.query(`UPDATE employees SET 
            employeeId=@employeeId, firstName=@firstName, lastName=@lastName, email=@email,
            role=@role, position=@position, department=@department, departmentId=@departmentId, projectIds=@projectIds, 
            status=@status, salary=@salary, avatar=@avatar, managerId=@managerId, 
            location=@location, phone=@phone, jobTitle=@jobTitle, workLocation=@workLocation 
            WHERE id=@id`);
        
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Employee not found.' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/employees/:id', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(req.params.id));
        await request.query("DELETE FROM employees WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- OTHER CRUD ROUTES (DEPARTMENTS, PROJECTS, LEAVES, ETC.) ---
// (Remain unchanged from previous version)

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
        await request.query("INSERT INTO departments (id, name, description, managerId) VALUES (@id, @name, @description, @managerId)");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/departments/:id', async (req, res) => {
    try {
        const d = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(req.params.id));
        request.input('name', sql.NVarChar, toStr(d.name));
        request.input('description', sql.NVarChar, toStr(d.description));
        request.input('managerId', sql.NVarChar, toStr(d.managerId));
        await request.query("UPDATE departments SET name=@name, description=@description, managerId=@managerId WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/departments/:id', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(req.params.id));
        await request.query("DELETE FROM departments WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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
        await request.query("INSERT INTO projects (id, name, description, status, tasks, dueDate) VALUES (@id, @name, @description, @status, @tasks, @dueDate)");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/projects/:id', async (req, res) => {
    try {
        const p = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(req.params.id));
        request.input('name', sql.NVarChar, toStr(p.name));
        request.input('description', sql.NVarChar, toStr(p.description));
        request.input('status', sql.NVarChar, toStr(p.status));
        request.input('tasks', sql.NVarChar, JSON.stringify(p.tasks || []));
        await request.query("UPDATE projects SET name=@name, description=@description, status=@status, tasks=@tasks WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/projects/:id', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(req.params.id));
        await request.query("DELETE FROM projects WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/leave_types', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM leave_types");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/leave_types', async (req, res) => {
    try {
        const t = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(t.id));
        request.input('name', sql.NVarChar, toStr(t.name));
        request.input('days', sql.Int, toInt(t.days));
        request.input('description', sql.NVarChar, toStr(t.description));
        request.input('isActive', sql.Bit, t.isActive ? 1 : 0);
        request.input('color', sql.NVarChar, toStr(t.color));
        await request.query("INSERT INTO leave_types (id, name, days, description, isActive, color) VALUES (@id, @name, @days, @description, @isActive, @color)");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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
        request.input('reason', sql.NVarChar, toStr(l.reason));
        request.input('status', sql.NVarChar, toStr(l.status));
        request.input('managerConsent', sql.Bit, l.managerConsent ? 1 : 0);
        request.input('notifyUserIds', sql.NVarChar, JSON.stringify(l.notifyUserIds || []));
        request.input('approverId', sql.NVarChar, toStr(l.approverId));
        request.input('isUrgent', sql.Bit, l.isUrgent ? 1 : 0);
        request.input('createdAt', sql.NVarChar, toStr(l.createdAt));
        await request.query("INSERT INTO leaves (id, userId, userName, type, startDate, endDate, reason, status, managerConsent, notifyUserIds, approverId, isUrgent, createdAt) VALUES (@id, @userId, @userName, @type, @startDate, @endDate, @reason, @status, @managerConsent, @notifyUserIds, @approverId, @isUrgent, @createdAt)");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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
        await request.query("INSERT INTO attendance (id, employeeId, employeeName, date, checkIn, checkOut, checkInTime, checkOutTime, status, notes, workLocation) VALUES (@id, @employeeId, @employeeName, @date, @checkIn, @checkOut, @checkInTime, @checkOutTime, @status, @notes, @workLocation)");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/time_entries', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM time_entries");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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
        request.input('isBillable', sql.Bit, t.isBillable ? 1 : 0);
        request.input('isExtra', sql.Bit, (toInt(t.extraMinutes) > 0) ? 1 : 0);
        await request.query("INSERT INTO time_entries (id, userId, projectId, task, date, durationMinutes, extraMinutes, description, status, isBillable, isExtra) VALUES (@id, @userId, @projectId, @task, @date, @durationMinutes, @extraMinutes, @description, @status, @isBillable, @isExtra)");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/holidays', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM holidays");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/holidays', async (req, res) => {
    try {
        const h = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(h.id));
        request.input('name', sql.NVarChar, toStr(h.name));
        request.input('date', sql.NVarChar, toStr(h.date));
        request.input('type', sql.NVarChar, toStr(h.type));
        await request.query("INSERT INTO holidays (id, name, date, type) VALUES (@id, @name, @date, @type)");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/payslips', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM payslips");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/payslips', async (req, res) => {
    try {
        const p = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(p.id));
        request.input('userId', sql.NVarChar, toStr(p.userId));
        request.input('userName', sql.NVarChar, toStr(p.userName));
        request.input('month', sql.NVarChar, toStr(p.month));
        request.input('amount', sql.Float, toFloat(p.amount));
        request.input('status', sql.NVarChar, toStr(p.status));
        request.input('generatedDate', sql.NVarChar, toStr(p.generatedDate));
        await request.query("INSERT INTO payslips (id, userId, userName, month, amount, status, generatedDate) VALUES (@id, @userId, @userName, @month, @amount, @status, @generatedDate)");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/notifications', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM notifications");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/notifications/:id/read', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(req.params.id));
        await request.query("UPDATE notifications SET [read] = 1 WHERE id = @id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mount routes
app.use('/api', apiRouter);

// Start Server
app.listen(PORT, async () => {
    console.log(`🚀 [BACKEND] HR Portal API running on http://localhost:${PORT}`);
    await connectDb();
});
