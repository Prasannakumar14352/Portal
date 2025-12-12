
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../services/db';
import { emailService } from '../services/emailService';
import { Employee, LeaveRequest, LeaveTypeConfig, AttendanceRecord, LeaveStatus, Notification, UserRole, Department, Project, User, TimeEntry, ToastMessage, Payslip, Holiday } from '../types';

interface AppContextType {
  // Data State
  employees: Employee[];
  users: Employee[]; // Alias for Organization component compatibility
  departments: Department[];
  projects: Project[];
  leaves: LeaveRequest[];
  leaveTypes: LeaveTypeConfig[];
  attendance: AttendanceRecord[];
  timeEntries: TimeEntry[];
  notifications: Notification[];
  payslips: Payslip[]; // New
  holidays: Holiday[]; // New
  toasts: ToastMessage[];
  isLoading: boolean;
  currentUser: User | null;
  
  // Theme State
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Actions (The API)
  refreshData: () => Promise<void>;
  
  // Auth
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<boolean>;

  // Toast Actions
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;

  // Employee Actions
  addEmployee: (emp: Employee) => Promise<void>;
  updateEmployee: (emp: Employee) => Promise<void>;
  updateUser: (id: string, data: Partial<Employee>) => Promise<void>; // Patch method
  deleteEmployee: (id: string) => Promise<void>;

  // Organization Actions
  addDepartment: (dept: Omit<Department, 'id'>) => Promise<void>;
  updateDepartment: (id: string, data: Partial<Department>) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;

  addProject: (proj: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Leave Actions
  addLeave: (leave: any) => Promise<void>; 
  addLeaves: (leaves: any[]) => Promise<void>;
  updateLeave: (id: string, data: any) => Promise<void>;
  updateLeaveStatus: (id: string, status: LeaveStatus, comment?: string) => Promise<void>;

  // Leave Type Actions
  addLeaveType: (type: any) => Promise<void>;
  updateLeaveType: (id: string, data: any) => Promise<void>;
  deleteLeaveType: (id: string) => Promise<void>;

  // Time Entry Actions
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => Promise<void>;
  updateTimeEntry: (id: string, data: Partial<TimeEntry>) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;
  
  // Attendance Actions
  checkIn: () => Promise<void>;
  checkOut: (reason?: string) => Promise<void>;
  getTodayAttendance: () => AttendanceRecord | undefined;

  // Notification Actions
  notify: (message: string) => Promise<void>; // Simple notification for Org component
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;

  // Holiday & Payslip Actions
  addHoliday: (holiday: Omit<Holiday, 'id'>) => Promise<void>;
  deleteHoliday: (id: string) => Promise<void>;
  generatePayslips: (month: string) => Promise<void>;
  manualAddPayslip: (payslip: Payslip) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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

  // Initial Load
  const refreshData = async () => {
    try {
      const [empData, deptData, projData, leaveData, typeData, attendData, timeData, notifData, holidayData, payslipData] = await Promise.all([
        db.getEmployees(),
        db.getDepartments(),
        db.getProjects(),
        db.getLeaves(),
        db.getLeaveTypes(),
        db.getAttendance(),
        db.getTimeEntries(),
        db.getNotifications(),
        db.getHolidays(),
        db.getPayslips()
      ]);
      setEmployees(empData);
      setDepartments(deptData);
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
      
      // Load theme
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
      if (savedTheme) {
          setTheme(savedTheme);
          if (savedTheme === 'dark') document.documentElement.classList.add('dark');
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setTheme('dark');
          document.documentElement.classList.add('dark');
      }
      
      setIsLoading(false);
    };
    init();
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
        const newTheme = prev === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        return newTheme;
    });
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const currentEmployees = await db.getEmployees();
    const user = currentEmployees.find(e => e.email.toLowerCase() === email.toLowerCase() && e.password === password);
    
