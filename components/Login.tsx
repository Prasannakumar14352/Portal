
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Lock, Mail, ChevronRight, Loader2, CheckCircle2, Layout, User as UserIcon, Building2, Users, Clock, Sparkles, X, ShieldCheck, FileText, ArrowLeft, Key } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { login, loginWithMicrosoft, forgotPassword, confirmPasswordReset, employees, showToast } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  
  const [viewMode, setViewMode] = useState<'login' | 'reset-password'>('login');
  
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const showDemoAccess = process.env.VITE_USE_MOCK_DATA !== 'false';

  useEffect(() => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (path === '/reset-password' || token) {
          if (token) {
              setResetToken(token);
              setViewMode('reset-password');
          }
      }
  }, []);

  const isMicrosoftDomain = (emailStr: string) => {
      const domains = ['outlook.com', 'hotmail.com', 'live.com', 'microsoft.com', 'msn.com'];
      const domain = emailStr.split('@')[1]?.toLowerCase();
      return domains.includes(domain);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const trimmedEmail = email.trim();
    const targetUser = employees.find(emp => emp.email.toLowerCase() === trimmedEmail.toLowerCase());

    if (password && (!targetUser || targetUser.password !== 'ms-auth-user')) {
        const success = await login(trimmedEmail, password);
        if (success) {
            setIsLoading(false);
            return;
        }
    }

    const isMSAccount = (targetUser && targetUser.password === 'ms-auth-user') || isMicrosoftDomain(trimmedEmail);
    
    if (isMSAccount) {
        showToast("Microsoft account detected. Launching secure sign-in...", "info");
        const success = await loginWithMicrosoft(trimmedEmail);
        if (!success) {
            showToast("Microsoft authentication was cancelled or failed.", "error");
        }
    } else {
        if (!password) {
            showToast("Please enter a password for this local account.", "warning");
        } else {
            await login(trimmedEmail, password);
        }
    }
    
    setIsLoading(false);
  };
  
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!resetEmail) return;
      
      setIsResetting(true);
      const success = await forgotPassword(resetEmail);
      setIsResetting(false);
      
      if (success) {
          setShowForgotPasswordModal(false);
          setResetEmail('');
      }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
          showToast("Passwords do not match.", "error");
          return;
      }
      if (newPassword.length < 6) {
          showToast("Password must be at least 6 characters.", "warning");
          return;
      }

      setIsLoading(true);
      const success = await confirmPasswordReset(resetToken, newPassword);
      setIsLoading(false);

      if (success) {
          setViewMode('login');
          window.history.pushState({}, '', '/');
      }
  };

  const openForgotPassword = () => {
      setResetEmail(email);
      setShowForgotPasswordModal(true);
  };

  const fillDemoCreds = (role: 'admin' | 'employee' | 'manager') => {
      if (role === 'admin') {
          setEmail('superadmin@empower.com');
          setPassword('password123');
      } else if (role === 'manager') {
          setEmail('bob.smith@empower.com');
          setPassword('password123');
      } else {
          setEmail('alice.j@empower.com');
          setPassword('password123');
      }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans selection:bg-primary-500 selection:text-white">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-white animate-in slide-in-from-left-5 duration-500 relative">
        <div className="max-w-md w-full space-y-8 relative z-10">
            {/* Brand Header */}
            <div className="flex items-center gap-3 mb-10">
                <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-2 rounded-xl shadow-lg shadow-primary-500/20">
                    <Layout className="text-white w-6 h-6" />
                </div>
                <span className="text-2xl font-black text-slate-800 tracking-tight">EmpowerCorp</span>
            </div>

            {viewMode === 'login' ? (
                <>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                            Welcome back
                        </h2>
                        <p className="text-slate-500 mt-2 font-medium">
                            Sign in to access your dashboard.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                                <input 
                                    type="text"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-100 rounded-xl focus:border-primary-500 focus:ring-0 outline-none transition-all bg-slate-50 focus:bg-white text-slate-900 placeholder-slate-400 font-medium"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                                <input 
                                    type="password" 
                                    className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-100 rounded-xl focus:border-primary-500 focus:ring-0 outline-none transition-all bg-slate-50 focus:bg-white text-slate-900 placeholder-slate-400 font-medium"
                                    placeholder={isMicrosoftDomain(email) ? "Optional for Microsoft SSO" : "••••••••"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            {isMicrosoftDomain(email) && (
                                <p className="text-[10px] text-primary-600 font-bold mt-2 uppercase tracking-tight flex items-center gap-1 animate-pulse">
                                    <Sparkles size={12}/> Microsoft 365 SSO Enabled
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                <span className="text-sm text-slate-600 font-medium">Remember me</span>
                            </label>
                            <button type="button" onClick={openForgotPassword} className="text-sm font-bold text-primary-600 hover:text-primary-700">
                                Recover Password
                            </button>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-xl shadow-primary-500/20 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                'Sign In Account'
                            )}
                        </button>
                    </form>

                    <div className="pt-6 flex items-center gap-2 text-xs text-slate-400 justify-center font-medium">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        <span>Secure 256-bit Encrypted Connection</span>
                    </div>

                    {showDemoAccess && (
                        <div className="mt-10 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] text-center text-slate-400 mb-3 uppercase font-black tracking-widest">Instant Access</p>
                            <div className="flex gap-2 justify-center flex-wrap">
                                <button onClick={() => fillDemoCreds('admin')} className="text-xs bg-white border border-slate-200 hover:border-primary-500 hover:text-primary-600 text-slate-600 px-4 py-2 rounded-lg transition-all shadow-sm font-bold">
                                    Admin
                                </button>
                                <button onClick={() => fillDemoCreds('manager')} className="text-xs bg-white border border-slate-200 hover:border-primary-500 hover:text-primary-600 text-slate-600 px-4 py-2 rounded-lg transition-all shadow-sm font-bold">
                                    Manager
                                </button>
                                <button onClick={() => fillDemoCreds('employee')} className="text-xs bg-white border border-slate-200 hover:border-primary-500 hover:text-primary-600 text-slate-600 px-4 py-2 rounded-lg transition-all shadow-sm font-bold">
                                    Employee
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* Reset Password View */
                <>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                            Reset Password
                        </h2>
                        <p className="text-slate-500 mt-2 font-medium">
                            Create a strong new password for your account.
                        </p>
                    </div>

                    <form onSubmit={handlePasswordResetSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">New Password</label>
                            <div className="relative group">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                                <input 
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-100 rounded-xl focus:border-primary-500 focus:ring-0 outline-none transition-all bg-slate-50 focus:bg-white text-slate-900 font-medium"
                                    placeholder="Minimum 6 characters"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Confirm Password</label>
                            <div className="relative group">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                                <input 
                                    type="password" 
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-100 rounded-xl focus:border-primary-500 focus:ring-0 outline-none transition-all bg-slate-50 focus:bg-white text-slate-900 font-medium"
                                    placeholder="Repeat password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center disabled:opacity-70 mt-4"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Update Password'}
                        </button>

                        <button 
                            type="button" 
                            onClick={() => setViewMode('login')}
                            className="w-full text-center text-sm font-bold text-slate-500 hover:text-primary-600 mt-4"
                        >
                            Back to Login
                        </button>
                    </form>
                </>
            )}
        </div>
      </div>

      {/* Right Side - Brand/Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white p-16 flex-col justify-center relative overflow-hidden">
         {/* Abstract Background Shapes */}
         <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 mix-blend-screen"></div>
         <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 mix-blend-screen"></div>
         
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>

         <div className="relative z-10 max-w-lg">
            <h1 className="text-5xl font-black mb-8 leading-tight tracking-tight">
                Enterprise Grade <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-300 to-indigo-300">HR Management</span>
            </h1>
            <p className="text-slate-300 text-lg mb-12 leading-relaxed font-medium">
                EmpowerCorp combines AI-driven insights with robust workforce tools to streamline your daily operations.
            </p>

            <div className="space-y-6">
                <div className="flex items-center gap-5 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/30">
                        <Sparkles className="text-white" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">Gemini AI Assistant</h3>
                        <p className="text-slate-400 text-sm">Automated policy drafting and HR queries.</p>
                    </div>
                </div>

                <div className="flex items-center gap-5 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
                        <Clock className="text-white" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">Smart Attendance</h3>
                        <p className="text-slate-400 text-sm">Geolocation tracking & biometric integration.</p>
                    </div>
                </div>
            </div>

            <div className="mt-16">
                <button 
                    type="button"
                    onClick={() => setShowFeaturesModal(true)}
                    className="text-white/80 hover:text-white font-bold flex items-center gap-2 transition-colors group text-sm uppercase tracking-widest"
                >
                    Explore Features <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
         </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row border border-slate-100">
                
                <div className="w-full md:w-1/2 p-12 relative flex flex-col justify-center">
                    <button onClick={() => setShowForgotPasswordModal(false)} className="absolute top-8 left-8 text-slate-400 hover:text-slate-700 transition">
                        <ArrowLeft size={24} />
                    </button>
                    
                    <div className="mb-8">
                        <h3 className="text-2xl font-black text-slate-800">Account Recovery</h3>
                        <p className="text-slate-500 text-sm mt-2 font-medium">
                            Enter your verified email to receive a password reset link.
                        </p>
                    </div>

                    <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                                <input 
                                    type="email"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-100 rounded-xl focus:border-primary-500 focus:ring-0 outline-none transition-all bg-slate-50 focus:bg-white text-slate-900 font-medium"
                                    placeholder="name@company.com"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 justify-end pt-4">
                            <button 
                                type="button" 
                                onClick={() => setShowForgotPasswordModal(false)}
                                className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={isResetting}
                                className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center min-w-[160px]"
                            >
                                {isResetting ? <Loader2 className="animate-spin" size={20} /> : 'Send Link'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="w-full md:w-1/2 bg-slate-900 p-12 text-white flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/30 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <h3 className="text-2xl font-bold mb-4">Secure Reset</h3>
                        <p className="text-slate-300 text-sm mb-8 leading-relaxed">
                            We use industry-standard encryption. If you use Microsoft SSO, please reset your password through the Microsoft portal instead.
                        </p>
                        
                        <ul className="space-y-4">
                            <li className="flex items-center gap-3 text-sm font-medium text-slate-200">
                                <ShieldCheck className="text-emerald-400" size={20} />
                                <span>End-to-end encryption</span>
                            </li>
                            <li className="flex items-center gap-3 text-sm font-medium text-slate-200">
                                <Clock className="text-emerald-400" size={20} />
                                <span>15-minute token validity</span>
                            </li>
                        </ul>
                    </div>
                </div>

            </div>
        </div>
      )}

      {/* Features Modal */}
      {showFeaturesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[80vh] overflow-hidden relative flex flex-col md:flex-row">
               <button 
                 onClick={() => setShowFeaturesModal(false)}
                 className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-900 transition z-50"
               >
                 <X size={20} />
               </button>
               
               <div className="w-full md:w-1/3 bg-slate-900 p-10 text-white flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20 mb-6">
                        <Layout className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-3xl font-black mb-3">Platform <br/> Capabilities</h3>
                    <p className="text-slate-400 text-sm font-medium">Explore the tools that drive efficiency.</p>
                  </div>
                  <div className="relative z-10 text-xs text-slate-500 font-bold uppercase tracking-widest">
                      v2.5 Enterprise Edition
                  </div>
               </div>

               <div className="w-full md:w-2/3 p-10 bg-white overflow-y-auto">
                  <h3 className="text-xl font-bold text-slate-900 mb-8">Core Modules</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      {[
                          { icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', title: 'People Directory', desc: 'Centralized employee database with hierarchy mapping.' },
                          { icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50', title: 'Time Tracking', desc: 'Precision attendance logging with geo-fencing.' },
                          { icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50', title: 'AI Assistant', desc: 'Gemini-powered HR policy and content generation.' },
                          { icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50', title: 'Leave & Payroll', desc: 'Automated leave workflows and payslip distribution.' },
                          { icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50', title: 'Access Control', desc: 'Role-based permissions (RBAC) for data security.' },
                          { icon: Building2, color: 'text-teal-600', bg: 'bg-teal-50', title: 'Org Chart', desc: 'Interactive visual hierarchy of departments.' }
                      ].map((feature, idx) => (
                          <div key={idx} className="group">
                              <div className={`w-12 h-12 ${feature.bg} ${feature.color} rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                                 <feature.icon size={24} />
                              </div>
                              <h4 className="font-bold text-slate-800 mb-1">{feature.title}</h4>
                              <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
                          </div>
                      ))}
                  </div>
               </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Login;
