
import React from 'react';
import { LayoutDashboard, Calendar, Clock, MessageSquareText, Building2, Timer, BarChart3, FileText, Coffee, X, Download } from 'lucide-react';
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
    <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col shadow-xl transition-transform duration-300 ease-in-out md:translate-x-0 border-r border-slate-200 dark:border-slate-800 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between h-16">
        <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-teal-700 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-sm">
            <span className="font-bold text-sm">EC</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">EmpowerCorp</h1>
        </div>
        {/* Mobile Close Button */}
        <button onClick={onClose} className="md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:white transition-colors">
            <X size={24} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-6">
        <ul className="space-y-2 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onChangeView(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
         {/* Install App button removed as requested */}
         <div className="text-xs text-slate-500 dark:text-slate-500 text-center">
            &copy; 2025 EmpowerCorp
         </div>
      </div>
    </div>
  );
};

export default Sidebar;
