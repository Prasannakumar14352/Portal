
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../services/db';
import { emailService } from '../services/emailService';
import { Employee, LeaveRequest, LeaveTypeConfig, AttendanceRecord, LeaveStatus, Notification, UserRole, Department, Project, User, TimeEntry, ToastMessage, Payslip, Holiday, EmployeeStatus, Role } from '../types';

// Robust helper to get YYYY-MM-DD regardless of locale
const formatDateISO = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Robust helper for 12h time (h:mm am/pm)
const formatTime12 = (date: Date) => {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }).toLowerCase();
};

interface AppContextType {
  employees: Employee[];
  users: Employee[]; 
  departments: Department[];
  roles: Role[];
  projects: Project[];
  leaves: LeaveRequest[];
  leaveTypes: LeaveTypeConfig[];
  attendance: AttendanceRecord[];
  timeEntries: TimeEntry[];
  notifications: Notification[];
  payslips: Payslip[]; 
  holidays: Holiday[]; 
  toasts: ToastMessage[];
  isLoading: boolean;
  currentUser: User | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  refreshData: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithMicrosoft: () => Promise<boolean>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<boolean>;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
  addEmployee: (emp: Employee) => Promise<void>;
  updateEmployee: (emp: Employee) => Promise<void>;
  updateUser: (id: string | number, data: Partial<Employee>) => Promise<void>; 
  deleteEmployee: (id: string | number) => Promise<void>;
  addDepartment: (dept: Omit<Department, 'id'>) => Promise<void>;
  updateDepartment: (id: string | number, data: Partial<Department>) => Promise<void>;
  deleteDepartment: (id: string | number) => Promise<void>;
  addRole: (role: Omit<Role, 'id'>) => Promise<void>;
  updateRole: (id: string | number, data: Partial<Role>) => Promise<void>;
  deleteRole: (id: string | number) => Promise<void>;
  addProject: (proj: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string | number, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string | number) => Promise<void>;
  addLeave: (leave: any) => Promise<void>; 
  addLeaves: (leaves: any[]) => Promise<void>;
  updateLeave: (id: string | number, data: any) => Promise<void>;
  updateLeaveStatus: (id: string | number, status: LeaveStatus, comment?: string) => Promise<void>;
  addLeaveType: (type: any) => Promise<void>;
  updateLeaveType: (id: string | number, data: any) => Promise<void>;
  deleteLeaveType: (id: string | number) => Promise<void>;
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => Promise<void>;
  updateTimeEntry: (id: string | number, data: Partial<TimeEntry>) => Promise<void>;
  deleteTimeEntry: (id: string | number) => Promise<void>;
  checkIn: () => Promise<void>;
  checkOut: (reason?: string) => Promise<void>;
  updateAttendanceRecord: (record: AttendanceRecord) => Promise<void>; 
  getTodayAttendance: () => AttendanceRecord | undefined;
  notify: (message: string) => Promise<void>; 
  markNotificationRead: (id: string | number) => Promise<void>;
  markAllRead: (userId: string | number) => Promise<void>;
  addHoliday: (holiday: Omit<Holiday, 'id'>) => Promise<void>;
  addHolidays: (holidays: Omit<Holiday, 'id'>[]) => Promise<void>;
  deleteHoliday: (id: string | number) => Promise<void>;
  generatePayslips: (month: string) => Promise<void>;
  manualAddPayslip: (payslip: Payslip) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [msalInstance, setMsalInstance] = useState<any>(null);

