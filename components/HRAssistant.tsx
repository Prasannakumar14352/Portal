
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { getHRChatResponse, resetChatSession } from '../services/geminiService';
import { ChatMessage } from '../types';
import { useAppContext } from '../contexts/AppContext';

const SUGGESTED_PROMPTS = [
  "What is my leave balance?",
  "Show me upcoming holidays",
  "Who is in the Engineering department?",
  "How many employees are active?",
  "My attendance history"
];

const HRAssistant: React.FC = () => {
  const { currentUser, employees, leaves, leaveTypes, holidays, attendance } = useAppContext();
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Hello ${currentUser?.name.split(' ')[0]}! I am your EmpowerCorp AI Assistant. I have full access to our organization's directory, leave policies, and holiday calendar. How can I help you today?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Clean up chat session on unmount
  useEffect(() => {
    return () => {
      resetChatSession();
    };
  }, []);

  const processMessage = async (text: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare the context object for Gemini
      const context = {
        currentUser,
        employees,
        leaves,
        leaveTypes,
        holidays,
        attendance
      };

      const responseText = await getHRChatResponse(userMessage.text, context);
      
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date(),
        isError: false
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      // Error handling modified to be user-friendly without console logging
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'Sorry, I encountered an issue. Please try again later.',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    await processMessage(input);
  };

  return (
    <div className="h-[calc(100dvh-8rem)] flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-teal-700 p-4 flex items-center justify-between text-white shadow-md">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <Sparkles size={20} className="text-teal-200" />
          </div>
          <div>
            <h2 className="font-bold text-lg">EC HR Intelligence</h2>
            <p className="text-teal-100 text-[10px] uppercase tracking-widest font-bold">Context Aware • Gemini 3</p>
          </div>
        </div>
        <button 
          onClick={() => {
            resetChatSession();
            setMessages([{
              id: Date.now().toString(),
              role: 'model',
              text: 'Conversation reset. Ask me anything about employees, leaves, or holidays.',
              timestamp: new Date()
            }]);
          }}
          className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/20 transition-all flex items-center gap-2"
        >
          <RefreshCw size={12} /> Reset
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-900/50 scrollbar-hide">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm
                ${msg.role === 'user' ? 'bg-teal-600' : msg.isError ? 'bg-red-500' : 'bg-slate-700 dark:bg-slate-600'}`}>
                {msg.role === 'user' ? <User size={18} className="text-white" /> : <Bot size={18} className="text-white" />}
              </div>
              
              <div className={`p-4 rounded-2xl shadow-sm border
                ${msg.role === 'user' 
                  ? 'bg-teal-600 text-white rounded-tr-none border-teal-500' 
                  : msg.isError
                    ? 'bg-red-50 border-red-200 text-red-700 rounded-tl-none dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-tl-none'}`}>
                
                {msg.isError && (
                    <div className="flex items-center space-x-2 mb-2 font-bold text-xs">
                        <AlertCircle size={14} />
                        <span>System Error</span>
                    </div>
                )}
                
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                </div>

                <div className={`flex items-center gap-1.5 mt-3 text-[10px] font-medium opacity-60 ${msg.role === 'user' ? 'text-teal-50' : 'text-slate-400'}`}>
                   <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                   {msg.role === 'model' && !msg.isError && (
                       <>
                        <span>•</span>
                        <span className="flex items-center gap-0.5"><Sparkles size={8}/> Verified Context</span>
                       </>
                   )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex flex-row items-center gap-3">
               <div className="w-9 h-9 rounded-xl bg-slate-700 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
                 <Bot size={18} className="text-white" />
               </div>
               <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                 <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                 <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                 <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                 <span className="text-xs text-slate-400 ml-2 font-medium">Analyzing records...</span>
               </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Area - Only show when conversation is short */}
      {!isLoading && messages.length < 4 && (
        <div className="px-4 pb-2 bg-slate-50 dark:bg-slate-900/50 flex gap-2 overflow-x-auto scrollbar-hide">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button 
                    key={idx} 
                    onClick={() => processMessage(prompt)}
                    className="flex-shrink-0 bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400 border border-teal-100 dark:border-slate-700 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                    {prompt}
                </button>
            ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <form onSubmit={handleSend} className="flex gap-3 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me about holidays, leaves, or colleagues..."
            className="flex-1 px-4 py-3.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all text-sm dark:text-white placeholder-slate-400"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="bg-teal-700 text-white p-3.5 rounded-xl hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-teal-500/20 flex items-center justify-center shrink-0"
          >
            <Send size={20} />
          </button>
        </form>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 justify-center text-center uppercase tracking-widest font-bold">
          <ShieldCheck size={12} className="shrink-0 text-teal-600" />
          <span>Real-time Secure Data Integration Active</span>
        </div>
      </div>
    </div>
  );
};

// Internal icon not exported from lucide
const ShieldCheck = ({size, className}: {size: number, className: string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
);

export default HRAssistant;
