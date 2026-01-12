
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  User, Employee, Department, Project, LeaveRequest, LeaveTypeConfig, 
  AttendanceRecord, TimeEntry, Notification, Holiday, Payslip, Position,
  Role, ToastMessage, UserRole, EmployeeStatus, Invitation 
} from '../types';
import { db } from '../services/db';
import { msalConfig, loginRequest } from '../services/authConfig';
import { PublicClientApplication, InteractionRequiredAuthError, BrowserAuthError } from "@azure/msal-browser";
import { microsoftGraphService } from '../services/microsoftGraphService';
import { emailService } from '../services/emailService';

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

  login: (email: string, password?: string) => Promise<boolean>;
  loginWithMicrosoft: (loginHint?: string) => Promise<boolean>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<boolean>;
  
  toggleTheme: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
  
  refreshData: () => Promise<void>;
  
  addEmployee: (emp: Employee) => Promise<void>;
  bulkAddEmployees: (emps: Employee[]) => Promise<void>;
  updateEmployee: (emp: Employee) => Promise<void>;
  deleteEmployee: (id: string | number) => Promise<void>;
  inviteEmployee: (data: any) => Promise<void>;
  syncAzureUsers: () => Promise<void>;
  updateUser: (id: string | number, data: Partial<User>) => Promise<void>;

  addDepartment: (dept: Department) => Promise<void>;
  updateDepartment: (dept: Department) => Promise<void>;
  deleteDepartment: (id: string | number) => Promise<void>;

  addProject: (proj: Project) => Promise<void>;
  updateProject: (proj: Project) => Promise<void>;
  deleteProject: (id: string | number) => Promise<void>;

  addPosition: (pos: Position) => Promise<void>;
  updatePosition: (pos: Position) => Promise<void>;
  deletePosition: (id: string | number) => Promise<void>;

  addLeave: (leave: LeaveRequest) => Promise<void>;
  addLeaves: (leaves: LeaveRequest[]) => Promise<void>;
  updateLeave: (id: string | number, data: Partial<LeaveRequest>) => Promise<void>;
  updateLeaveStatus: (id: string | number, status: string, comment?: string) => Promise<void>;
  deleteLeave: (id: string | number) => Promise<void>;
  
  addLeaveType: (type: LeaveTypeConfig) => Promise<void>;
  updateLeaveType: (id: string | number, data: Partial<LeaveTypeConfig>) => Promise<void>;
  deleteLeaveType: (id: string | number) => Promise<void>;

  checkIn: (notes?: string) => Promise<void>;
  checkOut: (notes?: string) => Promise<void>;
  updateAttendanceRecord: (record: AttendanceRecord) => Promise<void>;
  deleteAttendanceRecord: (id: string | number) => Promise<void>;

  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => Promise<void>;
  updateTimeEntry: (id: string | number, entry: Partial<TimeEntry>) => Promise<void>;
  deleteTimeEntry: (id: string | number) => Promise<void>;

  markNotificationRead: (id: string | number) => Promise<void>;
  markAllRead: (userId: string | number) => Promise<void>;
  notify: (message: string, userId: string | number) => Promise<void>;

  addHoliday: (holiday: Omit<Holiday, 'id'>) => Promise<void>;
  addHolidays: (holidays: Omit<Holiday, 'id'>[]) => Promise<void>;
  deleteHoliday: (id: string | number) => Promise<void>;
  syncHolidayLogs: (year: string) => Promise<void>;

  manualAddPayslip: (slip: Payslip) => Promise<void>;
  sendLeaveStatusEmail: (data: any) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Initialize MSAL outside the component to ensure it's a singleton and survives re-renders
