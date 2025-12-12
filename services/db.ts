import { Employee, LeaveRequest, LeaveTypeConfig, AttendanceRecord, EmployeeStatus, DepartmentType, LeaveStatus, Notification, Department, Project, TimeEntry } from '../types';

// --- SEED DATA ---

const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'd1', name: 'IT', description: 'Information Technology and Systems', managerId: 'm1' },
  { id: 'd2', name: 'HR', description: 'Human Resources and Talent Acquisition', managerId: 'hr1' },
  { id: 'd3', name: 'Sales', description: 'Sales and Business Development', managerId: 'm1' },
  { id: 'd4', name: 'Marketing', description: 'Brand and Marketing Strategy', managerId: 'm1' }
];

const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: 'Website Redesign', description: 'Overhaul of corporate website', status: 'Active', tasks: ['Design Mockups', 'Frontend Dev', 'Content Strategy'], dueDate: '2024-12-31' },
  { id: 'p2', name: 'Q3 Recruitment', description: 'Hiring for Sales and Tech', status: 'Active', tasks: ['Post Jobs', 'Screening', 'Interviews'] },
  { id: 'p3', name: 'Legacy Migration', description: 'Migrate CRM to Cloud', status: 'On Hold', tasks: ['Database Backup', 'API Mapping'] }
];

const INITIAL_EMPLOYEES: Employee[] = [
  { id: '1', firstName: 'Alice', lastName: 'Johnson', email: 'alice.j@empower.com', role: 'Software Engineer', department: 'IT', departmentId: 'd1', projectIds: ['p1', 'p3'], joinDate: '2023-01-15', status: EmployeeStatus.ACTIVE, salary: 85000, avatar: 'https://picsum.photos/seed/alice/100', managerId: 'm1' },
  { id: '2', firstName: 'Bob', lastName: 'Smith', email: 'bob.s@empower.com', role: 'Sales Manager', department: 'Sales', departmentId: 'd3', projectIds: ['p2'], joinDate: '2022-05-10', status: EmployeeStatus.ACTIVE, salary: 92000, avatar: 'https://picsum.photos/seed/bob/100', managerId: 'm1' },
  { id: '3', firstName: 'Charlie', lastName: 'Davis', email: 'charlie.d@empower.com', role: 'HR Specialist', department: 'HR', departmentId: 'd2', projectIds: ['p2'], joinDate: '2023-08-20', status: EmployeeStatus.ON_LEAVE, salary: 65000, avatar: 'https://picsum.photos/seed/charlie/100', managerId: 'hr1' },
  { id: '4', firstName: 'Diana', lastName: 'Prince', email: 'diana.p@empower.com', role: 'Marketing Lead', department: 'Marketing', departmentId: 'd4', projectIds: ['p1'], joinDate: '2021-11-01', status: EmployeeStatus.ACTIVE, salary: 88000, avatar: 'https://picsum.photos/seed/diana/100', managerId: 'm1' },
  { id: '5', firstName: 'Evan', lastName: 'Wright', email: 'evan.w@empower.com', role: 'DevOps Engineer', department: 'IT', departmentId: 'd1', projectIds: ['p3'], joinDate: '2024-02-01', status: EmployeeStatus.INACTIVE, salary: 95000, avatar: 'https://picsum.photos/seed/evan/100', managerId: 'm1' },
  { id: 'm1', firstName: 'Sarah', lastName: 'Manager', email: 'sarah.m@empower.com', role: 'Team Manager', department: 'IT', departmentId: 'd1', projectIds: ['p1', 'p2', 'p3'], joinDate: '2020-01-01', status: EmployeeStatus.ACTIVE, salary: 120000, avatar: 'https://picsum.photos/seed/sarah/100', managerId: 'hr1' },
  { id: 'hr1', firstName: 'Admin', lastName: 'User', email: 'admin@empower.com', role: 'HR Manager', department: 'HR', departmentId: 'd2', projectIds: [], joinDate: '2019-01-01', status: EmployeeStatus.ACTIVE, salary: 110000, avatar: 'https://picsum.photos/seed/admin/100' },
];

