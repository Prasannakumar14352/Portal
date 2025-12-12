
import React, { useState } from 'react';
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
import Holidays from './components/Holidays'; // New
import Payslips from './components/Payslips'; // New
import { User, UserRole, LeaveRequest, LeaveStatus } from './types';
import { useAppContext } from './contexts/AppContext';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

const ToastContainer = () => {
  const { toasts, removeToast } = useAppContext();
  
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map(toast => {
         let bgColor = 'bg-slate-800';
         let Icon = Info;
         
         if (toast.type === 'success') { bgColor = 'bg-emerald-600'; Icon = CheckCircle; }
         else if (toast.type === 'error') { bgColor = 'bg-red-600'; Icon = XCircle; }
         else if (toast.type === 'warning') { bgColor = 'bg-amber-500'; Icon = AlertTriangle; }

         return (
            <div key={toast.id} className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] animate-in slide-in-from-right-10 duration-300`}>
               <Icon size={20} />
               <p className="text-sm font-medium flex-1">{toast.message}</p>
               <button onClick={() => removeToast(toast.id)} className="text-white/80 hover:text-white p-1">
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
  
  // Use the Global API Context
  const { 
    currentUser,
    login,
    logout,
    employees, 
    leaves, 
    leaveTypes, 
    attendance, 
    isLoading,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addLeave,
    addLeaves,
    updateLeave,
    updateLeaveStatus,
    addLeaveType,
    updateLeaveType,
    deleteLeaveType
  } = useAppContext();

  // Convert Employees to Users for the Leave Component props
  const users: User[] = employees.map(emp => ({
    id: emp.id,
    name: `${emp.firstName} ${emp.lastName}`,
    role: emp.role.includes('Manager') ? (emp.department === 'HR' ? UserRole.HR : UserRole.MANAGER) : UserRole.EMPLOYEE,
    avatar: emp.avatar,
    managerId: emp.managerId,
    jobTitle: emp.role
  }));

  const handleLogin = (user: User) => {
    // Auth logic is handled within the Login component via Context
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    logout();
  };

  const handleViewChange = (view: string) => {
    setCurrentView(view);
    setIsSidebarOpen(false); // Close sidebar on mobile when navigating
  };

  // Wrapper for Leave creation to inject current user details automatically
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
        <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 dark:text-slate-400 animate-pulse">Loading EMP Portal...</p>
            </div>
        </div>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard employees={employees} />;
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
        return <Dashboard employees={employees} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden transition-colors duration-200">
      <ToastContainer />
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar 
        currentView={currentView} 
        onChangeView={handleViewChange} 
        userRole={currentUser.role}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <div className="flex-1 flex flex-col h-full md:ml-64 transition-all duration-300">
        <Header 
          user={currentUser} 
          onLogout={handleLogout} 
          onChangeView={handleViewChange}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        
        <main className="flex-1 p-4 md:p-8 overflow-y-auto mt-16 scrollbar-hide">
          <div className="max-w-7xl mx-auto pb-10">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