    if (user) {
        setCurrentUser({ 
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role.includes('HR') || user.role.includes('Admin') ? UserRole.HR : user.role.includes('Manager') ? UserRole.MANAGER : UserRole.EMPLOYEE,
            avatar: user.avatar,
            managerId: user.managerId,
            jobTitle: user.role,
            departmentId: user.departmentId,
            projectIds: user.projectIds,
            location: user.location,
            hireDate: user.joinDate
        });
        showToast(`Welcome back, ${user.firstName}!`, 'success');
        return true;
    } else {
        showToast('Invalid email or password', 'error');
        return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    showToast('Logged out successfully', 'info');
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
     // Simulate sending email
     await emailService.sendEmail({
         to: email,
         subject: 'Password Reset Request',
         body: 'Click here to reset your password...'
     });
     showToast('Password reset link sent to your email', 'success');
     return true;
  };

  // --- Toast Logic ---
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- Helper to Send Notification & Email ---
  const sendSystemNotification = async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    await db.addNotification({
      id: Math.random().toString(36).substr(2, 9),
      userId,
      title,
      message,
      time: 'Just now',
      read: false,
      type
    });

    const recipient = employees.find(e => e.id === userId);
    if (recipient && recipient.email) {
      emailService.sendEmail({
        to: recipient.email,
        subject: `EMP Portal: ${title}`,
        body: `Dear ${recipient.firstName},\n\n${message}\n\nRegards,\nEMP HR Portal`
      });
    }