const INITIAL_LEAVE_TYPES: LeaveTypeConfig[] = [
  { id: 'lt1', name: 'Annual Leave', days: 20, description: 'Standard paid vacation time.', isActive: true, color: 'text-blue-600' },
  { id: 'lt2', name: 'Sick Leave', days: 10, description: 'Medical leave for health issues.', isActive: true, color: 'text-red-600' },
  { id: 'lt3', name: 'Casual Leave', days: 5, description: 'Short personal time off.', isActive: true, color: 'text-orange-600' },
];

const INITIAL_LEAVES: LeaveRequest[] = [
  { id: 'l1', userId: '3', userName: 'Charlie Davis', type: 'Annual Leave', startDate: '2024-05-20', endDate: '2024-05-25', reason: 'Family trip to Hawaii', status: LeaveStatus.APPROVED, approverId: 'hr1' },
  { id: 'l2', userId: '1', userName: 'Alice Johnson', type: 'Sick Leave', startDate: '2024-05-22', endDate: '2024-05-23', reason: 'Viral fever', status: LeaveStatus.PENDING_MANAGER, approverId: 'm1', isUrgent: true },
  { id: 'l3', userId: '2', userName: 'Bob Smith', type: 'Casual Leave', startDate: '2024-06-01', endDate: '2024-06-01', reason: 'Personal work', status: LeaveStatus.REJECTED, approverId: 'm1' },
];

const INITIAL_ATTENDANCE: AttendanceRecord[] = [
    { id: 'a1', employeeId: '1', employeeName: 'Alice Johnson', date: '2024-05-24', checkIn: '09:00 AM', checkOut: '06:00 PM', status: 'Present' },
    { id: 'a2', employeeId: '2', employeeName: 'Bob Smith', date: '2024-05-24', checkIn: '09:15 AM', checkOut: '06:15 PM', status: 'Present' },
    { id: 'a3', employeeId: '4', employeeName: 'Diana Prince', date: '2024-05-24', checkIn: '09:45 AM', checkOut: '06:45 PM', status: 'Late' },
    { id: 'a4', employeeId: '1', employeeName: 'Alice Johnson', date: '2024-05-25', checkIn: '09:00 AM', checkOut: '06:00 PM', status: 'Present' },
];

const INITIAL_TIME_ENTRIES: TimeEntry[] = [
  { id: 'te1', userId: '1', projectId: 'p1', task: 'Frontend Dev', date: new Date().toISOString().split('T')[0], durationMinutes: 480, description: 'Worked on React components', status: 'Pending', isBillable: true },
  { id: 'te2', userId: '1', projectId: 'p3', task: 'Database Backup', date: new Date(Date.now() - 86400000).toISOString().split('T')[0], durationMinutes: 120, description: 'Routine backup', status: 'Approved', isBillable: false },
];

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'n1', userId: '1', title: 'Welcome', message: 'Welcome to the new portal!', time: 'Now', read: false, type: 'info' }
];

