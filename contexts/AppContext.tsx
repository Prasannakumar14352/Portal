
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../services/db';
import { emailService } from '../services/emailService';
import { Employee, LeaveRequest, LeaveTypeConfig, AttendanceRecord, LeaveStatus, Notification, UserRole, Department, Project, User, TimeEntry, ToastMessage, Payslip, Holiday, EmployeeStatus, DepartmentType, Role } from '../types';

interface AppContextType {
  // Data State
  employees: Employee[];
  users: Employee[]; // Alias for Organization component compatibility
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
  
  // Theme State
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Actions (The API)
  refreshData: () => Promise<void>;
  
  // Auth
  login: (email: string, password: string) => Promise<boolean>;
  loginWithMicrosoft: () => Promise<boolean>;
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

  addRole: (role: Omit<Role, 'id'>) => Promise<void>;
  updateRole: (id: string, data: Partial<Role>) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;

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
  updateAttendanceRecord: (record: AttendanceRecord) => Promise<void>; // Added capability to manually update record
  getTodayAttendance: () => AttendanceRecord | undefined;

  // Notification Actions
  notify: (message: string) => Promise<void>; // Simple notification for Org component
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;

  // Holiday & Payslip Actions
  addHoliday: (holiday: Omit<Holiday, 'id'>) => Promise<void>;
  addHolidays: (holidays: Omit<Holiday, 'id'>[]) => Promise<void>;
  deleteHoliday: (id: string) => Promise<void>;
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
  
  // MSAL Instance
  const [msalInstance, setMsalInstance] = useState<any>(null);

