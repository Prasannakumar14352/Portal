
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

// --- REQUEST LOGGER MIDDLEWARE ---
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const method = req.method;
        const url = req.originalUrl;
        
        if (status >= 400) {
            console.error(`[HTTP ERROR] ${method} ${url} - Status: ${status} - Duration: ${duration}ms`);
        } else {
            console.log(`[HTTP SUCCESS] ${method} ${url} - Status: ${status} - Duration: ${duration}ms`);
        }
    });
    next();
});

// Database Configuration
const dbConfig = {
    user: process.env.DB_USER || 'DHLE',
    password: process.env.DB_PASSWORD || 'DHLE',
    server: process.env.DB_SERVER || 'isthydpc107', 
    database: process.env.DB_NAME || 'DHLEDB',
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
        encrypt: false, 
        trustServerCertificate: true, 
        enableArithAbort: true,
        instancename: undefined 
    }
};

// JSON Helper
const parseJSON = (str) => {
    try {
        return str ? JSON.parse(str) : null;
    } catch (e) {
        return null;
    }
};

// Connection Pool
let pool;

const connectDb = async () => {
    try {
        console.log('----------------------------------------');
        console.log(`[SQL] Connecting to: ${dbConfig.server} | DB: ${dbConfig.database}`);
        
        pool = await sql.connect(dbConfig);
        console.log(`✅ [SQL] Connection successful.`);
        
        await initDb();
    } catch (err) {
        console.error('❌ [SQL] CONNECTION FAILED!');
        console.error(`[SQL] Error: ${err.message}`);
        console.log('----------------------------------------');
    }
};

const initDb = async () => {
    try {
        const request = pool.request();
        console.log("[DB] Synchronizing tables...");

        const tables = [
            { name: 'employees', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='employees' AND xtype='U') CREATE TABLE employees (id NVARCHAR(50) PRIMARY KEY, firstName NVARCHAR(100), lastName NVARCHAR(100), email NVARCHAR(255), password NVARCHAR(255), role NVARCHAR(50), department NVARCHAR(100), departmentId NVARCHAR(50), projectIds NVARCHAR(MAX), joinDate NVARCHAR(50), status NVARCHAR(50), salary FLOAT, avatar NVARCHAR(MAX), managerId NVARCHAR(50), location NVARCHAR(MAX), phone NVARCHAR(50), jobTitle NVARCHAR(100), workLocation NVARCHAR(100))` },
            { name: 'departments', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='departments' AND xtype='U') CREATE TABLE departments (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX), managerId NVARCHAR(50))` },
            { name: 'projects', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='projects' AND xtype='U') CREATE TABLE projects (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX), status NVARCHAR(50), tasks NVARCHAR(MAX), dueDate NVARCHAR(50))` },
            { name: 'leaves', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leaves' AND xtype='U') CREATE TABLE leaves (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(100), type NVARCHAR(50), startDate NVARCHAR(50), endDate NVARCHAR(50), reason NVARCHAR(MAX), status NVARCHAR(50), attachmentUrl NVARCHAR(MAX), managerConsent BIT, notifyUserIds NVARCHAR(MAX), approverId NVARCHAR(50), isUrgent BIT, managerComment NVARCHAR(MAX), hrComment NVARCHAR(MAX), createdAt NVARCHAR(50), employeeId NVARCHAR(50), employeeName NVARCHAR(100))` },
            { name: 'leave_types', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leave_types' AND xtype='U') CREATE TABLE leave_types (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), days INT, description NVARCHAR(MAX), isActive BIT, color NVARCHAR(50))` },
            { name: 'attendance', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='attendance' AND xtype='U') CREATE TABLE attendance (id NVARCHAR(50) PRIMARY KEY, employeeId NVARCHAR(50), employeeName NVARCHAR(100), date NVARCHAR(50), checkIn NVARCHAR(50), checkOut NVARCHAR(50), checkInTime NVARCHAR(50), checkOutTime NVARCHAR(50), status NVARCHAR(50), notes NVARCHAR(MAX), workLocation NVARCHAR(100))` },
            { name: 'time_entries', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='time_entries' AND xtype='U') CREATE TABLE time_entries (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), projectId NVARCHAR(50), task NVARCHAR(100), date NVARCHAR(50), durationMinutes INT, description NVARCHAR(MAX), status NVARCHAR(50), isBillable BIT)` },
            { name: 'notifications', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U') CREATE TABLE notifications (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), title NVARCHAR(255), message NVARCHAR(MAX), time NVARCHAR(50), [read] BIT, type NVARCHAR(50))` },
            { name: 'holidays', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='holidays' AND xtype='U') CREATE TABLE holidays (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), date NVARCHAR(50), type NVARCHAR(50))` },
            { name: 'payslips', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='payslips' AND xtype='U') CREATE TABLE payslips (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(100), month NVARCHAR(50), amount FLOAT, currency NVARCHAR(10), status NVARCHAR(50), generatedDate NVARCHAR(50), fileData NVARCHAR(MAX), fileName NVARCHAR(255))` },
            { name: 'roles', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U') CREATE TABLE roles (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX))` }
        ];

        for (const table of tables) {
            await request.query(table.query);
            console.log(`[DB] Verified table: ${table.name}`);
        }
        
        console.log("[DB] Verifying migrations...");
        try {
            await request.query(`IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'workLocation' AND Object_ID = Object_ID(N'employees')) ALTER TABLE employees ADD workLocation NVARCHAR(100)`);
            await request.query(`IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'workLocation' AND Object_ID = Object_ID(N'attendance')) ALTER TABLE attendance ADD workLocation NVARCHAR(100)`);
        } catch (e) { 
            console.warn("[DB] Migration warning:", e.message); 
        }

        console.log("✅ [DB] Initialization complete.");
    } catch (err) {
        console.error("❌ [DB] Initialization FAILED:", err);
    }
};