const KEYS = {
  EMPLOYEES: 'emp_portal_employees',
  LEAVES: 'emp_portal_leaves',
  TYPES: 'emp_portal_leave_types',
  ATTENDANCE: 'emp_portal_attendance',
  NOTIFICATIONS: 'emp_portal_notifications',
  DEPARTMENTS: 'emp_portal_departments',
  PROJECTS: 'emp_portal_projects',
  TIME_ENTRIES: 'emp_portal_time_entries',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const db = {
  // EMPLOYEES
  getEmployees: async (): Promise<Employee[]> => {
    await delay(200);
    const data = localStorage.getItem(KEYS.EMPLOYEES);
    if (!data) {
      localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(INITIAL_EMPLOYEES));
      return INITIAL_EMPLOYEES;
    }
    return JSON.parse(data);
  },

  addEmployee: async (emp: Employee) => {
    await delay(300);
    const data = JSON.parse(localStorage.getItem(KEYS.EMPLOYEES) || '[]');
    const newData = [...data, emp];
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(newData));
    return emp;
  },

  updateEmployee: async (emp: Employee) => {
    await delay(300);
    const data = JSON.parse(localStorage.getItem(KEYS.EMPLOYEES) || '[]');
    const newData = data.map((e: Employee) => e.id === emp.id ? emp : e);
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(newData));
    return emp;
  },

  deleteEmployee: async (id: string) => {
    await delay(300);
    const data = JSON.parse(localStorage.getItem(KEYS.EMPLOYEES) || '[]');
    const newData = data.filter((e: Employee) => e.id !== id);
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(newData));
  },

  // DEPARTMENTS
  getDepartments: async (): Promise<Department[]> => {
    await delay(200);
    const data = localStorage.getItem(KEYS.DEPARTMENTS);
    if (!data) {
      localStorage.setItem(KEYS.DEPARTMENTS, JSON.stringify(INITIAL_DEPARTMENTS));
      return INITIAL_DEPARTMENTS;
    }
    return JSON.parse(data);
  },

  addDepartment: async (dept: Department) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.DEPARTMENTS) || '[]');
    const newData = [...data, dept];
    localStorage.setItem(KEYS.DEPARTMENTS, JSON.stringify(newData));
  },

  updateDepartment: async (dept: Department) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.DEPARTMENTS) || '[]');
    const newData = data.map((d: Department) => d.id === dept.id ? dept : d);
    localStorage.setItem(KEYS.DEPARTMENTS, JSON.stringify(newData));
  },

  deleteDepartment: async (id: string) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.DEPARTMENTS) || '[]');
    const newData = data.filter((d: Department) => d.id !== id);
    localStorage.setItem(KEYS.DEPARTMENTS, JSON.stringify(newData));
  },

  // PROJECTS
  getProjects: async (): Promise<Project[]> => {
    await delay(200);
    const data = localStorage.getItem(KEYS.PROJECTS);
    if (!data) {
      localStorage.setItem(KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
      return INITIAL_PROJECTS;
    }
    return JSON.parse(data);
  },

  addProject: async (proj: Project) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]');
    const newData = [...data, proj];
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(newData));
  },

  updateProject: async (proj: Project) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]');
    const newData = data.map((p: Project) => p.id === proj.id ? proj : p);
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(newData));
  },

  deleteProject: async (id: string) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]');
    const newData = data.filter((p: Project) => p.id !== id);
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(newData));
  },

  // LEAVES
  getLeaves: async (): Promise<LeaveRequest[]> => {
    await delay(200);
    const data = localStorage.getItem(KEYS.LEAVES);
    if (!data) {
      localStorage.setItem(KEYS.LEAVES, JSON.stringify(INITIAL_LEAVES));
      return INITIAL_LEAVES;
    }
    return JSON.parse(data);
  },

  addLeave: async (leave: LeaveRequest) => {
    await delay(300);
    const data = JSON.parse(localStorage.getItem(KEYS.LEAVES) || '[]');
    const newData = [leave, ...data];
    localStorage.setItem(KEYS.LEAVES, JSON.stringify(newData));
    return leave;
  },

  updateLeave: async (leave: LeaveRequest) => {
    await delay(300);
    const data = JSON.parse(localStorage.getItem(KEYS.LEAVES) || '[]');
    const newData = data.map((l: LeaveRequest) => l.id === leave.id ? leave : l);
    localStorage.setItem(KEYS.LEAVES, JSON.stringify(newData));
    return leave;
  },

  // LEAVE TYPES
  getLeaveTypes: async (): Promise<LeaveTypeConfig[]> => {
    await delay(200);
    const data = localStorage.getItem(KEYS.TYPES);
    if (!data) {
      localStorage.setItem(KEYS.TYPES, JSON.stringify(INITIAL_LEAVE_TYPES));
      return INITIAL_LEAVE_TYPES;
    }
    return JSON.parse(data);
  },
  
  addLeaveType: async (type: LeaveTypeConfig) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.TYPES) || '[]');
    const newData = [...data, type];
    localStorage.setItem(KEYS.TYPES, JSON.stringify(newData));
  },

  updateLeaveType: async (type: LeaveTypeConfig) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.TYPES) || '[]');
    const newData = data.map((t: LeaveTypeConfig) => t.id === type.id ? type : t);
    localStorage.setItem(KEYS.TYPES, JSON.stringify(newData));
  },
  
  deleteLeaveType: async (id: string) => {
      await delay(200);
      const data = JSON.parse(localStorage.getItem(KEYS.TYPES) || '[]');
      const newData = data.filter((t: LeaveTypeConfig) => t.id !== id);
      localStorage.setItem(KEYS.TYPES, JSON.stringify(newData));
  },

  // ATTENDANCE
  getAttendance: async (): Promise<AttendanceRecord[]> => {
    await delay(200);
    const data = localStorage.getItem(KEYS.ATTENDANCE);
    if (!data) {
      localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(INITIAL_ATTENDANCE));
      return INITIAL_ATTENDANCE;
    }
    return JSON.parse(data);
  },

  addAttendance: async (record: AttendanceRecord) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.ATTENDANCE) || '[]');
    const newData = [...data, record];
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(newData));
  },

  updateAttendance: async (record: AttendanceRecord) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.ATTENDANCE) || '[]');
    const newData = data.map((r: AttendanceRecord) => r.id === record.id ? record : r);
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(newData));
  },

  // TIME ENTRIES
  getTimeEntries: async (): Promise<TimeEntry[]> => {
    await delay(200);
    const data = localStorage.getItem(KEYS.TIME_ENTRIES);
    if (!data) {
        localStorage.setItem(KEYS.TIME_ENTRIES, JSON.stringify(INITIAL_TIME_ENTRIES));
        return INITIAL_TIME_ENTRIES;
    }
    return JSON.parse(data);
  },

  addTimeEntry: async (entry: TimeEntry) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.TIME_ENTRIES) || '[]');
    const newData = [...data, entry];
    localStorage.setItem(KEYS.TIME_ENTRIES, JSON.stringify(newData));
  },

  updateTimeEntry: async (entry: TimeEntry) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.TIME_ENTRIES) || '[]');
    const newData = data.map((e: TimeEntry) => e.id === entry.id ? entry : e);
    localStorage.setItem(KEYS.TIME_ENTRIES, JSON.stringify(newData));
  },

  deleteTimeEntry: async (id: string) => {
    await delay(200);
    const data = JSON.parse(localStorage.getItem(KEYS.TIME_ENTRIES) || '[]');
    const newData = data.filter((e: TimeEntry) => e.id !== id);
    localStorage.setItem(KEYS.TIME_ENTRIES, JSON.stringify(newData));
  },

  // NOTIFICATIONS
  getNotifications: async (): Promise<Notification[]> => {
    const data = localStorage.getItem(KEYS.NOTIFICATIONS);
    if (!data) {
      localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    return JSON.parse(data);
  },

  addNotification: async (notif: Notification) => {
    const data = JSON.parse(localStorage.getItem(KEYS.NOTIFICATIONS) || '[]');
    const newData = [notif, ...data];
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(newData));
    return notif;
  },

  markNotificationRead: async (id: string) => {
    const data = JSON.parse(localStorage.getItem(KEYS.NOTIFICATIONS) || '[]');
    const newData = data.map((n: Notification) => n.id === id ? { ...n, read: true } : n);
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(newData));
  },

  markAllNotificationsRead: async (userId: string) => {
    const data = JSON.parse(localStorage.getItem(KEYS.NOTIFICATIONS) || '[]');
    const newData = data.map((n: Notification) => n.userId === userId ? { ...n, read: true } : n);
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(newData));
  }
};