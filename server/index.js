
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increased limit for file uploads (avatars, PDFs)

// Database Setup
const db = new sqlite3.Database('./hr_portal.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

// Helper functions for DB operations
const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// JSON Helper
const parseJSON = (str) => {
    try {
        return str ? JSON.parse(str) : null;
    } catch (e) {
        return null;
    }
};

const boolToInt = (val) => (val === true || val === 'true' ? 1 : 0);
const intToBool = (val) => val === 1;

// Initialize Database Tables
const initDb = async () => {
    try {
        await run(`CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            firstName TEXT,
            lastName TEXT,
            email TEXT,
            password TEXT,
            role TEXT,
            department TEXT,
            departmentId TEXT,
            projectIds TEXT,
            joinDate TEXT,
            status TEXT,
            salary REAL,
            avatar TEXT,
            managerId TEXT,
            location TEXT,
            phone TEXT,
            jobTitle TEXT
        )`);

        await run(`CREATE TABLE IF NOT EXISTS departments (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            managerId TEXT
        )`);

        await run(`CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            status TEXT,
            tasks TEXT,
            dueDate TEXT
        )`);

        await run(`CREATE TABLE IF NOT EXISTS leaves (
            id TEXT PRIMARY KEY,
            userId TEXT,
            userName TEXT,
            type TEXT,
            startDate TEXT,
            endDate TEXT,
            reason TEXT,
            status TEXT,
            attachmentUrl TEXT,
            managerConsent INTEGER,
            notifyUserIds TEXT,
            approverId TEXT,
            isUrgent INTEGER,
            managerComment TEXT,
            hrComment TEXT,
            createdAt TEXT,
            employeeId TEXT,
            employeeName TEXT
        )`);

        await run(`CREATE TABLE IF NOT EXISTS leave_types (
            id TEXT PRIMARY KEY,
            name TEXT,
            days INTEGER,
            description TEXT,
            isActive INTEGER,
            color TEXT
        )`);

        await run(`CREATE TABLE IF NOT EXISTS attendance (
            id TEXT PRIMARY KEY,
            employeeId TEXT,
            employeeName TEXT,
            date TEXT,
            checkIn TEXT,
            checkOut TEXT,
            checkInTime TEXT,
            checkOutTime TEXT,
            status TEXT,
            notes TEXT
        )`);

        await run(`CREATE TABLE IF NOT EXISTS time_entries (
            id TEXT PRIMARY KEY,
            userId TEXT,
            projectId TEXT,
            task TEXT,
            date TEXT,
            durationMinutes INTEGER,
            description TEXT,
            status TEXT,
            isBillable INTEGER
        )`);

        await run(`CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            userId TEXT,
            title TEXT,
            message TEXT,
            time TEXT,
            read INTEGER,
            type TEXT
        )`);

        await run(`CREATE TABLE IF NOT EXISTS holidays (
            id TEXT PRIMARY KEY,
            name TEXT,
            date TEXT,
            type TEXT
        )`);

        await run(`CREATE TABLE IF NOT EXISTS payslips (
            id TEXT PRIMARY KEY,
            userId TEXT,
            userName TEXT,
            month TEXT,
            amount REAL,
            currency TEXT,
            status TEXT,
            generatedDate TEXT,
            fileData TEXT,
            fileName TEXT
        )`);

        console.log("Database tables initialized.");
    } catch (err) {
        console.error("Error creating tables:", err);
    }
};

// --- ROUTES ---

// Employees
app.get('/api/employees', async (req, res) => {
    try {
        const rows = await get("SELECT * FROM employees");
        const employees = rows.map(e => ({
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
        await run(`INSERT INTO employees (id, firstName, lastName, email, password, role, department, departmentId, projectIds, joinDate, status, salary, avatar, managerId, location, phone, jobTitle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [e.id, e.firstName, e.lastName, e.email, e.password, e.role, e.department, e.departmentId, JSON.stringify(e.projectIds), e.joinDate, e.status, e.salary, e.avatar, e.managerId, JSON.stringify(e.location), e.phone, e.jobTitle]);
        res.json(e);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/employees/:id', async (req, res) => {
    const e = req.body;
    try {
        await run(`UPDATE employees SET firstName=?, lastName=?, email=?, password=?, role=?, department=?, departmentId=?, projectIds=?, joinDate=?, status=?, salary=?, avatar=?, managerId=?, location=?, phone=?, jobTitle=? WHERE id=?`, 
        [e.firstName, e.lastName, e.email, e.password, e.role, e.department, e.departmentId, JSON.stringify(e.projectIds), e.joinDate, e.status, e.salary, e.avatar, e.managerId, JSON.stringify(e.location), e.phone, e.jobTitle, req.params.id]);
        res.json(e);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/employees/:id', async (req, res) => {
    try {
        await run("DELETE FROM employees WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Departments
app.get('/api/departments', async (req, res) => {
    try {
        const rows = await get("SELECT * FROM departments");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/departments', async (req, res) => {
    const d = req.body;
    try {
        await run("INSERT INTO departments (id, name, description, managerId) VALUES (?, ?, ?, ?)", [d.id, d.name, d.description, d.managerId]);
        res.json(d);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/departments/:id', async (req, res) => {
    const d = req.body;
    try {
        await run("UPDATE departments SET name=?, description=?, managerId=? WHERE id=?", [d.name, d.description, d.managerId, req.params.id]);
        res.json(d);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/departments/:id', async (req, res) => {
    try {
        await run("DELETE FROM departments WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Projects
app.get('/api/projects', async (req, res) => {
    try {
        const rows = await get("SELECT * FROM projects");
        res.json(rows.map(r => ({ ...r, tasks: parseJSON(r.tasks) || [] })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/projects', async (req, res) => {
    const p = req.body;
    try {
        await run("INSERT INTO projects (id, name, description, status, tasks, dueDate) VALUES (?, ?, ?, ?, ?, ?)", 
        [p.id, p.name, p.description, p.status, JSON.stringify(p.tasks), p.dueDate]);
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/projects/:id', async (req, res) => {
    const p = req.body;
    try {
        await run("UPDATE projects SET name=?, description=?, status=?, tasks=?, dueDate=? WHERE id=?", 
        [p.name, p.description, p.status, JSON.stringify(p.tasks), p.dueDate, req.params.id]);
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        await run("DELETE FROM projects WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Leaves
app.get('/api/leaves', async (req, res) => {
    try {
        const rows = await get("SELECT * FROM leaves");
        res.json(rows.map(r => ({ 
            ...r, 
            notifyUserIds: parseJSON(r.notifyUserIds) || [],
            managerConsent: intToBool(r.managerConsent),
            isUrgent: intToBool(r.isUrgent)
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/leaves', async (req, res) => {
    const l = req.body;
    try {
        await run(`INSERT INTO leaves (id, userId, userName, type, startDate, endDate, reason, status, attachmentUrl, managerConsent, notifyUserIds, approverId, isUrgent, managerComment, hrComment, createdAt, employeeId, employeeName) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [l.id, l.userId, l.userName, l.type, l.startDate, l.endDate, l.reason, l.status, l.attachmentUrl, boolToInt(l.managerConsent), JSON.stringify(l.notifyUserIds), l.approverId, boolToInt(l.isUrgent), l.managerComment, l.hrComment, l.createdAt, l.employeeId, l.employeeName]);
        res.json(l);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/leaves/:id', async (req, res) => {
    const l = req.body;
    try {
        await run(`UPDATE leaves SET userId=?, userName=?, type=?, startDate=?, endDate=?, reason=?, status=?, attachmentUrl=?, managerConsent=?, notifyUserIds=?, approverId=?, isUrgent=?, managerComment=?, hrComment=? WHERE id=?`, 
        [l.userId, l.userName, l.type, l.startDate, l.endDate, l.reason, l.status, l.attachmentUrl, boolToInt(l.managerConsent), JSON.stringify(l.notifyUserIds), l.approverId, boolToInt(l.isUrgent), l.managerComment, l.hrComment, req.params.id]);
        res.json(l);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Leave Types
app.get('/api/leave_types', async (req, res) => {
    try {
        const rows = await get("SELECT * FROM leave_types");
        res.json(rows.map(r => ({ ...r, isActive: intToBool(r.isActive) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/leave_types', async (req, res) => {
    const t = req.body;
    try {
        await run("INSERT INTO leave_types (id, name, days, description, isActive, color) VALUES (?, ?, ?, ?, ?, ?)", 
        [t.id, t.name, t.days, t.description, boolToInt(t.isActive), t.color]);
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/leave_types/:id', async (req, res) => {
    const t = req.body;
    try {
        await run("UPDATE leave_types SET name=?, days=?, description=?, isActive=?, color=? WHERE id=?", 
        [t.name, t.days, t.description, boolToInt(t.isActive), t.color, req.params.id]);
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/leave_types/:id', async (req, res) => {
    try {
        await run("DELETE FROM leave_types WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Attendance
app.get('/api/attendance', async (req, res) => {
    try {
        const rows = await get("SELECT * FROM attendance");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance', async (req, res) => {
    const a = req.body;
    try {
        await run("INSERT INTO attendance (id, employeeId, employeeName, date, checkIn, checkOut, checkInTime, checkOutTime, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
        [a.id, a.employeeId, a.employeeName, a.date, a.checkIn, a.checkOut, a.checkInTime, a.checkOutTime, a.status, a.notes]);
        res.json(a);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/attendance/:id', async (req, res) => {
    const a = req.body;
    try {
        await run("UPDATE attendance SET checkOut=?, checkOutTime=?, status=?, notes=? WHERE id=?", 
        [a.checkOut, a.checkOutTime, a.status, a.notes, req.params.id]);
        res.json(a);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Time Entries
app.get('/api/time_entries', async (req, res) => {
    try {
        const rows = await get("SELECT * FROM time_entries");
        res.json(rows.map(r => ({ ...r, isBillable: intToBool(r.isBillable) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/time_entries', async (req, res) => {
    const t = req.body;
    try {
        await run("INSERT INTO time_entries (id, userId, projectId, task, date, durationMinutes, description, status, isBillable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", 
        [t.id, t.userId, t.projectId, t.task, t.date, t.durationMinutes, t.description, t.status, boolToInt(t.isBillable)]);
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/time_entries/:id', async (req, res) => {
    const t = req.body;
    try {
        await run("UPDATE time_entries SET userId=?, projectId=?, task=?, date=?, durationMinutes=?, description=?, status=?, isBillable=? WHERE id=?", 
        [t.userId, t.projectId, t.task, t.date, t.durationMinutes, t.description, t.status, boolToInt(t.isBillable), req.params.id]);
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/time_entries/:id', async (req, res) => {
    try {
        await run("DELETE FROM time_entries WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Notifications
app.get('/api/notifications', async (req, res) => {
    try {
        const rows = await get("SELECT * FROM notifications");
        res.json(rows.map(r => ({ ...r, read: intToBool(r.read) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notifications', async (req, res) => {
    const n = req.body;
    try {
        await run("INSERT INTO notifications (id, userId, title, message, time, read, type) VALUES (?, ?, ?, ?, ?, ?, ?)", 
        [n.id, n.userId, n.title, n.message, n.time, boolToInt(n.read), n.type]);
        res.json(n);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notifications/:id/read', async (req, res) => {
    try {
        await run("UPDATE notifications SET read=1 WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notifications/read-all/:userId', async (req, res) => {
    try {
        await run("UPDATE notifications SET read=1 WHERE userId=?", [req.params.userId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Holidays
app.get('/api/holidays', async (req, res) => {
    try {
        const rows = await get("SELECT * FROM holidays");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/holidays', async (req, res) => {
    const h = req.body;
    try {
        await run("INSERT INTO holidays (id, name, date, type) VALUES (?, ?, ?, ?)", [h.id, h.name, h.date, h.type]);
        res.json(h);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/holidays/:id', async (req, res) => {
    try {
        await run("DELETE FROM holidays WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Payslips
app.get('/api/payslips', async (req, res) => {
    try {
        const rows = await get("SELECT * FROM payslips");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payslips', async (req, res) => {
    const p = req.body;
    try {
        await run("INSERT INTO payslips (id, userId, userName, month, amount, currency, status, generatedDate, fileData, fileName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
        [p.id, p.userId, p.userName, p.month, p.amount, p.currency, p.status, p.generatedDate, p.fileData, p.fileName]);
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
