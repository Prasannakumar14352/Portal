
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
        console.log("[DB] Synchronizing tables and performing migrations...");

        // 1. Core table definitions (using numeric ID for employees)
        const tables = [
            { name: 'employees', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='employees' AND xtype='U') CREATE TABLE employees (id INT PRIMARY KEY, employeeId NVARCHAR(50), firstName NVARCHAR(100), lastName NVARCHAR(100), email NVARCHAR(255), password NVARCHAR(255), role NVARCHAR(50), department NVARCHAR(100), departmentId NVARCHAR(50), projectIds NVARCHAR(MAX), joinDate NVARCHAR(50), status NVARCHAR(50), salary FLOAT, avatar NVARCHAR(MAX), managerId NVARCHAR(50), location NVARCHAR(MAX), phone NVARCHAR(50), jobTitle NVARCHAR(100), workLocation NVARCHAR(100))` },
            { name: 'departments', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='departments' AND xtype='U') CREATE TABLE departments (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX), managerId NVARCHAR(50))` },
            { name: 'projects', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='projects' AND xtype='U') CREATE TABLE projects (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX), status NVARCHAR(50), tasks NVARCHAR(MAX), dueDate NVARCHAR(50))` },
            { name: 'leaves', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leaves' AND xtype='U') CREATE TABLE leaves (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(100), type NVARCHAR(50), startDate NVARCHAR(50), endDate NVARCHAR(50), reason NVARCHAR(MAX), status NVARCHAR(50), attachmentUrl NVARCHAR(MAX), managerConsent BIT, notifyUserIds NVARCHAR(MAX), approverId NVARCHAR(50), isUrgent BIT, managerComment NVARCHAR(MAX), hrComment NVARCHAR(MAX), createdAt NVARCHAR(50), employeeId NVARCHAR(50), employeeName NVARCHAR(100))` },
            { name: 'leave_types', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leave_types' AND xtype='U') CREATE TABLE leave_types (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), days INT, description NVARCHAR(MAX), isActive BIT, color NVARCHAR(50))` },
            { name: 'attendance', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='attendance' AND xtype='U') CREATE TABLE attendance (id NVARCHAR(50) PRIMARY KEY, employeeId NVARCHAR(50), employeeName NVARCHAR(100), date NVARCHAR(50), checkIn NVARCHAR(50), checkOut NVARCHAR(50), checkInTime NVARCHAR(50), checkOutTime NVARCHAR(50), status NVARCHAR(50), notes NVARCHAR(MAX), workLocation NVARCHAR(100))` },
            { name: 'time_entries', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='time_entries' AND xtype='U') CREATE TABLE time_entries (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), projectId NVARCHAR(50), task NVARCHAR(100), date NVARCHAR(50), durationMinutes INT, description NVARCHAR(MAX), status NVARCHAR(50), isBillable BIT, isExtra BIT, extraMinutes INT)` },
            { name: 'notifications', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U') CREATE TABLE notifications (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), title NVARCHAR(255), message NVARCHAR(MAX), time NVARCHAR(50), [read] BIT, type NVARCHAR(50))` },
            { name: 'holidays', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='holidays' AND xtype='U') CREATE TABLE holidays (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), date NVARCHAR(50), type NVARCHAR(50))` },
            { name: 'payslips', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='payslips' AND xtype='U') CREATE TABLE payslips (id NVARCHAR(50) PRIMARY KEY, userId NVARCHAR(50), userName NVARCHAR(100), month NVARCHAR(50), amount FLOAT, currency NVARCHAR(10), status NVARCHAR(50), generatedDate NVARCHAR(50), fileData NVARCHAR(MAX), fileName NVARCHAR(255))` },
            { name: 'roles', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U') CREATE TABLE roles (id NVARCHAR(50) PRIMARY KEY, name NVARCHAR(100), description NVARCHAR(MAX))` }
        ];

        for (const table of tables) {
            await request.query(table.query);
            console.log(`[DB] Verified table: ${table.name}`);
        }
        
        // 2. Dynamic column migrations (Ensuring missing columns are added to existing tables)
        const migrations = [
            { table: 'employees', column: 'employeeId', type: 'NVARCHAR(50)' },
            { table: 'employees', column: 'workLocation', type: 'NVARCHAR(100)' },
            { table: 'employees', column: 'jobTitle', type: 'NVARCHAR(100)' },
            { table: 'employees', column: 'phone', type: 'NVARCHAR(50)' },
            { table: 'attendance', column: 'workLocation', type: 'NVARCHAR(100)' },
            { table: 'time_entries', column: 'isExtra', type: 'BIT DEFAULT 0' },
            { table: 'time_entries', column: 'extraMinutes', type: 'INT DEFAULT 0' }
        ];

        for (const m of migrations) {
            await request.query(`IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'${m.column}' AND Object_ID = Object_ID(N'${m.table}')) ALTER TABLE ${m.table} ADD ${m.column} ${m.type}`);
            console.log(`[DB] Migration check: ${m.table}.${m.column}`);
        }

        // 3. Special handling for numeric 'id' conversion in employees
        const typeInfo = await request.query(`SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employees' AND COLUMN_NAME = 'id'`);
        if (typeInfo.recordset.length > 0 && typeInfo.recordset[0].DATA_TYPE !== 'int') {
            console.log("[DB] Detected non-int ID for employees. Attempting conversion...");
            try {
                await request.query(`
                    DECLARE @ConstraintName nvarchar(200)
                    SELECT @ConstraintName = Name FROM sys.key_constraints WHERE [type] = 'PK' AND [parent_object_id] = Object_id('employees')
                    IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE employees DROP CONSTRAINT ' + @ConstraintName)
                    
                    -- Only alter if records can be cast to int, else this will fail gracefully via catch
                    ALTER TABLE employees ALTER COLUMN id INT NOT NULL
                    ALTER TABLE employees ADD CONSTRAINT PK_employees PRIMARY KEY (id)
                `);
                console.log("[DB] Successfully converted employees.id to INT.");
            } catch (e) {
                console.error("[DB] Failed to convert id to int automatically (non-numeric data present):", e.message);
            }
        }

        console.log("✅ [DB] Initialization complete.");
    } catch (err) {
        console.error("❌ [DB] Initialization FAILED:", err);
    }
};

