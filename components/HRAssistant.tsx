import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle, XCircle } from 'lucide-react';
import { getHRChatResponse, resetChatSession } from '../services/geminiService';
import { ChatMessage } from '../types';

const HRAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hello! I am your AI HR Assistant for EmpowerCorp. I can help you draft policies, write job descriptions, or answer general HR queries. How can I help you today?',
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
  }, [messages]);

  // Clean up chat session on unmount
  useEffect(() => {
    return () => {
      resetChatSession();
    };
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const responseText = await getHRChatResponse(userMessage.text);
    
    // Check if the response suggests an error based on the service's default error string
    const isError = responseText.includes("Sorry, I encountered an error") || responseText.includes("apologize");

    const botMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText,
      timestamp: new Date(),
      isError: isError
    };

    setMessages(prev => [...prev, botMessage]);
    setIsLoading(false);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between text-white">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <Sparkles size={20} className="text-yellow-300" />
          </div>
          <div>
            <h2 className="font-bold text-lg">AI HR Assistant</h2>
            <p className="text-blue-100 text-xs">Powered by Gemini 2.5 Flash</p>
          </div>
        </div>
        <button 
          onClick={() => {
            resetChatSession();
            setMessages([{
              id: Date.now().toString(),
              role: 'model',
              text: 'Conversation reset. How can I help you now?',
              timestamp: new Date()
            }]);
          }}
          className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded transition-colors"
        >
          Reset Chat
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 
                ${msg.role === 'user' ? 'bg-blue-600' : msg.isError ? 'bg-red-500' : 'bg-indigo-600'}`}>
                {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
              </div>
              
              <div className={`p-4 rounded-2xl shadow-sm 
                ${msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : msg.isError
                    ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-none'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}`}>
                
                {msg.isError && (
                    <div className="flex items-center space-x-2 mb-2 font-semibold">
                        <XCircle size={16} />
                        <span>Error Processing Request</span>
                    </div>
                )}
                
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                <span className={`text-[10px] mt-2 block opacity-70 ${msg.role === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex flex-row items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                 <Bot size={16} className="text-white" />
               </div>
               <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-2">
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
               </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about leave policies, draft an email, or generate a job description..."
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center"
          >
            <Send size={20} />
          </button>
        </form>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400 justify-center">
          <AlertCircle size={12} />
          <span>AI can make mistakes. Please verify important HR information.</span>
        </div>
      </div>
    </div>
  );
};

export default HRAssistant;