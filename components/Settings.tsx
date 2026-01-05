import React, { useState } from 'react';
import { Bell, Mail, Monitor, Shield, Eye, Database, Sparkles, Smartphone, Moon, Sun, Lock, Save, RotateCcw } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole } from '../types';

const Settings = () => {
  const { theme, toggleTheme, currentUser, showToast } = useAppContext();
  const [isSaving, setIsSaving] = useState(false);
  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;

  // Local state for settings simulation
  const [notifications, setNotifications] = useState({
    emailLeaves: true,
    emailAttendance: false,
    pushWeb: true,
    pushMobile: true,
    systemAlerts: true
  });

  const [appConfig, setAppConfig] = useState({
    aiAssistant: true,
    azureSync: true,
    strictSso: false
  });

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsSaving(false);
    showToast("Application settings saved successfully.", "success");
  };

  const Toggle = ({ enabled, onChange, label, sublabel, icon: Icon }: any) => (
    <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-teal-500/30 transition-all group">
      <div className="flex items-start gap-4">
        <div className={`p-2 rounded-lg ${enabled ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-400'} transition-colors`}>
          <Icon size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sublabel}</p>
        </div>
      </div>
      <button 
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Settings</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Manage preferences and organizational configurations.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-black shadow-lg shadow-teal-500/20 disabled:opacity-70"
            >
                {isSaving ? <RotateCcw size={18} className="animate-spin" /> : <Save size={18} />}
                <span>{isSaving ? 'SAVING...' : 'SAVE CHANGES'}</span>
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Notification Preferences */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600">
              <Bell size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Notifications</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Toggle 
              enabled={notifications.emailLeaves} 
              onChange={(v: boolean) => setNotifications({...notifications, emailLeaves: v})}
              label="Leave Updates"
              sublabel="Email alerts when leave status changes."
              icon={Mail}
            />
            <Toggle 
              enabled={notifications.pushWeb} 
              onChange={(v: boolean) => setNotifications({...notifications, pushWeb: v})}
              label="Web Push"
              sublabel="Browser notifications for real-time alerts."
              icon={Monitor}
            />
            <Toggle 
              enabled={notifications.systemAlerts} 
              onChange={(v: boolean) => setNotifications({...notifications, systemAlerts: v})}
              label="Security Alerts"
              sublabel="Notify on new logins or account changes."
              icon={Shield}
            />
            <Toggle 
              enabled={notifications.pushMobile} 
              onChange={(v: boolean) => setNotifications({...notifications, pushMobile: v})}
              label="Mobile Sync"
              sublabel="Sync notifications with Empower mobile app."
              icon={Smartphone}
            />
          </div>
        </div>

        {/* Appearance Settings */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600">
              <Eye size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Appearance</h3>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-slate-100 dark:border-slate-800">
             <div className="flex items-start gap-4">
               <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                 {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
               </div>
               <div>
                 <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">System Theme</h4>
                 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Toggle between light and dark visual modes.</p>
               </div>
             </div>
             <button 
                onClick={toggleTheme}
                className="px-6 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all"
             >
                {theme === 'light' ? 'Go Dark' : 'Go Light'}
             </button>
          </div>
        </div>

        {/* Global Admin Config - Visible to Power Users Only */}
        {isPowerUser && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6 border-l-4 border-l-teal-600">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-xl text-teal-600">
                <Database size={20} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Organizational Control</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Toggle 
                enabled={appConfig.aiAssistant} 
                onChange={(v: boolean) => setAppConfig({...appConfig, aiAssistant: v})}
                label="AI Assistant"
                sublabel="Enable Gemini HR Intelligence for all users."
                icon={Sparkles}
              />
              <Toggle 
                enabled={appConfig.azureSync} 
                onChange={(v: boolean) => setAppConfig({...appConfig, azureSync: v})}
                label="Azure AD Real-time"
                sublabel="Keep directory in sync with Microsoft 365."
                icon={Database}
              />
              <Toggle 
                enabled={appConfig.strictSso} 
                onChange={(v: boolean) => setAppConfig({...appConfig, strictSso: v})}
                label="Strict SSO Enforcement"
                sublabel="Disable password logins for all employees."
                icon={Lock}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;