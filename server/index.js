
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

// JSON Helper
const parseJSON = (str) => {
    try { return str ? JSON.parse(str) : null; } catch (e) { return null; }
};

// Robust numeric conversion helpers to prevent "Validation failed for parameter 'id'. Invalid string."
const toInt = (val) => {
    const n = parseInt(val);
    return isNaN(n) ? 0 : n;
};

const toFloat = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
};

const initDb = async () => {
    try {
        const request = pool.request();
        console.log("[DB] Initializing schema and migrations...");

        const tables = [
            { name: 'employees', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='employees' AND xtype='U') CREATE TABLE employees (id INT PRIMARY KEY, employeeId INT, firstName NVARCHAR(100), lastName NVARCHAR(100), email NVARCHAR(255), password NVARCHAR(255), role NVARCHAR(50), department NVARCHAR(100), departmentId NVARCHAR(50), projectIds NVARCHAR(MAX), joinDate NVARCHAR(50), status NVARCHAR(50), salary FLOAT, avatar NVARCHAR(MAX), managerId NVARCHAR(50), location NVARCHAR(MAX), phone NVARCHAR(50), jobTitle NVARCHAR(100), workLocation NVARCHAR(100))` },
            { name: 'departments', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='departments' AND xtype='U') CREATE TABLE departments (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX), managerId NVARCHAR(50))` },
            { name: 'projects', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='projects' AND xtype='U') CREATE TABLE projects (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX), status NVARCHAR(50), tasks NVARCHAR(MAX), dueDate NVARCHAR(50))` },
            { name: 'leaves', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leaves' AND xtype='U') CREATE TABLE leaves (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(100), type NVARCHAR(50), startDate NVARCHAR(50), endDate NVARCHAR(50), reason NVARCHAR(MAX), status NVARCHAR(50), attachmentUrl NVARCHAR(MAX), managerConsent BIT, notifyUserIds NVARCHAR(MAX), approverId NVARCHAR(50), isUrgent BIT, managerComment NVARCHAR(MAX), hrComment NVARCHAR(MAX), createdAt NVARCHAR(50))` },
            { name: 'leave_types', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leave_types' AND xtype='U') CREATE TABLE leave_types (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), days INT, description NVARCHAR(MAX), isActive BIT, color NVARCHAR(50))` },
            { name: 'attendance', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='attendance' AND xtype='U') CREATE TABLE attendance (id NVARCHAR(50) PRIMARY KEY, employeeId NVARCHAR(50), employeeName NVARCHAR(100), date NVARCHAR(50), checkIn NVARCHAR(50), checkOut NVARCHAR(50), checkInTime NVARCHAR(50), checkOutTime NVARCHAR(50), status NVARCHAR(50), notes NVARCHAR(MAX), workLocation NVARCHAR(100))` },
            { name: 'time_entries', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='time_entries' AND xtype='U') CREATE TABLE time_entries (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), projectId NVARCHAR(50), task NVARCHAR(100), date NVARCHAR(50), durationMinutes INT, extraMinutes INT, description NVARCHAR(MAX), status NVARCHAR(50), isBillable BIT, isExtra BIT)` },
            { name: 'notifications', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U') CREATE TABLE notifications (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), title NVARCHAR(255), message NVARCHAR(MAX), time NVARCHAR(50), [read] BIT, type NVARCHAR(50))` },
            { name: 'holidays', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='holidays' AND xtype='U') CREATE TABLE holidays (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), date NVARCHAR(50), type NVARCHAR(50))` },
            { name: 'payslips', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='payslips' AND xtype='U') CREATE TABLE payslips (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(100), month NVARCHAR(50), amount FLOAT, currency NVARCHAR(10), status NVARCHAR(50), generatedDate NVARCHAR(50), fileData NVARCHAR(MAX), fileName NVARCHAR(255))` },
            { name: 'roles', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U') CREATE TABLE roles (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX))` }
        ];

        for (const table of tables) {
            await request.query(table.query);
        }
        
        const migrations = [
            { table: 'employees', column: 'employeeId', type: 'INT' },
            { table: 'employees', column: 'workLocation', type: 'NVARCHAR(100)' },
            { table: 'employees', column: 'jobTitle', type: 'NVARCHAR(100)' },
            { table: 'employees', column: 'phone', type: 'NVARCHAR(50)' },
            { table: 'attendance', column: 'workLocation', type: 'NVARCHAR(100)' },
            { table: 'time_entries', column: 'isExtra', type: 'BIT DEFAULT 0' },
            { table: 'time_entries', column: 'extraMinutes', type: 'INT DEFAULT 0' }
        ];

        for (const m of migrations) {
            if (m.column === 'employeeId') {
                 const colInfo = await request.query(`SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employees' AND COLUMN_NAME = 'employeeId'`);
                 if (colInfo.recordset.length > 0 && colInfo.recordset[0].DATA_TYPE.toLowerCase() !== 'int') {
                     console.log("[DB] Migrating employeeId to INT...");
                     await request.query(`UPDATE employees SET employeeId = REPLACE(CAST(employeeId AS NVARCHAR(50)), 'EMP', '') WHERE ISNUMERIC(REPLACE(CAST(employeeId AS NVARCHAR(50)), 'EMP', '')) = 1`);
                     await request.query(`UPDATE employees SET employeeId = '0' WHERE ISNUMERIC(employeeId) = 0`);
                     await request.query(`ALTER TABLE employees ALTER COLUMN employeeId INT`);
                 }
            }
            await request.query(`IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'${m.column}' AND Object_ID = Object_ID(N'${m.table}')) ALTER TABLE ${m.table} ADD ${m.column} ${m.type}`);
        }

        console.log("✅ [DB] Initialization complete.");
    } catch (err) {
        console.error("❌ [DB] Initialization FAILED:", err.message);
    }
};

