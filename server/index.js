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

        // 1. Core table definitions. Using INT for internal IDs where possible, employeeId is now explicitly INT.
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
        
        // 2. Dynamic column migrations (Ensure missing columns are added)
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
            // Check if column exists, if not add it. Handle type conversion if employeeId is not INT.
            if (m.column === 'employeeId') {
                 const colInfo = await request.query(`SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employees' AND COLUMN_NAME = 'employeeId'`);
                 if (colInfo.recordset.length > 0 && colInfo.recordset[0].DATA_TYPE.toLowerCase() !== 'int') {
                     console.log("[DB] Migrating employeeId to INT...");
                     // Strip 'EMP' if it exists and cast to INT
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

apiRouter.post