// --- API ROUTER ---
const apiRouter = express.Router();

// Employees
apiRouter.get('/employees', async (req, res) => {
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

apiRouter.post('/employees', async (req, res) => {
    const e = req.body;
    const numericId = parseInt(e.id);
    if (isNaN(numericId)) {
        return res.status(400).json({ error: "Validation failed for parameter 'id'. Expected a numeric string or number." });
    }
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.Int, numericId);
        reqSql.input('employeeId', sql.NVarChar, e.employeeId);
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
            (id, employeeId, firstName, lastName, email, password, role, department, departmentId, projectIds, joinDate, status, salary, avatar, managerId, location, workLocation, phone, jobTitle) 
            VALUES (@id, @employeeId, @firstName, @lastName, @email, @password, @role, @department, @departmentId, @projectIds, @joinDate, @status, @salary, @avatar, @managerId, @location, @workLocation, @phone, @jobTitle)`);
        res.json(e);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/employees/:id', async (req, res) => {
    const e = req.body;
    const { id } = req.params;
    const numericId = parseInt(id);
    if (isNaN(numericId)) {
        return res.status(400).json({ error: "Validation failed for parameter 'id'. Expected a numeric string or number." });
    }
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.Int, numericId);
        reqSql.input('employeeId', sql.NVarChar, e.employeeId);
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
            employeeId=@employeeId, firstName=@firstName, lastName=@lastName, email=@email, password=@password, role=@role, 
            department=@department, departmentId=@departmentId, projectIds=@projectIds, joinDate=@joinDate, 
            status=@status, salary=@salary, avatar=@avatar, managerId=@managerId, location=@location, workLocation=@workLocation,
            phone=@phone, jobTitle=@jobTitle WHERE id=@id`);
        res.json(e);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/employees/:id', async (req, res) => {
    const { id } = req.params;
    const numericId = parseInt(id);
    if (isNaN(numericId)) {
        return res.status(400).json({ error: "Validation failed for parameter 'id'. Expected a numeric string or number." });
    }
    if (!pool) return res.status(503).json({ error: "Database not connected" });
    
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('id', sql.Int, numericId);

        console.log(`[SQL] Transaction: Deleting employee ${id}...`);

        // Cascade delete child records
        await request.query("DELETE FROM attendance WHERE employeeId = CAST(@id AS NVARCHAR(50))");
        await request.query("DELETE FROM leaves WHERE userId = CAST(@id AS NVARCHAR(50)) OR employeeId = CAST(@id AS NVARCHAR(50))");
        await request.query("DELETE FROM time_entries WHERE userId = CAST(@id AS NVARCHAR(50))");
        await request.query("DELETE FROM notifications WHERE userId = CAST(@id AS NVARCHAR(50))");
        await request.query("DELETE FROM payslips WHERE userId = CAST(@id AS NVARCHAR(50))");
        
        const result = await request.query("DELETE FROM employees WHERE id = @id");
        await transaction.commit();
        
        res.json({ message: "Employee and associated records deleted successfully", rowsAffected: result.rowsAffected[0] });
    } catch (err) {
        console.error(`[SQL ERROR] Delete failed for ${id}:`, err.message);
        if (transaction) await transaction.rollback().catch(() => {});
        res.status(500).json({ error: `Database deletion failed: ${err.message}` });
    }
});

