
import { Employee, LeaveRequest, LeaveTypeConfig, AttendanceRecord, Notification, Department, Project, TimeEntry, Payslip, Holiday } from '../types';
import { 
  mockEmployees, mockDepartments, mockProjects, mockLeaves, mockLeaveTypes, 
  mockAttendance, mockTimeEntries, mockNotifications, mockHolidays, mockPayslips 
} from './mockData';

// --- CONFIGURATION ---
// Controlled via .env file (VITE_USE_MOCK_DATA=true/false)
// Defaults to TRUE if the variable is missing to ensure the app works out of the box.
const USE_MOCK_DATA = process.env.VITE_USE_MOCK_DATA === 'false' ? false : true;
const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

console.log(`[DB Service] Initialized. Mode: ${USE_MOCK_DATA ? 'MOCK DATA' : 'REAL API'}`);

// --- REAL API IMPLEMENTATION ---
const api = {
    get: async (endpoint: string) => {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        return res.json();
    },
    post: async (endpoint: string, data: any) => {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        return res.json();
    },
    put: async (endpoint: string, data: any) => {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        return res.json();
    },
    delete: async (endpoint: string) => {
        const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    }
};

// --- MOCK DATA STORE ---
// Mutable store for the session
const store = {
    Employees: [...mockEmployees],
    Departments: [...mockDepartments],
    Projects: [...mockProjects],
    Leaves: [...mockLeaves],
    leaveTypes: [...mockLeaveTypes],
    Attendance: [...mockAttendance],
    timeEntries: [...mockTimeEntries],
    Notifications: [...mockNotifications],
    Holidays: [...mockHolidays],
    Payslips: [...mockPayslips]
};

// --- MOCK IMPLEMENTATION ---
const mockDb = {
    // Employees
    getEmployees: async (): Promise<Employee[]> => Promise.resolve([...store.Employees]),
    addEmployee: async (emp: Employee) => { store.Employees.push(emp); return Promise.resolve(emp); },
    updateEmployee: async (emp: Employee) => {
        const idx = store.Employees.findIndex(e => e.id === emp.id);
        if(idx !== -1) store.Employees[idx] = emp;
        return Promise.resolve(emp);
    },
    deleteEmployee: async (id: string) => {
        store.Employees = store.Employees.filter(e => e.id !== id);
        return Promise.resolve();
    },

    // Departments
    getDepartments: async (): Promise<Department[]> => Promise.resolve([...store.Departments]),
    addDepartment: async (dept: Department) => { store.Departments.push(dept); return Promise.resolve(dept); },
    updateDepartment: async (dept: Department) => {
        const idx = store.Departments.findIndex(d => d.id === dept.id);
        if(idx !== -1) store.Departments[idx] = dept;
        return Promise.resolve(dept);
    },
    deleteDepartment: async (id: string) => {
        store.Departments = store.Departments.filter(d => d.id !== id);
        return Promise.resolve();
    },

    // Projects
    getProjects: async (): Promise<Project[]> => Promise.resolve([...store.Projects]),
    addProject: async (proj: Project) => { store.Projects.push(proj); return Promise.resolve(proj); },
    updateProject: async (proj: Project) => {
        const idx = store.Projects.findIndex(p => p.id === proj.id);
        if(idx !== -1) store.Projects[idx] = proj;
        return Promise.resolve(proj);
    },
    deleteProject: async (id: string) => {
        store.Projects = store.Projects.filter(p => p.id !== id);
        return Promise.resolve();
    },

    // Leaves
    getLeaves: async (): Promise<LeaveRequest[]> => Promise.resolve([...store.Leaves]),
    addLeave: async (leave: LeaveRequest) => { store.Leaves.push(leave); return Promise.resolve(leave); },
    updateLeave: async (leave: LeaveRequest) => {
        const idx = store.Leaves.findIndex(l => l.id === leave.id);
        if(idx !== -1) store.Leaves[idx] = leave;
        return Promise.resolve(leave);
    },

    // LEAVE TYPES
    getLeaveTypes: async (): Promise<LeaveTypeConfig[]> => Promise.resolve([...store.leaveTypes]),
    addLeaveType: async (type: LeaveTypeConfig) => { store.leaveTypes.push(type); return Promise.resolve(type); },
    updateLeaveType: async (type: LeaveTypeConfig) => {
        const idx = store.leaveTypes.findIndex(t => t.id === type.id);
        if(idx !== -1) store.leaveTypes[idx] = type;
        return Promise.resolve(type);
    },
    deleteLeaveType: async (id: string) => {
        store.leaveTypes = store.leaveTypes.filter(t => t.id !== id);
        return Promise.resolve();
    },

    // Attendance
    getAttendance: async (): Promise<AttendanceRecord[]> => Promise.resolve([...store.Attendance]),
    addAttendance: async (record: AttendanceRecord) => { store.Attendance.push(record); return Promise.resolve(record); },
    updateAttendance: async (record: AttendanceRecord) => {
        const idx = store.Attendance.findIndex(a => a.id === record.id);
        if(idx !== -1) store.Attendance[idx] = record;
        return Promise.resolve(record);
    },

    // TIME ENTRIES
    getTimeEntries: async (): Promise<TimeEntry[]> => Promise.resolve([...store.timeEntries]),
    addTimeEntry: async (entry: TimeEntry) => { store.timeEntries.push(entry); return Promise.resolve(entry); },
    updateTimeEntry: async (entry: TimeEntry) => {
        const idx = store.timeEntries.findIndex(e => e.id === entry.id);
        if(idx !== -1) store.timeEntries[idx] = entry;
        return Promise.resolve(entry);
    },
    deleteTimeEntry: async (id: string) => {
        store.timeEntries = store.timeEntries.filter(e => e.id !== id);
        return Promise.resolve();
    },

    // Notifications
    getNotifications: async (): Promise<Notification[]> => Promise.resolve([...store.Notifications]),
    addNotification: async (notif: Notification) => { store.Notifications.push(notif); return Promise.resolve(notif); },
    markNotificationRead: async (id: string) => {
        const idx = store.Notifications.findIndex(n => n.id === id);
        if(idx !== -1) store.Notifications[idx].read = true;
        return Promise.resolve();
    },
    markAllNotificationsRead: async (userId: string) => {
        store.Notifications.forEach(n => {
            if(n.userId === userId) n.read = true;
        });
        return Promise.resolve();
    },

    // Holidays
    getHolidays: async (): Promise<Holiday[]> => Promise.resolve([...store.Holidays]),
    addHoliday: async (holiday: Holiday) => { store.Holidays.push(holiday); return Promise.resolve(holiday); },
    deleteHoliday: async (id: string) => {
        store.Holidays = store.Holidays.filter(h => h.id !== id);
        return Promise.resolve();
    },

    // Payslips
    getPayslips: async (): Promise<Payslip[]> => Promise.resolve([...store.Payslips]),
    addPayslip: async (payslip: Payslip) => { store.Payslips.push(payslip); return Promise.resolve(payslip); }
};