  const refreshData = async () => {
    try {
      const [empData, deptData, roleData, projData, leaveData, typeData, attendData, timeData, notifData, holidayData, payslipData] = await Promise.all([
        db.getEmployees(), db.getDepartments(), db.getRoles(), db.getProjects(),
        db.getLeaves(), db.getLeaveTypes(), db.getAttendance(), db.getTimeEntries(),
        db.getNotifications(), db.getHolidays(), db.getPayslips()
      ]);
      setEmployees(empData);
      setDepartments(deptData);
      setRoles(roleData);
      setProjects(projData);
      setLeaves(leaveData);
      setLeaveTypes(typeData);
      setAttendance(attendData);
      setTimeEntries(timeData);
      setNotifications(notifData);
      setHolidays(holidayData);
      setPayslips(payslipData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await refreshData();
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
      if (savedTheme) {
          setTheme(savedTheme);
          if (savedTheme === 'dark') document.documentElement.classList.add('dark');
      }
      try {
        const { PublicClientApplication } = await import("@azure/msal-browser");
        const { msalConfig } = await import("../services/authConfig");
        const pca = new PublicClientApplication(msalConfig);
        await pca.initialize();
        
        const result = await pca.handleRedirectPromise();
        const accounts = pca.getAllAccounts();
        const activeAccount = result?.account || (accounts.length > 0 ? accounts[0] : null);

        if (activeAccount) {
            const email = activeAccount.username;
            const name = activeAccount.name || email.split('@')[0];
            const currentEmployees = await db.getEmployees();
            
            let targetUser = currentEmployees.find(e => e.email.toLowerCase() === email.toLowerCase());
            
            if (!targetUser) {
                console.log(`[Auth] Auto-provisioning new Azure user: ${email}`);
                const nextId = currentEmployees.length > 0 ? Math.max(...currentEmployees.map(e => Number(e.id))) + 1 : 1001;
                const newEmp: Employee = {
                    id: nextId,
                    employeeId: `EMP${nextId}`,
                    firstName: name.split(' ')[0],
                    lastName: name.split(' ').slice(1).join(' ') || 'User',
                    email: email,
                    password: 'ms-auth-user', 
                    role: 'Employee',
                    department: 'General',
                    joinDate: new Date().toISOString().split('T')[0],
                    status: EmployeeStatus.ACTIVE,
                    salary: 0,
                    avatar: `https://i.pravatar.cc/150?u=${email}`,
                    jobTitle: 'New Joiner (SSO)'
                };
                await db.addEmployee(newEmp);
                targetUser = newEmp;
                setEmployees(await db.getEmployees());
            }

            if (targetUser) {
                setCurrentUser({ 
                    id: targetUser.id, employeeId: targetUser.employeeId, name: `${targetUser.firstName} ${targetUser.lastName}`, email: targetUser.email,
                    role: targetUser.role.includes('HR') || targetUser.role.includes('Admin') ? UserRole.HR : targetUser.role.includes('Manager') ? UserRole.MANAGER : UserRole.EMPLOYEE,
                    avatar: targetUser.avatar, managerId: targetUser.managerId, jobTitle: targetUser.jobTitle || targetUser.role,
                    departmentId: targetUser.departmentId, projectIds: targetUser.projectIds,
                    location: targetUser.location, workLocation: targetUser.workLocation, hireDate: targetUser.joinDate
                });
            }
        }
        setMsalInstance(pca);
      } catch (err) { console.warn("MSAL initialization failed:", err); }
      setIsLoading(false);
    };
    init();
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
        const newTheme = prev === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        newTheme === 'dark' ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
        return newTheme;
    });
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const currentEmployees = await db.getEmployees();
    let user = currentEmployees.find(e => e.email.toLowerCase() === email.toLowerCase() && e.password === password);
    if (user) {
        setCurrentUser({ 
            id: user.id, employeeId: user.employeeId, name: `${user.firstName} ${user.lastName}`, email: user.email,
            role: user.role.includes('HR') || user.role.includes('Admin') ? UserRole.HR : user.role.includes('Manager') ? UserRole.MANAGER : UserRole.EMPLOYEE,
            avatar: user.avatar, managerId: user.managerId, jobTitle: user.jobTitle || user.role,
            departmentId: user.departmentId, projectIds: user.projectIds,
            location: user.location, workLocation: user.workLocation, hireDate: user.joinDate
        });
        showToast(`Welcome back, ${user.firstName}!`, 'success');
        return true;
    }
    showToast('Invalid email or password.', 'error');
    return false;
  };

  const loginWithMicrosoft = async (): Promise<boolean> => {
    if (!msalInstance) return false;
    try {
        const { loginRequest } = await import("../services/authConfig");
        await msalInstance.loginRedirect(loginRequest);
        return true;
    } catch (error: any) { 
        console.error("MS Redirect Login Error:", error); 
        showToast("Microsoft Sign-In failed to initiate.", "error");
        return false;
    }
  };

  const logout = async () => { 
    if (msalInstance) {
        try {
            const accounts = msalInstance.getAllAccounts();
            if (accounts.length > 0) {
                await msalInstance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
                return;
            }
        } catch (e) { console.warn("MSAL Logout failed", e); }
    }
    setCurrentUser(null); 
    showToast('Logged out successfully', 'info'); 
  };

  const forgotPassword = async (email: string): Promise<boolean> => { showToast('Reset link sent to your email', 'success'); return true; };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const addEmployee = async (emp: Employee) => { await db.addEmployee(emp); setEmployees(await db.getEmployees()); showToast('Employee added', 'success'); };
  const updateEmployee = async (emp: Employee) => { await db.updateEmployee(emp); setEmployees(await db.getEmployees()); setAttendance(await db.getAttendance()); showToast('Employee updated', 'success'); };
  const updateUser = async (id: string | number, data: Partial<Employee>) => {
    const existing = employees.find(e => e.id === id);
    if (existing) { await db.updateEmployee({ ...existing, ...data }); setEmployees(await db.getEmployees()); setAttendance(await db.getAttendance()); showToast('Profile updated', 'success'); }
  };
  const deleteEmployee = async (id: string | number) => { 
    try {
      await db.deleteEmployee(id.toString()); 
      setEmployees(await db.getEmployees()); 
      showToast('Employee and all linked records deleted', 'success'); 
    } catch (err: any) {
      console.error("Deletion failed:", err);
      showToast(`Delete failed: ${err.message || 'Unknown database error'}`, 'error');
    }
  };

  const addDepartment = async (dept: Omit<Department, 'id'>) => { await db.addDepartment({ ...dept, id: Math.random().toString(36).substr(2, 9) }); setDepartments(await db.getDepartments()); showToast('Department created', 'success'); };
  const updateDepartment = async (id: string | number, data: Partial<Department>) => {
    const existing = departments.find(d => d.id === id);
    if (existing) { await db.updateDepartment({ ...existing, ...data }); setDepartments(await db.getDepartments()); showToast('Department updated', 'success'); }
  };
  const deleteDepartment = async (id: string | number) => { await db.deleteDepartment(id.toString()); setDepartments(await db.getDepartments()); showToast('Department deleted', 'info'); };

  const addRole = async (role: Omit<Role, 'id'>) => { await db.addRole({ ...role, id: Math.random().toString(36).substr(2, 9) }); setRoles(await db.getRoles()); showToast('Role created', 'success'); };
  const updateRole = async (id: string | number, data: Partial<Role>) => {
    const existing = roles.find(r => r.id === id);
    if (existing) { await db.updateRole({ ...existing, ...data }); setRoles(await db.getRoles()); showToast('Role updated', 'success'); }
  };
  const deleteRole = async (id: string | number) => { await db.deleteRole(id.toString()); setRoles(await db.getRoles()); showToast('Role deleted', 'info'); };

  const addProject = async (proj: Omit<Project, 'id'>) => { await db.addProject({ ...proj, id: Math.random().toString(36).substr(2, 9) }); setProjects(await db.getProjects()); showToast('Project created', 'success'); };
  const updateProject = async (id: string | number, data: Partial<Project>) => {
    const existing = projects.find(p => p.id === id);
    if (existing) { await db.updateProject({ ...existing, ...data }); setProjects(await db.getProjects()); showToast('Project updated', 'success'); }
  };
  const deleteProject = async (id: string | number) => { await db.deleteProject(id.toString()); setProjects(await db.getProjects()); showToast('Project deleted', 'info'); };

  const addLeave = async (leave: any) => { await db.addLeave(leave); setLeaves(await db.getLeaves()); showToast('Leave request submitted', 'success'); };
  const addLeaves = async (newLeaves: any[]) => { for (const leave of newLeaves) { await db.addLeave(leave); } setLeaves(await db.getLeaves()); showToast(`${newLeaves.length} leaves uploaded`, 'success'); };
  const updateLeave = async (id: string | number, data: any) => {
    const existing = leaves.find(l => l.id === id);
    if (existing) { await db.updateLeave({ ...existing, ...data }); setLeaves(await db.getLeaves()); showToast('Leave updated', 'success'); }
  };
  const updateLeaveStatus = async (id: string | number, status: LeaveStatus, comment?: string) => {
    const leave = leaves.find(l => l.id === id);
    if (leave) {
       const updated = { ...leave, status, managerComment: (status === LeaveStatus.PENDING_HR || status === LeaveStatus.REJECTED) ? comment : leave.managerComment, hrComment: (status === LeaveStatus.APPROVED) ? comment : leave.hrComment };
       await db.updateLeave(updated); setLeaves(await db.getLeaves()); showToast(`Leave ${status}`, 'success');
    }
  };

  const addLeaveType = async (type: any) => { await db.addLeaveType(type); setLeaveTypes(await db.getLeaveTypes()); showToast('Leave type added', 'success'); };
  const updateLeaveType = async (id: string | number, data: any) => {
    const existing = leaveTypes.find(t => t.id === id);
    if (existing) { await db.updateLeaveType({ ...existing, ...data }); setLeaveTypes(await db.getLeaveTypes()); showToast('Leave type updated', 'success'); }
  };
  const deleteLeaveType = async (id: string | number) => { await db.deleteLeaveType(id.toString()); setLeaveTypes(await db.getLeaveTypes()); showToast('Leave type deleted', 'info'); };

  const addTimeEntry = async (entry: Omit<TimeEntry, 'id'>) => { await db.addTimeEntry({ ...entry, id: Math.random().toString(36).substr(2, 9) }); setTimeEntries(await db.getTimeEntries()); showToast('Time entry logged', 'success'); };
  const updateTimeEntry = async (id: string | number, data: Partial<TimeEntry>) => {
    const existing = timeEntries.find(e => e.id === id);
    if (existing) { await db.updateTimeEntry({ ...existing, ...data }); setTimeEntries(await db.getTimeEntries()); showToast('Time entry updated', 'success'); }
  };
  const deleteTimeEntry = async (id: string | number) => { await db.deleteTimeEntry(id.toString()); setTimeEntries(await db.getTimeEntries()); showToast('Time entry deleted', 'info'); };

  const getTodayAttendance = () => {
    if (!currentUser) return undefined;
    const todayStr = formatDateISO(new Date());
    const sessions = attendance.filter(a => a.employeeId === currentUser.id && a.date === todayStr);
    if (sessions.length === 0) return undefined;
    const active = sessions.find(s => !s.checkOut);
    return active || sessions[sessions.length - 1];
  };

  const checkIn = async () => {
    if (!currentUser) return;
    const now = new Date();
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
    const assignedLocation = currentUser.workLocation || 'Office HQ India';
    const localDate = formatDateISO(now);
    
    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      date: localDate,
      checkIn: formatTime12(now),
      checkInTime: now.toISOString(),
      checkOut: '',
      status: isLate ? 'Late' : 'Present',
      workLocation: assignedLocation
    };
    await db.addAttendance(record);
    setAttendance(await db.getAttendance()); 
    showToast(`Checked in successfully at ${record.checkIn}`, 'success');
  };

  const checkOut = async (reason?: string) => {
    if (!currentUser) return;
    const todayRec = getTodayAttendance();
    if (!todayRec || todayRec.checkOut) return;
    const now = new Date();
    const start = new Date(todayRec.checkInTime || now.toISOString());
    const durationHrs = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
    const finalStatus = durationHrs >= 9 ? 'Present' : todayRec.status;

    const updatedRecord: AttendanceRecord = {
      ...todayRec,
      checkOut: formatTime12(now),
      checkOutTime: now.toISOString(),
      status: finalStatus,
      notes: reason || todayRec.notes
    };
    await db.updateAttendance(updatedRecord);
    setAttendance(await db.getAttendance());
    showToast(`Checked out successfully at ${updatedRecord.checkOut}`, 'success');
  };

  const updateAttendanceRecord = async (record: AttendanceRecord) => {
      await db.updateAttendance(record);
      setAttendance(await db.getAttendance());
      showToast("Attendance record updated", "success");
  };

  const notify = async (message: string) => {
    if (!currentUser) return;
    const newNotif: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      title: 'System Notification',
      message,
      time: 'Just now',
      read: false,
      type: 'info'
    };
    await db.addNotification(newNotif);
    setNotifications(await db.getNotifications());
  };

  const markNotificationRead = async (id: string | number) => { await db.markNotificationRead(id.toString()); setNotifications(await db.getNotifications()); };
  const markAllRead = async (userId: string | number) => { await db.markAllNotificationsRead(userId.toString()); setNotifications(await db.getNotifications()); };
  const addHoliday = async (holiday: Omit<Holiday, 'id'>) => { await db.addHoliday({ ...holiday, id: Math.random().toString(36).substr(2, 9) }); setHolidays(await db.getHolidays()); showToast('Holiday added', 'success'); };
  const addHolidays = async (newHolidays: Omit<Holiday, 'id'>[]) => { for (const h of newHolidays) { await db.addHoliday({ ...h, id: Math.random().toString(36).substr(2, 9) }); } setHolidays(await db.getHolidays()); showToast(`Imported ${newHolidays.length} holidays`, 'success'); };
  const deleteHoliday = async (id: string | number) => { await db.deleteHoliday(id.toString()); setHolidays(await db.getHolidays()); showToast('Holiday deleted', 'info'); };
  const manualAddPayslip = async (payslip: Payslip) => { await db.addPayslip(payslip); setPayslips(await db.getPayslips()); };
  const generatePayslips = async (month: string) => {
      const activeEmployees = employees.filter(e => e.status === 'Active');
      const currentPayslips = await db.getPayslips();
      let count = 0;
      for (const emp of activeEmployees) {
          if (!currentPayslips.some(p => p.userId === emp.id && p.month === month)) {
              await db.addPayslip({ id: `pay-${Math.random().toString(36).substr(2,9)}`, userId: emp.id, userName: `${emp.firstName} ${emp.lastName}`, month: month, amount: emp.salary / 12, status: 'Paid', generatedDate: new Date().toISOString() });
              count++;
          }
      }
      setPayslips(await db.getPayslips()); showToast(`Generated ${count} payslips`, 'success');
  };

  const value = {
    employees, users: employees, departments, roles, projects, leaves, leaveTypes, attendance, timeEntries, notifications, 
    holidays, payslips, toasts, isLoading, currentUser, theme,
    login, loginWithMicrosoft, logout, forgotPassword, refreshData, showToast, removeToast, toggleTheme,
    addEmployee, updateEmployee, updateUser, deleteEmployee, addDepartment, updateDepartment, deleteDepartment,
    addRole, updateRole, deleteRole, addProject, updateProject, deleteProject, addLeave, addLeaves, updateLeave, updateLeaveStatus,
    addLeaveType, updateLeaveType, deleteLeaveType, addTimeEntry, updateTimeEntry, deleteTimeEntry,
    checkIn, checkOut, updateAttendanceRecord, getTodayAttendance, notify, markNotificationRead, markAllRead,
    addHoliday, addHolidays, deleteHoliday, generatePayslips, manualAddPayslip
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
