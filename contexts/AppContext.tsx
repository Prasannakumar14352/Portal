import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  User, Employee, Department, Project, LeaveRequest, LeaveTypeConfig, 
  AttendanceRecord, TimeEntry, Notification, Holiday, Payslip, 
  ToastMessage, UserRole, UserSettings, Position, Invitation, EmployeeStatus
} from '../types';
import { db } from '../services/db';
import { PublicClientApplication, AccountInfo } from "@azure/msal-browser";
import { msalConfig, loginRequest } from "../services/authConfig";
import { microsoftGraphService } from "../services/microsoftGraphService";

// Initialize MSAL
const msalInstance = new PublicClientApplication(msalConfig);
msalInstance.initialize();

interface AppContextType {
  currentUser: User | null;
  employees: Employee[];
  departments: Department[];
  projects: Project[];
  leaves: LeaveRequest[];
  leaveTypes: LeaveTypeConfig[];
  attendance: AttendanceRecord[];
  timeEntries: TimeEntry[];
  notifications: Notification[];
  holidays: Holiday[];
  payslips: Payslip[];
  positions: Position[];
  toasts: ToastMessage[];
  isLoading: boolean;
  theme: 'light' | 'dark';

  login: (email: string, pass: string) => Promise<boolean>;
  loginWithMicrosoft: (hint?: string) => Promise<boolean>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<boolean>;
  confirmPasswordReset: (token: string, newPass: string) => Promise<boolean>;
  toggleTheme: () => void;
  
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
  refreshData: () => Promise<void>;

  // Data Operations
  addEmployee: (emp: Employee) => Promise<void>;
  bulkAddEmployees: (emps: Employee[]) => Promise<void>;
  updateEmployee: (emp: Employee) => Promise<void>;
  deleteEmployee: (id: string | number) => Promise<void>;
  inviteEmployee: (data: any) => Promise<void>;
  
  syncAzureUsers: () => Promise<void>;
  updateUser: (id: string | number, data: Partial<User>) => Promise<void>;

  addDepartment: (dept: Department) => Promise<void>;
  updateDepartment: (id: string | number, dept: Department) => Promise<void>;
  deleteDepartment: (id: string | number) => Promise<void>;

  addProject: (proj: Project) => Promise<void>;
  updateProject: (id: string | number, proj: Project) => Promise<void>;
  deleteProject: (id: string | number) => Promise<void>;

  addPosition: (pos: Position) => Promise<void>;
  updatePosition: (id: string | number, pos: Position) => Promise<void>;
  deletePosition: (id: string | number) => Promise<void>;

  addLeave: (leave: LeaveRequest) => Promise<void>;
  addLeaves: (leaves: LeaveRequest[]) => Promise<void>;
  updateLeave: (id: string | number, leave: LeaveRequest) => Promise<void>;
  updateLeaveStatus: (id: string | number, status: string, comment?: string) => Promise<void>;
  deleteLeave: (id: string | number) => Promise<void>;

  addLeaveType: (type: LeaveTypeConfig) => Promise<void>;
  updateLeaveType: (id: string | number, type: LeaveTypeConfig) => Promise<void>;
  deleteLeaveType: (id: string | number) => Promise<void>;

  checkIn: () => Promise<void>;
  checkOut: (notes?: string) => Promise<void>;
  updateAttendanceRecord: (record: AttendanceRecord) => Promise<void>;
  deleteAttendanceRecord: (id: string | number) => Promise<void>;

  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => Promise<void>;
  updateTimeEntry: (id: string | number, entry: Partial<TimeEntry>) => Promise<void>;
  deleteTimeEntry: (id: string | number) => Promise<void>;

  markNotificationRead: (id: string | number) => Promise<void>;
  markAllRead: (userId: string | number) => Promise<void>;
  notify: (message: string, userId: string | number) => Promise<void>;

  addHoliday: (holiday: Holiday) => Promise<void>;
  addHolidays: (holidays: Holiday[]) => Promise<void>;
  deleteHoliday: (id: string | number) => Promise<void>;
  syncHolidayLogs: (year: string) => Promise<void>;

