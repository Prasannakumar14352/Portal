
import { Employee, LeaveRequest, LeaveTypeConfig, AttendanceRecord, Notification, Department, Project, TimeEntry, Payslip, Holiday } from '../types';
import { 
  mockEmployees, mockDepartments, mockProjects, mockLeaves, mockLeaveTypes, 
  mockAttendance, mockTimeEntries, mockNotifications, mockHolidays, mockPayslips 
} from './mockData';

// --- CONFIGURATION ---
// We default to FALSE to try the API, but the system will fallback to Mock if the API is unreachable.
const USE_MOCK_DATA = false; 
const API_BASE = 'http://localhost:8000/api';

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
    employees: [...mockEmployees],
    departments: [...mockDepartments],
    projects: [...mockProjects],
    leaves: [...mockLeaves],
    leaveTypes: [...mockLeaveTypes],
    attendance: [...mockAttendance],
    timeEntries: [...mockTimeEntries],
    notifications: [...mockNotifications],
    holidays: [...mockHolidays],
    payslips: [...mockPayslips]
};

// --- MOCK IMPLEMENTATION ---
const mockDb = {
    // EMPLOYEES
    getEmployees: async (): Promise<Employee[]> => Promise.resolve([...store.employees]),
    addEmployee: async (emp: Employee) => { store.employees.push(emp); return Promise.resolve(emp); },
    updateEmployee: async (emp: Employee) => {
        const idx = store.employees.findIndex(e => e.id === emp.id);
        if(idx !== -1) store.employees[idx] = emp;
        return Promise.resolve(emp);
    },
    deleteEmployee: async (id: string) => {
        store.employees = store.employees.filter(e => e.id !== id);
        return Promise.resolve();
    },

    // DEPARTMENTS
    getDepartments: async (): Promise<Department[]> => Promise.resolve([...store.departments]),
    addDepartment: async (dept: Department) => { store.departments.push(dept); return Promise.resolve(dept); },
    updateDepartment: async (dept: Department) => {
        const idx = store.departments.findIndex(d => d.id === dept.id);
        if(idx !== -1) store.departments[idx] = dept;
        return Promise.resolve(dept);
    },
    deleteDepartment: async (id: string) => {
        store.departments = store.departments.filter(d => d.id !== id);
        return Promise.resolve();
    },

    // PROJECTS
    getProjects: async (): Promise<Project[]> => Promise.resolve([...store.projects]),
    addProject: async (proj: Project) => { store.projects.push(proj); return Promise.resolve(proj); },
    updateProject: async (proj: Project) => {
        const idx = store.projects.findIndex(p => p.id === proj.id);
        if(idx !== -1) store.projects[idx] = proj;
        return Promise.resolve(proj);
    },
    deleteProject: async (id: string) => {
        store.projects = store.projects.filter(p => p.id !== id);
        return Promise.resolve();
    },

    // LEAVES
    getLeaves: async (): Promise<LeaveRequest[]> => Promise.resolve([...store.leaves]),
    addLeave: async (leave: LeaveRequest) => { store.leaves.push(leave); return Promise.resolve(leave); },
    updateLeave: async (leave: LeaveRequest) => {
        const idx = store.leaves.findIndex(l => l.id === leave.id);
        if(idx !== -1) store.leaves[idx] = leave;
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

    // ATTENDANCE
    getAttendance: async (): Promise<AttendanceRecord[]> => Promise.resolve([...store.attendance]),
    addAttendance: async (record: AttendanceRecord) => { store.attendance.push(record); return Promise.resolve(record); },
    updateAttendance: async (record: AttendanceRecord) => {
        const idx = store.attendance.findIndex(a => a.id === record.id);
        if(idx !== -1) store.attendance[idx] = record;
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

    // NOTIFICATIONS
    getNotifications: async (): Promise<Notification[]> => Promise.resolve([...store.notifications]),
    addNotification: async (notif: Notification) => { store.notifications.push(notif); return Promise.resolve(notif); },
    markNotificationRead: async (id: string) => {
        const idx = store.notifications.findIndex(n => n.id === id);
        if(idx !== -1) store.notifications[idx].read = true;
        return Promise.resolve();
    },
    markAllNotificationsRead: async (userId: string) => {
        store.notifications.forEach(n => {
            if(n.userId === userId) n.read = true;
        });
        return Promise.resolve();
    },

    // HOLIDAYS
    getHolidays: async (): Promise<Holiday[]> => Promise.resolve([...store.holidays]),
    addHoliday: async (holiday: Holiday) => { store.holidays.push(holiday); return Promise.resolve(holiday); },
    deleteHoliday: async (id: string) => {
        store.holidays = store.holidays.filter(h => h.id !== id);
        return Promise.resolve();
    },

    // PAYSLIPS
    getPayslips: async (): Promise<Payslip[]> => Promise.resolve([...store.payslips]),
    addPayslip: async (payslip: Payslip) => { store.payslips.push(payslip); return Promise.resolve(payslip); }
};

// --- REAL IMPLEMENTATION OBJECT ---
const apiDb = {
  getEmployees: () => api.get('/employees'),
  addEmployee: (emp: Employee) => api.post('/employees', emp),
  updateEmployee: (emp: Employee) => api.put(`/employees/${emp.id}`, emp),
  deleteEmployee: (id: string) => api.delete(`/employees/${id}`),

  getDepartments: () => api.get('/departments'),
  addDepartment: (dept: Department) => api.post('/departments', dept),
  updateDepartment: (dept: Department) => api.put(`/departments/${dept.id}`, dept),
  deleteDepartment: (id: string) => api.delete(`/departments/${id}`),

  getProjects: () => api.get('/projects'),
  addProject: (proj: Project) => api.post('/projects', proj),
  updateProject: (proj: Project) => api.put(`/projects/${proj.id}`, proj),
  deleteProject: (id: string) => api.delete(`/projects/${id}`),

  getLeaves: () => api.get('/leaves'),
  addLeave: (leave: LeaveRequest) => api.post('/leaves', leave),
  updateLeave: (leave: LeaveRequest) => api.put(`/leaves/${leave.id}`, leave),

  getLeaveTypes: () => api.get('/leave_types'),
  addLeaveType: (type: LeaveTypeConfig) => api.post('/leave_types', type),
  updateLeaveType: (type: LeaveTypeConfig) => api.put(`/leave_types/${type.id}`, type),
  deleteLeaveType: (id: string) => api.delete(`/leave_types/${id}`),

  getAttendance: () => api.get('/attendance'),
  addAttendance: (record: AttendanceRecord) => api.post('/attendance', record),
  updateAttendance: (record: AttendanceRecord) => api.put(`/attendance/${record.id}`, record),

  getTimeEntries: () => api.get('/time_entries'),
  addTimeEntry: (entry: TimeEntry) => api.post('/time_entries', entry),
  updateTimeEntry: (entry: TimeEntry) => api.put(`/time_entries/${entry.id}`, entry),
  deleteTimeEntry: (id: string) => api.delete(`/time_entries/${id}`),

  getNotifications: () => api.get('/notifications'),
  addNotification: (notif: Notification) => api.post('/notifications', notif),
  markNotificationRead: (id: string) => api.put(`/notifications/${id}/read`, {}),
  markAllNotificationsRead: (userId: string) => api.put(`/notifications/read-all/${userId}`, {}),

  getHolidays: () => api.get('/holidays'),
  addHoliday: (holiday: Holiday) => api.post('/holidays', holiday),
  deleteHoliday: (id: string) => api.delete(`/holidays/${id}`),

  getPayslips: () => api.get('/payslips'),
  addPayslip: (payslip: Payslip) => api.post('/payslips', payslip)
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
