import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PublicClientApplication, InteractionRequiredAuthError, BrowserAuthError } from "@azure/msal-browser";
import { msalConfig, loginRequest } from "../services/authConfig";
import { db } from '../services/db';
import { emailService } from '../services/emailService';
import { microsoftGraphService, AzureUser } from '../services/microsoftGraphService';
import { Employee, LeaveRequest, LeaveTypeConfig, AttendanceRecord, LeaveStatus, Notification, UserRole, Department, Project, User, TimeEntry, ToastMessage, Payslip, Holiday, EmployeeStatus, Role, Position, Invitation, UserSettings } from '../types';

const formatDateISO = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatTime12 = (date: Date) => {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }).toLowerCase();
};

const safeParseArray = (val: any) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }
    return [];
};

const safeParseObject = (val: any) => {
    if (!val) return undefined;
    if (typeof val === 'object' && !Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return (typeof parsed === 'object' && parsed !== null) ? parsed : undefined;
        } catch (e) { return undefined; }
    }
    return undefined;
};

const defaultSettings: UserSettings = {
  notifications: {
    emailLeaves: true,
    emailAttendance: false,
    pushWeb: true,
    pushMobile: true,
    systemAlerts: true
  },
  appConfig: {
    aiAssistant: true,
    azureSync: true,
    strictSso: false
  }
};