const apiRouter = express.Router();

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
        request.input('id', sql.Int, toInt(e.id));
        request.input('employeeId', sql.Int, toInt(e.employeeId));
        request.input('firstName', sql.NVarChar, e.firstName);
        request.input('lastName', sql.NVarChar, e.lastName);
        request.input('email', sql.NVarChar, e.email);
        request.input('password', sql.NVarChar, e.password);
        request.input('role', sql.NVarChar, e.role);
        request.input('department', sql.NVarChar, e.department);
        request.input('departmentId', sql.NVarChar, String(e.departmentId));
        request.input('projectIds', sql.NVarChar, JSON.stringify(e.projectIds || []));
        request.input('joinDate', sql.NVarChar, e.joinDate);
        request.input('status', sql.NVarChar, e.status);
        request.input('salary', sql.Float, toFloat(e.salary));
        request.input('avatar', sql.NVarChar, e.avatar);
        request.input('managerId', sql.NVarChar, String(e.managerId));
        request.input('location', sql.NVarChar, JSON.stringify(e.location));
        request.input('phone', sql.NVarChar, e.phone);
        request.input('jobTitle', sql.NVarChar, e.jobTitle);
        request.input('workLocation', sql.NVarChar, e.workLocation);

        await request.query(`INSERT INTO employees (id, employeeId, firstName, lastName, email, password, role, department, departmentId, projectIds, joinDate, status, salary, avatar, managerId, location, phone, jobTitle, workLocation) 
            VALUES (@id, @employeeId, @firstName, @lastName, @email, @password, @role, @department, @departmentId, @projectIds, @joinDate, @status, @salary, @avatar, @managerId, @location, @phone, @jobTitle, @workLocation)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/employees/:id', async (req, res) => {
    try {
        const e = req.body;
        const request = pool.request();
        request.input('id', sql.Int, toInt(req.params.id));
        request.input('firstName', sql.NVarChar, e.firstName);
        request.input('lastName', sql.NVarChar, e.lastName);
        request.input('role', sql.NVarChar, e.role);
        request.input('department', sql.NVarChar, e.department);
        request.input('departmentId', sql.NVarChar, String(e.departmentId));
        request.input('projectIds', sql.NVarChar, JSON.stringify(e.projectIds || []));
        request.input('status', sql.NVarChar, e.status);
        request.input('salary', sql.Float, toFloat(e.salary));
        request.input('avatar', sql.NVarChar, e.avatar);
        request.input('managerId', sql.NVarChar, String(e.managerId));
        request.input('location', sql.NVarChar, JSON.stringify(e.location));
        request.input('phone', sql.NVarChar, e.phone);
        request.input('jobTitle', sql.NVarChar, e.jobTitle);
        request.input('workLocation', sql.NVarChar, e.workLocation);

        await request.query(`UPDATE employees SET firstName=@firstName, lastName=@lastName, role=@role, department=@department, departmentId=@departmentId, projectIds=@projectIds, status=@status, salary=@salary, avatar=@avatar, managerId=@managerId, location=@location, phone=@phone, jobTitle=@jobTitle, workLocation=@workLocation WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/employees/:id', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.Int, toInt(req.params.id));
        await request.query("DELETE FROM employees WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- TIME ENTRIES (TIME LOGS) ---
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
        request.input('id', sql.NVarChar, t.id);
        request.input('userId', sql.NVarChar, String(t.userId));
        request.input('projectId', sql.NVarChar, String(t.projectId));
        request.input('task', sql.NVarChar, t.task);
        request.input('date', sql.NVarChar, t.date);
        request.input('durationMinutes', sql.Int, toInt(t.durationMinutes));
        request.input('extraMinutes', sql.Int, toInt(t.extraMinutes));
        request.input('description', sql.NVarChar, t.description);
        request.input('status', sql.NVarChar, t.status);
        request.input('isBillable', sql.Bit, t.isBillable ? 1 : 0);
        request.input('isExtra', sql.Bit, (t.extraMinutes > 0) ? 1 : 0);

        await request.query(`INSERT INTO time_entries (id, userId, projectId, task, date, durationMinutes, extraMinutes, description, status, isBillable, isExtra) 
            VALUES (@id, @userId, @projectId, @task, @date, @durationMinutes, @extraMinutes, @description, @status, @isBillable, @isExtra)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/time_entries/:id', async (req, res) => {
    try {
        const t = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        request.input('projectId', sql.NVarChar, String(t.projectId));
        request.input('task', sql.NVarChar, t.task);
        request.input('date', sql.NVarChar, t.date);
        request.input('durationMinutes', sql.Int, toInt(t.durationMinutes));
        request.input('extraMinutes', sql.Int, toInt(t.extraMinutes));
        request.input('description', sql.NVarChar, t.description);
        request.input('status', sql.NVarChar, t.status);
        request.input('isBillable', sql.Bit, t.isBillable ? 1 : 0);

        await request.query(`UPDATE time_entries SET projectId=@projectId, task=@task, date=@date, durationMinutes=@durationMinutes, extraMinutes=@extraMinutes, description=@description, status=@status, isBillable=@isBillable WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/time_entries/:id', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        await request.query("DELETE FROM time_entries WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ATTENDANCE ---
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
        request.input('id', sql.NVarChar, a.id);
        request.input('employeeId', sql.NVarChar, String(a.employeeId));
        request.input('employeeName', sql.NVarChar, a.employeeName);
        request.input('date', sql.NVarChar, a.date);
        request.input('checkIn', sql.NVarChar, a.checkIn);
        request.input('checkOut', sql.NVarChar, a.checkOut);
        request.input('checkInTime', sql.NVarChar, a.checkInTime);
        request.input('checkOutTime', sql.NVarChar, a.checkOutTime);
        request.input('status', sql.NVarChar, a.status);
        request.input('notes', sql.NVarChar, a.notes);
        request.input('workLocation', sql.NVarChar, a.workLocation);

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
        request.input('checkOut', sql.NVarChar, a.checkOut);
        request.input('checkOutTime', sql.NVarChar, a.checkOutTime);
        request.input('status', sql.NVarChar, a.status);
        request.input('notes', sql.NVarChar, a.notes);

        await request.query(`UPDATE attendance SET checkOut=@checkOut, checkOutTime=@checkOutTime, status=@status, notes=@notes WHERE id=@id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- LEAVES ---
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
        request.input('id', sql.NVarChar, l.id);
        request.input('userId', sql.NVarChar, String(l.userId));
        request.input('userName', sql.NVarChar, l.userName);
        request.input('type', sql.NVarChar, l.type);
        request.input('startDate', sql.NVarChar, l.startDate);
        request.input('endDate', sql.NVarChar, l.endDate);
        request.input('reason', sql.NVarChar, l.reason);
        request.input('status', sql.NVarChar, l.status);
        request.input('attachmentUrl', sql.NVarChar, l.attachmentUrl);
        request.input('managerConsent', sql.Bit, l.managerConsent ? 1 : 0);
        request.input('notifyUserIds', sql.NVarChar, JSON.stringify(l.notifyUserIds || []));
        request.input('approverId', sql.NVarChar, String(l.approverId));
        request.input('isUrgent', sql.Bit, l.isUrgent ? 1 : 0);
        request.input('createdAt', sql.NVarChar, l.createdAt);

        await request.query(`INSERT INTO leaves (id, userId, userName, type, startDate, endDate, reason, status, attachmentUrl, managerConsent, notifyUserIds, approverId, isUrgent, createdAt) 
            VALUES (@id, @userId, @userName, @type, @startDate, @endDate, @reason, @status, @attachmentUrl, @managerConsent, @notifyUserIds, @approverId, @isUrgent, @createdAt)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/leaves/:id', async (req, res) => {
    try {
        const l = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        request.input('status', sql.NVarChar, l.status);
        request.input('managerComment', sql.NVarChar, l.managerComment);
        request.input('hrComment', sql.NVarChar, l.hrComment);

        await request.query(`UPDATE leaves SET status=@status, managerComment=@managerComment, hrComment=@hrComment WHERE id=@id`);
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
        request.input('id', sql.NVarChar, d.id);
        request.input('name', sql.NVarChar, d.name);
        request.input('description', sql.NVarChar, d.description);
        request.input('managerId', sql.NVarChar, String(d.managerId));
        await request.query("INSERT INTO departments (id, name, description, managerId) VALUES (@id, @name, @description, @managerId)");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- HOLIDAYS ---
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
        request.input('id', sql.NVarChar, h.id);
        request.input('name', sql.NVarChar, h.name);
        request.input('date', sql.NVarChar, h.date);
        request.input('type', sql.NVarChar, h.type);
        await request.query("INSERT INTO holidays (id, name, date, type) VALUES (@id, @name, @date, @type)");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/holidays/:id', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
        await request.query("DELETE FROM holidays WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROLES ---
apiRouter.get('/roles', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM roles");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NOTIFICATIONS ---
apiRouter.get('/notifications', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM notifications");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/notifications/:id/read', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, req.params.id);
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