    setNotifications(await db.getNotifications());
  };

  const notify = async (message: string) => {
     if(currentUser) {
         await sendSystemNotification(currentUser.id, 'System Update', message, 'info');
         showToast(message, 'info');
     } else {
         showToast(message, 'info');
     }
  };

  // --- Employee Actions ---

  const addEmployee = async (emp: Employee) => {
    await db.addEmployee(emp);
    setEmployees(await db.getEmployees());
    
    // Notify the new employee
    await sendSystemNotification(emp.id, 'Welcome to EmpowerCorp', `Your account has been created. Your username is ${emp.email}.`, 'success');
    
    showToast('Employee added and notified successfully', 'success');
  };

  const updateEmployee = async (emp: Employee) => {
    await db.updateEmployee(emp);
    setEmployees(await db.getEmployees());
    showToast('Employee updated successfully', 'success');
  };

  const updateUser = async (id: string, data: Partial<Employee>) => {
    const existing = employees.find(e => e.id === id);
    if (existing) {
        const updated = { ...existing, ...data };
        await db.updateEmployee(updated);
        setEmployees(await db.getEmployees());
        
        // Notify on role/dept change if relevant
        if (data.departmentId && data.departmentId !== existing.departmentId) {
             const dept = departments.find(d => d.id === data.departmentId);
             await sendSystemNotification(id, 'Department Change', `You have been assigned to ${dept?.name || 'a new department'}.`, 'info');
        }
        if (data.projectIds && JSON.stringify(data.projectIds) !== JSON.stringify(existing.projectIds)) {
             await sendSystemNotification(id, 'Project Assignment Update', `Your project allocations have been updated.`, 'info');
        }

        showToast('Profile updated successfully', 'success');
    }
  };

  const deleteEmployee = async (id: string) => {
    await db.deleteEmployee(id);
    setEmployees(await db.getEmployees());
    showToast('Employee deleted', 'info');
  };

  // --- Organization Actions ---
  // (Organization actions remain same, omitted for brevity, logic doesn't change much)
  const addDepartment = async (dept: Omit<Department, 'id'>) => {
    const newDept = { ...dept, id: Math.random().toString(36).substr(2, 9) };
    await db.addDepartment(newDept);
    setDepartments(await db.getDepartments());
    showToast('Department created', 'success');
  };

  const updateDepartment = async (id: string, data: Partial<Department>) => {
    const existing = departments.find(d => d.id === id);
    if (existing) {
       await db.updateDepartment({ ...existing, ...data });
       setDepartments(await db.getDepartments());
       showToast('Department updated', 'success');
    }
  };

  const deleteDepartment = async (id: string) => {
    await db.deleteDepartment(id);
    setDepartments(await db.getDepartments());
    showToast('Department deleted', 'info');
  };

  const addProject = async (proj: Omit<Project, 'id'>) => {
    const newProj = { ...proj, id: Math.random().toString(36).substr(2, 9) };
    await db.addProject(newProj);
    setProjects(await db.getProjects());
    showToast('Project created', 'success');
  };

  const updateProject = async (id: string, data: Partial<Project>) => {
    const existing = projects.find(p => p.id === id);
    if (existing) {
       await db.updateProject({ ...existing, ...data });
       setProjects(await db.getProjects());
       showToast('Project updated', 'success');
    }
  };

  const deleteProject = async (id: string) => {
    await db.deleteProject(id);
    setProjects(await db.getProjects());
    showToast('Project deleted', 'info');
  };


  // --- Leave Actions --- (Same as before)
  const addLeave = async (leave: any) => {
    await db.addLeave(leave);
    setLeaves(await db.getLeaves());
    if (leave.approverId) {
      await sendSystemNotification(leave.approverId, 'New Leave Request', `${leave.userName} has requested ${leave.type}.`, 'info');
    }
    await sendSystemNotification(leave.userId, 'Leave Request Submitted', `Your request for ${leave.type} has been submitted.`, 'info');
    showToast('Leave request submitted', 'success');
  };

  const addLeaves = async (newLeaves: any[]) => {
    for (const leave of newLeaves) { await db.addLeave(leave); }
    setLeaves(await db.getLeaves());
    showToast(`${newLeaves.length} leaves uploaded`, 'success');
  };

  const updateLeave = async (id: string, data: any) => {
    const existing = leaves.find(l => l.id === id);
    if (existing) {
      await db.updateLeave({ ...existing, ...data });
      setLeaves(await db.getLeaves());
      showToast('Leave request updated', 'success');
    }
  };

  const updateLeaveStatus = async (id: string, status: LeaveStatus, comment?: string) => {
    const leave = leaves.find(l => l.id === id);
    if (leave) {
       const updated = { ...leave, status, managerComment: (status === LeaveStatus.PENDING_HR || status === LeaveStatus.REJECTED) ? comment : leave.managerComment, hrComment: (status === LeaveStatus.APPROVED) ? comment : leave.hrComment };
       await db.updateLeave(updated);
       setLeaves(await db.getLeaves());

       if (status === LeaveStatus.PENDING_HR) {
         const hrAdmins = employees.filter(e => e.role.includes('HR'));
         for (const hr of hrAdmins) { await sendSystemNotification(hr.id, 'Manager Approved Leave', `Requires Final HR Approval for ${leave.userName}.`, 'warning'); }
         await sendSystemNotification(leave.userId, 'Manager Approved', `Your manager approved leave. Pending HR.`, 'info');
       } else if (status === LeaveStatus.APPROVED) {
         await sendSystemNotification(leave.userId, 'Leave Approved', `Your leave for ${leave.type} is approved.`, 'success');
       } else if (status === LeaveStatus.REJECTED) {
         await sendSystemNotification(leave.userId, 'Leave Rejected', `Reason: ${comment}`, 'error');
       }
       showToast(`Leave ${status}`, 'success');
    }
  };

  // --- Other Actions ---
  const addLeaveType = async (type: any) => {
    await db.addLeaveType(type);
    setLeaveTypes(await db.getLeaveTypes());
    showToast('Leave type added', 'success');
  };

  const updateLeaveType = async (id: string, data: any) => {
    const existing = leaveTypes.find(t => t.id === id);
    if (existing) {
      await db.updateLeaveType({ ...existing, ...data });
      setLeaveTypes(await db.getLeaveTypes());
      showToast('Leave type updated', 'success');
    }
  };

  const deleteLeaveType = async (id: string) => {
    await db.deleteLeaveType(id);
    setLeaveTypes(await db.getLeaveTypes());
    showToast('Leave type deleted', 'info');
  };

  const addTimeEntry = async (entry: Omit<TimeEntry, 'id'>) => {
    await db.addTimeEntry({ ...entry, id: Math.random().toString(36).substr(2, 9) });
    setTimeEntries(await db.getTimeEntries());
    showToast('Time entry logged', 'success');
  };

  const updateTimeEntry = async (id: string, data: Partial<TimeEntry>) => {
    const existing = timeEntries.find(e => e.id === id);
    if (existing) {
       await db.updateTimeEntry({ ...existing, ...data });
       setTimeEntries(await db.getTimeEntries());
       showToast('Time entry updated', 'success');
    }
  };

  const deleteTimeEntry = async (id: string) => {
    await db.deleteTimeEntry(id);
    setTimeEntries(await db.getTimeEntries());
    showToast('Time entry deleted', 'info');
  };
  
  const getTodayAttendance = () => {
    if (!currentUser) return undefined;
    const today = new Date().toISOString().split('T')[0];
    return attendance.find(a => a.employeeId === currentUser.id && a.date === today);
  };

  const checkIn = async () => {
    if (!currentUser) return;
    const now = new Date();
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      date: now.toISOString().split('T')[0],
      checkIn: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      checkInTime: now.toISOString(),
      checkOut: '',
      status: isLate ? 'Late' : 'Present'
    };
    await db.addAttendance(record);
    setAttendance(await db.getAttendance());
    notify(`Checked in successfully at ${record.checkIn}`);
  };

  const checkOut = async (reason?: string) => {
    if (!currentUser) return;
    const todayRecord = getTodayAttendance();
    if (!todayRecord) return;
    const now = new Date();
    const updatedRecord: AttendanceRecord = {
      ...todayRecord,
      checkOut: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      checkOutTime: now.toISOString(),
      notes: reason || todayRecord.notes
    };
    await db.updateAttendance(updatedRecord);
    setAttendance(await db.getAttendance());
    notify(`Checked out successfully at ${updatedRecord.checkOut}`);
  };

  const markNotificationRead = async (id: string) => {
    await db.markNotificationRead(id);
    setNotifications(await db.getNotifications());
  };

  const markAllRead = async (userId: string) => {
    await db.markAllNotificationsRead(userId);
    setNotifications(await db.getNotifications());
  };

  // --- Holidays & Payslips ---
  const addHoliday = async (holiday: Omit<Holiday, 'id'>) => {
      const newHoliday = { ...holiday, id: Math.random().toString(36).substr(2, 9) };
      await db.addHoliday(newHoliday);
      setHolidays(await db.getHolidays());
      showToast('Holiday added', 'success');
  };

  const deleteHoliday = async (id: string) => {
      await db.deleteHoliday(id);
      setHolidays(await db.getHolidays());
      showToast('Holiday deleted', 'info');
  };

  const manualAddPayslip = async (payslip: Payslip) => {
      await db.addPayslip(payslip);
      setPayslips(await db.getPayslips());
  };

  const generatePayslips = async (month: string) => {
      const activeEmployees = employees.filter(e => e.status === 'Active');
      // Refetch payslips to ensure we have the latest list to check duplicates
      const currentPayslips = await db.getPayslips();
      let count = 0;

      for (const emp of activeEmployees) {
          const exists = currentPayslips.some(p => p.userId === emp.id && p.month === month);
          if (!exists) {
              await db.addPayslip({
                  id: `pay-${Math.random().toString(36).substr(2,9)}`,
                  userId: emp.id,
                  userName: `${emp.firstName} ${emp.lastName}`,
                  month: month,
                  amount: emp.salary / 12,
                  status: 'Paid',
                  generatedDate: new Date().toISOString()
              });
              // Notify employee
              await sendSystemNotification(emp.id, 'Payslip Generated', `Your payslip for ${month} is now available.`, 'info');
              count++;
          }
      }
      setPayslips(await db.getPayslips());
      if (count > 0) {
          showToast(`Generated ${count} payslips for ${month}`, 'success');
      } else {
          showToast(`Payslips for ${month} already exist. No new slips generated.`, 'info');
      }
  };

  const value = {
    employees, users: employees, departments, projects, leaves, leaveTypes, attendance, timeEntries, notifications, 
    holidays, payslips, toasts, isLoading, currentUser, theme,
    login, logout, forgotPassword, refreshData, showToast, removeToast, toggleTheme,
    addEmployee, updateEmployee, updateUser, deleteEmployee,
    addDepartment, updateDepartment, deleteDepartment,
    addProject, updateProject, deleteProject,
    addLeave, addLeaves, updateLeave, updateLeaveStatus,
    addLeaveType, updateLeaveType, deleteLeaveType,
    addTimeEntry, updateTimeEntry, deleteTimeEntry,
    checkIn, checkOut, getTodayAttendance,
    notify, markNotificationRead, markAllRead,
    addHoliday, deleteHoliday, generatePayslips, manualAddPayslip
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
