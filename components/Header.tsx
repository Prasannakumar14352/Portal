
import React, { useState, useRef, useEffect } from 'react';
import { Bell, LogOut, ChevronDown, User as UserIcon, Info, AlertTriangle, CheckCircle, XCircle, Menu, Moon, Sun, Settings, Home } from 'lucide-react';
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
    <header className="h-20 fixed top-0 right-0 left-0 md:left-72 z-40 flex items-center justify-between px-6 md:px-10 transition-all duration-300 glass border-b border-slate-100 dark:border-slate-800 shadow-sm">
      <div className="flex items-center gap-6">
        <button 
            onClick={onMenuClick}
            className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
        >
            <Menu size={24} />
        </button>
        
        <div className="hidden sm:block">
            {/* Title removed as per user request */}
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        {/* Home Link */}
        <button 
          onClick={() => onChangeView('dashboard')}
          className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-500 dark:text-slate-400 hover:text-primary-600"
        >
          <Home size={18} />
          <span className="text-sm font-bold hidden lg:inline">Home</span>
        </button>

        <div className="flex items-center gap-2 border-x border-slate-100 dark:border-slate-800 px-4">
            <button 
              onClick={toggleTheme}
              className="p-2.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2.5 rounded-full transition-colors ${showNotifications ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">Notifications</h4>
                    <div className="flex gap-2">
                        <button onClick={() => markAllRead(user.id)} className="text-[10px] font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider">Mark all read</button>
                        <button onClick={() => clearAllNotifications(user.id)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider">Clear</button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {myNotifications.length > 0 ? (
                      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {myNotifications.map((notif) => (
                          <div 
                            key={notif.id} 
                            onClick={() => !notif.read && markNotificationRead(notif.id)}
                            className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer flex gap-3 ${!notif.read ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                          >
                            <div className="mt-0.5">{getIcon(notif.type)}</div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs ${!notif.read ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{notif.message}</p>
                                <span className="text-[10px] text-slate-400 mt-1 block">{notif.time}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <Bell size={24} className="mx-auto text-slate-200 mb-2" />
                        <p className="text-xs text-slate-400">All caught up!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
        </div>

        <div className="relative" ref={profileRef}>
            <button 
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center gap-3 p-1 pr-3 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
            >
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm bg-slate-200">
                    <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="hidden lg:block text-left">
                    <p className="text-sm font-bold text-slate-800 dark:text-white leading-none">{user.name.split(' ')[0]}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{user.role}</p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${showProfile ? 'rotate-180' : ''}`} />
            </button>

            {showProfile && (
                <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-50 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account</p>
                    </div>
                    <div className="p-2">
                        <button 
                            onClick={() => { onChangeView('profile'); setShowProfile(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
                        >
                            <UserIcon size={18} /> Profile Details
                        </button>
                        <button 
                            onClick={() => { onChangeView('settings'); setShowProfile(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
                        >
                            <Settings size={18} /> Preferences
                        </button>
                    </div>
                    <div className="p-2 border-t border-slate-50 dark:border-slate-700">
                        <button 
                            onClick={onLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
                        >
                            <LogOut size={18} /> Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;