const msalInstance = new PublicClientApplication(msalConfig);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isMsalReady, setIsMsalReady] = useState(false);

  useEffect(() => {
    // Initialize MSAL
    const initMsal = async () => {
      try {
        if (!msalInstance.getActiveAccount() && !isMsalReady) {
             await msalInstance.initialize();
             setIsMsalReady(true);
             const response = await msalInstance.handleRedirectPromise();
             if (response) handleMsalResponse(response);
        } else {
             setIsMsalReady(true);
        }
      } catch (error) {
        console.log("MSAL Init notice:", error);
        // If it fails because it's already initialized, we mark ready
        setIsMsalReady(true); 
      }
    };
    initMsal();
    
    // Check for stored user
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    
    // Check theme
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }

    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      const [emps, depts, projs, lvs, ltypes, att, time, notifs, hols, slips, pos] = await Promise.all([
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
      setAttendance(att);
      setTimeEntries(time);
      setNotifications(notifs);
      setHolidays(hols);
      setPayslips(slips);
      setPositions(pos);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    const user = employees.find(e => e.email.toLowerCase() === email.toLowerCase());
    
    if (user && (!password || user.password === password || user.password === 'ms-auth-user')) {
      const role = user.role.toLowerCase().includes('admin') ? UserRole.ADMIN : 
                   user.role.toLowerCase().includes('hr') ? UserRole.HR :
                   user.role.toLowerCase().includes('manager') ? UserRole.MANAGER : UserRole.EMPLOYEE;
      
      const sessionUser: User = {
        id: user.id,
        employeeId: user.employeeId,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: role,
        position: user.position,
        avatar: user.avatar || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}`,
        managerId: user.managerId,
        departmentId: user.departmentId,
        jobTitle: user.jobTitle || user.position,
        settings: user.settings
      };
      
      setCurrentUser(sessionUser);
      localStorage.setItem('currentUser', JSON.stringify(sessionUser));
      showToast(`Welcome back, ${user.firstName}!`, 'success');
      return true;
    }
    
    showToast('Invalid credentials', 'error');
    return false;
  };

  const handleMsalResponse = async (response: any) => {
      const email = response.account?.username;
      if (email) {
          // Check if user exists in DB
          let user = employees.find(e => e.email.toLowerCase() === email.toLowerCase());
          
          if (!user) {
              // Optionally provision user if they exist in Azure but not DB (JIT Provisioning)
              try {
                  const graphProfile = await microsoftGraphService.fetchMe(response.accessToken);
                  // Just create a temp user record if auto-provisioning is desired, else fail
                  showToast("User found in Azure but not in HR system. Contact Admin.", "warning");
                  return;
              } catch (e) {
                  showToast("Failed to fetch Azure profile.", "error");
                  return;
              }
          }
          await login(email);
      }
  };

  const loginWithMicrosoft = async (loginHint?: string): Promise<boolean> => {
      if (!isMsalReady) {
          showToast("Authentication service is initializing...", "info");
          return false;
      }
      try {
          const request = { ...loginRequest, loginHint };
          const response = await msalInstance.loginPopup(request);
          await handleMsalResponse(response);
          return true;
      } catch (error: any) {
          if (error instanceof BrowserAuthError && (error.errorCode === "user_cancelled" || error.message?.includes("window closed"))) {
             // User cancelled, just log info
             console.log("MSAL Login: User cancelled or closed window.");
          } else {
             console.error("MSAL Login Error:", error);
          }
          return false;
      }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    if (isMsalReady) {
        msalInstance.logoutPopup().catch(console.error); // Optional Azure logout
    }
    showToast('Logged out successfully', 'info');
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
      // Simulate API call
      return new Promise((resolve) => {
          setTimeout(() => {
             // In real app, call API to send email
             showToast(`Reset instructions sent to ${email}`, 'success');
             resolve(true);
          }, 1000);
      });
  };

  // --- Data Operations Wrappers ---

  const addEmployee = async (emp: Employee) => {
      const newEmp = { ...emp, id: emp.id || Math.random().toString(36).substr(2, 9) };
      await db.addEmployee(newEmp);
      setEmployees(prev => [...prev, newEmp]);
  };

  const bulkAddEmployees = async (emps: Employee[]) => { 
      setIsLoading(true);
      try {
          await db.bulkAddEmployees(emps);
          await refreshData(); 
          showToast(`Imported ${emps.length} employees.`, 'success'); 
      } catch (err) {
          console.error("Bulk Import Failed:", err);
          showToast("Failed to import employees.", "error");
      } finally {
          setIsLoading(false);
      }
  };

  const updateEmployee = async (emp: Employee) => {
      await db.updateEmployee(emp);
      setEmployees(prev => prev.map(e => String(e.id) === String(emp.id) ? emp : e));
      if (currentUser && String(currentUser.id) === String(emp.id)) {
          const updatedUser = { ...currentUser, ...emp, name: `${emp.firstName} ${emp.lastName}` };
          setCurrentUser(updatedUser as User);
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      }
  };

  const deleteEmployee = async (id: string | number) => {
      await db.deleteEmployee(String(id));
      setEmployees(prev => prev.filter(e => String(e.id) !== String(id)));
  };

  const inviteEmployee = async (data: any) => {
     // Create invitation record
     const token = Math.random().toString(36).substring(2);
     const invite: Invitation = {
         id: Math.random().toString(36).substr(2, 9),
         ...data,
         invitedDate: new Date().toISOString(),
         token,
         provisionInAzure: data.provisionInAzure
     };
     await db.addInvitation(invite);
     await emailService.sendInvitation({ email: data.email, firstName: data.firstName, role: data.role, token });
     
     // Also provision in local DB as "Invited" status
     await addEmployee({
         id: Math.random().toString(36).substr(2, 9),
         employeeId: `EMP-${Math.floor(Math.random() * 10000)}`,
         firstName: data.firstName,
         lastName: data.lastName,
         email: data.email,
         role: data.role,
         position: data.position,
         department: data.department,
         salary: data.salary,
         status: EmployeeStatus.INVITED,
         joinDate: new Date().toISOString().split('T')[0],
         avatar: `https://ui-avatars.com/api/?name=${data.firstName}+${data.lastName}`,
         password: 'tempPassword123!', // Should be reset on first login
         projectIds: [],
         location: data.location || { latitude: 0, longitude: 0, address: '' }
     });

     showToast(`Invitation sent to ${data.email}`, 'success');
  };

  const syncAzureUsers = async () => {
      // In a real implementation, this would call the backend to sync
      // For now, we simulate success
      showToast("Syncing with Azure AD...", "info");
      setTimeout(() => {
          showToast("Azure AD Sync Completed", "success");
      }, 2000);
  };
  
  const updateUser = async (id: string | number, data: Partial<User>) => {
      // Since User is derived from Employee, we find the employee and update
      const emp = employees.find(e => String(e.id) === String(id));
      if (emp) {
          const updatedEmp = { ...emp, ...data };
          if (data.name) {
             const parts = data.name.split(' ');
             updatedEmp.firstName = parts[0];
             updatedEmp.lastName = parts.slice(1).join(' ');
          }
          await updateEmployee(updatedEmp);
      }
  };

  const addDepartment = async (dept: Department) => {
      await db.addDepartment(dept);
      setDepartments(prev => [...prev, dept]);
  };
  const updateDepartment = async (dept: Department) => {
      await db.updateDepartment(dept);
      setDepartments(prev => prev.map(d => String(d.id) === String(dept.id) ? dept : d));
  };
  const deleteDepartment = async (id: string | number) => {
      await db.deleteDepartment(String(id));
      setDepartments(prev => prev.filter(d => String(d.id) !== String(id)));
  };

  const addProject = async (proj: Project) => {
      await db.addProject(proj);
      setProjects(prev => [...prev, proj]);
  };
  const updateProject = async (proj: Project) => {
      await db.updateProject(proj);
      setProjects(prev => prev.map(p => String(p.id) === String(proj.id) ? proj : p));
  };
  const deleteProject = async (id: string | number) => {
      await db.deleteProject(String(id));
      setProjects(prev => prev.filter(p => String(p.id) !== String(id)));
  };

  const addPosition = async (pos: Position) => {
      await db.addPosition(pos);
      setPositions(prev => [...prev, pos]);
  };
  const updatePosition = async (pos: Position) => {
      await db.updatePosition(pos);
      setPositions(prev => prev.map(p => String(p.id) === String(pos.id) ? pos : p));
  };
  const deletePosition = async (id: string | number) => {
      await db.deletePosition(String(id));
      setPositions(prev => prev.filter(p => String(p.id) !== String(id)));
  };

  const addLeave = async (leave: LeaveRequest) => {
      await db.addLeave(leave);
      setLeaves(prev => [...prev, leave]);
  };
  const addLeaves = async (newLeaves: LeaveRequest[]) => {
      // Batch add not supported by mockDB directly usually, loop for now or add bulk method
      for (const l of newLeaves) await db.addLeave(l);
      setLeaves(prev => [...prev, ...newLeaves]);
  };
  const updateLeave = async (id: string | number, data: Partial<LeaveRequest>) => {
      const existing = leaves.find(l => String(l.id) === String(id));
      if (existing) {
          const updated = { ...existing, ...data };
          await db.updateLeave(updated);
          setLeaves(prev => prev.map(l => String(l.id) === String(id) ? updated : l));
      }
  };
  const updateLeaveStatus = async (id: string | number, status: string, comment?: string) => {
      await updateLeave(id, { status: status as any, managerComment: comment });
  };
  const deleteLeave = async (id: string | number) => {
      await db.deleteLeave(String(id));
      setLeaves(prev => prev.filter(l => String(l.id) !== String(id)));
  };

  const addLeaveType = async (type: LeaveTypeConfig) => {
      await db.addLeaveType(type);
      setLeaveTypes(prev => [...prev, type]);
  };
  const updateLeaveType = async (id: string | number, data: Partial<LeaveTypeConfig>) => {
      const existing = leaveTypes.find(t => String(t.id) === String(id));
      if (existing) {
          const updated = { ...existing, ...data };
          await db.updateLeaveType(updated);
          setLeaveTypes(prev => prev.map(t => String(t.id) === String(id) ? updated : t));
      }
  };
  const deleteLeaveType = async (id: string | number) => {
      await db.deleteLeaveType(String(id));
      setLeaveTypes(prev => prev.filter(t => String(t.id) !== String(id)));
  };

  const checkIn = async (notes?: string) => {
      if (!currentUser) return;
      const now = new Date();
      const record: AttendanceRecord = {
          id: Math.random().toString(36).substr(2, 9),
          employeeId: currentUser.id,
          employeeName: currentUser.name,
          date: now.toLocaleDateString('en-CA'),
          checkIn: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(),
          checkInTime: now.toISOString(),
          checkOut: '',
          status: 'Present',
          notes,
          workLocation: currentUser.workLocation
      };
      await db.addAttendance(record);
      setAttendance(prev => [...prev, record]);
      showToast("Checked In Successfully", "success");
  };
  
  const checkOut = async (notes?: string) => {
      if (!currentUser) return;
      const today = new Date().toLocaleDateString('en-CA');
      // Find open session
      const record = attendance.find(a => String(a.employeeId) === String(currentUser.id) && a.date === today && !a.checkOut);
      
      if (record) {
          const now = new Date();
          const updated = {
              ...record,
              checkOut: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(),
              checkOutTime: now.toISOString(),
              notes: notes ? (record.notes ? record.notes + '; ' + notes : notes) : record.notes
          };
          await db.updateAttendance(updated);
          setAttendance(prev => prev.map(a => String(a.id) === String(updated.id) ? updated : a));
          showToast("Checked Out Successfully", "success");
      } else {
          showToast("No active session found to check out.", "warning");
      }
  };

  const updateAttendanceRecord = async (record: AttendanceRecord) => {
      await db.updateAttendance(record);
      setAttendance(prev => prev.map(a => String(a.id) === String(record.id) ? record : a));
  };
  
  const deleteAttendanceRecord = async (id: string | number) => {
      await db.deleteAttendance(String(id));
      setAttendance(prev => prev.filter(a => String(a.id) !== String(id)));
  };

  const addTimeEntry = async (entry: Omit<TimeEntry, 'id'>) => {
      const newEntry = { ...entry, id: Math.random().toString(36).substr(2, 9) };
      await db.addTimeEntry(newEntry);
      setTimeEntries(prev => [...prev, newEntry]);
  };
  const updateTimeEntry = async (id: string | number, entryData: Partial<TimeEntry>) => {
      const existing = timeEntries.find(e => String(e.id) === String(id));
      if (existing) {
          const updated = { ...existing, ...entryData };
          await db.updateTimeEntry(updated);
          setTimeEntries(prev => prev.map(e => String(e.id) === String(id) ? updated : e));
      }
  };
  const deleteTimeEntry = async (id: string | number) => {
      await db.deleteTimeEntry(String(id));
      setTimeEntries(prev => prev.filter(e => String(e.id) !== String(id)));
  };

  const markNotificationRead = async (id: string | number) => {
      await db.markNotificationRead(String(id));
      setNotifications(prev => prev.map(n => String(n.id) === String(id) ? { ...n, read: true } : n));
  };
  
  const markAllRead = async (userId: string | number) => {
      await db.markAllNotificationsRead(String(userId));
      setNotifications(prev => prev.map(n => String(n.userId) === String(userId) ? { ...n, read: true } : n));
  };

  const notify = async (message: string, userId: string | number) => {
      const notif: Notification = {
          id: Math.random().toString(36).substr(2, 9),
          userId,
          title: 'System Notification',
          message,
          time: 'Just now',
          read: false,
          type: 'info'
      };
      await db.addNotification(notif);
      setNotifications(prev => [notif, ...prev]);
  };

  const addHoliday = async (holiday: Omit<Holiday, 'id'>) => {
      const newHoliday = { ...holiday, id: Math.random().toString(36).substr(2, 9) };
      await db.addHoliday(newHoliday);
      setHolidays(prev => [...prev, newHoliday]);
  };

  const addHolidays = async (newHolidays: Omit<Holiday, 'id'>[]) => {
      // Simulate bulk add
      for (const h of newHolidays) {
          await addHoliday(h);
      }
  };

  const deleteHoliday = async (id: string | number) => {
      await db.deleteHoliday(String(id));
      setHolidays(prev => prev.filter(h => String(h.id) !== String(id)));
  };

  const syncHolidayLogs = async (year: string) => {
      showToast(`Syncing holiday logs for ${year}...`, "info");
      // Logic to auto-generate time entries for holidays would go here
      setTimeout(() => showToast("Holiday logs synced.", "success"), 1000);
  };

  const manualAddPayslip = async (slip: Payslip) => {
      await db.addPayslip(slip);
      setPayslips(prev => [...prev, slip]);
  };

  const sendLeaveStatusEmail = async (data: any) => {
      // Backend handles email
      console.log("Sending email", data);
  };

  return (
    <AppContext.Provider value={{
      currentUser, employees, departments, projects, leaves, leaveTypes, attendance, 
      timeEntries, notifications, holidays, payslips, positions, toasts, isLoading, theme,
      login, loginWithMicrosoft, logout, forgotPassword, toggleTheme, showToast, removeToast,
      refreshData, addEmployee, bulkAddEmployees, updateEmployee, deleteEmployee, inviteEmployee, 
      syncAzureUsers, updateUser, addDepartment, updateDepartment, deleteDepartment,
      addProject, updateProject, deleteProject, addPosition, updatePosition, deletePosition,
      addLeave, addLeaves, updateLeave, updateLeaveStatus, deleteLeave, addLeaveType, 
      updateLeaveType, deleteLeaveType, checkIn, checkOut, updateAttendanceRecord, 
      deleteAttendanceRecord, addTimeEntry, updateTimeEntry, deleteTimeEntry,
      markNotificationRead, markAllRead, notify, addHoliday, addHolidays, deleteHoliday, 
      syncHolidayLogs, manualAddPayslip, sendLeaveStatusEmail
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