// --- API ENDPOINTS ---

// Employees
app.get('/api/employees', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM employees");
        const employees = result.recordset.map(e => ({
            ...e,
            projectIds: parseJSON(e.projectIds) || [],
            location: parseJSON(e.location),
        }));
        console.log(`[GET /api/employees] SUCCESS: Sent ${employees.length} records.`);
        res.json(employees);
    } catch (err) { 
        console.error("[GET /api/employees] ERROR:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

app.post('/api/employees', async (req, res) => {
    const e = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, e.id);
        reqSql.input('firstName', sql.NVarChar, e.firstName);
        reqSql.input('lastName', sql.NVarChar, e.lastName);
        reqSql.input('email', sql.NVarChar, e.email);
        reqSql.input('password', sql.NVarChar, e.password);
        reqSql.input('role', sql.NVarChar, e.role);
        reqSql.input('department', sql.NVarChar, e.department);
        reqSql.input('departmentId', sql.NVarChar, e.departmentId);
        reqSql.input('projectIds', sql.NVarChar, JSON.stringify(e.projectIds));
        reqSql.input('joinDate', sql.NVarChar, e.joinDate);
        reqSql.input('status', sql.NVarChar, e.status);
        reqSql.input('salary', sql.Float, e.salary);
        reqSql.input('avatar', sql.NVarChar, e.avatar);
        reqSql.input('managerId', sql.NVarChar, e.managerId);
        reqSql.input('location', sql.NVarChar, JSON.stringify(e.location));
        reqSql.input('workLocation', sql.NVarChar, e.workLocation);
        reqSql.input('phone', sql.NVarChar, e.phone);
        reqSql.input('jobTitle', sql.NVarChar, e.jobTitle);

        await reqSql.query(`INSERT INTO employees 
            (id, firstName, lastName, email, password, role, department, departmentId, projectIds, joinDate, status, salary, avatar, managerId, location, workLocation, phone, jobTitle) 
            VALUES (@id, @firstName, @lastName, @email, @password, @role, @department, @departmentId, @projectIds, @joinDate, @status, @salary, @avatar, @managerId, @location, @workLocation, @phone, @jobTitle)`);
        
        console.log(`[POST /api/employees] SUCCESS: Created ID ${e.id}`);
        res.json(e);
    } catch (err) { 
        console.error(`[POST /api/employees] FAILED for ${e.id}:`, err.message);
        res.status(500).json({ error: err.message }); 
    }
});