  // Initial Load
  const refreshData = async () => {
    try {
      const [empData, deptData, roleData, projData, leaveData, typeData, attendData, timeData, notifData, holidayData, payslipData] = await Promise.all([
        db.getEmployees(),
        db.getDepartments(),
        db.getRoles(),
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
      
      // Initialize Data
      await refreshData();
      
      // Initialize Theme
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
      if (savedTheme) {
          setTheme(savedTheme);
          if (savedTheme === 'dark') document.documentElement.classList.add('dark');
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setTheme('dark');
          document.documentElement.classList.add('dark');
      }

      // Initialize MSAL
      try {
        const { PublicClientApplication } = await import("@azure/msal-browser");
        const { msalConfig } = await import("../services/authConfig");
        const pca = new PublicClientApplication(msalConfig);
        await pca.initialize();
        setMsalInstance(pca);
      } catch (err) {
        console.warn("MSAL initialization failed:", err);
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
    
    // Normal Login
    let user = currentEmployees.find(e => e.email.toLowerCase() === email.toLowerCase() && e.password === password);
    
    // SPECIAL DEMO HANDLER
    if (!user && email.toLowerCase().includes('onmicrosoft.com')) {
        const existingUser = currentEmployees.find(e => e.email.toLowerCase() === email.toLowerCase());
        
        if (existingUser) {
            user = existingUser;
        } else {
            const newUser: Employee = {
                id: Math.random().toString(36).substr(2, 9),
                firstName: 'Microsoft',
                lastName: 'User',
                email: email,
                password: password,
                role: UserRole.EMPLOYEE,
                department: DepartmentType.IT,
                departmentId: 'd1',
                joinDate: new Date().toISOString().split('T')[0],
                status: EmployeeStatus.ACTIVE,
                salary: 0,
                avatar: `https://ui-avatars.com/api/?name=MS+User&background=0D8ABC&color=fff`,
                projectIds: [],
                jobTitle: 'Employee'
            };
            await db.addEmployee(newUser);
            setEmployees(prev => [...prev, newUser]);
            user = newUser;
        }
    }

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
            workLocation: user.workLocation,
            hireDate: user.joinDate
        });
        showToast(`Welcome back, ${user.firstName}!`, 'success');
        return true;
    } else {
        showToast('Invalid email or password. For demo, try the buttons below.', 'error');
        return false;
    }
  };

  // Helper to handle user registration/session creation
  const handleUserAuthSuccess = async (name: string, email: string) => {
      const currentEmployees = await db.getEmployees();
      const existingUser = currentEmployees.find(e => e.email.toLowerCase() === email.toLowerCase());
      
      if (existingUser) {
          setCurrentUser({ 
              id: existingUser.id,
              name: `${existingUser.firstName} ${existingUser.lastName}`,
              email: existingUser.email,
              role: existingUser.role.includes('HR') || existingUser.role.includes('Admin') ? UserRole.HR : existingUser.role.includes('Manager') ? UserRole.MANAGER : UserRole.EMPLOYEE,
              avatar: existingUser.avatar,
              managerId: existingUser.managerId,
              jobTitle: existingUser.role,
              departmentId: existingUser.departmentId,
              projectIds: existingUser.projectIds,
              location: existingUser.location,
              workLocation: existingUser.workLocation,
              hireDate: existingUser.joinDate
          });
          showToast(`Welcome back, ${existingUser.firstName}!`, 'success');
      } else {
          const [firstName, ...lastNameParts] = name.split(' ');
          const lastName = lastNameParts.join(' ') || '';
          
          const newUser: Employee = {
              id: Math.random().toString(36).substr(2, 9),
              firstName: firstName || 'User',
              lastName: lastName,
              email: email,
              password: 'ms-auth-user',
              role: 'Employee',
              department: 'General',
              departmentId: '',
              joinDate: new Date().toISOString().split('T')[0],
              status: EmployeeStatus.ACTIVE,
              salary: 0,
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`,
              projectIds: []
          };
          
          await db.addEmployee(newUser);
          setEmployees(prev => [...prev, newUser]);
          
          setCurrentUser({
              id: newUser.id,
              name: `${newUser.firstName} ${newUser.lastName}`,
              email: newUser.email,
              role: UserRole.EMPLOYEE,
              avatar: newUser.avatar,
              jobTitle: newUser.role,
              hireDate: newUser.joinDate
          });
          
          await sendSystemNotification(newUser.id, 'Welcome to EmpowerCorp', `Your account has been created via Microsoft Login.`, 'success');
          showToast(`Account created for ${newUser.firstName}!`, 'success');
      }
  };

  const loginWithMicrosoft = async (): Promise<boolean> => {
    if (!msalInstance) {
        showToast("Microsoft login service is initializing...", "info");
        return false;
    }

    try {
        const { loginRequest } = await import("../services/authConfig");
        const response = await msalInstance.loginPopup(loginRequest);
        
        if (response && response.account) {
            const email = response.account.username;
            const name = response.account.name || email.split('@')[0];
            await handleUserAuthSuccess(name, email);
            return true;
        }
    } catch (error: any) {
        console.error("Microsoft Login Error:", error);
        const errorMsg = error.message || error.toString();

        if (error.errorCode === 'user_cancelled') {
            showToast("Login cancelled.", "info");
            return false;
        }
        
        if (error.errorCode === 'popup_window_error') {
            showToast("Login popup was blocked. Please allow popups for this site.", "warning");
            return false;
        }

        let fallbackMessage = "Login failed. Falling back to Demo User.";
        if (errorMsg.includes("9002326") || errorMsg.includes("AADSTS9002326")) {
             fallbackMessage = "Azure Config Mismatch (Web vs SPA). Using Demo User.";
        } else if (errorMsg.includes("400") || errorMsg.includes("ServerError")) {
             fallbackMessage = "Azure Token Error (Missing Secret?). Using Demo User.";
        }

        showToast(fallbackMessage, "warning");
        await handleUserAuthSuccess("Azure Demo User", "azure.demo@empower.com");
        return true;
    }
    return false;
  };

  const logout = () => {
    if (msalInstance) {
        // Optional: msalInstance.logoutPopup(); 
    }
    setCurrentUser(null);
    showToast('Logged out successfully', 'info');
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
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
    setTimeout(() => removeToast(id), 5000);
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

  // --- Roles Actions ---
  const addRole = async (role: Omit<Role, 'id'>) => {
    const newRole = { ...role, id: Math.random().toString(36).substr(2, 9) };
    await db.addRole(newRole);
    setRoles(await db.getRoles());
    showToast('Role created', 'success');
  };

  const updateRole = async (id: string, data: Partial<Role>) => {
    const existing = roles.find(r => r.id === id);
    if (existing) {
       await db.updateRole({ ...existing, ...data });
       setRoles(await db.getRoles());
       showToast('Role updated', 'success');
    }
  };

  const deleteRole = async (id: string) => {
    await db.deleteRole(id);
    setRoles(await db.getRoles());
    showToast('Role deleted', 'info');
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


  // --- Leave Actions ---
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
    
    // Prioritize active session (no checkout) regardless of date
    // This handles overnight shifts where current time is next day but session started previous day.
    const activeSession = attendance.find(a => a.employeeId === currentUser.id && !a.checkOut);
    if (activeSession) return activeSession;

    // Fallback: If no active session, find completed session for "today" (local date)
    const today = new Date().toLocaleDateString('en-CA');
    return attendance.find(a => a.employeeId === currentUser.id && a.date === today);
  };

  const checkIn = async () => {
    if (!currentUser) return;
    const now = new Date();
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
    const assignedLocation = currentUser.workLocation || 'Office HQ India';
    const localDate = now.toLocaleDateString('en-CA'); // Ensure consistent YYYY-MM-DD
    
    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      date: localDate,
      checkIn: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      checkInTime: now.toISOString(),
      checkOut: '',
      status: isLate ? 'Late' : 'Present',
      workLocation: assignedLocation
    };
    await db.addAttendance(record);
    setAttendance(await db.getAttendance());
    notify(`Checked in successfully at ${record.checkIn} (${assignedLocation})`);
  };

  const checkOut = async (reason?: string) => {
    if (!currentUser) return;
    const todayRecord = getTodayAttendance();
    if (!todayRecord) return;
    const now = new Date();
    
    // Calculate total hours
    const start = new Date(todayRecord.checkInTime || now.toISOString()); // fallback to now if checkInTime missing (edge case)
    const durationMs = now.getTime() - start.getTime();
    const durationHrs = durationMs / (1000 * 60 * 60);
    
    // If worked more than 9 hours, status becomes Present even if it was Late
    const finalStatus = durationHrs >= 9 ? 'Present' : todayRecord.status;

    const updatedRecord: AttendanceRecord = {
      ...todayRecord,
      checkOut: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      checkOutTime: now.toISOString(),
      status: finalStatus,
      notes: reason || todayRecord.notes
    };
    await db.updateAttendance(updatedRecord);
    setAttendance(await db.getAttendance());
    notify(`Checked out successfully at ${updatedRecord.checkOut}`);
  };

  // Add capability to manually update record
  const updateAttendanceRecord = async (record: AttendanceRecord) => {
      await db.updateAttendance(record);
      setAttendance(await db.getAttendance());
      showToast("Attendance record updated", "success");
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

  // Bulk add holidays to prevent multiple toast messages
  const addHolidays = async (newHolidays: Omit<Holiday, 'id'>[]) => {
      for (const h of newHolidays) {
          const holidayWithId = { ...h, id: Math.random().toString(36).substr(2, 9) };
          await db.addHoliday(holidayWithId);
      }
      setHolidays(await db.getHolidays());
      showToast(`Successfully imported ${newHolidays.length} holidays`, 'success');
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
    employees, users: employees, departments, roles, projects, leaves, leaveTypes, attendance, timeEntries, notifications, 
    holidays, payslips, toasts, isLoading, currentUser, theme,
    login, loginWithMicrosoft, logout, forgotPassword, refreshData, showToast, removeToast, toggleTheme,
    addEmployee, updateEmployee, updateUser, deleteEmployee,
    addDepartment, updateDepartment, deleteDepartment,
    addRole, updateRole, deleteRole,
    addProject, updateProject, deleteProject,
    addLeave, addLeaves, updateLeave, updateLeaveStatus,
    addLeaveType, updateLeaveType, deleteLeaveType,
    addTimeEntry, updateTimeEntry, deleteTimeEntry,
    checkIn, checkOut, updateAttendanceRecord, getTodayAttendance,
    notify, markNotificationRead, markAllRead,
    addHoliday, addHolidays, deleteHoliday, generatePayslips, manualAddPayslip
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
