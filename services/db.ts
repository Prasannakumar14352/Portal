
import { Employee, LeaveRequest, LeaveTypeConfig, AttendanceRecord, Notification, Department, Project, TimeEntry, Payslip, Holiday, Role } from '../types';
import { 
  mockEmployees, mockDepartments, mockProjects, mockLeaves, mockLeaveTypes, 
  mockAttendance, mockTimeEntries, mockNotifications, mockHolidays, mockPayslips, mockRoles
} from './mockData';

// --- CONFIGURATION ---
// Controlled via .env file (VITE_USE_MOCK_DATA=true/false)
const USE_MOCK_DATA = process.env.VITE_USE_MOCK_DATA === 'true'; // Strict check: defaults to real API if not explicitly 'true'
const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

console.log(`[DB Service] Initialized. Mode: ${USE_MOCK_DATA ? 'MOCK DATA' : 'REAL API'}`);

// --- REAL API IMPLEMENTATION ---
const api = {
    get: async (endpoint: string) => {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error(`API GET Error: ${res.status} ${res.statusText}`);
        return res.json();
    },
    post: async (endpoint: string, data: any) => {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`API POST Error: ${res.status} ${res.statusText}`);
        return res.json();
    },
    put: async (endpoint: string, data: any) => {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`API PUT Error: ${res.status} ${res.statusText}`);
        return res.json();
    },
    delete: async (endpoint: string) => {
        const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
        if (!res.ok) {
            const errorText = await res.text().catch(() => res.statusText);
            throw new Error(`API DELETE Error: ${res.status} ${errorText}`);
        }
    }
};

// --- MOCK DATA STORE ---
const store = {
    employees: [...mockEmployees],
    departments: [...mockDepartments],
    roles: [...mockRoles],
    projects: [...mockProjects],
    leaves: [...mockLeaves],
    leaveTypes: [...mockLeaveTypes],
    attendance: [...mockAttendance],
    timeEntries: [...mockTimeEntries],
    notifications: [...mockNotifications],
    holidays: [...mockHolidays],
    payslips: [...mockPayslips]
};

// --- MOCK DB IMPLEMENTATION ---
const mockDb = {
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
    getRoles: async (): Promise<Role[]> => Promise.resolve([...store.roles]),
    addRole: async (role: Role) => { store.roles.push(role); return Promise.resolve(role); },
    updateRole: async (role: Role) => {
        const idx = store.roles.findIndex(r => r.id === role.id);
        if(idx !== -1) store.roles[idx] = role;
        return Promise.resolve(role);
    },
    deleteRole: async (id: string) => {
        store.roles = store.roles.filter(r => r.id !== id);
        return Promise.resolve();
    },
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
    getLeaves: async (): Promise<LeaveRequest[]> => Promise.resolve([...store.leaves]),
    addLeave: async (leave: LeaveRequest) => { store.leaves.push(leave); return Promise.resolve(leave); },
    updateLeave: async (leave: LeaveRequest) => {
        const idx = store.leaves.findIndex(l => l.id === leave.id);
        if(idx !== -1) store.leaves[idx] = leave;
        return Promise.resolve(leave);
    },
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
    getAttendance: async (): Promise<AttendanceRecord[]> => Promise.resolve([...store.attendance]),
    addAttendance: async (record: AttendanceRecord) => { store.attendance.push(record); return Promise.resolve(record); },
    updateAttendance: async (record: AttendanceRecord) => {
        const idx = store.attendance.findIndex(a => a.id === record.id);
        if(idx !== -1) store.attendance[idx] = record;
        return Promise.resolve(record);
    },
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
    getNotifications: async (): Promise<Notification[]> => Promise.resolve([...store.notifications]),
    addNotification: async (notif: Notification) => { store.notifications.push(notif); return Promise.resolve(notif); },
    markNotificationRead: async (id: string) => {
        const idx = store.notifications.findIndex(n => n.id === id);
        if(idx !== -1) store.notifications[idx].read = true;
        return Promise.resolve();
    },
    markAllNotificationsRead: async (userId: string) => {
        store.notifications.forEach(n => { if(n.userId === userId) n.read = true; });
        return Promise.resolve();
    },
    getHolidays: async (): Promise<Holiday[]> => Promise.resolve([...store.holidays]),
    addHoliday: async (holiday: Holiday) => { store.holidays.push(holiday); return Promise.resolve(holiday); },
    deleteHoliday: async (id: string) => { store.holidays = store.holidays.filter(h => h.id !== id); return Promise.resolve(); },
    getPayslips: async (): Promise<Payslip[]> => Promise.resolve([...store.payslips]),
    addPayslip: async (payslip: Payslip) => { store.payslips.push(payslip); return Promise.resolve(payslip); }
};

// --- REAL API DB IMPLEMENTATION ---
const apiDb = {
  getEmployees: () => api.get('/employees'),
  addEmployee: (emp: Employee) => api.post('/employees', emp),
  updateEmployee: (emp: Employee) => api.put(`/employees/${emp.id}`, emp),
  deleteEmployee: (id: string) => api.delete(`/employees/${id}`),

  getDepartments: () => api.get('/departments'),
  addDepartment: (dept: Department) => api.post('/departments', dept),
  updateDepartment: (dept: Department) => api.put(`/departments/${dept.id}`, dept),
  deleteDepartment: (id: string) => api.delete(`/departments/${id}`),

  getRoles: () => api.get('/roles'),
  addRole: (role: Role) => api.post('/roles', role),
  updateRole: (role: Role) => api.put(`/roles/${role.id}`, role),
  deleteRole: (id: string) => api.delete(`/roles/${id}`),

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

// --- HYBRID DB PROXY ---
const createHybridDb = () => {
    return new Proxy(mockDb, {
        get(target, prop: string) {
            return async (...args: any[]) => {
                const isMutation = prop.startsWith('add') || prop.startsWith('update') || prop.startsWith('delete') || prop.startsWith('mark');
                
                // 1. If explicit MOCK mode, just use mockDb
                if (USE_MOCK_DATA) {
                    return (mockDb[prop as keyof typeof mockDb] as Function)(...args);
                }
                
                // 2. REAL API Mode
                try {
                    if (apiDb[prop as keyof typeof apiDb]) {
                        return await (apiDb[prop as keyof typeof apiDb] as Function)(...args);
                    }
                    // If method doesn't exist in apiDb, fallback to mockDb
                    return (mockDb[prop as keyof typeof mockDb] as Function)(...args);
                } catch (error) {
                    // CRITICAL: Mutations must NOT fallback to mock data silently in real API mode
                    if (isMutation) {
                        console.error(`[DB] Critical API error during mutation (${prop}):`, error);
                        throw error; // Propagate error to context so user knows it failed
                    }
                    
                    // GET requests can fallback for resilience
                    console.warn(`[DB] API read failed for ${String(prop)}, falling back to local Mock Data.`, error);
                    return (mockDb[prop as keyof typeof mockDb] as Function)(...args);
                }
            };
        }
    });
};

export const db = createHybridDb();
