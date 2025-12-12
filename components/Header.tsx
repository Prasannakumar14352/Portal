import React, { useState, useRef, useEffect } from 'react';
import { Bell, LogOut, ChevronDown, User as UserIcon, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { User } from '../types';
import { useAppContext } from '../contexts/AppContext';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onChangeView: (view: string) => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onChangeView }) => {
  const { notifications, markNotificationRead, markAllRead } = useAppContext();
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
        // Simple sort by unread first, then by approximate recency (mocked for now, assumes DB order usually appends)
        if (a.read === b.read) return 0;
        return a.read ? 1 : -1;
    });

  const unreadCount = myNotifications.filter(n => !n.read).length;

  const getIcon = (type: string | undefined) => {
    switch(type) {
        case 'success': return <CheckCircle size={16} className="text-green-500" />;
        case 'error': return <XCircle size={16} className="text-red-500" />;
        case 'warning': return <AlertTriangle size={16} className="text-orange-500" />;
        default: return <Info size={16} className="text-blue-500" />;
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 fixed top-0 right-0 left-64 z-10 flex items-center justify-between px-8 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-700">Welcome, {user.name.split(' ')[0]}</h2>
      </div>

      <div className="flex items-center space-x-6">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2 rounded-full transition-colors ${showNotifications ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-in fade-in zoom-in-95 duration-200 z-50">
              <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={() => markAllRead(user.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {myNotifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No notifications</div>
                ) : (
                    myNotifications.map(notif => (
                    <div 
                        key={notif.id} 
                        onClick={() => markNotificationRead(notif.id)}
                        className={`px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${!notif.read ? 'bg-blue-50/40' : ''}`}
                    >
                        <div className="flex justify-between items-start mb-1 gap-2">
                        <div className="flex items-center gap-2">
                            {getIcon(notif.type)}
                            <span className={`text-sm font-medium ${!notif.read ? 'text-slate-900' : 'text-slate-600'}`}>{notif.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{notif.time}</span>
                        </div>
                        <p className={`text-xs ${!notif.read ? 'text-slate-600' : 'text-slate-400'} line-clamp-2 pl-6`}>{notif.message}</p>
                        {!notif.read && (
                            <div className="flex justify-end mt-1">
                                <span className="text-[10px] text-blue-500 font-medium">New</span>
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
            className="flex items-center space-x-3 hover:bg-slate-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-100"
          >
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-8 h-8 rounded-full border border-slate-200 object-cover" 
            />
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-slate-700">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1 animate-in fade-in zoom-in-95 duration-200 z-50">
              <div className="px-4 py-3 border-b border-slate-100 mb-1 bg-slate-50/50">
                <p className="text-sm font-bold text-slate-800">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.role}</p>
              </div>
              <button 
                onClick={() => {
                  onChangeView('profile');
                  setShowProfile(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 flex items-center space-x-3"
              >
                <UserIcon size={16} />
                <span>My Profile</span>
              </button>
              <div className="border-t border-slate-100 my-1"></div>
              <button 
                onClick={onLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3"
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