interface AppContextType {
  employees: Employee[];
  users: Employee[]; 
  invitations: Invitation[];
  departments: Department[];
  roles: Role[];
  positions: Position[];
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
  loginWithMicrosoft: (emailHint?: string) => Promise<boolean>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<boolean>;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
  inviteEmployee: (data: Partial<Invitation>) => Promise<void>;
  acceptInvitation: (id: string) => Promise<void>;
  revokeInvitation: (id: string) => Promise<void>;
  addEmployee: (emp: Employee, syncToAzure?: boolean) => Promise<void>;
  updateEmployee: (emp: Employee) => Promise<void>;
  updateUser: (id: string | number, data: Partial<Employee>) => Promise<void>; 
  bulkUpdateEmployees: (updates: { id: string | number, data: Partial<Employee> }[]) => Promise<void>;
  deleteEmployee: (id: string | number) => Promise<void>;
  addDepartment: (dept: Department) => Promise<void>;
  updateDepartment: (id: string | number, data: Partial<Department>) => Promise<void>;
  deleteDepartment: (id: string | number) => Promise<void>;
  addPosition: (pos: Omit<Position, 'id'>) => Promise<void>;
  updatePosition: (id: string | number, data: Partial<Position>) => Promise<void>;
  deletePosition: (id: string | number) => Promise<void>;
  addRole: (role: Omit<Role, 'id'>) => Promise<void>;
  updateRole: (id: string | number, data: Partial<Role>) => Promise<void>;
  deleteRole: (id: string | number) => Promise<void>;
  addProject: (proj: Omit<Project, 'id'> & { id?: string | number }) => Promise<void>;
  updateProject: (id: string | number, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string | number) => Promise<void>;
  addLeave: (leave: any) => Promise<void>; 
  addLeaves: (leaves: any[]) => Promise<void>;
  updateLeave: (id: string | number, data: any) => Promise<void>;
  deleteLeave: (id: string | number) => Promise<void>;
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
  deleteAttendanceRecord: (id: string | number) => Promise<void>;
  getTodayAttendance: () => AttendanceRecord | undefined;
  notify: (message: string, userId?: string | number) => Promise<void>; 
  sendProjectAssignmentEmail: (data: { email: string, firstName: string, projectName: string, projectDescription?: string }) => Promise<void>;
  sendLeaveRequestEmail: (data: { to: string, cc?: string[], employeeName: string, type: string, startDate: string, endDate: string, reason: string, isUpdate?: boolean, isWithdrawal?: boolean }) => Promise<void>;
  sendLeaveStatusEmail: (data: { to: string, employeeName: string, status: string, type: string, managerComment?: string, hrAction?: boolean }) => Promise<void>;
  markNotificationRead: (id: string | number) => Promise<void>;
  markAllRead: (userId: string | number) => Promise<void>;
  addHoliday: (holiday: Omit<Holiday, 'id'>) => Promise<void>;
  addHolidays: (holidays: Omit<Holiday, 'id'>[]) => Promise<void>;
  deleteHoliday: (id: string | number) => Promise<void>;
  generatePayslips: (month: string) => Promise<void>;
  manualAddPayslip: (payslip: Payslip) => Promise<void>;
  syncAzureUsers: () => Promise<void>;
  syncHolidayLogs: (year?: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
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
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const API_BASE = (process.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, '');

  const refreshData = async () => {
    try {
      const [empData, deptData, roleData, posData, projData, leaveData, typeData, attendData, timeData, notifData, holidayData, payslipData, inviteData] = await Promise.all([
        db.getEmployees(), db.getDepartments(), db.getRoles(), db.getPositions(), db.getProjects(),
        db.getLeaves(), db.getLeaveTypes(), db.getAttendance(), db.getTimeEntries(),
        db.getNotifications(), db.getHolidays(), db.getPayslips(), db.getInvitations()
      ]);

      const sanitizedEmployees = Array.isArray(empData) ? empData.map((e: any) => ({ 
        ...e, 
        projectIds: safeParseArray(e.projectIds),
        location: safeParseObject(e.location),
        settings: safeParseObject(e.settings) || defaultSettings,
        bio: e.bio || ''
      })) : [];

      const sanitizedProjects = Array.isArray(projData) ? projData.map((p: any) => ({ ...p, tasks: safeParseArray(p.tasks) })) : [];
      const sanitizedLeaves = Array.isArray(leaveData) ? leaveData.map((l: any) => ({ ...l, notifyUserIds: safeParseArray(l.notifyUserIds) })) : [];

      setEmployees(sanitizedEmployees);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      setRoles(Array.isArray(roleData) ? roleData : []);
      setPositions(Array.isArray(posData) ? posData : []);
      setProjects(sanitizedProjects);
      setLeaves(sanitizedLeaves);
      setLeaveTypes(Array.isArray(typeData) ? typeData : []);
      setAttendance(Array.isArray(attendData) ? attendData : []);
      setTimeEntries(Array.isArray(timeData) ? timeData : []);
      setNotifications(Array.isArray(notifData) ? notifData : []);
      setHolidays(Array.isArray(holidayData) ? holidayData : []);
      setPayslips(Array.isArray(payslipData) ? payslipData : []);
      setInvitations(Array.isArray(inviteData) ? inviteData : []);

      // Refresh Current User if logged in
      if (currentUser) {
          const updatedSelf = sanitizedEmployees.find(e => String(e.id) === String(currentUser.id));
          if (updatedSelf) {
              setCurrentUser({
                id: updatedSelf.id, employeeId: updatedSelf.employeeId, name: `${updatedSelf.firstName} ${updatedSelf.lastName}`, email: updatedSelf.email,
                role: updatedSelf.role as UserRole, position: updatedSelf.position, avatar: updatedSelf.avatar, managerId: updatedSelf.managerId, jobTitle: updatedSelf.jobTitle || updatedSelf.role,
                departmentId: updatedSelf.departmentId, projectIds: updatedSelf.projectIds, location: updatedSelf.location, workLocation: updatedSelf.workLocation, hireDate: updatedSelf.joinDate,
                settings: updatedSelf.settings
              });
          }
      }
    } catch (error) {
      console.error("Failed to refresh data:", error);
    }
  };

  const initMsal = async (): Promise<PublicClientApplication | null> => {
      try {
          const pca = new PublicClientApplication(msalConfig);
          await pca.initialize();
          setMsalInstance(pca);
          return pca;
      } catch (err) {
          console.error("MSAL Initialization Error:", err);
          return null;
      }
  };

  const getSystemRole = (jobTitle: string): UserRole => {
      const title = (jobTitle || '').toLowerCase().trim();
      if (title === 'hr manager' || title === 'hr' || title === 'head of hr') return UserRole.HR;
      if (title === 'manager' || title.includes('manager')) return UserRole.MANAGER;
      if (title === 'admin') return UserRole.ADMIN;
      return UserRole.EMPLOYEE;
  };

  const processAzureLogin = async (account: any, accessToken: string) => {
      try {
          const azureProfile = await microsoftGraphService.fetchMe(accessToken);
          const email = account.username || azureProfile.mail || azureProfile.userPrincipalName;
          const currentEmployees = await db.getEmployees();
          const currentDepts = await db.getDepartments();
          let targetUser = Array.isArray(currentEmployees) ? currentEmployees.find(e => e.email.toLowerCase() === email.toLowerCase()) : null;
          const azureJobTitle = azureProfile.jobTitle || 'Team Member';
          const mappedSystemRole = getSystemRole(azureJobTitle);
          const mappedEmpId = azureProfile.employeeId || 'SSO-NEW';
          const mappedHireDate = azureProfile.employeeHireDate ? azureProfile.employeeHireDate.split('T')[0] : formatDateISO(new Date());
          const azureDeptName = azureProfile.department || 'General';
          const matchedDept = Array.isArray(currentDepts) ? currentDepts.find(d => d.name.toLowerCase() === azureDeptName.toLowerCase()) : null;
          const mappedDeptId = matchedDept ? matchedDept.id : '';
          const mappedDeptName = matchedDept ? matchedDept.name : azureDeptName;

          if (!targetUser) {
              const numericIds = Array.isArray(currentEmployees) ? currentEmployees.map(e => Number(e.id)).filter(id => !isNaN(id)) : [];
              const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1001;
              const newEmp: Employee = {
                  id: nextId, employeeId: String(mappedEmpId), firstName: azureProfile.givenName || account.name?.split(' ')[0] || 'User',
                  lastName: azureProfile.surname || account.name?.split(' ').slice(1).join(' ') || '',
                  email: email, password: 'ms-auth-user', role: mappedSystemRole, position: azureJobTitle, department: mappedDeptName,
                  departmentId: mappedDeptId, projectIds: [], managerId: '', joinDate: mappedHireDate, status: EmployeeStatus.ACTIVE,
                  salary: 0, avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(account.name || 'User')}&background=0D9488&color=fff`,
                  jobTitle: azureJobTitle, phone: '', workLocation: 'Office HQ India', settings: defaultSettings
              };
              await db.addEmployee(newEmp);
              targetUser = newEmp;
              setEmployees(await db.getEmployees());
          } else {
              const updates: Partial<Employee> = {};
              if (targetUser.position !== azureJobTitle) {
                 updates.position = azureJobTitle;
                 updates.jobTitle = azureJobTitle;
                 updates.role = mappedSystemRole;
              }
              if (String(targetUser.employeeId) !== String(mappedEmpId)) updates.employeeId = String(mappedEmpId);
              if (targetUser.joinDate !== mappedHireDate) updates.joinDate = mappedHireDate;
              if (targetUser.department !== mappedDeptName) {
                  updates.department = mappedDeptName;
                  updates.departmentId = mappedDeptId;
              }
              if (Object.keys(updates).length > 0) {
                await db.updateEmployee({ ...targetUser, ...updates });
                targetUser = { ...targetUser, ...updates };
                setEmployees(await db.getEmployees());
              }
          }
          if (targetUser) {
              setCurrentUser({ 
                  id: targetUser.id, employeeId: targetUser.employeeId, name: `${targetUser.firstName} ${targetUser.lastName}`, email: targetUser.email,
                  role: targetUser.role as UserRole, position: targetUser.position, avatar: targetUser.avatar, managerId: targetUser.managerId, jobTitle: targetUser.jobTitle || targetUser.role,
                  departmentId: targetUser.departmentId, projectIds: targetUser.projectIds, location: safeParseObject(targetUser.location), workLocation: targetUser.workLocation, hireDate: targetUser.joinDate,
                  settings: safeParseObject(targetUser.settings) || defaultSettings
              });
              return true;
          }
          return false;
      } catch (err) {
          console.error("Azure processing failed:", err);
          return false;
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
      const pca = await initMsal();
      if (pca) {
          try {
              const result = await pca.handleRedirectPromise();
              const accounts = pca.getAllAccounts();
              const activeAccount = result?.account || (accounts.length > 0 ? accounts[0] : null);
              if (activeAccount) {
                  const tokenResponse = await pca.acquireTokenSilent({ scopes: ["User.Read", "User.ReadWrite.All"], account: activeAccount });
                  await processAzureLogin(activeAccount, tokenResponse.accessToken);
              }
          } catch (e) { console.warn("Initial MSAL check failed", e); }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const loginWithMicrosoft = async (emailHint?: string): Promise<boolean> => {
    if (isInteracting) return false;
    let instance = msalInstance || await initMsal();
    if (!instance) return false;
    setIsInteracting(true);
    try {
        await instance.handleRedirectPromise();
        // Use loginHint to skip the 'Pick an account' screen
        const result = await instance.loginPopup({
            ...loginRequest,
            loginHint: emailHint
        });
        if (result && result.account) {
            const ok = await processAzureLogin(result.account, result.accessToken);
            setIsInteracting(false);
            return ok;
        }
        setIsInteracting(false);
        return false;
    } catch (error: any) { 
        setIsInteracting(false);
        console.error("Microsoft Sign-In Error:", error);
        return false;
    }
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
      try {
          const res = await fetch(`${API_BASE}/notify/reset-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
          });
          if (!res.ok) throw new Error("Server error");
          showToast("Password reset email sent. Please check your inbox.", "success");
          return true;
      } catch (err) {
          console.error("Reset Password Error:", err);
          showToast("Failed to send reset email. Contact IT Support.", "error");
          return false;
      }
  };