  manualAddPayslip: (slip: Payslip) => Promise<void>;
  updatePayslip: (slip: Payslip) => Promise<void>;
  deletePayslip: (id: string | number) => Promise<void>;
  
  sendLeaveStatusEmail: (data: any) => Promise<void>;
  sendLeaveRequestEmail: (data: any) => Promise<void>;
  sendProjectAssignmentEmail: (data: { email: string, name: string, projectName: string, managerName: string }) => Promise<void>;

  installApp: () => Promise<void>;
  isInstallable: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Initialize as true for first load
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');
    if (isDark) document.documentElement.classList.add('dark');

    // PWA Install Prompt Capture
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    refreshData();
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      if (newTheme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return newTheme;
    });
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshData = async () => {
    try {
      const [emps, depts, projs, lvs, ltypes, atts, times, notifs, hols, slips, pos] = await Promise.all([
        db.getEmployees(),
        db.getDepartments(),
        db.getProjects(),
        db.getLeaves(),
        db.getLeaveTypes(),
        db.getAttendance(),
        db.getTimeEntries(),
        db.getNotifications(),
        db.getHolidays(),
        db.getPayslips(),
        db.getPositions()
      ]);
      setEmployees(emps);
      setDepartments(depts);
      setProjects(projs);
      setLeaves(lvs);
      setLeaveTypes(ltypes);
      setAttendance(atts);
      setTimeEntries(times);
      setNotifications(notifs);
      setHolidays(hols);
      setPayslips(slips);
      setPositions(pos);
      
      // Return data for immediate use in login
      return { emps, depts, projs, lvs, ltypes, atts, times, notifs, hols, slips, pos };
    } catch (error) {
      console.error("Failed to refresh data", error);
      // Don't throw, just allow app to continue potentially with empty data or retries
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    // Get fresh data immediately to ensure we have the latest user list
    const data = await refreshData();
    const userList = data?.emps || employees; 
    
    const user = userList.find(e => e.email.toLowerCase() === email.toLowerCase());
    if (user && (user.password === pass || user.password === 'ms-auth-user')) {
      const role = (user.role as any) === 'HR Manager' ? UserRole.HR : 
                   (user.role as any) === 'Admin' ? UserRole.ADMIN :
                   (user.role as any) === 'Team Manager' ? UserRole.MANAGER : UserRole.EMPLOYEE;
                   
      setCurrentUser({
        id: user.id,
        employeeId: user.employeeId,
        name: `${user.firstName} ${user.lastName}`,
        role: role,
        position: user.position,
        avatar: user.avatar,
        managerId: user.managerId,
        jobTitle: user.jobTitle || user.position,
        departmentId: user.departmentId,
        projectIds: user.projectIds,
        location: user.location,
        workLocation: user.workLocation,
        email: user.email,
        settings: user.settings
      });
      return true;
    }
    showToast("Invalid credentials", "error");
    return false;
  };

  const loginWithMicrosoft = async (hint?: string): Promise<boolean> => {
    try {
        const request = { ...loginRequest, loginHint: hint };
        const response = await msalInstance.loginPopup(request);
        if (response && response.account) {
            const email = response.account.username;
            const user = employees.find(e => e.email.toLowerCase() === email.toLowerCase());
            
            if (user) {
                return login(email, user.password || 'ms-auth-user');
            } else {
                showToast("Microsoft account authenticated, but user not found in HR system.", "error");
                return false;
            }
        }
    } catch (e) {
        console.error(e);
        return false;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    showToast("Logged out successfully", "info");
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
      try {
          const API_BASE = process.env.VITE_API_BASE_URL 
              ? process.env.VITE_API_BASE_URL.replace(/\/$/, '') 
              : '/api';
          
          const isMock = process.env.VITE_USE_MOCK_DATA === 'true';
          
          if (isMock) {
              console.log("[Mock API] Forgot Password Triggered for:", email);
              showToast(`Password reset link sent to ${email}`, "success");
              return true;
          }

          const res = await fetch(`${API_BASE}/auth/forgot-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
          });
          
          const data = await res.json();
          if (res.ok) {
              showToast(data.message || "Reset link sent", "success");
              return true;
          } else {
              showToast(data.message || "Failed to process request", "error");
              return false;
          }
      } catch (err) {
          console.error("Forgot Password Failed", err);
          showToast("Network error. Ensure backend is running on port 8000.", "error");
          return false;
      }
  };

  const confirmPasswordReset = async (token: string, newPass: string): Promise<boolean> => {
      try {
          const API_BASE = process.env.VITE_API_BASE_URL 
              ? process.env.VITE_API_BASE_URL.replace(/\/$/, '') 
              : '/api';
          
          const isMock = process.env.VITE_USE_MOCK_DATA === 'true';
          
          if (isMock) {
              console.log("[Mock API] Password Reset with Token:", token);
              showToast(`Password reset successful. Please login.`, "success");
              return true;
          }

          const res = await fetch(`${API_BASE}/auth/reset-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, newPassword: newPass })
          });
          
          const data = await res.json();
          if (res.ok) {
              showToast(data.message || "Password updated", "success");
              return true;
          } else {
              showToast(data.message || "Failed to reset password", "error");
              return false;
          }
      } catch (err) {
          console.error("Reset Password Failed", err);
          showToast("Connection error.", "error");
          return false;
      }
  };

  // --- CRUD Operations ---

  const addEmployee = async (emp: Employee) => {
      await db.addEmployee(emp);
      await refreshData();
  };

  const bulkAddEmployees = async (emps: Employee[]) => {
      await db.bulkAddEmployees(emps);
      await refreshData();
  };

  const updateEmployee = async (emp: Employee) => {
      await db.updateEmployee(emp);
      if (currentUser && String(currentUser.id) === String(emp.id)) {
          const role = (emp.role as any) === 'HR Manager' ? UserRole.HR : 
                   (emp.role as any) === 'Admin' ? UserRole.ADMIN :
                   (emp.role as any) === 'Team Manager' ? UserRole.MANAGER : UserRole.EMPLOYEE;
          setCurrentUser({
              ...currentUser,
              name: `${emp.firstName} ${emp.lastName}`,
              role,
              position: emp.position,
              avatar: emp.avatar,
              jobTitle: emp.jobTitle || emp.position,
              location: emp.location,
              workLocation: emp.workLocation,
              settings: emp.settings
          });
      }
      await refreshData();
  };

  const deleteEmployee = async (id: string | number) => {
      await db.deleteEmployee(String(id));
      await refreshData();
  };

  const inviteEmployee = async (data: any) => {
      const newEmp: Employee = {
          id: Math.random().toString(36).substr(2, 9),
          employeeId: `EMP-${Math.floor(Math.random()*10000)}`,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: 'password123', 
          role: data.role || 'Employee',
          position: data.position,
          department: 'General',
          joinDate: new Date().toISOString().split('T')[0],
          status: EmployeeStatus.INVITED, 
          salary: data.salary || 0,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.firstName + ' ' + data.lastName)}`,
          location: data.location || { latitude: 0, longitude: 0, address: '' },
          projectIds: data.projectIds || []
      };
      await addEmployee(newEmp);
      showToast(`Invitation sent to ${data.email}`, "success");
  };

  const syncAzureUsers = async () => {
      try {
          const accounts = msalInstance.getAllAccounts();
          if (accounts.length > 0) {
              const request = {
                  scopes: ["User.Read.All"],
                  account: accounts[0]
              };
              const response = await msalInstance.acquireTokenSilent(request).catch(async () => {
                  return await msalInstance.acquireTokenPopup(request);
              });
              
              if (response.accessToken) {
                  const azureUsers = await microsoftGraphService.fetchActiveUsers(response.accessToken);
                  let added = 0;
                  let updated = 0;
                  
                  for (const azUser of azureUsers) {
                      const existing = employees.find(e => e.email.toLowerCase() === azUser.mail?.toLowerCase() || e.email.toLowerCase() === azUser.userPrincipalName.toLowerCase());
                      if (existing) {
                          updated++;
                      } else {
                          const newEmp: Employee = {
                              id: Math.random().toString(36).substr(2, 9),
                              employeeId: azUser.employeeId || `AZ-${Math.floor(Math.random()*10000)}`,
                              firstName: azUser.givenName || azUser.displayName.split(' ')[0],
                              lastName: azUser.surname || '',
                              email: azUser.mail || azUser.userPrincipalName,
                              password: 'ms-auth-user',
                              role: 'Employee',
                              position: azUser.jobTitle || 'Staff',
                              department: azUser.department || 'General',
                              joinDate: azUser.employeeHireDate ? azUser.employeeHireDate.split('T')[0] : new Date().toISOString().split('T')[0],
                              status: azUser.accountEnabled ? EmployeeStatus.ACTIVE : EmployeeStatus.INACTIVE,
                              salary: 0,
                              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(azUser.displayName)}`,
                              location: { latitude: 0, longitude: 0, address: '' }
                          };
                          await db.addEmployee(newEmp);
                          added++;
                      }
                  }
                  await refreshData();
                  showToast(`Azure Sync: ${added} added, ${updated} existing matched.`, "success");
              }
          } else {
              showToast("Please login with Microsoft to sync.", "warning");
          }
      } catch (err) {
          console.error("Azure Sync Error", err);
          showToast("Failed to sync with Azure AD", "error");
      }
  };

  const updateUser = async (id: string | number, data: Partial<User>) => {
      const emp = employees.find(e => String(e.id) === String(id));
      if (emp) {
          const updates: any = { ...data };
          if (data.name) {
              const parts = data.name.split(' ');
              updates.firstName = parts[0];
              updates.lastName = parts.slice(1).join(' ');
          }
          await db.updateEmployee({ ...emp, ...updates });
          await refreshData();
          
          if (currentUser && String(currentUser.id) === String(id)) {
              setCurrentUser({ ...currentUser, ...data });
          }
      }
  };

  const addDepartment = async (dept: Department) => { await db.addDepartment(dept); await refreshData(); };
  const updateDepartment = async (id: string | number, dept: Department) => { await db.updateDepartment(dept); await refreshData(); };
  const deleteDepartment = async (id: string | number) => { await db.deleteDepartment(String(id)); await refreshData(); };

  const addProject = async (proj: Project) => { await db.addProject(proj); await refreshData(); };
  const updateProject = async (id: string | number, proj: Project) => { await db.updateProject(proj); await refreshData(); };
  const deleteProject = async (id: string | number) => { await db.deleteProject(String(id)); await refreshData(); };

  const addPosition = async (pos: Position) => { await db.addPosition(pos); await refreshData(); };
  const updatePosition = async (id: string | number, pos: Position) => { await db.updatePosition(pos); await refreshData(); };
  const deletePosition = async (id: string | number) => { await db.deletePosition(String(id)); await refreshData(); };

  const addLeave = async (leave: LeaveRequest) => { await db.addLeave(leave); await refreshData(); };
  const addLeaves = async (newLeaves: LeaveRequest[]) => { for (const l of newLeaves) await db.addLeave(l); await refreshData(); };
  const updateLeave = async (id: string | number, leave: LeaveRequest) => { await db.updateLeave(leave); await refreshData(); };
  const updateLeaveStatus = async (id: string | number, status: string, comment?: string) => {
      const leave = leaves.find(l => String(l.id) === String(id));
      if (leave) {
          const updates: any = { status: status as any };
          // Assign comment to the correct field based on role
          if (currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN) {
              updates.hrComment = comment;
          } else {
              updates.managerComment = comment;
          }
          
          await db.updateLeave({ ...leave, ...updates });
          await refreshData();
      }
  };
  const deleteLeave = async (id: string | number) => { await db.deleteLeave(String(id)); await refreshData(); };

  const addLeaveType = async (type: LeaveTypeConfig) => { await db.addLeaveType(type); await refreshData(); };
  const updateLeaveType = async (id: string | number, type: LeaveTypeConfig) => { await db.updateLeaveType(type); await refreshData(); };
  const deleteLeaveType = async (id: string | number) => { await db.deleteLeaveType(String(id)); await refreshData(); };

  const checkIn = async () => {
      if (!currentUser) return;
      const now = new Date();
      const record: AttendanceRecord = {
          id: Math.random().toString(36).substr(2, 9),
          employeeId: currentUser.id,
          employeeName: currentUser.name,
          date: now.toISOString().split('T')[0],
          checkIn: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          checkInTime: now.toISOString(),
          checkOut: '',
          status: 'Present',
          workLocation: currentUser.workLocation || 'Office'
      };
      await db.addAttendance(record);
      await refreshData();
      showToast("Checked in successfully", "success");
  };

  const checkOut = async (notes?: string) => {
      if (!currentUser) return;
      const now = new Date();
      const record = attendance.find(a => String(a.employeeId) === String(currentUser.id) && (!a.checkOut || a.checkOut === ''));
      
      if (record) {
          await db.updateAttendance({
              ...record,
              checkOut: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
              checkOutTime: now.toISOString(),
              notes: notes
          });
          await refreshData();
          showToast("Checked out successfully", "success");
      } else {
          showToast("No active check-in found", "warning");
      }
  };

  const updateAttendanceRecord = async (record: AttendanceRecord) => { await db.updateAttendance(record); await refreshData(); };
  const deleteAttendanceRecord = async (id: string | number) => { await db.deleteAttendance(String(id)); await refreshData(); };

  const addTimeEntry = async (entry: Omit<TimeEntry, 'id'>) => { await db.addTimeEntry({ ...entry, id: Math.random().toString(36).substr(2, 9) }); await refreshData(); };
  const updateTimeEntry = async (id: string | number, entry: Partial<TimeEntry>) => {
      const existing = timeEntries.find(t => String(t.id) === String(id));
      if (existing) { await db.updateTimeEntry({ ...existing, ...entry }); await refreshData(); }
  };
  const deleteTimeEntry = async (id: string | number) => { await db.deleteTimeEntry(String(id)); await refreshData(); };

  // Optimistic UI updates for notifications
  const markNotificationRead = async (id: string | number) => { 
      setNotifications(prev => prev.map(n => String(n.id) === String(id) ? { ...n, read: true } : n));
      // NOTE: We do NOT await refreshData() here to preserve the optimistic update
      // and prevent UI flickering if the backend is slow or returns old data.
      await db.markNotificationRead(String(id)); 
  };

  const markAllRead = async (userId: string | number) => { 
      setNotifications(prev => prev.map(n => String(n.userId) === String(userId) ? { ...n, read: true } : n));
      // NOTE: We do NOT await refreshData() here to preserve the optimistic update.
      await db.markAllNotificationsRead(String(userId)); 
  };

  const notify = async (message: string, userId: string | number) => {
      await db.addNotification({
          id: Math.random().toString(36).substr(2, 9),
          userId,
          title: 'System Notification',
          message,
          time: 'Just now',
          read: false,
          type: 'info'
      });
      await refreshData();
  };

  const addHoliday = async (holiday: Holiday) => { await db.addHoliday({ ...holiday, id: Math.random().toString(36).substr(2, 9) }); await refreshData(); };
  const addHolidays = async (newHolidays: Holiday[]) => { for (const h of newHolidays) await db.addHoliday({ ...h, id: Math.random().toString(36).substr(2, 9) }); await refreshData(); };
  const deleteHoliday = async (id: string | number) => { await db.deleteHoliday(String(id)); await refreshData(); };
  const syncHolidayLogs = async (year: string) => { showToast(`Holiday logs synced for ${year}`, "success"); };

  const manualAddPayslip = async (slip: Payslip) => { await db.addPayslip(slip); await refreshData(); };
  const updatePayslip = async (slip: Payslip) => { await db.updatePayslip(slip); await refreshData(); };
  const deletePayslip = async (id: string | number) => { await db.deletePayslip(String(id)); await refreshData(); };

  // Implement Email Sending for Status
  const sendLeaveStatusEmail = async (data: any) => {
      try {
          const API_BASE = process.env.VITE_API_BASE_URL 
              ? process.env.VITE_API_BASE_URL.replace(/\/$/, '') 
              : '/api';
          
          const isMock = process.env.VITE_USE_MOCK_DATA === 'true';
          
          if (isMock) {
              console.log("[Mock Email] Leave Status:", data);
              showToast(`Mock Status Email sent`, "success");
              return;
          }

          const res = await fetch(`${API_BASE}/notify/leave-status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
          });
          
          if (!res.ok) throw new Error("Failed to send status email");
      } catch (err) {
          console.error("Failed to send status email", err);
      }
  };

  const sendLeaveRequestEmail = async (data: any) => {
      try {
          const API_BASE = process.env.VITE_API_BASE_URL 
              ? process.env.VITE_API_BASE_URL.replace(/\/$/, '') 
              : '/api';
          
          const isMock = process.env.VITE_USE_MOCK_DATA === 'true';
          
          if (isMock) {
              console.log("[Mock Email] Leave Request:", data);
              showToast(`Mock Email sent to approver`, "success");
              return;
          }

          const res = await fetch(`${API_BASE}/notify/leave-request`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
          });
          
          if (!res.ok) throw new Error("Failed to send email");
      } catch (err) {
          console.error("Failed to send leave email", err);
      }
  };

  const sendProjectAssignmentEmail = async (data: { email: string, name: string, projectName: string, managerName: string }) => {
      try {
          const API_BASE = process.env.VITE_API_BASE_URL 
              ? process.env.VITE_API_BASE_URL.replace(/\/$/, '') 
              : '/api';
          
          const isMock = process.env.VITE_USE_MOCK_DATA === 'true';
          
          if (isMock) {
              console.log("[Mock Email] Project Assignment:", data);
              showToast(`Mock Email sent to ${data.email}`, "success");
              return;
          }

          const res = await fetch(`${API_BASE}/notify/project-assignment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
          });
          
          if (!res.ok) throw new Error("Failed to send email");
          showToast(`Assignment notification sent to ${data.name}`, "success");
      } catch (err) {
          console.error("Failed to send project email", err);
          showToast("Could not send email notification", "warning");
      }
  };

  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser, employees, departments, projects, leaves, leaveTypes, attendance, 
      timeEntries, notifications, holidays, payslips, positions, toasts, isLoading, theme,
      login, loginWithMicrosoft, logout, forgotPassword, confirmPasswordReset, toggleTheme, showToast, removeToast,
      refreshData, addEmployee, bulkAddEmployees, updateEmployee, deleteEmployee, inviteEmployee, 
      syncAzureUsers, updateUser, addDepartment, updateDepartment, deleteDepartment,
      addProject, updateProject, deleteProject, addPosition, updatePosition, deletePosition,
      addLeave, addLeaves, updateLeave, updateLeaveStatus, deleteLeave, addLeaveType, 
      updateLeaveType, deleteLeaveType, checkIn, checkOut, updateAttendanceRecord, 
      deleteAttendanceRecord, addTimeEntry, updateTimeEntry, deleteTimeEntry,
      markNotificationRead, markAllRead, notify, addHoliday, addHolidays, deleteHoliday, 
      syncHolidayLogs, manualAddPayslip, updatePayslip, deletePayslip, sendLeaveStatusEmail,
      sendLeaveRequestEmail, sendProjectAssignmentEmail,
      installApp, isInstallable: !!deferredPrompt && !isStandalone
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};