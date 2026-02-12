
import React, { useState, useRef, useEffect } from 'react';
import { Bell, LogOut, ChevronDown, User as UserIcon, Info, AlertTriangle, CheckCircle, XCircle, Menu, Moon, Sun, Settings } from 'lucide-react';
import { User } from '../types';
import { useAppContext } from '../contexts/AppContext';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onChangeView: (view: string) => void;
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onChangeView, onMenuClick }) => {
  const { notifications, markNotificationRead, markAllRead, clearAllNotifications, theme, toggleTheme } = useAppContext();
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

  const myNotifications = notifications
    .filter(n => String(n.userId) === String(user.id))
    .sort((a, b) => {
        if (a.read === b.read) return 0;
        return a.read ? 1 : -1;
    });

  const unreadCount = myNotifications.filter(n => !n.read).length;

  const getIcon = (type: string | undefined) => {
    switch(type) {
        case 'success': return <CheckCircle size={16} className="text-emerald-500" />;
        case 'error': return <XCircle size={16} className="text-red-500" />;
        case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
        default: return <Info size={16} className="text-primary-500" />;
    }
  };

  return (
    <header className="h-20 fixed top-0 right-0 left-0 md:left-72 z-40 flex items-center justify-between px-6 md:px-10 transition-all duration-300 glass">
      <div className="flex items-center gap-4">
        <button 
            onClick={onMenuClick}
            className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl transition-colors"
        >
            <Menu size={24} />
        </button>
        
        <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white leading-tight tracking-tight">
                Hello, {user.name.split(' ')[0]} 👋
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Here's what's happening with your team today.
            </p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        <button 
          onClick={toggleTheme}
          className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2.5 rounded-full transition-colors ${showNotifications ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200'}`}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-4 w-80 md:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 py-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right z-50">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-white">Notifications</h3>
                <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button onClick={() => markAllRead(user.id)} className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-bold">
                        Mark all read
                      </button>
                    )}
                    {myNotifications.length > 0 && (
                      <button onClick={() => clearAllNotifications(user.id)} className="text-xs text-slate-400 hover:text-red-600 font-bold transition-colors">
                        Clear
                      </button>
                    )}
                </div>
              </div>
              <div className="max-h-[20rem] overflow-y-auto custom-scrollbar">
                {myNotifications.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center text-slate-300">
                            <Bell size={20} />
                        </div>
                        <p className="text-slate-400 text-sm font-medium">All caught up!</p>
                    </div>
                ) : (
                    myNotifications.map(notif => (
                    <div 
                        key={notif.id} 
                        onClick={() => markNotificationRead(notif.id)}
                        className={`px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors ${!notif.read ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                    >
                        <div className="flex gap-3">
                            <div className={`mt-0.5 p-1.5 rounded-full flex-shrink-0 ${!notif.read ? 'bg-white shadow-sm dark:bg-slate-700' : 'bg-transparent'}`}>
                                {getIcon(notif.type)}
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-start gap-2">
                                    <span className={`text-sm font-semibold ${!notif.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{notif.title}</span>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">{notif.time}</span>
                                </div>
                                <p className={`text-xs leading-relaxed ${!notif.read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>{notif.message}</p>
                            </div>
                        </div>
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
            className="flex items-center gap-3 pl-1 pr-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary-200 dark:hover:border-primary-800 transition-all group"
          >
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-slate-700 group-hover:border-primary-100 transition-colors" 
            />
            <div className="hidden md:block text-left pr-1">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-medium">{user.role}</p>
            </div>
            <ChevronDown size={14} className="text-slate-400 group-hover:text-primary-500 transition-colors hidden sm:block" />
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 p-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right z-50">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl mb-2">
                <p className="text-sm font-bold text-slate-800 dark:text-white">{user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{user.email || 'No email'}</p>
              </div>
              
              <button onClick={() => { onChangeView('profile'); setShowProfile(false); }} className="w-full text-left px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-3 transition-colors">
                <UserIcon size={16} /> <span>My Profile</span>
              </button>
              
              <button onClick={() => { onChangeView('settings'); setShowProfile(false); }} className="w-full text-left px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-3 transition-colors">
                <Settings size={16} /> <span>Settings</span>
              </button>

              <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"></div>
              
              <button onClick={onLogout} className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-3 transition-colors font-medium">
                <LogOut size={16} /> <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