// Departments
apiRouter.get('/departments', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM departments");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/departments', async (req, res) => {
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

apiRouter.put('/departments/:id', async (req, res) => {
    const d = req.body;
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('name', sql.NVarChar, d.name);
        reqSql.input('description', sql.NVarChar, d.description);
        reqSql.input('managerId', sql.NVarChar, d.managerId);
        await reqSql.query("UPDATE departments SET name=@name, description=@description, managerId=@managerId WHERE id=@id");
        res.json(d);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/departments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        await reqSql.query("DELETE FROM departments WHERE id=@id");
        res.json({ message: "Department deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Roles
apiRouter.get('/roles', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM roles");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/roles', async (req, res) => {
    const r = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, r.id);
        reqSql.input('name', sql.NVarChar, r.name);
        reqSql.input('description', sql.NVarChar, r.description);
        await reqSql.query("INSERT INTO roles (id, name, description) VALUES (@id, @name, @description)");
        res.json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/roles/:id', async (req, res) => {
    const r = req.body;
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('name', sql.NVarChar, r.name);
        reqSql.input('description', sql.NVarChar, r.description);
        await reqSql.query("UPDATE roles SET name=@name, description=@description WHERE id=@id");
        res.json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/roles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        await reqSql.query("DELETE FROM roles WHERE id=@id");
        res.json({ message: "Role deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Projects
apiRouter.get('/projects', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM projects");
        const data = result.recordset.map(p => ({ ...p, tasks: parseJSON(p.tasks) || [] }));
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/projects', async (req, res) => {
    const p = req.body;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, p.id);
        reqSql.input('name', sql.NVarChar, p.name);
        reqSql.input('description', sql.NVarChar, p.description || '');
        reqSql.input('status', sql.NVarChar, p.status);
        reqSql.input('tasks', sql.NVarChar, JSON.stringify(p.tasks || []));
        reqSql.input('dueDate', sql.NVarChar, p.dueDate || '');
        await reqSql.query("INSERT INTO projects (id, name, description, status, tasks, dueDate) VALUES (@id, @name, @description, @status, @tasks, @dueDate)");
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/projects/:id', async (req, res) => {
    const p = req.body;
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('name', sql.NVarChar, p.name);
        reqSql.input('description', sql.NVarChar, p.description || '');
        reqSql.input('status', sql.NVarChar, p.status);
        reqSql.input('tasks', sql.NVarChar, JSON.stringify(p.tasks || []));
        reqSql.input('dueDate', sql.NVarChar, p.dueDate || '');
        await reqSql.query("UPDATE projects SET name=@name, description=@description, status=@status, tasks=@tasks, dueDate=@dueDate WHERE id=@id");
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/projects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        await reqSql.query("DELETE FROM projects WHERE id=@id");
        res.json({ message: "Project deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Leaves
apiRouter.get('/leaves', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM leaves");
        const data = result.recordset.map(l => ({ ...l, notifyUserIds: parseJSON(l.notifyUserIds) || [], managerConsent: !!l.managerConsent, isUrgent: !!l.isUrgent }));
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/leaves', async (req, res) => {
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
        await reqSql.query(`INSERT INTO leaves (id, userId, userName, type, startDate, endDate, reason, status, attachmentUrl, managerConsent, notifyUserIds, approverId, isUrgent, createdAt) VALUES (@id, @userId, @userName, @type, @startDate, @endDate, @reason, @status, @attachmentUrl, @managerConsent, @notifyUserIds, @approverId, @isUrgent, @createdAt)`);
        res.json(l);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/leaves/:id', async (req, res) => {
    const l = req.body;
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('status', sql.NVarChar, l.status);
        reqSql.input('managerComment', sql.NVarChar, l.managerComment || '');
        reqSql.input('hrComment', sql.NVarChar, l.hrComment || '');
        await reqSql.query("UPDATE leaves SET status=@status, managerComment=@managerComment, hrComment=@hrComment WHERE id=@id");
        res.json(l);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Leave Types
apiRouter.get('/leave_types', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM leave_types");
        const data = result.recordset.map(t => ({ ...t, isActive: !!t.isActive }));
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/leave_types', async (req, res) => {
    const t = req.body;
    try {
        const reqSql = pool.request();
        const id = t.id || Math.random().toString(36).substr(2, 9);
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('name', sql.NVarChar, t.name);
        reqSql.input('days', sql.Int, t.days);
        reqSql.input('description', sql.NVarChar, t.description || '');
        reqSql.input('isActive', sql.Bit, t.isActive ? 1 : 0);
        reqSql.input('color', sql.NVarChar, t.color || '');
        await reqSql.query("INSERT INTO leave_types (id, name, days, description, isActive, color) VALUES (@id, @name, @days, @description, @isActive, @color)");
        res.json({ ...t, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/leave_types/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        await reqSql.query("DELETE FROM leave_types WHERE id=@id");
        res.json({ message: "Leave type deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Attendance
apiRouter.get('/attendance', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM attendance");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/attendance', async (req, res) => {
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
        res.json(a);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/attendance/:id', async (req, res) => {
    const a = req.body;
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('checkIn', sql.NVarChar, a.checkIn);
        reqSql.input('checkOut', sql.NVarChar, a.checkOut);
        reqSql.input('checkInTime', sql.NVarChar, a.checkInTime);
        reqSql.input('checkOutTime', sql.NVarChar, a.checkOutTime);
        reqSql.input('status', sql.NVarChar, a.status);
        await reqSql.query("UPDATE attendance SET checkIn=@checkIn, checkOut=@checkOut, checkInTime=@checkInTime, checkOutTime=@checkOutTime, status=@status WHERE id=@id");
        res.json(a);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Time Entries
apiRouter.get('/time_entries', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM time_entries");
        const data = result.recordset.map(r => ({ ...r, isBillable: !!r.isBillable, isExtra: !!r.isExtra, extraMinutes: r.extraMinutes || 0 }));
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/time_entries', async (req, res) => {
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
        reqSql.input('extraMinutes', sql.Int, t.extraMinutes || 0);
        reqSql.input('description', sql.NVarChar, t.description || '');
        reqSql.input('status', sql.NVarChar, t.status);
        reqSql.input('isBillable', sql.Bit, t.isBillable ? 1 : 0);
        reqSql.input('isExtra', sql.Bit, t.isExtra ? 1 : 0);
        await reqSql.query("INSERT INTO time_entries (id, userId, projectId, task, date, durationMinutes, extraMinutes, description, status, isBillable, isExtra) VALUES (@id, @userId, @projectId, @task, @date, @durationMinutes, @extraMinutes, @description, @status, @isBillable, @isExtra)");
        res.json({ ...t, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/time_entries/:id', async (req, res) => {
    const t = req.body;
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        reqSql.input('projectId', sql.NVarChar, t.projectId || '');
        reqSql.input('task', sql.NVarChar, t.task);
        reqSql.input('date', sql.NVarChar, t.date);
        reqSql.input('durationMinutes', sql.Int, t.durationMinutes);
        reqSql.input('extraMinutes', sql.Int, t.extraMinutes || 0);
        reqSql.input('description', sql.NVarChar, t.description || '');
        reqSql.input('isBillable', sql.Bit, t.isBillable ? 1 : 0);
        await reqSql.query("UPDATE time_entries SET projectId=@projectId, task=@task, date=@date, durationMinutes=@durationMinutes, extraMinutes=@extraMinutes, description=@description, isBillable=@isBillable WHERE id=@id");
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/time_entries/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        await reqSql.query("DELETE FROM time_entries WHERE id=@id");
        res.json({ message: "Time entry deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Notifications
apiRouter.get('/notifications', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM notifications");
        const data = result.recordset.map(n => ({ ...n, read: !!n.read }));
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/notifications/:id/read', async (req, res) => {
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        await reqSql.query("UPDATE notifications SET [read]=1 WHERE id=@id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/notifications/read-all/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('userId', sql.NVarChar, userId);
        await reqSql.query("UPDATE notifications SET [read]=1 WHERE userId=@userId");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Holidays
apiRouter.get('/holidays', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM holidays");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/holidays', async (req, res) => {
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

apiRouter.delete('/holidays/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const reqSql = pool.request();
        reqSql.input('id', sql.NVarChar, id);
        await reqSql.query("DELETE FROM holidays WHERE id=@id");
        res.json({ message: "Holiday deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Payslips
apiRouter.get('/payslips', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM payslips");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/payslips', async (req, res) => {
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
        await reqSql.query("INSERT INTO payslips (id, userId, userName, month, amount, currency, status, generatedDate, fileData, fileName) VALUES (@id, @userId, @userName, @month, @amount, @currency, @status, @generatedDate, @fileData, @fileName)");
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mount API Router
apiRouter.get('/test', (req, res) => res.json({ status: "ok" }));
app.use('/api', apiRouter);

app.listen(PORT, async () => {
    console.log(`🚀 Server starting on port ${PORT}`);
    await connectDb();
});
