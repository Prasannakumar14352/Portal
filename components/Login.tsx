
import React, { useState } from 'react';
import { User } from '../types';
import { Lock, Mail, ChevronRight, Loader2, CheckCircle2, Layout, User as UserIcon, Building2, Users, Clock, Sparkles, X, ShieldCheck, FileText, ArrowLeft } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { login, loginWithMicrosoft, forgotPassword, employees, showToast } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  
  // Forgot Password State
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetUsername, setResetUsername] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Check if Mock Data is enabled (default true unless explicitly set to 'false')
  const showDemoAccess = process.env.VITE_USE_MOCK_DATA !== 'false';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Smart Login Check:
    // If the user exists and has the placeholder password 'ms-auth-user', 
    // it means they registered via Microsoft. We should redirect them to the MS flow
    // even if they tried to use the standard form.
    const targetUser = employees.find(emp => emp.email.toLowerCase() === email.trim().toLowerCase());
    
    if (targetUser && targetUser.password === 'ms-auth-user') {
        showToast("This account uses Microsoft Sign-In. Redirecting...", "info");
        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay for user to read toast
        await loginWithMicrosoft();
        setIsLoading(false);
        return;
    }

    // Normal Login Flow
    await new Promise(resolve => setTimeout(resolve, 800));
    await login(email, password);
    // Success handled by context (currentUser state change)
    
    setIsLoading(false);
  };

  const handleMicrosoftLogin = async () => {
      setIsLoading(true);
      await loginWithMicrosoft();
      setIsLoading(false);
  };
  
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsResetting(true);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing
      
      // In a real scenario, we would validate username matches email here
      await forgotPassword(resetEmail);
      
      setIsResetting(false);
      setShowForgotPasswordModal(false);
      setResetEmail('');
      setResetUsername('');
  };

  const openForgotPassword = () => {
      setResetEmail(email); // Pre-fill if user typed it in login
      setShowForgotPasswordModal(true);
  };

  // Fill credentials for demo purposes
  const fillDemoCreds = (role: 'admin' | 'employee') => {
      if (role === 'admin') {
          setEmail('superadmin@empower.com');
          setPassword('password123');
      } else {
          setEmail('alice.j@empower.com');
          setPassword('password123');
      }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-white animate-in slide-in-from-left-5 duration-500">
        <div className="max-w-md w-full space-y-8">
            {/* Brand Header */}
            <div className="flex items-center gap-2 mb-8">
                <div className="bg-teal-700 p-1.5 rounded-lg">
                    <Layout className="text-white w-6 h-6" />
                </div>
                <span className="text-xl font-bold text-teal-800">EmpowerCorp HR</span>
            </div>

            <div>
                <h2 className="text-3xl font-bold text-slate-900">
                    Welcome back
                </h2>
                <p className="text-slate-500 mt-2">
                    Sign in to your account to access the platform.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Username or Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text"
                            required
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                            placeholder="Your username or email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="password" 
                            required
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                            placeholder="Your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500" />
                        <span className="text-sm text-slate-600">Remember me</span>
                    </label>
                    <button type="button" onClick={openForgotPassword} className="text-sm font-medium text-teal-700 hover:text-teal-800">
                        Forgot your password?
                    </button>
                </div>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3.5 rounded-lg transition-all duration-200 shadow-lg hover:shadow-teal-500/30 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                    {isLoading ? (
                        <Loader2 className="animate-spin" size={20} />
                    ) : (
                        'Login'
                    )}
                </button>
            </form>

            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase tracking-widest">Or continue with</span>
                <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button 
                type="button"
                onClick={handleMicrosoftLogin}
                disabled={isLoading}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-lg border border-slate-200 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-70 shadow-sm"
            >
                <svg width="20" height="20" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H1z"/>
                </svg>
                Sign in with Microsoft
            </button>

            {/* Demo Credentials Helper */}
            {showDemoAccess && (
                <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs text-center text-slate-400 mb-2 uppercase font-bold tracking-wider">Quick Demo Access</p>
                    <div className="flex gap-2 justify-center">
                        <button onClick={() => fillDemoCreds('admin')} className="text-xs bg-white border border-slate-200 hover:border-teal-300 text-slate-600 px-3 py-1.5 rounded transition shadow-sm">
                            Fill Admin
                        </button>
                        <button onClick={() => fillDemoCreds('employee')} className="text-xs bg-white border border-slate-200 hover:border-teal-300 text-slate-600 px-3 py-1.5 rounded transition shadow-sm">
                            Fill Employee
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Right Side - Brand/Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-teal-800 text-white p-16 flex-col justify-center relative overflow-hidden">
         {/* Background Shapes */}
         <div className="absolute top-0 right-0 w-96 h-96 bg-teal-700 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
         <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-900 rounded-full mix-blend-multiply filter blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2"></div>

         <div className="relative z-10 max-w-lg">
            <h1 className="text-4xl font-bold mb-6 leading-tight">Enterprise HR Management</h1>
            <p className="text-teal-100 text-lg mb-10 leading-relaxed">
                EmpowerCorp HR Portal helps teams organize employees, track attendance, and manage HR operations in a collaborative environment.
            </p>

            <div className="space-y-8">
                <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-teal-700/50 flex items-center justify-center flex-shrink-0 border border-teal-600">
                        <CheckCircle2 className="text-teal-300" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg mb-1">Intuitive Employee Management</h3>
                        <p className="text-teal-200 text-sm">Organize employee records, monitor status, and manage departments all in one place.</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-teal-700/50 flex items-center justify-center flex-shrink-0 border border-teal-600">
                        <Sparkles className="text-teal-300" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg mb-1">AI-Powered HR Assistant</h3>
                        <p className="text-teal-200 text-sm">Let our Gemini AI help optimize your HR queries and policy drafting for maximum efficiency.</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-teal-700/50 flex items-center justify-center flex-shrink-0 border border-teal-600">
                        <Clock className="text-teal-300" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg mb-1">Attendance & Leave Tracking</h3>
                        <p className="text-teal-200 text-sm">Work together seamlessly with real-time updates on attendance and leave requests.</p>
                    </div>
                </div>
            </div>

            <div className="mt-16">
                <button 
                    type="button"
                    onClick={() => setShowFeaturesModal(true)}
                    className="text-teal-300 hover:text-white font-medium flex items-center gap-2 transition-colors focus:outline-none"
                >
                    Learn more about our features <ChevronRight size={16} />
                </button>
            </div>
         </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row">
                
                {/* Left Side - Reset Form */}
                <div className="w-full md:w-1/2 p-8 md:p-12 relative flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-6">
                        <button onClick={() => setShowForgotPasswordModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                            <ArrowLeft size={20} />
                        </button>
                        <h3 className="text-xl font-bold text-slate-800">Forgot Password</h3>
                    </div>
                    
                    <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                        Enter your username and email to request a password reset. For security reasons, an administrator must review and process your request before a new password is issued.
                    </p>

                    <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Username</label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text"
                                    required
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                    placeholder="Your username"
                                    value={resetUsername}
                                    onChange={(e) => setResetUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="email"
                                    required
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                    placeholder="Your email"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex gap-3 justify-end">
                            <button 
                                type="button" 
                                onClick={() => setShowForgotPasswordModal(false)}
                                className="px-4 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={isResetting}
                                className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg transition-all shadow-md flex items-center justify-center min-w-[140px]"
                            >
                                {isResetting ? <Loader2 className="animate-spin" size={20} /> : 'Submit Request'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Side - Information */}
                <div className="w-full md:w-1/2 bg-teal-700 p-8 md:p-12 text-white flex flex-col justify-center">
                    <h3 className="text-2xl font-bold mb-4">Reset Your Password</h3>
                    <p className="text-teal-100 text-sm mb-8 leading-relaxed">
                        We understand you might need to reset your password sometimes. Please provide your username and email address. For security reasons, an administrator must review and process your request.
                    </p>
                    
                    <ul className="space-y-6">
                        <li className="flex items-start gap-3">
                            <ShieldCheck className="text-teal-300 flex-shrink-0" size={24} />
                            <div>
                                <h4 className="font-semibold text-sm">Security-focused reset process</h4>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <Users className="text-teal-300 flex-shrink-0" size={24} />
                            <div>
                                <h4 className="font-semibold text-sm">Administrator approval required</h4>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <Mail className="text-teal-300 flex-shrink-0" size={24} />
                            <div>
                                <h4 className="font-semibold text-sm">Email notification when new password is issued</h4>
                            </div>
                        </li>
                    </ul>
                </div>

            </div>
        </div>
      )}

      {/* Features Modal (Existing) */}
      {showFeaturesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative flex flex-col md:flex-row">
               <button 
                 onClick={() => setShowFeaturesModal(false)}
                 className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition z-10"
               >
                 <X size={20} />
               </button>
               
               {/* Modal Content - Left (Image/Color) */}
               <div className="w-full md:w-1/3 bg-teal-800 p-8 text-white flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-64 h-64 bg-teal-700 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-x-1/2 -translate-y-1/2"></div>
                  <div className="relative z-10">
                    <Layout className="w-12 h-12 mb-4 text-teal-300" />
                    <h3 className="text-2xl font-bold mb-2">EmpowerCorp</h3>
                    <p className="text-teal-100 text-sm">Comprehensive Human Resource Management Solution.</p>
                  </div>
               </div>

               {/* Modal Content - Right (Features List) */}
               <div className="w-full md:w-2/3 p-8 md:p-10 bg-white">
                  <h3 className="text-2xl font-bold text-slate-800 mb-6">Platform Features</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-2">
                             <Users size={20} />
                          </div>
                          <h4 className="font-bold text-slate-700">Employee Directory</h4>
                          <p className="text-xs text-slate-500">Centralized database for all employee records, roles, and department info.</p>
                      </div>
                      <div className="space-y-2">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-2">
                             <Clock size={20} />
                          </div>
                          <h4 className="font-bold text-slate-700">Smart Attendance</h4>
                          <p className="text-xs text-slate-500">Real-time check-in/out tracking with geolocation and status updates.</p>
                      </div>
                      <div className="space-y-2">
                          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-2">
                             <Sparkles size={20} />
                          </div>
                          <h4 className="font-bold text-slate-700">AI HR Assistant</h4>
                          <p className="text-xs text-slate-500">Powered by Gemini AI to answer policy questions and draft documents.</p>
                      </div>
                      <div className="space-y-2">
                          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center mb-2">
                             <FileText size={20} />
                          </div>
                          <h4 className="font-bold text-slate-700">Leave Management</h4>
                          <p className="text-xs text-slate-500">Streamlined leave requests, approvals, and balance tracking.</p>
                      </div>
                      <div className="space-y-2">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-2">
                             <ShieldCheck size={20} />
                          </div>
                          <h4 className="font-bold text-slate-700">Role-Based Access</h4>
                          <p className="text-xs text-slate-500">Secure access controls for Admins, HR Managers, and Employees.</p>
                      </div>
                      <div className="space-y-2">
                          <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center mb-2">
                             <Building2 size={20} />
                          </div>
                          <h4 className="font-bold text-slate-700">Organization Chart</h4>
                          <p className="text-xs text-slate-500">Visual hierarchy of departments and project allocations.</p>
                      </div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                      <button onClick={() => setShowFeaturesModal(false)} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition">Close</button>
                  </div>
               </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Login;
