import React from 'react';
import { UserRole, User } from '../types';
import { Shield, Users, User as UserIcon } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const handleRoleSelect = (role: UserRole) => {
    // Mock login logic
    let user: User;
    switch (role) {
      case UserRole.HR:
        user = { id: 'hr1', name: 'Admin User', role: UserRole.HR, avatar: 'https://picsum.photos/seed/admin/40' };
        break;
      case UserRole.MANAGER:
        user = { id: 'm1', name: 'Sarah Manager', role: UserRole.MANAGER, avatar: 'https://picsum.photos/seed/sarah/40' };
        break;
      case UserRole.EMPLOYEE:
        // Fixed ID to '1' to match seed data in db.ts
        user = { id: '1', name: 'Alice Johnson', role: UserRole.EMPLOYEE, avatar: 'https://picsum.photos/seed/alice/40' };
        break;
      default:
        return;
    }
    onLogin(user);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to EMP Portal</h1>
          <p className="text-slate-400">Select your role to sign in</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => handleRoleSelect(UserRole.HR)}
            className="bg-white p-8 rounded-2xl hover:scale-105 transition-transform duration-200 group"
          >
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-600 transition-colors">
              <Shield size={32} className="text-blue-600 group-hover:text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">HR Manager</h3>
            <p className="text-slate-500 text-sm">Full access to employee data, leaves, and settings.</p>
          </button>

          <button 
            onClick={() => handleRoleSelect(UserRole.MANAGER)}
            className="bg-white p-8 rounded-2xl hover:scale-105 transition-transform duration-200 group"
          >
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-purple-600 transition-colors">
              <Users size={32} className="text-purple-600 group-hover:text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Team Manager</h3>
            <p className="text-slate-500 text-sm">Manage team attendance and approve leave requests.</p>
          </button>

          <button 
            onClick={() => handleRoleSelect(UserRole.EMPLOYEE)}
            className="bg-white p-8 rounded-2xl hover:scale-105 transition-transform duration-200 group"
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-emerald-600 transition-colors">
              <UserIcon size={32} className="text-emerald-600 group-hover:text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Employee</h3>
            <p className="text-slate-500 text-sm">View your profile, check attendance, and apply for leave.</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;