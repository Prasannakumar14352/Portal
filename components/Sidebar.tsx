import React from 'react';
import { LayoutDashboard, Users, Calendar, Clock, MessageSquareText, Building2, Timer, BarChart3 } from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  userRole: UserRole;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, userRole }) => {
  const getMenuItems = () => {
    const commonItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'ai-assistant', label: 'HR Assistant', icon: MessageSquareText },
    ];

    if (userRole === UserRole.EMPLOYEE) {
      return [
        commonItems[0],
        { id: 'organization', label: 'Organization', icon: Building2 },
        { id: 'time-logs', label: 'Time Logs', icon: Timer },
        { id: 'attendance', label: 'My Attendance', icon: Clock },
        { id: 'leaves', label: 'Leaves', icon: Calendar },
        commonItems[1]
      ];
    }

    // HR and Manager
    return [
      commonItems[0],
      { id: 'employees', label: 'Employees', icon: Users },
      { id: 'organization', label: 'Organization', icon: Building2 },
      { id: 'time-logs', label: 'Time Logs', icon: Timer },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'attendance', label: 'Attendance', icon: Clock },
      { id: 'leaves', label: 'Leave Management', icon: Calendar },
      commonItems[1]
    ];
  };

  const menuItems = getMenuItems();

  return (
    <div className="h-screen w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0 shadow-xl z-20">
      <div className="p-6 border-b border-slate-700 flex items-center space-x-3 h-16">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <span className="font-bold text-lg">E</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight">EMP Portal</h1>
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
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;