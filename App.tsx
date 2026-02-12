
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import EmployeeList from './components/EmployeeList';
import LeaveManagement from './components/LeaveManagement';
import Attendance from './components/Attendance';
import HRAssistant from './components/HRAssistant';
import Organization from './components/Organization';
import TimeLogs from './components/TimeLogs';
import Reports from './components/Reports';
import Profile from './components/Profile';
import Holidays from './components/Holidays';
import Payslips from './components/Payslips';
import Settings from './components/Settings';
import { User, UserRole, LeaveRequest, LeaveStatus } from './types';
import { useAppContext } from './contexts/AppContext';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

const viewToPath: Record<string, string> = {
  'dashboard': 'dashboard',
  'time-logs': 'timelogs',
  'organization': 'organization',
  'attendance': 'attendance',
  'leaves': 'leaves',
  'reports': 'reports',
  'holidays': 'holidays',
  'payslips': 'payslips',
  'profile': 'profile',
  'ai-assistant': 'ai-assistant',
  'settings': 'settings'
};

const pathToView: Record<string, string> = Object.fromEntries(
  Object.entries(viewToPath).map(([k, v]) => [v, k])
);

const ToastContainer = () => {
  const { toasts, removeToast } = useAppContext();
  
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {toasts.map(toast => {
         let bgColor = 'bg-slate-800';
         let Icon = Info;
         
         if (toast.type === 'success') { bgColor = 'bg-emerald-600'; Icon = CheckCircle; }
         else if (toast.type === 'error') { bgColor = 'bg-red-600'; Icon = XCircle; }
         else if (toast.type === 'warning') { bgColor = 'bg-amber-500'; Icon = AlertTriangle; }

         return (
            <div key={toast.id} className={`${bgColor} text-white px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 min-w-[320px] animate-in slide-in-from-right-10 duration-300 border border-white/10`}>
               <Icon size={20} />
               <p className="text-sm font-medium flex-1">{toast.message}</p>
               <button onClick={() => removeToast(toast.id)} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                 <X size={16} />
               </button>
            </div>
         );
      })}
    </div>
  );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const { 
    currentUser,
    employees, 
    departments,
    leaves, 
    leaveTypes, 
    attendance, 
    isLoading,
    logout,
    addLeave,
    addLeaves,
    updateLeave,
    updateLeaveStatus,
    addLeaveType,
    updateLeaveType,
    deleteLeaveType
  } = useAppContext();

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash && pathToView[hash]) {
        setCurrentView(pathToView[hash]);
      } else if (!hash && currentUser) {
        window.location.hash = '/dashboard';
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser]);

  const handleViewChange = useCallback((viewId: string) => {
    const path = viewToPath[viewId];
    if (path) {
      window.location.hash = `/${path}`;
    }
    setCurrentView(viewId);
    setIsSidebarOpen(false);
  }, []);

  const users: User[] = employees.map(emp => {
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
      jobTitle: emp.jobTitle || emp.position || emp.role
    };
  });

  const handleLogin = (user: User) => {
    handleViewChange('dashboard');
  };

  const handleLogout = () => {
    logout();
    window.location.hash = '';
  };

  const handleCreateLeave = async (leaveData: any) => {
    const newLeave: LeaveRequest = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser!.id,
      userName: currentUser!.name,
      status: LeaveStatus.PENDING_MANAGER,
      createdAt: new Date().toISOString(),
      ...leaveData
    };
    await addLeave(newLeave);
  };

  if (!currentUser) {
    return (
      <>
        <ToastContainer />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  if (isLoading) {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-slate-950">
            <div className="flex flex-col items-center gap-6">
                <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 dark:text-slate-400 font-bold animate-pulse tracking-widest uppercase text-xs">Initializing Portal...</p>
            </div>
        </div>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard employees={employees} leaves={leaves} departments={departments} />;
      case 'organization':
        return <Organization />;
      case 'time-logs':
        return <TimeLogs />;
      case 'reports':
        return <Reports />;
      case 'profile':
        return <Profile />;
      case 'attendance':
        return <Attendance records={attendance} />;
      case 'holidays':
        return <Holidays />;
      case 'payslips':
        return <Payslips />;
      case 'settings':
        return <Settings />;
      case 'leaves':
        return (
          <LeaveManagement 
            currentUser={currentUser}
            users={users}
            leaves={leaves}
            leaveTypes={leaveTypes}
            addLeave={handleCreateLeave}
            editLeave={updateLeave}
            addLeaves={addLeaves}
            updateLeaveStatus={updateLeaveStatus}
            addLeaveType={addLeaveType}
            updateLeaveType={updateLeaveType}
            deleteLeaveType={deleteLeaveType}
          />
        );
      case 'ai-assistant':
        return <HRAssistant />;
      default:
        return <Dashboard employees={employees} leaves={leaves} departments={departments} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      <ToastContainer />
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden transition-opacity" onClick={() => setIsSidebarOpen(false)} />}
      <Sidebar 
        currentView={currentView} 
        onChangeView={handleViewChange} 
        userRole={currentUser.role}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col h-full md:pl-72 transition-all duration-300">
        <Header 
          user={currentUser} 
          onLogout={handleLogout} 
          onChangeView={handleViewChange}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        <main className="flex-1 px-6 py-8 md:px-10 overflow-y-auto mt-20 custom-scrollbar">
          <div className="max-w-7xl mx-auto pb-12">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
};

export default App;
