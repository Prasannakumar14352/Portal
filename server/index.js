
require('dotenv').config();
const path = require('path');

// Fallback: If running from server/ folder, try to load .env from root if variables are missing
if (!process.env.DB_NAME) {
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
        console.log("[DB] Verifying tables...");

        const tables = [
            { name: 'attendance', query: `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='attendance' AND xtype='U') CREATE TABLE attendance (id NVARCHAR(50) PRIMARY KEY, employeeId NVARCHAR(50), employeeName NVARCHAR(100), date NVARCHAR(50), checkIn NVARCHAR(50), checkOut NVARCHAR(50), checkInTime NVARCHAR(50), checkOutTime NVARCHAR(50), status NVARCHAR(50), notes NVARCHAR(MAX), workLocation NVARCHAR(100))` }
        ];

        for (const table of tables) {
            await request.query(table.query);
        }
        console.log("✅ [DB] Initialization complete.");
    } catch (err) {
        console.error("❌ [DB] Initialization FAILED:", err.message);
    }
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
        request.input('employeeId', sql.NVarChar, toStr(a.employeeId)); // Matching physical DB [employeeId]
        request.input('employeeName', sql.NVarChar, toStr(a.employeeName));
        request.input('date', sql.NVarChar, toStr(a.date));
        request.input('checkIn', sql.NVarChar, toStr(a.checkIn));
        request.input('checkOut', sql.NVarChar, toStr(a.checkOut));
        request.input('checkInTime', sql.NVarChar, toStr(a.checkInTime));
        request.input('checkOutTime', sql.NVarChar, toStr(a.checkOutTime));
        request.input('status', sql.NVarChar, toStr(a.status));
        request.input('notes', sql.NVarChar, toStr(a.notes));
        request.input('workLocation', sql.NVarChar, toStr(a.workLocation));
        
        await request.query(`INSERT INTO attendance 
            (id, employeeId, employeeName, date, checkIn, checkOut, checkInTime, checkOutTime, status, notes, workLocation) 
            VALUES (@id, @employeeId, @employeeName, @date, @checkIn, @checkOut, @checkInTime, @checkOutTime, @status, @notes, @workLocation)`);
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/attendance/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const a = req.body;
        console.log(`[DB] Updating attendance record: ${id}`);

        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(id));
        request.input('employeeId', sql.NVarChar, toStr(a.employeeId)); // Matching physical DB [employeeId]
        request.input('employeeName', sql.NVarChar, toStr(a.employeeName));
        request.input('date', sql.NVarChar, toStr(a.date));
        request.input('checkIn', sql.NVarChar, toStr(a.checkIn));
        request.input('checkOut', sql.NVarChar, toStr(a.checkOut));
        request.input('checkInTime', sql.NVarChar, toStr(a.checkInTime));
        request.input('checkOutTime', sql.NVarChar, toStr(a.checkOutTime));
        request.input('status', sql.NVarChar, toStr(a.status));
        request.input('notes', sql.NVarChar, toStr(a.notes));
        request.input('workLocation', sql.NVarChar, toStr(a.workLocation));
        
        const result = await request.query(`UPDATE attendance SET 
            employeeId=@employeeId, employeeName=@employeeName, date=@date, 
            checkIn=@checkIn, checkOut=@checkOut, checkInTime=@checkInTime, 
            checkOutTime=@checkOutTime, status=@status, notes=@notes, 
            workLocation=@workLocation 
            WHERE id=@id`);
            
        if (result.rowsAffected[0] === 0) {
            console.warn(`[DB] Record ${id} not found for update.`);
            return res.status(404).json({ error: 'Attendance record not found in database.' });
        }
        
        console.log(`[DB] Record ${id} updated successfully.`);
        res.json({ success: true });
    } catch (err) { 
        console.error(`[DB ERROR] PUT /attendance/${req.params.id}:`, err.message);
        res.status(500).json({ error: err.message }); 
    }
});

apiRouter.delete('/attendance/:id', async (req, res) => {
    try {
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(req.params.id));
        const result = await request.query("DELETE FROM attendance WHERE id=@id");
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Record not found.' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- EMPLOYEES ROUTES ---
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

apiRouter.put('/employees/:id', async (req, res) => {
    try {
        const e = req.body;
        const request = pool.request();
        request.input('id', sql.NVarChar, toStr(req.params.id));
        request.input('firstName', sql.NVarChar, toStr(e.firstName));
        request.input('lastName', sql.NVarChar, toStr(e.lastName));
        request.input('email', sql.NVarChar, toStr(e.email)); 
        request.input('role', sql.NVarChar, toStr(e.role));
        request.input('position', sql.NVarChar, toStr(e.position));
        request.input('department', sql.NVarChar, toStr(e.department));
        request.input('status', sql.NVarChar, toStr(e.status));
        request.input('salary', sql.Float, toFloat(e.salary));
        request.input('avatar', sql.NVarChar, toStr(e.avatar));
        request.input('phone', sql.NVarChar, toStr(e.phone));
        request.input('workLocation', sql.NVarChar, toStr(e.workLocation));

        const result = await request.query(`UPDATE employees SET 
            firstName=@firstName, lastName=@lastName, email=@email,
            role=@role, position=@position, department=@department, 
            status=@status, salary=@salary, avatar=@avatar, 
            phone=@phone, workLocation=@workLocation 
            WHERE id=@id`);
        
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Employee not found.' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mount routes correctly
app.use('/api', apiRouter);

// --- CATCH-ALL ROUTE ---
app.use((req, res) => {
    console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found on this server.` });
});

// Start Server
app.listen(PORT, async () => {
    console.log(`🚀 [BACKEND] HR Portal API running on http://localhost:${PORT}`);
    await connectDb();
});
