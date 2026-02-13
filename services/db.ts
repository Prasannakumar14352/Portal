
import { Employee, LeaveRequest, LeaveTypeConfig, AttendanceRecord, Notification, Department, Project, TimeEntry, Payslip, Holiday, Role, Position, Invitation } from '../types';
import { 
  mockEmployees, mockDepartments, mockProjects, mockLeaves, mockLeaveTypes, 
  mockAttendance, mockTimeEntries, mockNotifications, mockHolidays, mockPayslips, mockRoles
} from './mockData';

// Switch default to relative '/api' path to use Vite Proxy
const API_BASE = process.env.VITE_API_BASE_URL 
    ? process.env.VITE_API_BASE_URL.replace(/\/$/, '') 
    : '/api';

const USE_MOCK_DATA = process.env.VITE_USE_MOCK_DATA === 'true';

console.log(`[DB Service] Initialized. Mode: ${USE_MOCK_DATA ? 'MOCK DATA' : 'REAL API'}`);
console.log(`[DB Service] Target URL: ${API_BASE}`);

const api = {
    get: async (endpoint: string) => {
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const res = await fetch(`${API_BASE}${path}`);
        if (!res.ok) throw new Error(`API GET Error: ${res.status} ${res.statusText}`);
        return res.json();
    },
    post: async (endpoint: string, data: any) => {
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`API POST Error: ${res.status} ${res.statusText}`);
        return res.json();
    },
    put: async (endpoint: string, data: any) => {
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(`API PUT Error: ${res.status} ${errBody.error || res.statusText}`);
        }
        return res.json();
    },
    delete: async (endpoint: string) => {
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
        if (!res.ok) {
            const errorText = await res.text().catch(() => res.statusText);
            throw new Error(`API DELETE Error: ${res.status} ${errorText}`);
        }
        return res.json();
    }
};

// Initialize Mock Store from LocalStorage or Default Mock Data
const loadMockStore = () => {
    try {
        const saved = localStorage.getItem('empower_mock_db');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn("Failed to load mock DB from localStorage", e);
    }
    return {
        employees: [...mockEmployees],
        departments: [...mockDepartments],
        roles: [...mockRoles],
        positions: [] as Position[],
        projects: [...mockProjects],
        leaves: [...mockLeaves],
        leaveTypes: [...mockLeaveTypes],
        attendance: [...mockAttendance],
        timeEntries: [...mockTimeEntries],
        notifications: [...mockNotifications],
        holidays: [...mockHolidays],
        payslips: [...mockPayslips],
        invitations: [] as Invitation[]
    };
};

const store = loadMockStore();

const saveMockStore = () => {
    try {
        localStorage.setItem('empower_mock_db', JSON.stringify(store));
    } catch (e) {
        console.error("Failed to save mock DB", e);
    }
};

