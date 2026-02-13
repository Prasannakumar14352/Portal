
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Employee, Department, Project, LeaveRequest, LeaveTypeConfig, AttendanceRecord, TimeEntry, Notification, Holiday, Payslip, Position, UserRole, Invitation, LeaveStatus, UserSettings, EmployeeStatus } from '../types';
import { db } from '../services/db';
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginRequest } from "../services/authConfig";
import { microsoftGraphService } from "../services/microsoftGraphService";

interface AppContextType {
  currentUser: User | null;
  employees: Employee[];
  departments: Department[];
  positions: Position[];
  projects: Project[];
  leaves: LeaveRequest[];
  leaveTypes: LeaveTypeConfig[];
  attendance: AttendanceRecord[];
  timeEntries: TimeEntry[];
  notifications: Notification[];
  holidays: Holiday[];
  payslips: Payslip[];
  isLoading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (email: string, password?: string) => Promise<boolean>;
  loginWithMicrosoft: (loginHint?: string) => Promise<boolean>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<boolean>;
  confirmPasswordReset: (token: string, newPass: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
  
  addEmployee: (emp: Employee) => Promise<void>;
  bulkAddEmployees: (emps: Employee[]) => Promise<void>;
  updateEmployee: (emp: Partial<Employee>) => Promise<void>;
  updateUser: (id: string|number, data: Partial<User>) => Promise<void>;
  deleteEmployee: (id: string|number) => Promise<void>;
  inviteEmployee: (data: any) => Promise<void>;
  
  addLeave: (leave: LeaveRequest) => Promise<void>;
  addLeaves: (leaves: LeaveRequest[]) => Promise<void>;
  updateLeave: (id: string|number, data: Partial<LeaveRequest>) => Promise<void>;
  updateLeaveStatus: (id: string|number, status: string, comment?: string) => Promise<void>;
  deleteLeave: (id: string|number) => Promise<void>;
  
  addProject: (project: Project) => Promise<void>;
  updateProject: (id: string|number, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string|number) => Promise<void>;
  
  addPosition: (pos: Position) => Promise<void>;
  updatePosition: (id: string|number, data: Partial<Position>) => Promise<void>;
  deletePosition: (id: string|number) => Promise<void>;
  
  checkIn: () => Promise<void>;
  checkOut: (notes?: string) => Promise<void>;
  updateAttendanceRecord: (record: AttendanceRecord) => Promise<void>;
  deleteAttendanceRecord: (id: string|number) => Promise<void>;
  
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => Promise<void>;
  updateTimeEntry: (id: string|number, entry: Partial<TimeEntry>) => Promise<void>;
  deleteTimeEntry: (id: string|number) => Promise<void>;
  
  addLeaveType: (type: LeaveTypeConfig) => Promise<void>;
  updateLeaveType: (id: string|number, data: Partial<LeaveTypeConfig>) => Promise<void>;
  deleteLeaveType: (id: string|number) => Promise<void>;
  
  addHoliday: (holiday: Holiday) => Promise<void>;
  addHolidays: (holidays: Holiday[]) => Promise<void>;
  deleteHoliday: (id: string|number) => Promise<void>;
  
  manualAddPayslip: (payslip: Payslip) => Promise<void>;
  updatePayslip: (payslip: Payslip) => Promise<void>;
  deletePayslip: (id: string|number) => Promise<void>;
  
  markNotificationRead: (id: string|number) => Promise<void>;
  markAllRead: (userId: string|number) => Promise<void>;
  clearAllNotifications: (userId: string|number) => Promise<void>;
  notify: (message: string, userId: string|number, type?: 'info'|'success'|'warning'|'error') => Promise<void>;
  
  syncAzureUsers: () => Promise<void>;
  sendProjectAssignmentEmail: (data: any) => Promise<void>;
  syncHolidayLogs: (year: string) => Promise<void>;
  
  toasts: Array<{id: string, message: string, type: 'success'|'error'|'info'|'warning'}>;
  showToast: (msg: string, type?: 'success'|'error'|'info'|'warning') => void;
  removeToast: (id: string) => void;

  notifyMissingTimesheets: (targetDate: string) => Promise<any>;
  notifyWeeklyCompliance: () => Promise<any>;

  installApp: () => void;
  isInstallable: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light'|'dark'>('light');
  const [toasts, setToasts] = useState<Array<{id: string, message: string, type: 'success'|'error'|'info'|'warning'}>>([]);

  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  // MSAL Instance
  const msalInstance = new PublicClientApplication(msalConfig);

  useEffect(() => {
    // Check dark mode preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
    
    const initData = async () => {
      try {
        await refreshData();
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          // Re-validate against fresh employee data if possible
          const freshEmp = (await db.getEmployees()).find(e => String(e.id) === String(user.id));
          if (freshEmp) {
             const mappedUser = mapEmployeeToUser(freshEmp);
             setCurrentUser(mappedUser);
             // Apply saved theme preference on load
             if (mappedUser.settings?.branding?.primaryColor) {
               applyThemeToRoot(mappedUser.settings.branding.primaryColor);
             }
          } else {
             setCurrentUser(user);
             if (user.settings?.branding?.primaryColor) {
               applyThemeToRoot(user.settings.branding.primaryColor);
             }
          }
        }
      } catch(e) {
        console.error("Init failed", e);
      } finally {
        setIsLoading(false);
      }
    };
    
    initData();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Apply theme when user updates settings
  useEffect(() => {
    if (currentUser?.settings?.branding?.primaryColor) {
      applyThemeToRoot(currentUser.settings.branding.primaryColor);
    }
  }, [currentUser?.settings?.branding?.primaryColor]);

  // PWA Handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
        setIsStandalone(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // -- Theme Helpers --
  const applyThemeToRoot = (hex: string) => {
    const hexToRgb = (h: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    };
    const mix = (c1: any, c2: any, w: number) => {
        const r = Math.round(c1.r * (1 - w) + c2.r * w);
        const g = Math.round(c1.g * (1 - w) + c2.g * w);
        const b = Math.round(c1.b * (1 - w) + c2.b * w);
        return `${r} ${g} ${b}`;
    };

    const rgb = hexToRgb(hex);
    if (!rgb) return;

    const root = document.documentElement;
    root.style.setProperty('--primary-50', mix(rgb, {r:255,g:255,b:255}, 0.95));
    root.style.setProperty('--primary-100', mix(rgb, {r:255,g:255,b:255}, 0.9));
    root.style.setProperty('--primary-200', mix(rgb, {r:255,g:255,b:255}, 0.75));
    root.style.setProperty('--primary-300', mix(rgb, {r:255,g:255,b:255}, 0.6));
    root.style.setProperty('--primary-400', mix(rgb, {r:255,g:255,b:255}, 0.3));
    root.style.setProperty('--primary-500', mix(rgb, {r:255,g:255,b:255}, 0.1));
    root.style.setProperty('--primary-600', `${rgb.r} ${rgb.g} ${rgb.b}`);
    root.style.setProperty('--primary-700', mix(rgb, {r:0,g:0,b:0}, 0.1));
    root.style.setProperty('--primary-800', mix(rgb, {r:0,g:0,b:0}, 0.25));
    root.style.setProperty('--primary-900', mix(rgb, {r:0,g:0,b:0}, 0.45));
    root.style.setProperty('--primary-950', mix(rgb, {r:0,g:0,b:0}, 0.65));
  };

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        setDeferredPrompt(null);
    }
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const mapEmployeeToUser = (emp: Employee): User => {
    let roleEnum = UserRole.EMPLOYEE;
    const dbRole = (emp.role || '').toLowerCase();
    if (dbRole.includes('admin')) roleEnum = UserRole.ADMIN;
    else if (dbRole.includes('hr manager')) roleEnum = UserRole.HR;
    else if (dbRole.includes('team manager') || dbRole === 'manager') roleEnum = UserRole.MANAGER;

    return {
      id: emp.id,
      employeeId: emp.employeeId,
      name: `${emp.firstName} ${emp.lastName}`,
      role: roleEnum,
      position: emp.position,
      avatar: emp.avatar,
      managerId: emp.managerId,
      jobTitle: emp.jobTitle || emp.position || emp.role,
      departmentId: emp.departmentId,
      email: emp.email,
      settings: emp.settings,
      bio: emp.bio
    } as User;
  };

  const refreshData = async () => {
    try {
      const [emp, dept, pos, proj, lvs, lts, att, times, notifs, hols, pay] = await Promise.all([
        db.getEmployees(), db.getDepartments(), db.getPositions(), db.getProjects(), 
        db.getLeaves(), db.getLeaveTypes(), db.getAttendance(), db.getTimeEntries(), 
        db.getNotifications(), db.getHolidays(), db.getPayslips()
      ]);
      setEmployees(emp);
      setDepartments(dept);
      setPositions(pos);
      setProjects(proj);
      setLeaves(lvs);
      setLeaveTypes(lts);
      setAttendance(att);
      setTimeEntries(times);
      setNotifications(notifs);
      setHolidays(hols);
      setPayslips(pay);
    } catch(e) {
      console.error("Refresh failed", e);
    }
  };

  const showToast = (message: string, type: 'success'|'error'|'info'|'warning' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const login = async (email: string, password?: string) => {
    // Force refresh to ensure we have latest employees
    const currentEmployees = await db.getEmployees();
    const user = currentEmployees.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (user) {
      if (password && user.password !== password) {
          showToast("Invalid credentials", "error");
          return false;
      }
      const mapped = mapEmployeeToUser(user);
      setCurrentUser(mapped);
      localStorage.setItem('currentUser', JSON.stringify(mapped));
      
      // Apply theme on login
      if (mapped.settings?.branding?.primaryColor) {
          applyThemeToRoot(mapped.settings.branding.primaryColor);
      }
      
      return true;
    }
    showToast("User not found", "error");
    return false;
  };

  const loginWithMicrosoft = async (loginHint?: string) => {
    try {
        await msalInstance.initialize();
        const response = await msalInstance.loginPopup({ ...loginRequest, loginHint });
        if (response && response.account) {
            const email = response.account.username;
            const currentEmployees = await db.getEmployees();
            let user = currentEmployees.find(u => u.email.toLowerCase() === email.toLowerCase());
            
            if (!user) {
                // Strict check for now
                showToast("Microsoft account verified, but no matching employee record found.", "error");
                return false;
            }
            
            const mapped = mapEmployeeToUser(user);
            setCurrentUser(mapped);
            localStorage.setItem('currentUser', JSON.stringify(mapped));
            
            // Apply theme on login
            if (mapped.settings?.branding?.primaryColor) {
               applyThemeToRoot(mapped.settings.branding.primaryColor);
            }

            return true;
        }
    } catch (e) {
        console.error(e);
        return false;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    // Reset theme to default on logout
    applyThemeToRoot('#7c3aed');
  };

  const forgotPassword = async (email: string) => {
      const res = await fetch('/api/auth/forgot-password', {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email })
      });
      if(res.ok) {
          showToast("Password reset link sent to your email.", "success");
          return true;
      }
      showToast("Failed to send reset link.", "error");
      return false;
  };

  const confirmPasswordReset = async (token: string, newPass: string) => {
      const res = await fetch('/api/auth/reset-password', {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ token, password: newPass })
      });
      if(res.ok) {
          showToast("Password updated successfully.", "success");
          return true;
      }
      showToast("Failed to update password.", "error");
      return false;
  };

