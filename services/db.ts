
import { Employee, LeaveRequest, LeaveTypeConfig, AttendanceRecord, Notification, Department, Project, TimeEntry, Payslip, Holiday } from '../types';

const API_BASE = 'http://localhost:8000/api';

const api = {
    get: async (endpoint: string) => {
        const res = await fetch(`${API_BASE}${endpoint}`);
        return res.json();
    },
    post: async (endpoint: string, data: any) => {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    put: async (endpoint: string, data: any) => {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    delete: async (endpoint: string) => {
        await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
    }
};

export const db = {
  // EMPLOYEES
  getEmployees: async (): Promise<Employee[]> => api.get('/employees'),
  addEmployee: async (emp: Employee) => api.post('/employees', emp),
  updateEmployee: async (emp: Employee) => api.put(`/employees/${emp.id}`, emp),
  deleteEmployee: async (id: string) => api.delete(`/employees/${id}`),

  // DEPARTMENTS
  getDepartments: async (): Promise<Department[]> => api.get('/departments'),
  addDepartment: async (dept: Department) => api.post('/departments', dept),
  updateDepartment: async (dept: Department) => api.put(`/departments/${dept.id}`, dept),
  deleteDepartment: async (id: string) => api.delete(`/departments/${id}`),

  // PROJECTS
  getProjects: async (): Promise<Project[]> => api.get('/projects'),
  addProject: async (proj: Project) => api.post('/projects', proj),
  updateProject: async (proj: Project) => api.put(`/projects/${proj.id}`, proj),
  deleteProject: async (id: string) => api.delete(`/projects/${id}`),

  // LEAVES
  getLeaves: async (): Promise<LeaveRequest[]> => api.get('/leaves'),
  addLeave: async (leave: LeaveRequest) => api.post('/leaves', leave),
  updateLeave: async (leave: LeaveRequest) => api.put(`/leaves/${leave.id}`, leave),

  // LEAVE TYPES
  getLeaveTypes: async (): Promise<LeaveTypeConfig[]> => api.get('/leave_types'),
  addLeaveType: async (type: LeaveTypeConfig) => api.post('/leave_types', type),
  updateLeaveType: async (type: LeaveTypeConfig) => api.put(`/leave_types/${type.id}`, type),
  deleteLeaveType: async (id: string) => api.delete(`/leave_types/${id}`),

  // ATTENDANCE
  getAttendance: async (): Promise<AttendanceRecord[]> => api.get('/attendance'),
  addAttendance: async (record: AttendanceRecord) => api.post('/attendance', record),
  updateAttendance: async (record: AttendanceRecord) => api.put(`/attendance/${record.id}`, record),

  // TIME ENTRIES
  getTimeEntries: async (): Promise<TimeEntry[]> => api.get('/time_entries'),
  addTimeEntry: async (entry: TimeEntry) => api.post('/time_entries', entry),
  updateTimeEntry: async (entry: TimeEntry) => api.put(`/time_entries/${entry.id}`, entry),
  deleteTimeEntry: async (id: string) => api.delete(`/time_entries/${id}`),

  // NOTIFICATIONS
  getNotifications: async (): Promise<Notification[]> => api.get('/notifications'),
  addNotification: async (notif: Notification) => api.post('/notifications', notif),
  markNotificationRead: async (id: string) => api.put(`/notifications/${id}/read`, {}),
  markAllNotificationsRead: async (userId: string) => api.put(`/notifications/read-all/${userId}`, {}),

  // HOLIDAYS
  getHolidays: async (): Promise<Holiday[]> => api.get('/holidays'),
  addHoliday: async (holiday: Holiday) => api.post('/holidays', holiday),
  deleteHoliday: async (id: string) => api.delete(`/holidays/${id}`),

  // PAYSLIPS
  getPayslips: async (): Promise<Payslip[]> => api.get('/payslips'),
  addPayslip: async (payslip: Payslip) => api.post('/payslips', payslip)
};
