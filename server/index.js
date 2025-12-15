
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

// Database Configuration
const dbConfig = {
    user: process.env.DB_USER || 'DHLE',
    password: process.env.DB_PASSWORD || 'DHLE',
    server: process.env.DB_SERVER || 'isthydpc107', 
    database: process.env.DB_NAME || 'DHLEDB',
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
        encrypt: false, // Set to false for local/internal network servers
        trustServerCertificate: true, // Trust self-signed certificates
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
        console.log(`[SQL] Connecting to Server: ${dbConfig.server}`);
        console.log(`[SQL] Target Database:      ${dbConfig.database}`);
        console.log(`[SQL] User:                 ${dbConfig.user}`);
        console.log('----------------------------------------');

        // Connect to the specific database
        pool = await sql.connect(dbConfig);
        console.log(`✅ Connected to SQL Server successfully.`);
        
        // Check schema only (creates tables only if they don't exist)
        await initDb();
    } catch (err) {
        console.error('❌ Database Connection Failed!');
        console.error('Error Message:', err.message);
        console.error('----------------------------------------');
        console.error('TROUBLESHOOTING STEPS:');
        console.error(`1. Does the database "${dbConfig.database}" exist in SQL Server?`);
        console.error(`2. Does user "${dbConfig.user}" have 'db_owner' or 'public' access to "${dbConfig.database}"?`);
        console.error('   (Go to SSMS > Security > Logins > Right Click User > Properties > User Mapping)');
        console.error('3. If you just changed the DB name, did you update the user mapping?');
    }
};

// Initialize Database Tables (Idempotent - only creates if missing)
const initDb = async () => {
    try {
        const request = pool.request();

        // 1. Employees
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='employees' AND xtype='U')
            CREATE TABLE employees (
                id NVARCHAR(50) PRIMARY KEY,
                firstName NVARCHAR(100),
                lastName NVARCHAR(100),
                email NVARCHAR(255),
                password NVARCHAR(255),
                role NVARCHAR(50),
                department NVARCHAR(100),
                departmentId NVARCHAR(50),
                projectIds NVARCHAR(MAX),
                joinDate NVARCHAR(50),
                status NVARCHAR(50),
                salary FLOAT,
                avatar NVARCHAR(MAX),
                managerId NVARCHAR(50),
                location NVARCHAR(MAX),
                phone NVARCHAR(50),
                jobTitle NVARCHAR(100)
            )
        `);

        // 2. Departments
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='departments' AND xtype='U')
            CREATE TABLE departments (
                id NVARCHAR(50) PRIMARY KEY,
                name NVARCHAR(100),
                description NVARCHAR(MAX),
                managerId NVARCHAR(50)
            )
        `);

        // 3. Projects
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='projects' AND xtype='U')
            CREATE TABLE projects (
                id NVARCHAR(50) PRIMARY KEY,
                name NVARCHAR(100),
                description NVARCHAR(MAX),
                status NVARCHAR(50),
                tasks NVARCHAR(MAX),
                dueDate NVARCHAR(50)
            )
        `);

        // 4. Leaves
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leaves' AND xtype='U')
            CREATE TABLE leaves (
                id NVARCHAR(50) PRIMARY KEY,
                userId NVARCHAR(50),
                userName NVARCHAR(100),
                type NVARCHAR(50),
                startDate NVARCHAR(50),
                endDate NVARCHAR(50),
                reason NVARCHAR(MAX),
                status NVARCHAR(50),
                attachmentUrl NVARCHAR(MAX),
                managerConsent BIT,
                notifyUserIds NVARCHAR(MAX),
                approverId NVARCHAR(50),
                isUrgent BIT,
                managerComment NVARCHAR(MAX),
                hrComment NVARCHAR(MAX),
                createdAt NVARCHAR(50),
                employeeId NVARCHAR(50),
                employeeName NVARCHAR(100)
            )
        `);

        // 5. Leave Types
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leave_types' AND xtype='U')
            CREATE TABLE leave_types (
                id NVARCHAR(50) PRIMARY KEY,
                name NVARCHAR(100),
                days INT,
                description NVARCHAR(MAX),
                isActive BIT,
                color NVARCHAR(50)
            )
        `);

        // 6. Attendance
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='attendance' AND xtype='U')
            CREATE TABLE attendance (
                id NVARCHAR(50) PRIMARY KEY,
                employeeId NVARCHAR(50),
                employeeName NVARCHAR(100),
                date NVARCHAR(50),
                checkIn NVARCHAR(50),
                checkOut NVARCHAR(50),
                checkInTime NVARCHAR(50),
                checkOutTime NVARCHAR(50),
                status NVARCHAR(50),
                notes NVARCHAR(MAX)
            )
        `);

        // 7. Time Entries
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='time_entries' AND xtype='U')
            CREATE TABLE time_entries (
                id NVARCHAR(50) PRIMARY KEY,
                userId NVARCHAR(50),
                projectId NVARCHAR(50),
                task NVARCHAR(100),
                date NVARCHAR(50),
                durationMinutes INT,
                description NVARCHAR(MAX),
                status NVARCHAR(50),
                isBillable BIT
            )
        `);

        // 8. Notifications
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U')
            CREATE TABLE notifications (
                id NVARCHAR(50) PRIMARY KEY,
                userId NVARCHAR(50),
                title NVARCHAR(255),
                message NVARCHAR(MAX),
                time NVARCHAR(50),
                [read] BIT,
                type NVARCHAR(50)
            )
        `);

        // 9. Holidays
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='holidays' AND xtype='U')
            CREATE TABLE holidays (
                id NVARCHAR(50) PRIMARY KEY,
                name NVARCHAR(100),
                date NVARCHAR(50),
                type NVARCHAR(50)
            )
        `);

        // 10. Payslips
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='payslips' AND xtype='U')
            CREATE TABLE payslips (
                id NVARCHAR(50) PRIMARY KEY,
                userId NVARCHAR(50),
                userName NVARCHAR(100),
                month NVARCHAR(50),
                amount FLOAT,
                currency NVARCHAR(10),
                status NVARCHAR(50),
                generatedDate NVARCHAR(50),
                fileData NVARCHAR(MAX),
                fileName NVARCHAR(255)
            )
        `);

        console.log("Database schema checked/initialized.");
    } catch (err) {
        console.error("Error creating/checking tables:", err);
    }
};