// --- REAL IMPLEMENTATION OBJECT ---
const apiDb = {
  getEmployees: () => api.get('/Employees'),
  addEmployee: (emp: Employee) => api.post('/Employees', emp),
  updateEmployee: (emp: Employee) => api.put(`/Employees/${emp.id}`, emp),
  deleteEmployee: (id: string) => api.delete(`/Employees/${id}`),

  getDepartments: () => api.get('/Departments'),
  addDepartment: (dept: Department) => api.post('/Departments', dept),
  updateDepartment: (dept: Department) => api.put(`/Departments/${dept.id}`, dept),
  deleteDepartment: (id: string) => api.delete(`/Departments/${id}`),

  getProjects: () => api.get('/Projects'),
  addProject: (proj: Project) => api.post('/Projects', proj),
  updateProject: (proj: Project) => api.put(`/Projects/${proj.id}`, proj),
  deleteProject: (id: string) => api.delete(`/Projects/${id}`),

  getLeaves: () => api.get('/Leaves'),
  addLeave: (leave: LeaveRequest) => api.post('/Leaves', leave),
  updateLeave: (leave: LeaveRequest) => api.put(`/Leaves/${leave.id}`, leave),

  getLeaveTypes: () => api.get('/LeaveTypes'),
  addLeaveType: (type: LeaveTypeConfig) => api.post('/LeaveTypes', type),
  updateLeaveType: (type: LeaveTypeConfig) => api.put(`/LeaveTypes/${type.id}`, type),
  deleteLeaveType: (id: string) => api.delete(`/LeaveTypes/${id}`),

  getAttendance: () => api.get('/Attendance'),
  addAttendance: (record: AttendanceRecord) => api.post('/Attendance', record),
  updateAttendance: (record: AttendanceRecord) => api.put(`/Attendance/${record.id}`, record),

  getTimeEntries: () => api.get('/TimeEntries'),
  addTimeEntry: (entry: TimeEntry) => api.post('/TimeEntries', entry),
  updateTimeEntry: (entry: TimeEntry) => api.put(`/TimeEntries/${entry.id}`, entry),
  deleteTimeEntry: (id: string) => api.delete(`/TimeEntries/${id}`),

  getNotifications: () => api.get('/Notifications'),
  addNotification: (notif: Notification) => api.post('/Notifications', notif),
  markNotificationRead: (id: string) => api.put(`/Notifications/${id}/read`, {}),
  markAllNotificationsRead: (userId: string) => api.put(`/Notifications/read-all/${userId}`, {}),

  getHolidays: () => api.get('/Holidays'),
  addHoliday: (holiday: Holiday) => api.post('/Holidays', holiday),
  deleteHoliday: (id: string) => api.delete(`/Holidays/${id}`),

  getPayslips: () => api.get('/Payslips'),
  addPayslip: (payslip: Payslip) => api.post('/Payslips', payslip)
};

// --- HYBRID EXPORT ---
// This Proxy wraps calls. If USE_MOCK_DATA is true, it uses mockDb.
// If FALSE, it attempts apiDb. If apiDb fails (e.g. server not running), it catches the error and falls back to mockDb.
const createHybridDb = () => {
    return new Proxy(mockDb, {
        get(target, prop: keyof typeof mockDb) {
            return async (...args: any[]) => {
                if (USE_MOCK_DATA) {
                    return (mockDb[prop] as Function)(...args);
                }
                
                try {
                    // Try real API
                    return await (apiDb[prop] as Function)(...args);
                } catch (error) {
                    console.warn(`[DB] API call failed for ${String(prop)}, falling back to Mock Data.`);
                    // Fallback
                    return (mockDb[prop] as Function)(...args);
                }
            };
        }
    });
};

export const db = createHybridDb();