  // CRUD implementations
  const addEmployee = async (emp: Employee) => {
      await db.addEmployee(emp);
      await refreshData();
  };
  
  const bulkAddEmployees = async (emps: Employee[]) => {
      await db.bulkAddEmployees(emps);
      await refreshData();
  };

  const updateEmployee = async (emp: Partial<Employee>) => {
      if(!emp.id) return;
      const existing = employees.find(e => String(e.id) === String(emp.id));
      if(existing) {
          await db.updateEmployee({...existing, ...emp});
          await refreshData();
          if(currentUser && String(currentUser.id) === String(emp.id)) {
              const updated = mapEmployeeToUser({...existing, ...emp});
              setCurrentUser(updated);
              localStorage.setItem('currentUser', JSON.stringify(updated));
          }
      }
  };

  const updateUser = async (id: string|number, data: Partial<User>) => {
      const empUpdate: any = { id };
      if(data.name) {
          const parts = data.name.split(' ');
          empUpdate.firstName = parts[0];
          empUpdate.lastName = parts.slice(1).join(' ');
      }
      if(data.phone) empUpdate.phone = data.phone;
      if(data.avatar) empUpdate.avatar = data.avatar;
      if(data.location) empUpdate.location = data.location;
      if(data.settings) empUpdate.settings = data.settings;
      if(data.workLocation) empUpdate.workLocation = data.workLocation;
      if(data.jobTitle) empUpdate.jobTitle = data.jobTitle;
      if(data.bio) empUpdate.bio = data.bio;

      await updateEmployee(empUpdate);
  };

