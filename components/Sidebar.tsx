
import React from 'react';
import { LayoutDashboard, Calendar, Clock, MessageSquareText, Building2, Timer, BarChart3, FileText, Coffee, X, Hexagon } from 'lucide-react';
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
    return [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'organization', label: 'Organization', icon: Building2 },
      { id: 'time-logs', label: 'Time Logs', icon: Timer },
      { id: 'attendance', label: 'My Attendance', icon: Clock },
      { id: 'leaves', label: 'Leaves', icon: Calendar },
      { id: 'payslips', label: 'Payslips', icon: FileText },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'holidays', label: 'Holidays', icon: Coffee },
      { id: 'ai-assistant', label: 'HR Assistant', icon: MessageSquareText },
    ];
  };

  const menuItems = getMenuItems();

  return (
    <>
        <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} shadow-xl flex flex-col h-full`}>
            {/* Logo Area */}
            <div className="flex items-center gap-3 h-20 px-6 border-b border-slate-50 dark:border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
                      <Hexagon size={24} fill="white" fillOpacity={0.2} />
                      <span className="absolute font-black text-[10px] tracking-tighter">IST</span>
                    </div>
                    <div className="text-slate-800 dark:text-white">
                        <h1 className="text-[13px] font-black leading-tight tracking-tight uppercase">Smart</h1>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Solutions</p>
                    </div>
                </div>
                <button onClick={onClose} className="md:hidden p-2 text-slate-400 hover:text-slate-600 ml-auto">
                    <X size={20} />
                </button>
            </div>

            {/* Section Header */}
            <div className="px-8 pt-8 pb-4">
                <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Main Menu</p>
            </div>

            {/* Navigation List */}
            <nav className="flex-1 overflow-y-auto pb-4 space-y-1.5 px-4 custom-scrollbar">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => onChangeView(item.id)}
                            className={`w-full flex items-center gap-4 px-4 py-3.5 text-sm font-semibold transition-all duration-200 rounded-xl relative group ${
                                isActive
                                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary-500 rounded-full"></div>
                            )}
                            
                            <Icon 
                                size={20} 
                                className={`transition-colors duration-200 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} 
                            />
                            <span className="tracking-tight">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-6 border-t border-slate-50 dark:border-slate-800">
                <div className="text-center">
                   <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-widest">© 2025 EmpowerCorp</p>
                </div>
            </div>
        </div>
        {isOpen && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden" onClick={onClose}></div>}
    </>
  );
};

export default Sidebar;