  const syncAzureUsers = async () => {
    if (!msalInstance || !currentUser) return;
    try {
      const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
      if (!account) { showToast("Sign in with Microsoft to sync.", "warning"); return; }
      const tokenResponse = await msalInstance.acquireTokenSilent({ scopes: ["User.Read.All"], account: account });
      const azureUsers = await microsoftGraphService.fetchActiveUsers(tokenResponse.accessToken);
      const currentEmployees = await db.getEmployees();
      const currentDepts = await db.getDepartments();
      const numericIds = Array.isArray(currentEmployees) ? currentEmployees.map(e => Number(e.id)).filter(id => !isNaN(id)) : [];
      let nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1001;

      for (const au of azureUsers) {
        const email = (au.mail || au.userPrincipalName).toLowerCase();
        const azureJobTitle = au.jobTitle || 'Team Member';
        const mappedSystemRole = getSystemRole(azureJobTitle);
        const azureDeptName = au.department || 'General';
        const matchedDept = Array.isArray(currentDepts) ? currentDepts.find(d => d.name.toLowerCase() === azureDeptName.toLowerCase()) : null;
        const mappedDeptId = matchedDept ? matchedDept.id : '';
        const mappedDeptName = matchedDept ? matchedDept.name : azureDeptName;

        const existingEmp = Array.isArray(currentEmployees) ? currentEmployees.find(e => e.email.toLowerCase() === email) : null;
        if (existingEmp) {
          const updates: Partial<Employee> = {};
          if (existingEmp.position !== azureJobTitle) { updates.position = azureJobTitle; updates.jobTitle = azureJobTitle; updates.role = mappedSystemRole; }
          if (existingEmp.department !== mappedDeptName) { updates.department = mappedDeptName; updates.departmentId = mappedDeptId; }
          if (Object.keys(updates).length > 0) await db.updateEmployee({ ...existingEmp, ...updates });
        } else {
          const newEmp: Employee = {
            id: nextId, employeeId: `AZ-${nextId}`, firstName: au.givenName || au.displayName.split(' ')[0],
            lastName: au.surname || au.displayName.split(' ').slice(1).join(' ') || 'User', email: email,
            password: 'ms-auth-user', role: mappedSystemRole, position: azureJobTitle,
            department: mappedDeptName, departmentId: mappedDeptId, projectIds: [], managerId: '',
            joinDate: formatDateISO(new Date()), status: EmployeeStatus.ACTIVE, salary: 0, 
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(au.displayName)}&background=random`,
            jobTitle: azureJobTitle, phone: '', workLocation: 'Office HQ India', settings: defaultSettings
          };
          await db.addEmployee(newEmp);
          nextId++;
        }
      }
      await refreshData();
      showToast(`Directory sync complete.`, "success");
    } catch (err: any) { showToast("Azure sync failed.", "error"); }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const currentEmployees = await db.getEmployees();
    let user = Array.isArray(currentEmployees) ? currentEmployees.find(e => e.email.toLowerCase() === email.toLowerCase() && e.password === password) : null;
    if (user) {
        setCurrentUser({ 
            id: user.id, employeeId: user.employeeId, name: `${user.firstName} ${user.lastName}`, email: user.email,
            role: user.role as UserRole, position: user.position, avatar: user.avatar, managerId: user.managerId, jobTitle: user.jobTitle || user.role,
            departmentId: user.departmentId, projectIds: user.projectIds, location: safeParseObject(user.location), workLocation: user.workLocation, hireDate: user.joinDate,
            settings: safeParseObject(user.settings) || defaultSettings
        });
        showToast(`Welcome back!`, 'success');
        return true;
    }
    showToast('Invalid credentials.', 'error');
    return false;
  };
  
  const logout = async () => { 
    if (msalInstance) {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) { await msalInstance.logoutRedirect({ postLogoutRedirectUri: window.location.origin }); return; }
    }
    setCurrentUser(null); 
    showToast('Logged out.', 'info'); 
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const notify = async (message: string, userId?: string | number) => {
    const targetId = userId || currentUser?.id;
    if(!targetId) return;
    try {
        await db.addNotification({ 
            id: Math.random().toString(36).substr(2,9), 
            userId: targetId, 
            title: 'Update Notification', 
            message: message, 
            time: 'Just now', 
            read: false,
            type: 'info'
        }); 
        await refreshData();
    } catch (err) {
        console.error("Failed to save notification to DB:", err);
    }
  };

  const syncHolidayLogs = async (year?: string) => {
    const targetYear = year || new Date().getFullYear().toString();
    const activeEmps = employees.filter(e => e.status === EmployeeStatus.ACTIVE);
    const yearHolidays = holidays.filter(h => h.date.startsWith(targetYear));
    const todayStr = formatDateISO(new Date());

    showToast(`Commencing Holiday Sync for ${targetYear}...`, "info");
    let createdCount = 0;
    let errors = 0;

    for (const h of yearHolidays) {
        if (h.date > todayStr) continue; // Past holidays only

        for (const emp of activeEmps) {
            const alreadyLogged = timeEntries.some(t => 
                String(t.userId) === String(emp.id) && t.date === h.date
            );

            if (!alreadyLogged) {
                try {
                    await db.addTimeEntry({
                        id: `hol-${h.id}-${emp.id}`,
                        userId: emp.id,
                        projectId: '',
                        task: 'Public Holiday',
                        date: h.date,
                        durationMinutes: 480, // 8 hours
                        extraMinutes: 0,
                        description: `System auto-log for ${h.name}.`,
                        status: 'Approved',
                        isBillable: false
                    });
                    createdCount++;
                } catch (e) {
                    console.error("Failed to log holiday for employee:", emp.id, e);
                    errors++;
                }
            }
        }
    }

    await refreshData();
    if (createdCount > 0) {
        showToast(`Sync Complete: ${createdCount} logs created.${errors > 0 ? ` (${errors} failed)` : ''}`, "success");
    } else {
        showToast("Directory already synchronized with company holidays.", "info");
    }
  };

  const sendProjectAssignmentEmail = async (data: { email: string, firstName: string, projectName: string, projectDescription?: string }) => {
    try {
        const res = await fetch(`${API_BASE}/notify/project-assignment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error("Backend rejection");
    } catch (err) {
        console.error("Failed to trigger project email:", err);
    }
  };

  const sendLeaveRequestEmail = async (data: any) => {
    try {
      const res = await fetch(`${API_BASE}/notify/leave-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Leave email failed");
    } catch (err) {
      console.error(err);
    }
  };

  const sendLeaveStatusEmail = async (data: any) => {
    try {
      const res = await fetch(`${API_BASE}/notify/leave-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Leave status email failed");
    } catch (err) {
      console.error(err);
    }
  };

  // Fix: Adding inviteEmployee implementation to fix AppContext scope error
  const inviteEmployee = async (data: Partial<Invitation>) => {
    const invite: Invitation = {
      id: Math.random().toString(36).substr(2, 9),
      token: Math.random().toString(36).substr(2, 15),
      invitedDate: formatDateISO(new Date()),
      email: data.email || '',
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      role: data.role || UserRole.EMPLOYEE,
      position: data.position || '',
      department: data.department || '',
      salary: data.salary || 0,
      provisionInAzure: !!data.provisionInAzure
    };

    if (invite.provisionInAzure && msalInstance) {
        try {
            const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
            if (account) {
                const tokenResponse = await msalInstance.acquireTokenSilent({ scopes: ["User.ReadWrite.All"], account });
                await microsoftGraphService.createUser(tokenResponse.accessToken, invite);
                showToast("User provisioned in Azure AD", "success");
            }
        } catch (e) {
            console.error("Azure Provisioning failed during invite:", e);
            showToast("Azure provisioning failed, but local invite created.", "warning");
        }
    }

    await db.addInvitation(invite);
    showToast(`Invitation sent to ${invite.email}`, "success");
    await refreshData();
  };

  // Fix: Adding acceptInvitation implementation to fix AppContext scope error
  const acceptInvitation = async (id: string) => {
    const invite = invitations.find(i => String(i.id) === String(id));
    if (!invite) {
        showToast("Invitation not found", "error");
        return;
    }

    const newEmp: Employee = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: `EMP-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      firstName: invite.firstName,
      lastName: invite.lastName,
      email: invite.email,
      role: invite.role,
      position: invite.position,
      department: invite.department,
      joinDate: formatDateISO(new Date()),
      status: EmployeeStatus.ACTIVE,
      salary: invite.salary,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(invite.firstName + ' ' + invite.lastName)}&background=0D9488&color=fff`,
      settings: defaultSettings
    };

    await db.addEmployee(newEmp);
    await db.deleteInvitation(id);
    await refreshData();
    showToast("Employee account activated.", "success");
  };

  const value = {
    employees, users: employees, invitations, departments, roles, positions, projects, leaves, leaveTypes, attendance, timeEntries, notifications, 
    holidays, payslips, toasts, isLoading, currentUser, theme,
    login, loginWithMicrosoft, logout, forgotPassword, refreshData, showToast, removeToast, toggleTheme,
    inviteEmployee, acceptInvitation, revokeInvitation: async (id: string) => { await db.deleteInvitation(id); await refreshData(); showToast("Invite revoked."); },
    addEmployee: async (emp: Employee) => { await db.addEmployee(emp); await refreshData(); showToast('Added.', 'success'); },
    updateEmployee: async (emp: Employee) => { await db.updateEmployee(emp); await refreshData(); showToast('Updated.', 'success'); },
    updateUser: async (id: string | number, data: Partial<Employee>) => { const ex = employees.find(e => String(e.id) === String(id)); if(ex) { await db.updateEmployee({...ex, ...data}); await refreshData(); showToast('Sync complete.'); } },
    bulkUpdateEmployees: async (upds: any[]) => { for(const u of upds) { const ex = employees.find(e => String(e.id) === String(u.id)); if(ex) await db.updateEmployee({...ex, ...u.data}); } await refreshData(); },
    deleteEmployee: async (id: string | number) => { await db.deleteEmployee(id.toString()); await refreshData(); showToast('Deleted.'); },
    addDepartment: async (d: any) => { await db.addDepartment(d); await refreshData(); },
    updateDepartment: async (id: any, data: any) => { const ex = departments.find(d => String(d.id) === String(id)); if(ex) { await db.updateDepartment({...ex, ...data} as any); await refreshData(); } },
    deleteDepartment: async (id: any) => { await db.deleteDepartment(id.toString()); await refreshData(); },
    addPosition: async (p: any) => { await db.addPosition({...p, id: Math.random().toString(36).substr(2,9)}); await refreshData(); },
    updatePosition: async (id: any, data: any) => { const ex = positions.find(p => String(p.id) === String(id)); if(ex) { await db.updatePosition({...ex, ...data}); await refreshData(); } },
    deletePosition: async (id: any) => { await db.deletePosition(id.toString()); await refreshData(); },
    addRole: async (r: any) => { await db.addRole({...r, id: Math.random().toString(36).substr(2,9)}); await refreshData(); },
    updateRole: async (id: any, data: any) => { const ex = roles.find(r => String(r.id) === String(id)); if(ex) { await db.updateRole({...ex, ...data}); await refreshData(); } },
    deleteRole: async (id: any) => { await db.deleteRole(id.toString()); await refreshData(); },
    addProject: async (p: any) => { const finalId = p.id || Math.random().toString(36).substr(2,9); await db.addProject({...p, id: finalId}); await refreshData(); },
    updateProject: async (id: any, data: any) => { const ex = projects.find(p => String(p.id) === String(id)); if(ex) { await db.updateProject({...ex, ...data}); await refreshData(); } },
    deleteProject: async (id: any) => { await db.deleteProject(id.toString()); await refreshData(); },
    addLeave: async (l: any) => { try { await db.addLeave(l); await refreshData(); showToast("Leave request created", "success"); } catch(e) { showToast("Failed to create leave", "error"); throw e; } },
    addLeaves: async (ls: any[]) => { for(const l of ls) await db.addLeave(l); await refreshData(); },
    updateLeave: async (id: any, d: any) => { try { const ex = leaves.find(l => String(l.id) === String(id)); if(ex) { await db.updateLeave({...ex, ...d}); await refreshData(); showToast("Leave updated", "success"); } } catch(e) { showToast("Failed to update leave", "error"); throw e; } },
    deleteLeave: async (id: any) => { await db.deleteLeave(id.toString()); await refreshData(); },
    updateLeaveStatus: async (id: any, s: any, c: any) => { const ex = leaves.find(l => String(l.id) === String(id)); if(ex) { await db.updateLeave({...ex, status: s, managerComment: c}); await refreshData(); } },
    addLeaveType: async (t: any) => { await db.addLeaveType(t); await refreshData(); },
    updateLeaveType: async (id: any, d: any) => { const ex = leaveTypes.find(t => String(t.id) === String(id)); if(ex) { await db.updateLeaveType({...ex, ...d}); await refreshData(); } },
    deleteLeaveType: async (id: any) => { await db.deleteLeaveType(id.toString()); await refreshData(); },
    addTimeEntry: async (e: any) => { await db.addTimeEntry({...e, id: Math.random().toString(36).substr(2,9)}); await refreshData(); },
    updateTimeEntry: async (id: any, d: any) => { const ex = timeEntries.find(e => String(e.id) === String(id)); if(ex) { await db.updateTimeEntry({...ex, ...d}); await refreshData(); } },
    deleteTimeEntry: async (id: any) => { await db.deleteTimeEntry(id.toString()); await refreshData(); },
    checkIn: async () => { if(!currentUser) return; try { const now = new Date(); const rec: AttendanceRecord = { id: Math.random().toString(36).substr(2,9), employeeId: currentUser.id, employeeName: currentUser.name, date: formatDateISO(now), checkIn: formatTime12(now), checkInTime: now.toISOString(), checkOut: '', status: 'Present', workLocation: 'Office' }; await db.addAttendance(rec); await refreshData(); showToast("Check In Successful", "success"); } catch(e) { showToast("Check In Failed", "error"); } },
    checkOut: async () => { if(!currentUser) return; const today = formatDateISO(new Date()); const rec = attendance.find(a => String(a.employeeId) === String(currentUser.id) && a.date === today && !a.checkOut); if(rec) { try { const now = new Date(); await db.updateAttendance({...rec, checkOut: formatTime12(now), checkOutTime: now.toISOString()}); await refreshData(); showToast("Check Out Successful", "success"); } catch(e) { showToast("Check Out Failed", "error"); } } },
    updateAttendanceRecord: async (r: any) => { await db.updateAttendance(r); await refreshData(); },
    deleteAttendanceRecord: async (id: any) => { await db.deleteAttendance(id.toString()); await refreshData(); },
    getTodayAttendance: () => { if(!currentUser) return undefined; const today = formatDateISO(new Date()); return attendance.find(a => String(a.employeeId) === String(currentUser.id) && a.date === today); },
    notify,
    syncHolidayLogs,
    sendProjectAssignmentEmail,
    sendLeaveRequestEmail,
    sendLeaveStatusEmail,
    markNotificationRead: async (id: any) => { await db.markNotificationRead(id.toString()); await refreshData(); },
    markAllRead: async (u: any) => { await db.markAllNotificationsRead(u.toString()); await refreshData(); },
    addHoliday: async (h: any) => { await db.addHoliday({...h, id: Math.random().toString(36).substr(2,9)}); await refreshData(); },
    addHolidays: async (hs: any[]) => { for(const h of hs) await db.addHoliday({...h, id: Math.random().toString(36).substr(2,9)}); await refreshData(); },
    deleteHoliday: async (id: any) => { await db.deleteHoliday(id.toString()); await refreshData(); },
    generatePayslips: async () => { await refreshData(); },
    manualAddPayslip: async (p: any) => { await db.addPayslip(p); await refreshData(); },
    syncAzureUsers
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};