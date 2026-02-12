
import React from 'react';
import { LayoutDashboard, Calendar, Clock, MessageSquareText, Building2, Timer, BarChart3, FileText, Coffee, X } from 'lucide-react';
import { UserRole } from '../types';
import { useAppContext } from '../contexts/AppContext';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  userRole: UserRole;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, userRole, isOpen = false, onClose }) => {
  const { installApp, isInstallable } = useAppContext();

  const getMenuItems = () => {
    // Items visible to EVERYONE
    const commonItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'holidays', label: 'Holidays', icon: Coffee },
      { id: 'ai-assistant', label: 'HR Assistant', icon: MessageSquareText },
    ];

    if (userRole === UserRole.EMPLOYEE) {
      return [
        commonItems[0], // Dashboard
        { id: 'organization', label: 'Organization', icon: Building2 },
        { id: 'time-logs', label: 'Time Logs', icon: Timer },
        { id: 'attendance', label: 'My Attendance', icon: Clock },
        { id: 'leaves', label: 'Leaves', icon: Calendar },
        { id: 'payslips', label: 'Payslips', icon: FileText },
        commonItems[1], // Reports
        commonItems[2], // Holidays
        commonItems[3], // AI
      ];
    }

    // Admin, HR and Manager
    return [
      commonItems[0], // Dashboard
      { id: 'organization', label: 'Organization', icon: Building2 },
      { id: 'time-logs', label: 'Time Logs', icon: Timer },
      commonItems[1], // Reports
      { id: 'attendance', label: 'Attendance', icon: Clock },
      { id: 'leaves', label: 'Leave Management', icon: Calendar },
      { id: 'payslips', label: 'Payslips', icon: FileText },
      commonItems[2], // Holidays
      commonItems[3], // AI
    ];
  };

  const menuItems = getMenuItems();

  return (
    <>
        <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl`}>
            <div className="flex items-center justify-between h-20 px-6 border-b border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-600/30">
                        <span className="font-black text-lg tracking-tighter">EC</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-white leading-none tracking-tight">EmpowerCorp</h1>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">HR Portal</p>
                    </div>
                </div>
                <button onClick={onClose} className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Main Menu</p>
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onChangeView(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden ${
                                isActive
                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-primary-600 rounded-r-full"></div>}
                            <Icon size={20} className={`transition-colors ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="p-4 m-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 text-white relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                <div className="relative z-10">
                    <p className="text-xs font-medium text-slate-300 mb-1">Need Help?</p>
                    <p className="text-xs text-slate-400 mb-3">Contact support for assistance.</p>
                    <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors border border-white/10">
                        Support Center
                    </button>
                </div>
            </div>
            
            <div className="px-6 pb-6 text-center">
               <p className="text-[10px] text-slate-400 font-medium">© 2025 EmpowerCorp</p>
            </div>
        </div>
        {isOpen && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden" onClick={onClose}></div>}
    </>
  );
};

export default Sidebar;