app.put('/api/employees/:id', async (req, res) => {
    const e = req.body;
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('firstName', sql.NVarChar, e.firstName);
        reqSql.input('lastName', sql.NVarChar, e.lastName);
        reqSql.input('email', sql.NVarChar, e.email);
        reqSql.input('password', sql.NVarChar, e.password);
        reqSql.input('role', sql.NVarChar, e.role);
        reqSql.input('department', sql.NVarChar, e.department);
        reqSql.input('departmentId', sql.NVarChar, e.departmentId);
        reqSql.input('projectIds', sql.NVarChar, JSON.stringify(e.projectIds));
        reqSql.input('joinDate', sql.NVarChar, e.joinDate);
        reqSql.input('status', sql.NVarChar, e.status);
        reqSql.input('salary', sql.Float, e.salary);
        reqSql.input('avatar', sql.NVarChar, e.avatar);
        reqSql.input('managerId', sql.NVarChar, e.managerId);
        reqSql.input('location', sql.NVarChar, JSON.stringify(e.location));
        reqSql.input('workLocation', sql.NVarChar, e.workLocation);
        reqSql.input('phone', sql.NVarChar, e.phone);
        reqSql.input('jobTitle', sql.NVarChar, e.jobTitle);

        await reqSql.query(`UPDATE employees SET 
            firstName=@firstName, lastName=@lastName, email=@email, password=@password, role=@role, 
            department=@department, departmentId=@departmentId, projectIds=@projectIds, joinDate=@joinDate, 
            status=@status, salary=@salary, avatar=@avatar, managerId=@managerId, location=@location, workLocation=@workLocation,
            phone=@phone, jobTitle=@jobTitle WHERE id=@id`);
        
        console.log(`[PUT /api/employees/${id}] SUCCESS: Updated employee.`);

        if (e.workLocation) {
            try {
                const attendReq = pool.request();
                attendReq.input('eid', sql.NVarChar, id);
                attendReq.input('loc', sql.NVarChar, e.workLocation);
                await attendReq.query("UPDATE attendance SET workLocation = @loc WHERE employeeId = @eid");
                console.log(`[CASCADE] SUCCESS: Updated workLocation for all attendance records of ${id}`);
            } catch (cascadeErr) {
                console.error(`[CASCADE] FAILED for ${id}:`, cascadeErr.message);
            }
        }
        res.json(e);
    } catch (err) { 
        console.error(`[PUT /api/employees/${id}] ERROR:`, err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// Leaves (Fixed 404)
app.get('/api/leaves', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM leaves");
        const data = result.recordset.map(l => ({
            ...l,
            notifyUserIds: parseJSON(l.notifyUserIds) || [],
            managerConsent: !!l.managerConsent,
            isUrgent: !!l.isUrgent
        }));
        console.log(`[GET /api/leaves] SUCCESS: Sent ${data.length} records.`);
        res.json(data);
    } catch (err) {
        console.error("[GET /api/leaves] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/leaves', async (req, res) => {
    const l = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, l.id);
        reqSql.input('userId', sql.NVarChar, l.userId);
        reqSql.input('userName', sql.NVarChar, l.userName);
        reqSql.input('type', sql.NVarChar, l.type);
        reqSql.input('startDate', sql.NVarChar, l.startDate);
        reqSql.input('endDate', sql.NVarChar, l.endDate);
        reqSql.input('reason', sql.NVarChar, l.reason);
        reqSql.input('status', sql.NVarChar, l.status);
        reqSql.input('attachmentUrl', sql.NVarChar, l.attachmentUrl || '');
        reqSql.input('managerConsent', sql.Bit, l.managerConsent ? 1 : 0);
        reqSql.input('notifyUserIds', sql.NVarChar, JSON.stringify(l.notifyUserIds || []));
        reqSql.input('approverId', sql.NVarChar, l.approverId || '');
        reqSql.input('isUrgent', sql.Bit, l.isUrgent ? 1 : 0);
        reqSql.input('createdAt', sql.NVarChar, l.createdAt || new Date().toISOString());
        
        await reqSql.query(`INSERT INTO leaves (id, userId, userName, type, startDate, endDate, reason, status, attachmentUrl, managerConsent, notifyUserIds, approverId, isUrgent, createdAt) 
            VALUES (@id, @userId, @userName, @type, @startDate, @endDate, @reason, @status, @attachmentUrl, @managerConsent, @notifyUserIds, @approverId, @isUrgent, @createdAt)`);
        
        console.log(`[POST /api/leaves] SUCCESS: Request ${l.id} from ${l.userName}`);
        res.json(l);
    } catch (err) {
        console.error("[POST /api/leaves] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/leaves/:id', async (req, res) => {
    const l = req.body;
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('status', sql.NVarChar, l.status);
        reqSql.input('managerComment', sql.NVarChar, l.managerComment || '');
        reqSql.input('hrComment', sql.NVarChar, l.hrComment || '');
        
        await reqSql.query("UPDATE leaves SET status=@status, managerComment=@managerComment, hrComment=@hrComment WHERE id=@id");
        console.log(`[PUT /api/leaves/${id}] SUCCESS: Status changed to ${l.status}`);
        res.json(l);
    } catch (err) {
        console.error(`[PUT /api/leaves/${id}] ERROR:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// Leave Types (Fixed 404)
app.get('/api/leave_types', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM leave_types");
        const data = result.recordset.map(t => ({ ...t, isActive: !!t.isActive }));
        console.log(`[GET /api/leave_types] SUCCESS: Sent ${data.length} records.`);
        res.json(data);
    } catch (err) {
        console.error("[GET /api/leave_types] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/leave_types', async (req, res) => {
    const t = req.body;
    try {
        const reqSql = pool.request();
        const id = t.id || Math.random().toString(36).substr(2, 9);
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('name', sql.NVarChar, t.name);
        reqSql.input('days', sql.Int, t.days);
        reqSql.input('description', sql.NVarChar, t.description || '');
        reqSql.input('isActive', sql.Bit, t.isActive ? 1 : 0);
        reqSql.input('color', sql.NVarChar, t.color || 'text-emerald-600');
        await reqSql.query("INSERT INTO leave_types (id, name, days, description, isActive, color) VALUES (@id, @name, @days, @description, @isActive, @color)");
        console.log(`[POST /api/leave_types] SUCCESS: Created ${t.name}`);
        res.json({ ...t, id });
    } catch (err) {
        console.error("[POST /api/leave_types] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Attendance
app.get('/api/attendance', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM attendance");
        console.log(`[GET /api/attendance] SUCCESS: Sent ${result.recordset.length} records.`);
        res.json(result.recordset);
    } catch (err) { 
        console.error("[GET /api/attendance] ERROR:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

app.post('/api/attendance', async (req, res) => {
    const a = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, a.id);
        reqSql.input('employeeId', sql.NVarChar, a.employeeId);
        reqSql.input('employeeName', sql.NVarChar, a.employeeName);
        reqSql.input('date', sql.NVarChar, a.date);
        reqSql.input('checkIn', sql.NVarChar, a.checkIn);
        reqSql.input('checkOut', sql.NVarChar, a.checkOut || '');
        reqSql.input('checkInTime', sql.NVarChar, a.checkInTime);
        reqSql.input('checkOutTime', sql.NVarChar, a.checkOutTime || '');
        reqSql.input('status', sql.NVarChar, a.status);
        reqSql.input('notes', sql.NVarChar, a.notes || '');
        reqSql.input('workLocation', sql.NVarChar, a.workLocation || ''); 
        
        await reqSql.query("INSERT INTO attendance (id, employeeId, employeeName, date, checkIn, checkOut, checkInTime, checkOutTime, status, notes, workLocation) VALUES (@id, @employeeId, @employeeName, @date, @checkIn, @checkOut, @checkInTime, @checkOutTime, @status, @notes, @workLocation)");
        console.log(`[POST /api/attendance] SUCCESS: Check-In ${a.employeeName}`);
        res.json(a);
    } catch (err) { 
        console.error(`[POST /api/attendance] ERROR for ${a.employeeName}:`, err.message);
        res.status(500).json({ error: err.message }); 
    }
});

app.put('/api/attendance/:id', async (req, res) => {
    const a = req.body;
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('checkOut', sql.NVarChar, a.checkOut);
        reqSql.input('checkOutTime', sql.NVarChar, a.checkOutTime);
        reqSql.input('status', sql.NVarChar, a.status);
        reqSql.input('notes', sql.NVarChar, a.notes);
        await reqSql.query("UPDATE attendance SET checkOut=@checkOut, checkOutTime=@checkOutTime, status=@status, notes=@notes WHERE id=@id");
        console.log(`[PUT /api/attendance/${id}] SUCCESS: Check-Out confirmed.`);
        res.json(a);
    } catch (err) { 
        console.error(`[PUT /api/attendance/${id}] ERROR:`, err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// Holidays (Fixed 404)
app.get('/api/holidays', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM holidays");
        console.log(`[GET /api/holidays] SUCCESS: Sent ${result.recordset.length} records.`);
        res.json(result.recordset);
    } catch (err) {
        console.error("[GET /api/holidays] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/holidays', async (req, res) => {
    const h = req.body;
    try {
        const reqSql = pool.request();
        const id = h.id || Math.random().toString(36).substr(2, 9);
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('name', sql.NVarChar, h.name);
        reqSql.input('date', sql.NVarChar, h.date);
        reqSql.input('type', sql.NVarChar, h.type);
        await reqSql.query("INSERT INTO holidays (id, name, date, type) VALUES (@id, @name, @date, @type)");
        console.log(`[POST /api/holidays] SUCCESS: Added ${h.name}`);
        res.json({ ...h, id });
    } catch (err) {
        console.error("[POST /api/holidays] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Payslips (Fixed 404)
app.get('/api/payslips', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM payslips");
        console.log(`[GET /api/payslips] SUCCESS: Sent ${result.recordset.length} records.`);
        res.json(result.recordset);
    } catch (err) {
        console.error("[GET /api/payslips] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/payslips', async (req, res) => {
    const p = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, p.id);
        reqSql.input('userId', sql.NVarChar, p.userId);
        reqSql.input('userName', sql.NVarChar, p.userName);
        reqSql.input('month', sql.NVarChar, p.month);
        reqSql.input('amount', sql.Float, p.amount);
        reqSql.input('currency', sql.NVarChar, p.currency || '₹');
        reqSql.input('status', sql.NVarChar, p.status);
        reqSql.input('generatedDate', sql.NVarChar, p.generatedDate);
        reqSql.input('fileData', sql.NVarChar, p.fileData || '');
        reqSql.input('fileName', sql.NVarChar, p.fileName || '');
        
        await reqSql.query(`INSERT INTO payslips (id, userId, userName, month, amount, currency, status, generatedDate, fileData, fileName) 
            VALUES (@id, @userId, @userName, @month, @amount, @currency, @status, @generatedDate, @fileData, @fileName)`);
        
        console.log(`[POST /api/payslips] SUCCESS: Generated for ${p.userName} for ${p.month}`);
        res.json(p);
    } catch (err) {
        console.error("[POST /api/payslips] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Time Entries
app.get('/api/time_entries', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM time_entries");
        const data = result.recordset.map(r => ({ ...r, isBillable: !!r.isBillable }));
        console.log(`[GET /api/time_entries] SUCCESS: Sent ${data.length} records.`);
        res.json(data);
    } catch (err) { 
        console.error("[GET /api/time_entries] ERROR:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

app.post('/api/time_entries', async (req, res) => {
    const t = req.body;
    try {
        const reqSql = pool.request();
        const id = t.id || Math.random().toString(36).substr(2, 9);
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('userId', sql.NVarChar, t.userId);
        reqSql.input('projectId', sql.NVarChar, t.projectId || '');
        reqSql.input('task', sql.NVarChar, t.task);
        reqSql.input('date', sql.NVarChar, t.date);
        reqSql.input('durationMinutes', sql.Int, t.durationMinutes);
        reqSql.input('description', sql.NVarChar, t.description || '');
        reqSql.input('status', sql.NVarChar, t.status);
        reqSql.input('isBillable', sql.Bit, t.isBillable ? 1 : 0);
        await reqSql.query("INSERT INTO time_entries (id, userId, projectId, task, date, durationMinutes, description, status, isBillable) VALUES (@id, @userId, @projectId, @task, @date, @durationMinutes, @description, @status, @isBillable)");
        console.log(`[POST /api/time_entries] SUCCESS: Added log for ${t.userId}`);
        res.json({ ...t, id });
    } catch (err) { 
        console.error("[POST /api/time_entries] ERROR:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// Organization structure
app.get('/api/departments', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM departments");
        console.log(`[GET /api/departments] SUCCESS: Sent ${result.recordset.length} records.`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/roles', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM roles");
        console.log(`[GET /api/roles] SUCCESS: Sent ${result.recordset.length} records.`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM projects");
        const data = result.recordset.map(r => ({ ...r, tasks: parseJSON(r.tasks) || [] }));
        console.log(`[GET /api/projects] SUCCESS: Sent ${data.length} records.`);
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Notifications
app.get('/api/notifications', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM notifications");
        console.log(`[GET /api/notifications] SUCCESS: Sent ${result.recordset.length} items.`);
        res.json(result.recordset.map(r => ({ ...r, read: !!r.read })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, async () => {
    console.log('----------------------------------------');
    console.log(`🚀 Server starting on port ${PORT}`);
    console.log('----------------------------------------');
    await connectDb();
});