// --- ROUTES ---

// Employees
app.get('/api/employees', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM employees");
        const employees = result.recordset.map(e => ({
            ...e,
            projectIds: parseJSON(e.projectIds) || [],
            location: parseJSON(e.location),
        }));
        res.json(employees);
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        reqSql.input('phone', sql.NVarChar, e.phone);
        reqSql.input('jobTitle', sql.NVarChar, e.jobTitle);

        await reqSql.query(`INSERT INTO employees 
            (id, firstName, lastName, email, password, role, department, departmentId, projectIds, joinDate, status, salary, avatar, managerId, location, phone, jobTitle) 
            VALUES (@id, @firstName, @lastName, @email, @password, @role, @department, @departmentId, @projectIds, @joinDate, @status, @salary, @avatar, @managerId, @location, @phone, @jobTitle)`);
        
        res.json(e);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/employees/:id', async (req, res) => {
    const e = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
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
        reqSql.input('phone', sql.NVarChar, e.phone);
        reqSql.input('jobTitle', sql.NVarChar, e.jobTitle);

        await reqSql.query(`UPDATE employees SET 
            firstName=@firstName, lastName=@lastName, email=@email, password=@password, role=@role, 
            department=@department, departmentId=@departmentId, projectIds=@projectIds, joinDate=@joinDate, 
            status=@status, salary=@salary, avatar=@avatar, managerId=@managerId, location=@location, 
            phone=@phone, jobTitle=@jobTitle WHERE id=@id`);
        
        res.json(e);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/employees/:id', async (req, res) => {
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        await reqSql.query("DELETE FROM employees WHERE id = @id");
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Departments
app.get('/api/departments', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM departments");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/departments', async (req, res) => {
    const d = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, d.id);
        reqSql.input('name', sql.NVarChar, d.name);
        reqSql.input('description', sql.NVarChar, d.description);
        reqSql.input('managerId', sql.NVarChar, d.managerId);
        await reqSql.query("INSERT INTO departments (id, name, description, managerId) VALUES (@id, @name, @description, @managerId)");
        res.json(d);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/departments/:id', async (req, res) => {
    const d = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        reqSql.input('name', sql.NVarChar, d.name);
        reqSql.input('description', sql.NVarChar, d.description);
        reqSql.input('managerId', sql.NVarChar, d.managerId);
        await reqSql.query("UPDATE departments SET name=@name, description=@description, managerId=@managerId WHERE id=@id");
        res.json(d);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/departments/:id', async (req, res) => {
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        await reqSql.query("DELETE FROM departments WHERE id = @id");
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Projects
app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM projects");
        res.json(result.recordset.map(r => ({ ...r, tasks: parseJSON(r.tasks) || [] })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/projects', async (req, res) => {
    const p = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, p.id);
        reqSql.input('name', sql.NVarChar, p.name);
        reqSql.input('description', sql.NVarChar, p.description);
        reqSql.input('status', sql.NVarChar, p.status);
        reqSql.input('tasks', sql.NVarChar, JSON.stringify(p.tasks));
        reqSql.input('dueDate', sql.NVarChar, p.dueDate);
        await reqSql.query("INSERT INTO projects (id, name, description, status, tasks, dueDate) VALUES (@id, @name, @description, @status, @tasks, @dueDate)");
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/projects/:id', async (req, res) => {
    const p = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        reqSql.input('name', sql.NVarChar, p.name);
        reqSql.input('description', sql.NVarChar, p.description);
        reqSql.input('status', sql.NVarChar, p.status);
        reqSql.input('tasks', sql.NVarChar, JSON.stringify(p.tasks));
        reqSql.input('dueDate', sql.NVarChar, p.dueDate);
        await reqSql.query("UPDATE projects SET name=@name, description=@description, status=@status, tasks=@tasks, dueDate=@dueDate WHERE id=@id");
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        await reqSql.query("DELETE FROM projects WHERE id = @id");
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Leaves
app.get('/api/leaves', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM leaves");
        res.json(result.recordset.map(r => ({ 
            ...r, 
            notifyUserIds: parseJSON(r.notifyUserIds) || [],
            managerConsent: !!r.managerConsent,
            isUrgent: !!r.isUrgent
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        reqSql.input('attachmentUrl', sql.NVarChar, l.attachmentUrl);
        reqSql.input('managerConsent', sql.Bit, l.managerConsent ? 1 : 0);
        reqSql.input('notifyUserIds', sql.NVarChar, JSON.stringify(l.notifyUserIds));
        reqSql.input('approverId', sql.NVarChar, l.approverId);
        reqSql.input('isUrgent', sql.Bit, l.isUrgent ? 1 : 0);
        reqSql.input('managerComment', sql.NVarChar, l.managerComment);
        reqSql.input('hrComment', sql.NVarChar, l.hrComment);
        reqSql.input('createdAt', sql.NVarChar, l.createdAt);
        reqSql.input('employeeId', sql.NVarChar, l.employeeId);
        reqSql.input('employeeName', sql.NVarChar, l.employeeName);

        await reqSql.query(`INSERT INTO leaves (id, userId, userName, type, startDate, endDate, reason, status, attachmentUrl, managerConsent, notifyUserIds, approverId, isUrgent, managerComment, hrComment, createdAt, employeeId, employeeName) 
        VALUES (@id, @userId, @userName, @type, @startDate, @endDate, @reason, @status, @attachmentUrl, @managerConsent, @notifyUserIds, @approverId, @isUrgent, @managerComment, @hrComment, @createdAt, @employeeId, @employeeName)`);
        res.json(l);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/leaves/:id', async (req, res) => {
    const l = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        reqSql.input('userId', sql.NVarChar, l.userId);
        reqSql.input('userName', sql.NVarChar, l.userName);
        reqSql.input('type', sql.NVarChar, l.type);
        reqSql.input('startDate', sql.NVarChar, l.startDate);
        reqSql.input('endDate', sql.NVarChar, l.endDate);
        reqSql.input('reason', sql.NVarChar, l.reason);
        reqSql.input('status', sql.NVarChar, l.status);
        reqSql.input('attachmentUrl', sql.NVarChar, l.attachmentUrl);
        reqSql.input('managerConsent', sql.Bit, l.managerConsent ? 1 : 0);
        reqSql.input('notifyUserIds', sql.NVarChar, JSON.stringify(l.notifyUserIds));
        reqSql.input('approverId', sql.NVarChar, l.approverId);
        reqSql.input('isUrgent', sql.Bit, l.isUrgent ? 1 : 0);
        reqSql.input('managerComment', sql.NVarChar, l.managerComment);
        reqSql.input('hrComment', sql.NVarChar, l.hrComment);

        await reqSql.query(`UPDATE leaves SET userId=@userId, userName=@userName, type=@type, startDate=@startDate, endDate=@endDate, reason=@reason, status=@status, attachmentUrl=@attachmentUrl, managerConsent=@managerConsent, notifyUserIds=@notifyUserIds, approverId=@approverId, isUrgent=@isUrgent, managerComment=@managerComment, hrComment=@hrComment WHERE id=@id`);
        res.json(l);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Leave Types
app.get('/api/leave_types', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM leave_types");
        res.json(result.recordset.map(r => ({ ...r, isActive: !!r.isActive })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/leave_types', async (req, res) => {
    const t = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, t.id);
        reqSql.input('name', sql.NVarChar, t.name);
        reqSql.input('days', sql.Int, t.days);
        reqSql.input('description', sql.NVarChar, t.description);
        reqSql.input('isActive', sql.Bit, t.isActive ? 1 : 0);
        reqSql.input('color', sql.NVarChar, t.color);
        await reqSql.query("INSERT INTO leave_types (id, name, days, description, isActive, color) VALUES (@id, @name, @days, @description, @isActive, @color)");
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/leave_types/:id', async (req, res) => {
    const t = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        reqSql.input('name', sql.NVarChar, t.name);
        reqSql.input('days', sql.Int, t.days);
        reqSql.input('description', sql.NVarChar, t.description);
        reqSql.input('isActive', sql.Bit, t.isActive ? 1 : 0);
        reqSql.input('color', sql.NVarChar, t.color);
        await reqSql.query("UPDATE leave_types SET name=@name, days=@days, description=@description, isActive=@isActive, color=@color WHERE id=@id");
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/leave_types/:id', async (req, res) => {
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        await reqSql.query("DELETE FROM leave_types WHERE id = @id");
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Attendance
app.get('/api/attendance', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM attendance");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        reqSql.input('checkOut', sql.NVarChar, a.checkOut);
        reqSql.input('checkInTime', sql.NVarChar, a.checkInTime);
        reqSql.input('checkOutTime', sql.NVarChar, a.checkOutTime);
        reqSql.input('status', sql.NVarChar, a.status);
        reqSql.input('notes', sql.NVarChar, a.notes);
        await reqSql.query("INSERT INTO attendance (id, employeeId, employeeName, date, checkIn, checkOut, checkInTime, checkOutTime, status, notes) VALUES (@id, @employeeId, @employeeName, @date, @checkIn, @checkOut, @checkInTime, @checkOutTime, @status, @notes)");
        res.json(a);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/attendance/:id', async (req, res) => {
    const a = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        reqSql.input('checkOut', sql.NVarChar, a.checkOut);
        reqSql.input('checkOutTime', sql.NVarChar, a.checkOutTime);
        reqSql.input('status', sql.NVarChar, a.status);
        reqSql.input('notes', sql.NVarChar, a.notes);
        await reqSql.query("UPDATE attendance SET checkOut=@checkOut, checkOutTime=@checkOutTime, status=@status, notes=@notes WHERE id=@id");
        res.json(a);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Time Entries
app.get('/api/time_entries', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM time_entries");
        res.json(result.recordset.map(r => ({ ...r, isBillable: !!r.isBillable })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/time_entries', async (req, res) => {
    const t = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, t.id);
        reqSql.input('userId', sql.NVarChar, t.userId);
        reqSql.input('projectId', sql.NVarChar, t.projectId);
        reqSql.input('task', sql.NVarChar, t.task);
        reqSql.input('date', sql.NVarChar, t.date);
        reqSql.input('durationMinutes', sql.Int, t.durationMinutes);
        reqSql.input('description', sql.NVarChar, t.description);
        reqSql.input('status', sql.NVarChar, t.status);
        reqSql.input('isBillable', sql.Bit, t.isBillable ? 1 : 0);
        await reqSql.query("INSERT INTO time_entries (id, userId, projectId, task, date, durationMinutes, description, status, isBillable) VALUES (@id, @userId, @projectId, @task, @date, @durationMinutes, @description, @status, @isBillable)");
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/time_entries/:id', async (req, res) => {
    const t = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        reqSql.input('userId', sql.NVarChar, t.userId);
        reqSql.input('projectId', sql.NVarChar, t.projectId);
        reqSql.input('task', sql.NVarChar, t.task);
        reqSql.input('date', sql.NVarChar, t.date);
        reqSql.input('durationMinutes', sql.Int, t.durationMinutes);
        reqSql.input('description', sql.NVarChar, t.description);
        reqSql.input('status', sql.NVarChar, t.status);
        reqSql.input('isBillable', sql.Bit, t.isBillable ? 1 : 0);
        await reqSql.query("UPDATE time_entries SET userId=@userId, projectId=@projectId, task=@task, date=@date, durationMinutes=@durationMinutes, description=@description, status=@status, isBillable=@isBillable WHERE id=@id");
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/time_entries/:id', async (req, res) => {
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        await reqSql.query("DELETE FROM time_entries WHERE id = @id");
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Notifications
app.get('/api/notifications', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM notifications");
        res.json(result.recordset.map(r => ({ ...r, read: !!r.read })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notifications', async (req, res) => {
    const n = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, n.id);
        reqSql.input('userId', sql.NVarChar, n.userId);
        reqSql.input('title', sql.NVarChar, n.title);
        reqSql.input('message', sql.NVarChar, n.message);
        reqSql.input('time', sql.NVarChar, n.time);
        reqSql.input('read', sql.Bit, n.read ? 1 : 0);
        reqSql.input('type', sql.NVarChar, n.type);
        await reqSql.query("INSERT INTO notifications (id, userId, title, message, time, [read], type) VALUES (@id, @userId, @title, @message, @time, @read, @type)");
        res.json(n);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notifications/:id/read', async (req, res) => {
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        await reqSql.query("UPDATE notifications SET [read]=1 WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notifications/read-all/:userId', async (req, res) => {
    try {
        const reqSql = pool.request();
        reqSql.input('userId', sql.NVarChar, req.params.userId);
        await reqSql.query("UPDATE notifications SET [read]=1 WHERE userId=@userId");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Holidays
app.get('/api/holidays', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM holidays");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/holidays', async (req, res) => {
    const h = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, h.id);
        reqSql.input('name', sql.NVarChar, h.name);
        reqSql.input('date', sql.NVarChar, h.date);
        reqSql.input('type', sql.NVarChar, h.type);
        await reqSql.query("INSERT INTO holidays (id, name, date, type) VALUES (@id, @name, @date, @type)");
        res.json(h);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/holidays/:id', async (req, res) => {
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, req.params.id);
        await reqSql.query("DELETE FROM holidays WHERE id = @id");
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Payslips
app.get('/api/payslips', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM payslips");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        reqSql.input('currency', sql.NVarChar, p.currency);
        reqSql.input('status', sql.NVarChar, p.status);
        reqSql.input('generatedDate', sql.NVarChar, p.generatedDate);
        reqSql.input('fileData', sql.NVarChar, p.fileData);
        reqSql.input('fileName', sql.NVarChar, p.fileName);
        
        await reqSql.query("INSERT INTO payslips (id, userId, userName, month, amount, currency, status, generatedDate, fileData, fileName) VALUES (@id, @userId, @userName, @month, @amount, @currency, @status, @generatedDate, @fileData, @fileName)");
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Start Server
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await connectDb();
});