  const deleteEmployee = async (id: string|number) => {
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
          role: data.role,
          salary: data.salary,
          joinDate: new Date().toISOString().split('T')[0],
          status: EmployeeStatus.INVITED,
          password: 'password123',
          avatar: `https://ui-avatars.com/api/?name=${data.firstName}+${data.lastName}`,
          location: data.location,
          department: 'General',
          projectIds: []
      };
      await addEmployee(newEmp);
      showToast(`Invitation sent to ${data.email}`, 'success');
  };

  const addLeave = async (leave: LeaveRequest) => {
      await db.addLeave(leave);
      await refreshData();
  };
  const addLeaves = async (leaves: LeaveRequest[]) => {
      for(const l of leaves) await db.addLeave(l);
      await refreshData();
  };
  const updateLeave = async (id: string|number, data: Partial<LeaveRequest>) => {
      const existing = leaves.find(l => String(l.id) === String(id));
      if(existing) {
          await db.updateLeave({...existing, ...data});
          await refreshData();
      }
  };
  const updateLeaveStatus = async (id: string|number, status: string, comment?: string) => {
      const existing = leaves.find(l => String(l.id) === String(id));
      if(existing) {
          const update: any = { status };
          if(comment) {
              if(status === LeaveStatus.REJECTED || status === LeaveStatus.APPROVED) {
                  update.managerComment = comment; 
              }
          }
          await db.updateLeave({...existing, ...update});
          await refreshData();
      }
  };
  const deleteLeave = async (id: string|number) => {
      await db.deleteLeave(String(id));
      await refreshData();
  };

  const addProject = async (project: Project) => {
      await db.addProject(project);
      await refreshData();
  };
  const updateProject = async (id: string|number, data: Partial<Project>) => {
      const existing = projects.find(p => String(p.id) === String(id));
      if(existing) {
          await db.updateProject({...existing, ...data});
          await refreshData();
      }
  };
  const deleteProject = async (id: string|number) => {
      await db.deleteProject(String(id));
      await refreshData();
  };

  const addPosition = async (pos: Position) => {
      await db.addPosition(pos);
      await refreshData();
  };
  const updatePosition = async (id: string|number, data: Partial<Position>) => {
      const existing = positions.find(p => String(p.id) === String(id));
      if(existing) {
          await db.updatePosition({...existing, ...data});
          await refreshData();
      }
  };
  const deletePosition = async (id: string|number) => {
      await db.deletePosition(String(id));
      await refreshData();
  };

  const checkIn = async () => {
      if(!currentUser) return;
      const now = new Date();
      const record: AttendanceRecord = {
          id: Math.random().toString(36).substr(2,9),
          employeeId: currentUser.id,
          employeeName: currentUser.name,
          date: now.toLocaleDateString('en-CA'),
          checkIn: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}),
          checkInTime: now.toISOString(),
          checkOut: '',
          status: 'Present',
          workLocation: currentUser.workLocation || 'Office'
      };
      await db.addAttendance(record);
      await refreshData();
      showToast('Checked in successfully', 'success');
  };

  const checkOut = async (notes?: string) => {
      if(!currentUser) return;
      const pending = attendance
        .filter(a => String(a.employeeId) === String(currentUser.id) && !a.checkOut)
        .sort((a,b) => new Date(b.checkInTime || b.date).getTime() - new Date(a.checkInTime || a.date).getTime())[0];
      
      if(pending) {
          const now = new Date();
          await db.updateAttendance({
              ...pending,
              checkOut: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}),
              checkOutTime: now.toISOString(),
              notes: notes
          });
          await refreshData();
          showToast('Checked out successfully', 'success');
      } else {
          showToast('No active session found', 'warning');
      }
  };

  const updateAttendanceRecord = async (record: AttendanceRecord) => {
      await db.updateAttendance(record);
      await refreshData();
  };
  const deleteAttendanceRecord = async (id: string|number) => {
      await db.deleteAttendance(String(id));
      await refreshData();
  };

  const addTimeEntry = async (entry: Omit<TimeEntry, 'id'>) => {
      await db.addTimeEntry({...entry, id: Math.random().toString(36).substr(2,9)});
      await refreshData();
  };
  const updateTimeEntry = async (id: string|number, entry: Partial<TimeEntry>) => {
      const existing = timeEntries.find(t => String(t.id) === String(id));
      if(existing) {
          await db.updateTimeEntry({...existing, ...entry});
          await refreshData();
      }
  };
  const deleteTimeEntry = async (id: string|number) => {
      await db.deleteTimeEntry(String(id));
      await refreshData();
  };

  const addLeaveType = async (type: LeaveTypeConfig) => {
      await db.addLeaveType(type);
      await refreshData();
  };
  const updateLeaveType = async (id: string|number, data: Partial<LeaveTypeConfig>) => {
      const existing = leaveTypes.find(t => String(t.id) === String(id));
      if(existing) {
          await db.updateLeaveType({...existing, ...data});
          await refreshData();
      }
  };
  const deleteLeaveType = async (id: string|number) => {
      await db.deleteLeaveType(String(id));
      await refreshData();
  };

  const addHoliday = async (holiday: Holiday) => {
      await db.addHoliday(holiday);
      await refreshData();
  };
  const addHolidays = async (newHolidays: Holiday[]) => {
      for(const h of newHolidays) await db.addHoliday(h);
      await refreshData();
  };
  const deleteHoliday = async (id: string|number) => {
      await db.deleteHoliday(String(id));
      await refreshData();
  };

  const manualAddPayslip = async (payslip: Payslip) => {
      await db.addPayslip(payslip);
      await refreshData();
  };
  const updatePayslip = async (payslip: Payslip) => {
      await db.updatePayslip(payslip);
      await refreshData();
  };
  const deletePayslip = async (id: string|number) => {
      await db.deletePayslip(String(id));
      await refreshData();
  };

  const markNotificationRead = async (id: string|number) => {
      await db.markNotificationRead(String(id));
      await refreshData();
  };
  const markAllRead = async (userId: string|number) => {
      await db.markAllNotificationsRead(String(userId));
      await refreshData();
  };
  const clearAllNotifications = async (userId: string|number) => {
      await db.clearAllNotifications(String(userId));
      await refreshData();
  };
  
  const notify = async (message: string, userId: string|number, type: 'info'|'success'|'warning'|'error' = 'info') => {
      await db.addNotification({
          id: Math.random().toString(36).substr(2,9),
          userId,
          title: 'System Alert',
          message,
          time: 'Just now',
          read: false,
          type
      });
      await refreshData();
  };

  const syncAzureUsers = async () => {
      try {
          await msalInstance.initialize();
          const response = await msalInstance.acquireTokenPopup({ ...loginRequest });
          const azureUsers = await microsoftGraphService.fetchActiveUsers(response.accessToken);
          
          for (const azUser of azureUsers) {
              const existing = employees.find(e => e.email.toLowerCase() === azUser.mail.toLowerCase() || e.email.toLowerCase() === azUser.userPrincipalName.toLowerCase());
              if (existing) {
                  await db.updateEmployee({
                      ...existing,
                      firstName: azUser.givenName || existing.firstName,
                      lastName: azUser.surname || existing.lastName,
                      jobTitle: azUser.jobTitle || existing.jobTitle,
                      department: azUser.department || existing.department
                  });
              } else {
                  await db.addEmployee({
                      id: Math.random().toString(36).substr(2,9),
                      employeeId: azUser.employeeId || `EMP-${Math.floor(Math.random()*10000)}`,
                      firstName: azUser.givenName || azUser.displayName.split(' ')[0],
                      lastName: azUser.surname || azUser.displayName.split(' ').slice(1).join(' '),
                      email: azUser.mail || azUser.userPrincipalName,
                      password: 'ms-auth-user',
                      role: 'Employee',
                      department: azUser.department || 'General',
                      joinDate: new Date().toISOString().split('T')[0],
                      status: EmployeeStatus.ACTIVE,
                      salary: 0,
                      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(azUser.displayName)}`,
                      projectIds: []
                  });
              }
          }
          await refreshData();
          showToast(`Synced ${azureUsers.length} users from Azure AD`, 'success');
      } catch (e: any) {
          console.error(e);
          showToast("Azure Sync Failed: " + e.message, "error");
      }
  };

  const sendProjectAssignmentEmail = async (data: any) => {
      console.log("Sending project email", data);
  };

  const syncHolidayLogs = async (year: string) => {
      const yrHols = holidays.filter(h => h.date.startsWith(year));
      for(const h of yrHols) {
          if(!currentUser) continue;
          const exists = timeEntries.some(t => t.date === h.date && String(t.userId) === String(currentUser.id));
          if(!exists) {
              await db.addTimeEntry({
                  userId: currentUser.id,
                  projectId: '',
                  task: 'Public Holiday',
                  date: h.date,
                  durationMinutes: 480,
                  description: h.name,
                  status: 'Approved',
                  isBillable: false,
                  id: Math.random().toString(36).substr(2,9)
              });
          }
      }
      await refreshData();
      showToast(`Synced holiday logs for ${year}`, 'success');
  };

  const getApiBaseUrl = () => {
      if (process.env.VITE_API_BASE_URL) {
          return process.env.VITE_API_BASE_URL.replace(/\/$/, '');
      }
      return '/api';
  };

  const notifyMissingTimesheets = async (targetDate: string) => {
      const baseUrl = getApiBaseUrl();
      const endpoint = baseUrl.endsWith('/api') ? `${baseUrl}/notify/missing-timesheets` : `${baseUrl}/api/notify/missing-timesheets`;
      
      const isMock = process.env.VITE_USE_MOCK_DATA === 'true';
      if (isMock) {
          return { json: () => Promise.resolve({ success: true, count: 5, message: "Mock reminders sent" }) };
      }

      return fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetDate })
      });
  };

  const notifyWeeklyCompliance = async () => {
      const baseUrl = getApiBaseUrl();
      const endpoint = baseUrl.endsWith('/api') ? `${baseUrl}/notify/weekly-compliance` : `${baseUrl}/api/notify/weekly-compliance`;
      
      const isMock = process.env.VITE_USE_MOCK_DATA === 'true';
      if (isMock) {
          return { json: () => Promise.resolve({ success: true, count: 3, message: "Mock weekly audit completed" }) };
      }

      return fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
      });
  };

  return (
    <AppContext.Provider value={{
      currentUser, employees, departments, positions, projects, leaves, leaveTypes, attendance, timeEntries, notifications, holidays, payslips, isLoading, theme, toggleTheme,
      login, loginWithMicrosoft, logout, forgotPassword, confirmPasswordReset, refreshData,
      addEmployee, bulkAddEmployees, updateEmployee, updateUser, deleteEmployee, inviteEmployee,
      addLeave, addLeaves, updateLeave, updateLeaveStatus, deleteLeave,
      addProject, updateProject, deleteProject,
      addPosition, updatePosition, deletePosition,
      checkIn, checkOut, updateAttendanceRecord, deleteAttendanceRecord,
      addTimeEntry, updateTimeEntry, deleteTimeEntry,
      addLeaveType, updateLeaveType, deleteLeaveType,
      addHoliday, addHolidays, deleteHoliday,
      manualAddPayslip, updatePayslip, deletePayslip,
      markNotificationRead, markAllRead, clearAllNotifications, notify,
      syncAzureUsers, sendProjectAssignmentEmail, syncHolidayLogs,
      toasts, showToast, removeToast,
      notifyMissingTimesheets, notifyWeeklyCompliance,
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
