
import React, { useState, useRef, useEffect } from 'react';
import { Bell, LogOut, ChevronDown, User as UserIcon, Info, AlertTriangle, CheckCircle, XCircle, Menu, Moon, Sun } from 'lucide-react';
import { User } from '../types';
import { useAppContext } from '../contexts/AppContext';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onChangeView: (view: string) => void;
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onChangeView, onMenuClick }) => {
  const { notifications, markNotificationRead, markAllRead, theme, toggleTheme } = useAppContext();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter notifications for the current user
  const myNotifications = notifications
    .filter(n => n.userId === user.id)
    .sort((a, b) => {
        if (a.read === b.read) return 0;
        return a.read ? 1 : -1;
    });

  const unreadCount = myNotifications.filter(n => !n.read).length;

  const getIcon = (type: string | undefined) => {
    switch(type) {
        case 'success': return <CheckCircle size={16} className="text-emerald-500" />;
        case 'error': return <XCircle size={16} className="text-red-500" />;
        case 'warning': return <AlertTriangle size={16} className="text-orange-500" />;
        default: return <Info size={16} className="text-teal-500" />;
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-800 dark:border-slate-700 border-b border-slate-200 fixed top-0 right-0 left-0 md:left-64 z-10 flex items-center justify-between px-4 md:px-8 shadow-sm transition-all duration-300">
      <div className="flex items-center gap-3">
        <button 
            onClick={onMenuClick}
            className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
            <Menu size={24} />
        </button>
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 truncate">
            <span className="hidden sm:inline">Welcome, </span>{user.name.split(' ')[0]}
        </h2>
      </div>

      <div className="flex items-center space-x-3 md:space-x-4">
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2 rounded-full transition-colors ${showNotifications ? 'bg-teal-50 text-teal-600 dark:bg-slate-700 dark:text-teal-400' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'}`}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-72 md:w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-2 animate-in fade-in zoom-in-95 duration-200 z-50">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={() => markAllRead(user.id)} className="text-xs text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300 font-medium cursor-pointer">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-hide">
                {myNotifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No notifications</div>
                ) : (
                    myNotifications.map(notif => (
                    <div 
                        key={notif.id} 
                        onClick={() => markNotificationRead(notif.id)}
                        className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-50 dark:border-slate-700 last:border-0 transition-colors ${!notif.read ? 'bg-teal-50/40 dark:bg-teal-900/10' : ''}`}
                    >
                        <div className="flex justify-between items-start mb-1 gap-2">
                        <div className="flex items-center gap-2">
                            {getIcon(notif.type)}
                            <span className={`text-sm font-medium ${!notif.read ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>{notif.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{notif.time}</span>
                        </div>
                        <p className={`text-xs ${!notif.read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'} line-clamp-2 pl-6`}>{notif.message}</p>
                        {!notif.read && (
                            <div className="flex justify-end mt-1">
                                <span className="text-[10px] text-teal-500 font-medium">New</span>
                            </div>
                        )}
                    </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center space-x-2 md:space-x-3 hover:bg-slate-50 dark:hover:bg-slate-700 p-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600"
          >
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600 object-cover flex-shrink-0" 
            />
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user.role}</p>
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-1 animate-in fade-in zoom-in-95 duration-200 z-50">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 mb-1 bg-slate-50/50 dark:bg-slate-900/50">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.role}</p>
              </div>
              <button 
                onClick={() => {
                  onChangeView('profile');
                  setShowProfile(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-3"
              >
                <UserIcon size={16} />
                <span>My Profile</span>
              </button>
              <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
              <button 
                onClick={onLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