const mockDb = {
    getEmployees: async (): Promise<Employee[]> => Promise.resolve([...store.employees]),
    addEmployee: async (emp: Employee) => { store.employees.push(emp); saveMockStore(); return Promise.resolve(emp); },
    bulkAddEmployees: async (emps: Employee[]) => { store.employees.push(...emps); saveMockStore(); return Promise.resolve(); },
    updateEmployee: async (emp: Employee) => {
        const idx = store.employees.findIndex(e => String(e.id) === String(emp.id));
        if(idx !== -1) { store.employees[idx] = emp; saveMockStore(); }
        return Promise.resolve(emp);
    },
    deleteEmployee: async (id: string) => {
        store.employees = store.employees.filter(e => String(e.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    getDepartments: async (): Promise<Department[]> => Promise.resolve([...store.departments]),
    addDepartment: async (dept: Department) => { store.departments.push(dept); saveMockStore(); return Promise.resolve(dept); },
    updateDepartment: async (dept: Department) => {
        const idx = store.departments.findIndex(d => String(d.id) === String(dept.id));
        if(idx !== -1) { store.departments[idx] = dept; saveMockStore(); }
        return Promise.resolve(dept);
    },
    deleteDepartment: async (id: string) => {
        store.departments = store.departments.filter(d => String(d.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    getPositions: async (): Promise<Position[]> => Promise.resolve([...store.positions]),
    addPosition: async (pos: Position) => { store.positions.push(pos); saveMockStore(); return Promise.resolve(pos); },
    updatePosition: async (pos: Position) => {
        const idx = store.positions.findIndex(p => String(p.id) === String(pos.id));
        if(idx !== -1) { store.positions[idx] = pos; saveMockStore(); }
        return Promise.resolve(pos);
    },
    deletePosition: async (id: string) => {
        store.positions = store.positions.filter(p => String(p.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    getRoles: async (): Promise<Role[]> => Promise.resolve([...store.roles]),
    addRole: async (role: Role) => { store.roles.push(role); saveMockStore(); return Promise.resolve(role); },
    updateRole: async (role: Role) => {
        const idx = store.roles.findIndex(r => String(r.id) === String(role.id));
        if(idx !== -1) { store.roles[idx] = role; saveMockStore(); }
        return Promise.resolve(role);
    },
    deleteRole: async (id: string) => {
        store.roles = store.roles.filter(r => String(r.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    getProjects: async (): Promise<Project[]> => Promise.resolve([...store.projects]),
    addProject: async (proj: Project) => { store.projects.push(proj); saveMockStore(); return Promise.resolve(proj); },
    updateProject: async (proj: Project) => {
        const idx = store.projects.findIndex(p => String(p.id) === String(proj.id));
        if(idx !== -1) { store.projects[idx] = proj; saveMockStore(); }
        return Promise.resolve(proj);
    },
    deleteProject: async (id: string) => {
        store.projects = store.projects.filter(p => String(p.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    getLeaves: async (): Promise<LeaveRequest[]> => Promise.resolve([...store.leaves]),
    addLeave: async (leave: LeaveRequest) => { store.leaves.push(leave); saveMockStore(); return Promise.resolve(leave); },
    updateLeave: async (leave: LeaveRequest) => {
        const idx = store.leaves.findIndex(l => String(l.id) === String(leave.id));
        if(idx !== -1) { store.leaves[idx] = leave; saveMockStore(); }
        return Promise.resolve(leave);
    },
    deleteLeave: async (id: string) => {
        store.leaves = store.leaves.filter(l => String(l.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    getLeaveTypes: async (): Promise<LeaveTypeConfig[]> => Promise.resolve([...store.leaveTypes]),
    addLeaveType: async (type: LeaveTypeConfig) => { store.leaveTypes.push(type); saveMockStore(); return Promise.resolve(type); },
    updateLeaveType: async (type: LeaveTypeConfig) => {
        const idx = store.leaveTypes.findIndex(t => String(t.id) === String(type.id));
        if(idx !== -1) { store.leaveTypes[idx] = type; saveMockStore(); }
        return Promise.resolve(type);
    },
    deleteLeaveType: async (id: string) => {
        store.leaveTypes = store.leaveTypes.filter(t => String(t.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    getAttendance: async (): Promise<AttendanceRecord[]> => Promise.resolve([...store.attendance]),
    addAttendance: async (record: AttendanceRecord) => { store.attendance.push(record); saveMockStore(); return Promise.resolve(record); },
    updateAttendance: async (record: AttendanceRecord) => {
        const idx = store.attendance.findIndex(a => String(a.id) === String(record.id));
        if(idx !== -1) { store.attendance[idx] = record; saveMockStore(); }
        return Promise.resolve(record);
    },
    deleteAttendance: async (id: string) => {
        store.attendance = store.attendance.filter(a => String(a.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    getTimeEntries: async (): Promise<TimeEntry[]> => Promise.resolve([...store.timeEntries]),
    addTimeEntry: async (entry: TimeEntry) => { store.timeEntries.push(entry); saveMockStore(); return Promise.resolve(entry); },
    updateTimeEntry: async (entry: TimeEntry) => {
        const idx = store.timeEntries.findIndex(e => String(e.id) === String(entry.id));
        if(idx !== -1) { store.timeEntries[idx] = entry; saveMockStore(); }
        return Promise.resolve(entry);
    },
    deleteTimeEntry: async (id: string) => {
        store.timeEntries = store.timeEntries.filter(e => String(e.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    getNotifications: async (): Promise<Notification[]> => Promise.resolve([...store.notifications]),
    addNotification: async (notif: Notification) => { store.notifications.push(notif); saveMockStore(); return Promise.resolve(notif); },
    markNotificationRead: async (id: string) => {
        const idx = store.notifications.findIndex(n => String(n.id) === String(id));
        if(idx !== -1) { store.notifications[idx].read = true; saveMockStore(); }
        return Promise.resolve();
    },
    markAllNotificationsRead: async (userId: string) => {
        store.notifications.forEach(n => { if(String(n.userId) === String(userId)) n.read = true; });
        saveMockStore();
        return Promise.resolve();
    },
    clearAllNotifications: async (userId: string) => {
        store.notifications = store.notifications.filter(n => String(n.userId) !== String(userId));
        saveMockStore();
        return Promise.resolve();
    },
    getHolidays: async (): Promise<Holiday[]> => Promise.resolve([...store.holidays]),
    addHoliday: async (holiday: Holiday) => { store.holidays.push(holiday); saveMockStore(); return Promise.resolve(holiday); },
    deleteHoliday: async (id: string) => {
        store.holidays = store.holidays.filter(h => String(h.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    getPayslips: async (): Promise<Payslip[]> => Promise.resolve([...store.payslips]),
    addPayslip: async (payslip: Payslip) => { store.payslips.push(payslip); saveMockStore(); return Promise.resolve(payslip); },
    updatePayslip: async (payslip: Payslip) => {
        const idx = store.payslips.findIndex(p => String(p.id) === String(payslip.id));
        if(idx !== -1) { store.payslips[idx] = payslip; saveMockStore(); }
        return Promise.resolve(payslip);
    },
    deletePayslip: async (id: string) => {
        store.payslips = store.payslips.filter(p => String(p.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    getInvitations: async (): Promise<Invitation[]> => Promise.resolve([...store.invitations]),
    addInvitation: async (invite: Invitation) => { store.invitations.push(invite); saveMockStore(); return Promise.resolve(invite); },
    deleteInvitation: async (id: string) => {
        store.invitations = store.invitations.filter(i => String(i.id) !== String(id));
        saveMockStore();
        return Promise.resolve();
    },
    notifyMissingTimesheets: async (targetDate: string) => { 
        console.log(`[Mock DB] Checking missing timesheets for ${targetDate}`);
        return { success: true, count: 0 }; 
    }
};

const apiDb = {
  getEmployees: async () => {
      const users = await api.get('/employees');
      // Fix for SQL/Backend potentially returning settings as string
      return users.map((u: any) => {
          if (u.settings && typeof u.settings === 'string') {
              try { u.settings = JSON.parse(u.settings); } catch(e) {}
          }
          if (u.location && typeof u.location === 'string') {
              try { u.location = JSON.parse(u.location); } catch(e) {}
          }
          if (u.projectIds && typeof u.projectIds === 'string') {
              try { u.projectIds = JSON.parse(u.projectIds); } catch(e) {}
          }
          return u;
      });
  },
  addEmployee: (emp: Employee) => api.post('/employees', emp),
  bulkAddEmployees: (emps: Employee[]) => api.post('/employees/bulk', emps),
  updateEmployee: (emp: Employee) => api.put(`/employees/${emp.id}`, emp),
  deleteEmployee: (id: string) => api.delete(`/employees/${id}`),

  getDepartments: () => api.get('/departments'),
  addDepartment: (dept: Department) => api.post('/departments', dept),
  updateDepartment: (dept: Department) => api.put(`/departments/${dept.id}`, dept),
  deleteDepartment: (id: string) => api.delete(`/departments/${id}`),

  getPositions: () => api.get('/positions'),
  addPosition: (pos: Position) => api.post('/positions', pos),
  updatePosition: (pos: Position) => api.put(`/positions/${pos.id}`, pos),
  deletePosition: (id: string) => api.delete(`/positions/${id}`),

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
  deleteLeave: (id: string) => api.delete(`/leaves/${id}`),

  getLeaveTypes: () => api.get('/leave_types'),
  addLeaveType: (type: LeaveTypeConfig) => api.post('/leave_types', type),
  updateLeaveType: (type: LeaveTypeConfig) => api.put(`/leave_types/${type.id}`, type),
  deleteLeaveType: (id: string) => api.delete(`/leave_types/${id}`),

  getAttendance: () => api.get('/attendance'),
  addAttendance: (record: AttendanceRecord) => api.post('/attendance', record),
  updateAttendance: (record: AttendanceRecord) => api.put(`/attendance/${record.id}`, record),
  deleteAttendance: (id: string) => api.delete(`/attendance/${id}`),

  getTimeEntries: () => api.get('/time_entries'),
  addTimeEntry: (entry: TimeEntry) => api.post('/time_entries', entry),
  updateTimeEntry: (entry: TimeEntry) => api.put(`/time_entries/${entry.id}`, entry),
  deleteTimeEntry: (id: string) => api.delete(`/time_entries/${id}`),

  getNotifications: () => api.get('/notifications'),
  addNotification: (notif: Notification) => api.post('/notifications', notif),
  // Updated endpoints to POST
  markNotificationRead: (id: string) => api.post('/notifications/mark-read', { id }),
  markAllNotificationsRead: (userId: string) => api.post('/notifications/mark-all-read', { userId }),
  clearAllNotifications: (userId: string) => api.post('/notifications/clear-all', { userId }),

  getHolidays: () => api.get('/holidays'),
  addHoliday: (holiday: Holiday) => api.post('/holidays', holiday),
  deleteHoliday: (id: string) => api.delete(`/holidays/${id}`),

  getPayslips: () => api.get('/payslips'),
  addPayslip: (payslip: Payslip) => api.post('/payslips', payslip),
  updatePayslip: (payslip: Payslip) => api.put(`/payslips/${payslip.id}`, payslip),
  deletePayslip: (id: string) => api.delete(`/payslips/${id}`),

  getInvitations: () => api.get('/invitations'),
  addInvitation: (invite: Invitation) => api.post('/invitations', invite),
  deleteInvitation: (id: string) => api.delete(`/invitations/${id}`),

  notifyMissingTimesheets: (targetDate: string) => api.post('/notify/missing-timesheets', { targetDate })
};

const createHybridDb = () => {
    return new Proxy(mockDb, {
        get(target, prop: string) {
            return async (...args: any[]) => {
                if (USE_MOCK_DATA) {
                    return (mockDb[prop as keyof typeof mockDb] as Function)(...args);
                }
                try {
                    if (apiDb[prop as keyof typeof apiDb]) {
                        return await (apiDb[prop as keyof typeof apiDb] as Function)(...args);
                    }
                    return (mockDb[prop as keyof typeof mockDb] as Function)(...args);
                } catch (error) {
                    console.warn(`[DB] Real API failed for ${String(prop)}. Falling back to Mock Data.`, error.message);
                    return (mockDb[prop as keyof typeof mockDb] as Function)(...args);
                }
            };
        }
    });
};

export const db = createHybridDb();
