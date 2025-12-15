
import React, { useState } from 'react';
import { User } from '../types';
import { Lock, Mail, ChevronRight, Loader2, ArrowLeft, LayoutGrid } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { login, loginWithMicrosoft, forgotPassword } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'login' | 'forgot'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Add a small delay to simulate network request
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const success = await login(email, password);
    if (success) {
       // Success handled by context
    }
    setIsLoading(false);
  };

  const handleMicrosoftLogin = async () => {
      setIsLoading(true);
      await loginWithMicrosoft();
      setIsLoading(false);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      await forgotPassword(email);
      setIsLoading(false);
      setView('login');
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 p-8 text-center relative">
           {view === 'forgot' && (
               <button onClick={() => setView('login')} className="absolute left-4 top-4 text-white/80 hover:text-white">
                   <ArrowLeft size={24} />
               </button>
           )}
           <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Lock className="text-white" size={32} />
           </div>
           <h1 className="text-2xl font-bold text-white">EMP Portal</h1>
           <p className="text-blue-100 text-sm mt-1">{view === 'login' ? 'Secure Employee Access' : 'Reset Your Password'}</p>
        </div>

        {/* Form */}
        <div className="p-8">
           {view === 'login' ? (
               <div className="space-y-6">
                   <form onSubmit={handleSubmit} className="space-y-5">
                      <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                         <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                              type="email" 
                              required
                              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              placeholder="name@company.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                            />
                         </div>
                      </div>

                      <div>
                         <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-700">Password</label>
                            <button type="button" onClick={() => setView('forgot')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Forgot Password?</button>
                         </div>
                         <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                              type="password" 
                              required
                              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                            />
                         </div>
                      </div>

                      <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-blue-500/30 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                Sign In <ChevronRight size={18} className="ml-2" />
                            </>
                        )}
                      </button>
                   </form>

                   <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-400 text-xs">OR</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                   </div>

                   <button 
                        type="button"
                        onClick={handleMicrosoftLogin}
                        disabled={isLoading}
                        className="w-full bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-lg border border-slate-300 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-70"
                   >
                        {/* Microsoft SVG Icon */}
                        <svg width="20" height="20" viewBox="0 0 23 23">
                            <path fill="#f35325" d="M1 1h10v10H1z"/>
                            <path fill="#81bc06" d="M12 1h10v10H12z"/>
                            <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                            <path fill="#ffba08" d="M12 12h10v10H12z"/>
                        </svg>
                        Sign in with Microsoft
                   </button>
               </div>
           ) : (
               <form onSubmit={handleForgotSubmit} className="space-y-6">
                  <p className="text-sm text-slate-500">Enter your email address and we'll send you a link to reset your password.</p>
                  <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                     <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="email" 
                          required
                          className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="name@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                     </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-blue-500/30 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Send Reset Link"}
                  </button>
               </form>
           )}

           <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-xs text-center text-slate-400 mb-3 uppercase font-bold tracking-wider">Demo Credentials</p>
              <div className="flex gap-3 justify-center">
                 <button onClick={() => fillDemoCreds('admin')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded transition">
                    Fill Admin
                 </button>
                 <button onClick={() => fillDemoCreds('employee')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded transition">
                    Fill Employee
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
