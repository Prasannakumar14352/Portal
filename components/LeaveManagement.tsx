import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserRole, LeaveStatus, LeaveRequest, LeaveTypeConfig, User } from '../types';
import { 
  Upload, Paperclip, CheckSquare, Search, Edit2, Calendar as CalendarIcon, 
  List, Settings, Trash2, Plus, Calendar, CheckCircle, XCircle, Users, AlertTriangle, Flame, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, X, CheckCheck, PieChart, Layers
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

export interface LeaveManagementProps {
  currentUser: User;
  users: User[];
  leaves: LeaveRequest[];
  leaveTypes: LeaveTypeConfig[];
  addLeave: (leave: any) => void;
  editLeave: (id: string, data: any) => void;
  addLeaves: (leaves: any[]) => void;
  updateLeaveStatus: (id: string, status: LeaveStatus, comment?: string) => void;
  addLeaveType: (type: any) => void;
  updateLeaveType: (id: string, data: any) => void;
  deleteLeaveType: (id: string) => void;
}

// Custom MultiSelect Component
const MultiSelectUser = ({ 
  options, 
  selectedIds, 
  onChange, 
  label 
}: { 
  options: User[], 
  selectedIds: string[], 
  onChange: (ids: string[]) => void, 
  label: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(sid => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeTag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange(selectedIds.filter(sid => sid !== id));
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div 
        className="w-full min-h-[42px] border border-slate-300 rounded-lg px-2 py-1.5 flex flex-wrap items-center gap-2 cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500 bg-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedIds.length === 0 && <span className="text-slate-400 text-sm ml-1">Select colleagues...</span>}
        {selectedIds.map(id => {
          const user = options.find(u => u.id === id);
          return (
            <span key={id} className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1 border border-emerald-100">
              {user?.name}
              <X size={12} className="hover:text-emerald-900 cursor-pointer" onClick={(e) => removeTag(e, id)} />
            </span>
          );
        })}
        <div className="ml-auto">
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
          {options.map(user => (
            <div 
              key={user.id} 
              onClick={() => handleSelect(user.id)}
              className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer"
            >
              <div className={`w-4 h-4 border rounded mr-3 flex items-center justify-center ${selectedIds.includes(user.id) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                {selectedIds.includes(user.id) && <CheckCircle size={12} className="text-white" />}
              </div>
              <img src={user.avatar} className="w-6 h-6 rounded-full mr-2" alt="" />
              <div>
                <p className="text-sm font-medium text-slate-800">{user.name}</p>
                <p className="text-xs text-slate-500">{user.jobTitle}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LeaveManagement: React.FC<LeaveManagementProps> = ({ 
  currentUser, users, leaves, leaveTypes, 
  addLeave, editLeave, addLeaves, updateLeaveStatus,
  addLeaveType, updateLeaveType, deleteLeaveType 
}) => {
  const { showToast } = useAppContext();
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  const [editingType, setEditingType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'requests' | 'balances' | 'types' | 'calendar' | 'team'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  
  // Team View State
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Calendar View State
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedCalDate, setSelectedCalDate] = useState<Date | null>(null);

  // Request Form State
  const [formData, setFormData] = useState<{
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
    attachment?: boolean;
    consent?: boolean;
    notifyUserIds: string[];
    approverId: string;
    isUrgent: boolean;
  }>({ 
    type: '', 
    startDate: '', 
    endDate: '', 
    reason: '', 
    attachment: false, 
    consent: false,
    notifyUserIds: [],
    approverId: '',
    isUrgent: false
  });

  // Type Config Form State
  const [typeData, setTypeData] = useState<{
    name: string;
    days: number;
    description: string;
    isActive: boolean;
  }>({ name: '', days: 10, description: '', isActive: true });

  const isManager = currentUser?.role === UserRole.MANAGER || currentUser?.role === UserRole.HR;
  const isHR = currentUser?.role === UserRole.HR;

  // --- Helper Functions ---
  const getDaysDiff = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = e.getTime() - s.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 0;
  };

  const isDateInRange = (checkDate: Date, start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    s.setHours(0,0,0,0);
    e.setHours(0,0,0,0);
    const d = new Date(checkDate);
    d.setHours(0,0,0,0);
    return d >= s && d <= e;
  };

  // --- Filtering & Derived State ---
  const visibleLeaves = useMemo(() => {
    let filtered = [];
    if (currentUser?.role === UserRole.HR) {
      filtered = leaves;
    } else if (currentUser?.role === UserRole.MANAGER) {
      // Logic: Show leaves where I am the approver OR leaves of my direct reports
      // Also show my own leaves
      const directReports = users.filter(u => u.managerId === currentUser.id).map(u => u.id);
      
      const relevantLeaves = leaves.filter(l => 
        l.userId === currentUser.id || // My leaves
        l.approverId === currentUser.id || // Explicitly assigned to me
        (directReports.includes(l.userId) && (!l.approverId || l.approverId === currentUser.id)) // Direct report leaves (if not assigned to someone else)
      );
      
      filtered = relevantLeaves;
    } else {
      filtered = leaves.filter(l => l.userId === currentUser?.id);
    }
    return filtered;
  }, [leaves, currentUser, users]);

  const searchedLeaves = useMemo(() => {
    const lowerQ = searchQuery.toLowerCase();
    return visibleLeaves.filter(l => 
      l.userName.toLowerCase().includes(lowerQ) ||
      l.type.toLowerCase().includes(lowerQ) ||
      l.status.toLowerCase().includes(lowerQ)
    );
  }, [visibleLeaves, searchQuery]);

  // Pending Actions Logic
  const pendingApprovals = searchedLeaves.filter(l => 
    (currentUser?.role === UserRole.MANAGER && l.status === LeaveStatus.PENDING_MANAGER && l.userId !== currentUser.id) ||
    (currentUser?.role === UserRole.HR && l.status === LeaveStatus.PENDING_HR)
  );

  // Balance Calculation Logic (Generic per type)
  const getBalance = (typeName: string, limit: number, userId?: string) => {
    const targetId = userId || currentUser?.id;
    const used = leaves
      .filter(l => l.userId === targetId && l.type === typeName && l.status === LeaveStatus.APPROVED)
      .reduce((acc, l) => acc + getDaysDiff(l.startDate, l.endDate), 0);
    return Math.max(0, limit - used);
  };

  const getSelectedTypeBalance = () => {
    const t = leaveTypes.find(lt => lt.name === formData.type);
    if (!t) return null;
    return `${getBalance(t.name, t.days)}/${t.days} Days Available`;
  };

  // --- Handlers ---
  const handleOpenCreate = () => {
    setIsEditing(null);
    setFormData({ 
      type: leaveTypes.find(t => t.isActive)?.name || '', 
      startDate: '', endDate: '', reason: '', 
      attachment: false, consent: false, notifyUserIds: [], 
      approverId: currentUser?.managerId || '',
      isUrgent: false
    });
    setShowModal(true);
  };

  const handleOpenEdit = (leave: LeaveRequest) => {
    // Only allow editing if pending
    if (leave.status !== LeaveStatus.PENDING_MANAGER) {
        showToast("You can only edit pending requests.", "error");
        return;
    }
    proceedToEdit(leave);
  };

  const proceedToEdit = (leave: LeaveRequest) => {
    setIsEditing(leave.id);
    setFormData({
      type: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason,
      attachment: !!leave.attachmentUrl,
      consent: !!leave.managerConsent,
      notifyUserIds: leave.notifyUserIds || [],
      approverId: leave.approverId || currentUser?.managerId || '',
      isUrgent: leave.isUrgent || false
    });
    setShowModal(true);
  };

  const handleApproveAll = () => {
    if (confirm(`Are you sure you want to approve all ${pendingApprovals.length} pending requests?`)) {
      const nextStatus = currentUser?.role === UserRole.MANAGER ? LeaveStatus.PENDING_HR : LeaveStatus.APPROVED;
      pendingApprovals.forEach(l => {
        updateLeaveStatus(l.id, nextStatus, "Bulk Approved");
      });
      showToast(`Approved ${pendingApprovals.length} requests`, "success");
    }
  };

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingType) {
      updateLeaveType(editingType, typeData);
    } else {
      addLeaveType(typeData);
    }
    setShowTypeModal(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const duration = getDaysDiff(formData.startDate, formData.endDate);
    
    if (formData.type.includes('Sick') && duration > 2 && !formData.attachment && !isEditing) {
      showToast("A medical certificate is required for sick leave exceeding 2 days.", "error");
      return;
    }
    
    const payload = {
      type: formData.type,
      startDate: formData.startDate,
      endDate: formData.endDate,
      reason: formData.reason,
      attachmentUrl: formData.attachment ? 'mock_cert.pdf' : undefined,
      managerConsent: formData.consent,
      notifyUserIds: formData.notifyUserIds,
      approverId: formData.approverId,
      isUrgent: formData.isUrgent
    };

    if (isEditing) {
      editLeave(isEditing, payload);
    } else {
      addLeave(payload);
    }
    setShowModal(false);
  };

  // --- Sub-Components ---
  const StatusBadge = ({ status }: { status: LeaveStatus | string }) => {
    const styles: Record<string, string> = {
      [LeaveStatus.APPROVED]: 'bg-green-100 text-green-700 border-green-200',
      [LeaveStatus.REJECTED]: 'bg-red-100 text-red-700 border-red-200',
      [LeaveStatus.PENDING_MANAGER]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      [LeaveStatus.PENDING_HR]: 'bg-purple-100 text-purple-700 border-purple-200',
    };
    
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${styles[status] || 'bg-slate-100 text-slate-700'}`}>{status}</span>;
  };
  
  // --- Manager Calendar View Component ---
  const ManagerCalendar = () => {
    const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
    const firstDayOfWeek = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay();
    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), i));

    // Get relevant team leaves
    const teamLeaves = visibleLeaves.filter(l => l.userId !== currentUser?.id); 

    const getLeavesForDate = (date: Date) => {
        return teamLeaves.filter(l => isDateInRange(date, l.startDate, l.endDate));
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Team Calendar</h3>
                <div className="flex items-center gap-4">
                    <button onClick={() => setCalMonth(new Date(calMonth.setMonth(calMonth.getMonth() - 1)))} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={20} /></button>
                    <span className="font-semibold text-slate-700 w-32 text-center">{calMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={() => setCalMonth(new Date(calMonth.setMonth(calMonth.getMonth() + 1)))} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={20} /></button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center text-xs font-bold text-slate-400">{d}</div>)}
            </div>
            
            <div className="grid grid-cols-7 gap-2">
                {days.map((date, i) => {
                    if (!date) return <div key={i} className="h-24 bg-slate-50/50 rounded-lg"></div>;
                    const dateLeaves = getLeavesForDate(date);
                    const pendingCount = dateLeaves.filter(l => l.status.includes('Pending')).length;
                    const approvedCount = dateLeaves.filter(l => l.status === LeaveStatus.APPROVED).length;

                    return (
                        <div 
                            key={i} 
                            onClick={() => setSelectedCalDate(date)}
                            className={`h-24 border rounded-lg p-2 cursor-pointer transition hover:shadow-md relative ${
                                dateLeaves.length > 0 ? 'bg-white border-emerald-100' : 'bg-white border-slate-100'
                            }`}
                        >
                            <span className={`text-sm font-semibold ${date.getDate() === new Date().getDate() && date.getMonth() === new Date().getMonth() ? 'text-emerald-600' : 'text-slate-700'}`}>{date.getDate()}</span>
                            
                            <div className="flex gap-1 mt-2 flex-wrap">
                                {pendingCount > 0 && (
                                    <span className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5 py-0.5 rounded font-bold" title={`${pendingCount} Pending`}>
                                        {pendingCount} P
                                    </span>
                                )}
                                {approvedCount > 0 && (
                                    <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded font-bold" title={`${approvedCount} Approved`}>
                                        {approvedCount} A
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Date Details Modal */}
            {selectedCalDate && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedCalDate(null)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-4 text-slate-800">{selectedCalDate.toLocaleDateString()} Leaves</h3>
                        <div className="space-y-3">
                            {getLeavesForDate(selectedCalDate).length === 0 ? (
                                <p className="text-slate-500 text-sm">No leaves for this date.</p>
                            ) : (
                                getLeavesForDate(selectedCalDate).map(l => (
                                    <div key={l.id} className="border border-slate-100 p-3 rounded-lg bg-slate-50">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-slate-800">{l.userName}</span>
                                            <StatusBadge status={l.status} />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">{l.type}</p>
                                    </div>
                                ))
                            )}
                        </div>
                        <button onClick={() => setSelectedCalDate(null)} className="mt-4 w-full bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-200">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
  };

  const TeamView = () => {
    // Show direct reports
    const myTeam = users.filter(u => u.managerId === currentUser?.id);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
        {myTeam.map(member => {
           // Calculate balances for this user
           const memberLeaves = leaves.filter(l => l.userId === member.id);
           
           return (
             <div key={member.id} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
                <div className="flex items-center space-x-4 mb-4">
                  <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-full object-cover border border-slate-100" />
                  <div>
                    <h4 className="font-bold text-slate-800">{member.name}</h4>
                    <p className="text-xs text-slate-500">{member.jobTitle || 'Team Member'}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100 pb-1">Leave Balances</h5>
                  {leaveTypes.filter(t => t.isActive).slice(0, 3).map(type => {
                     const used = memberLeaves
                        .filter(l => l.type === type.name && l.status === LeaveStatus.APPROVED)
                        .reduce((acc, l) => acc + getDaysDiff(l.startDate, l.endDate), 0);
                     const balance = Math.max(0, type.days - used);
                     const percent = Math.min(100, Math.round((balance / type.days) * 100));
                     
                     return (
                       <div key={type.id}>
                         <div className="flex justify-between text-xs mb-1">
                           <span className="text-slate-600">{type.name}</span>
                           <span className="font-medium text-slate-800">{balance} / {type.days}</span>
                         </div>
                         <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                           <div className={`h-1.5 rounded-full transition-all duration-500 ${balance < 3 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }}></div>
                         </div>
                       </div>
                     );
                  })}
                </div>
                
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                   <button 
                     onClick={() => {
                        setSearchQuery(member.name);
                        setViewMode('requests');
                     }}
                     className="text-xs text-emerald-600 font-medium hover:underline flex items-center gap-1"
                   >
                     <List size={12} /> View History
                   </button>
                   {currentUser?.role === UserRole.HR && (
                      <span className="text-[10px] text-slate-400">HR View</span>
                   )}
                </div>
             </div>
           );
        })}
        {myTeam.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users size={32} className="text-slate-300" />
             </div>
             <p className="font-medium text-slate-600">No direct reports found.</p>
             <p className="text-xs text-slate-400 mt-1">Employees assigned to you will appear here.</p>
          </div>
        )}
      </div>
    );
  };

  const LeaveTypeCard = ({ config }: { config: LeaveTypeConfig }) => (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <Calendar className={`w-5 h-5 ${config.color || 'text-slate-600'}`} />
          <h3 className="font-bold text-slate-800 text-lg">{config.name}</h3>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${config.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {config.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      
      <div className="mb-4">
        <h4 className={`text-2xl font-bold ${config.color || 'text-slate-800'}`}>{config.days} Days</h4>
        <p className="text-xs text-slate-500">Default allocation per year</p>
      </div>
      
      <p className="text-sm text-slate-600 mb-6 h-12 line-clamp-2">{config.description}</p>
      
      {isHR && (
        <div className="flex justify-between items-center border-t border-slate-100 pt-4">
            <div className="flex items-center space-x-2">
            <div className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${config.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} 
                onClick={() => updateLeaveType(config.id, { isActive: !config.isActive })}>
                <div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${config.isActive ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-xs text-slate-500">{config.isActive ? 'Active' : 'Hidden'}</span>
            </div>
            
            <div className="flex space-x-2">
            <button 
                onClick={() => {
                setEditingType(config.id);
                setTypeData({ name: config.name, days: config.days, description: config.description, isActive: config.isActive });
                setShowTypeModal(true);
                }}
                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
            >
                <Edit2 size={16} />
            </button>
            <button 
                onClick={() => {
                if (window.confirm('Delete this leave type?')) deleteLeaveType(config.id);
                }}
                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
            >
                <Trash2 size={16} />
            </button>
            </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Leave Management
          </h2>
          <p className="text-slate-500 text-sm">Manage time off, check balances, and review policies.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          {viewMode !== 'types' && viewMode !== 'balances' && (
            <div className="relative flex-1 md:w-64">
               <input 
                 type="text" 
                 placeholder="Search leaves..." 
                 className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-full"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          )}

          {/* Toggle Views (Tabs) */}
          <div className="flex bg-slate-100 p-1 rounded-lg self-start">
            <button 
              onClick={() => setViewMode('requests')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition ${viewMode === 'requests' ? 'bg-white shadow text-emerald-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <List size={16} />
              <span className="hidden sm:inline">Requests</span>
            </button>
            <button 
              onClick={() => setViewMode('balances')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition ${viewMode === 'balances' ? 'bg-white shadow text-emerald-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <PieChart size={16} />
              <span className="hidden sm:inline">Balances</span>
            </button>
            <button 
              onClick={() => setViewMode('types')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition ${viewMode === 'types' ? 'bg-white shadow text-emerald-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Layers size={16} />
              <span className="hidden sm:inline">Types</span>
            </button>
            {isManager && (
              <>
                <button 
                  onClick={() => setViewMode('team')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition ${viewMode === 'team' ? 'bg-white shadow text-emerald-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Users size={16} />
                  <span className="hidden sm:inline">Team</span>
                </button>
                <button 
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition ${viewMode === 'calendar' ? 'bg-white shadow text-emerald-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <CalendarIcon size={16} />
                  <span className="hidden sm:inline">Calendar</span>
                </button>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 self-start">
            {viewMode === 'types' && isHR ? (
              <button 
                onClick={() => {
                  setEditingType(null);
                  setTypeData({ name: '', days: 12, description: '', isActive: true });
                  setShowTypeModal(true);
                }}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center space-x-2 text-sm whitespace-nowrap shadow-sm"
              >
                <Plus size={18} />
                <span>Add Type</span>
              </button>
            ) : (
              <>
                {isHR && viewMode === 'requests' && (
                  <div className="relative">
                     <input type="file" id="leaves-bulk-upload" className="hidden" onChange={(e) => {
                       if (e.target.files?.length) addLeaves([{ 
                          id: `l-bulk-${Date.now()}`, userId: 'u1', userName: 'Bulk User', 
                          type: 'Annual Leave', startDate: '2024-07-01', endDate: '2024-07-05', 
                          reason: 'Bulk', status: LeaveStatus.APPROVED, createdAt: new Date().toISOString() 
                       }]);
                     }} />
                     <label htmlFor="leaves-bulk-upload" className="cursor-pointer bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 flex items-center space-x-2 text-sm whitespace-nowrap shadow-sm">
                       <Upload size={16} />
                       <span>Bulk Upload</span>
                     </label>
                  </div>
                )}
                {currentUser?.role === UserRole.EMPLOYEE && viewMode !== 'types' && (
                  <button 
                    onClick={handleOpenCreate}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center space-x-2 text-sm whitespace-nowrap shadow-sm"
                  >
                    <Plus size={18} />
                    <span>New Request</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* VIEW: LEAVE TYPES (Tab) */}
      {viewMode === 'types' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {leaveTypes.filter(t => isHR || t.isActive).map(type => (
            <LeaveTypeCard key={type.id} config={type} />
          ))}
          {leaveTypes.filter(t => isHR || t.isActive).length === 0 && <p className="text-slate-500">No leave types available.</p>}
        </div>
      )}

      {/* VIEW: LEAVE BALANCES (Tab) */}
      {viewMode === 'balances' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
             {leaveTypes.filter(t => t.isActive).map(t => {
                const balance = getBalance(t.name, t.days);
                const percentage = Math.round((balance / t.days) * 100);
                const isLow = percentage < 20;
                
                return (
                  <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                       <span className={`text-sm font-bold px-3 py-1 rounded-full ${t.color ? t.color.replace('text-', 'bg-').replace('600', '100') + ' ' + t.color : 'bg-slate-100 text-slate-600'}`}>
                         {t.name}
                       </span>
                    </div>
                    <div className="flex items-baseline space-x-1 mb-2">
                      <span className={`text-4xl font-bold ${isLow ? 'text-amber-600' : 'text-slate-800'}`}>{balance}</span>
                      <span className="text-sm text-slate-500">/ {t.days} Days Left</span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-4">
                       <div 
                         className={`h-2 rounded-full transition-all duration-500 ${isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                         style={{ width: `${percentage}%` }}
                       ></div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{t.description}</p>
                  </div>
                );
              })}
          </div>
      )}

      {/* VIEW: REQUEST LIST (Tab) */}
      {viewMode === 'requests' && (
        <>
          {pendingApprovals.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                     <div className="w-2 h-2 rounded-full bg-orange-500 mr-2"></div> Requires Attention
                  </h3>
                  {pendingApprovals.length > 1 && (
                      <button 
                        onClick={handleApproveAll}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg transition"
                      >
                          <CheckCheck size={16} /> Approve All Pending
                      </button>
                  )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {pendingApprovals.map(leave => (
                  <div key={leave.id} className={`relative bg-orange-50 rounded-xl p-4 border border-orange-100 hover:shadow-md transition ${leave.isUrgent ? 'ring-2 ring-red-300' : ''}`}>
                    {leave.isUrgent && (
                        <div className="absolute top-0 right-0 bg-red-100 text-red-600 px-3 py-1 text-xs font-bold rounded-bl-lg rounded-tr-lg border-b border-l border-red-200 flex items-center gap-1">
                            <Flame size={12} fill="currentColor" /> URGENT
                        </div>
                    )}
                    <div className="flex justify-between items-start mb-2 mt-2">
                       <div>
                         <p className="font-bold text-slate-900">{leave.userName}</p>
                         <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">{leave.type}</span>
                       </div>
                       <div className="text-right">
                         <p className="text-xs text-slate-500">Duration</p>
                         <p className="font-semibold text-slate-800">{getDaysDiff(leave.startDate, leave.endDate)} Days</p>
                       </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4 bg-white/60 p-2 rounded">{leave.reason}</p>
                    
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         placeholder="Add comment..." 
                         className="flex-1 text-xs border border-orange-200 rounded px-2 py-1 focus:ring-1 focus:ring-orange-500 outline-none"
                         onChange={(e) => setReviewComment(e.target.value)}
                       />
                       {/* Manager approves to PENDING_HR, HR approves to APPROVED */}
                       <button onClick={() => updateLeaveStatus(leave.id, currentUser.role === UserRole.MANAGER ? LeaveStatus.PENDING_HR : LeaveStatus.APPROVED, reviewComment)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"><CheckCircle size={18}/></button>
                       <button onClick={() => {
                           const reason = prompt("Reason for rejection:");
                           if(reason) updateLeaveStatus(leave.id, LeaveStatus.REJECTED, reason);
                       }} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200"><XCircle size={18}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-medium">Employee</th>
                    <th className="px-6 py-4 font-medium">Leave Details</th>
                    <th className="px-6 py-4 font-medium">Duration</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {searchedLeaves.map(leave => (
                    <tr key={leave.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                           <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">
                             {leave.userName.charAt(0)}
                           </div>
                           <span className="font-medium text-slate-700">{leave.userName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{leave.type}</p>
                            {leave.isUrgent && (
                                <span title="Urgent Request" className="flex items-center">
                                    <Flame size={14} className="text-red-500" fill="currentColor" />
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500">{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {getDaysDiff(leave.startDate, leave.endDate)} Days
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={leave.status} /></td>
                      <td className="px-6 py-4">
                        {currentUser?.role === UserRole.EMPLOYEE && leave.status === LeaveStatus.PENDING_MANAGER ? (
                          <button onClick={() => handleOpenEdit(leave)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium flex items-center">
                            <Edit2 size={12} className="mr-1"/> Edit
                          </button>
                        ) : (
                          // Logic for List View Actions
                          ((currentUser?.role === UserRole.HR && leave.status === LeaveStatus.PENDING_HR) || 
                           (currentUser?.role === UserRole.MANAGER && leave.status === LeaveStatus.PENDING_MANAGER)) ? (
                            <div className="flex gap-2">
                                <button 
                                  onClick={() => updateLeaveStatus(leave.id, currentUser.role === UserRole.MANAGER ? LeaveStatus.PENDING_HR : LeaveStatus.APPROVED, "Approved from list")} 
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded transition" 
                                  title={currentUser.role === UserRole.MANAGER ? "Approve (Forward to HR)" : "Final Approve"}
                                >
                                  <CheckCircle size={18}/>
                                </button>
                                <button 
                                  onClick={() => {
                                      const reason = prompt("Reason for rejection:");
                                      if(reason) updateLeaveStatus(leave.id, LeaveStatus.REJECTED, reason);
                                  }} 
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition" 
                                  title="Reject"
                                >
                                  <XCircle size={18}/>
                                </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">{leave.managerComment || leave.hrComment || '-'}</span>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                  {searchedLeaves.length === 0 && (
                     <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">No records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW: CALENDAR */}
      {viewMode === 'calendar' && isManager && <ManagerCalendar />}

      {/* VIEW: TEAM */}
      {viewMode === 'team' && isManager && <TeamView />}

      {/* ... MODALS ... */}
      {/* (Modals code remains identical, just rendering logic wrapper) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-1">{isEditing ? 'Edit Request' : 'New Leave Request'}</h3>
            <p className="text-sm text-slate-500 mb-6">Fill in the details below for your leave application.</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Leave Type</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  required
                >
                  <option value="" disabled>Select a type...</option>
                  {leaveTypes.filter(t => t.isActive).map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
                {formData.type && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">{getSelectedTypeBalance()}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Approving Manager</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={formData.approverId}
                  onChange={e => setFormData({...formData, approverId: e.target.value})}
                  required
                >
                  <option value="" disabled>Select manager...</option>
                  {users.filter(u => u.role === UserRole.MANAGER || u.role === UserRole.HR).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
                  <input required type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
                  <input required type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </div>

              {/* Dynamic Warning for Sick Leave */}
              {formData.type.includes('Sick') && getDaysDiff(formData.startDate, formData.endDate) > 2 && (
                 <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start gap-3">
                    <Paperclip className="text-amber-600 mt-0.5" size={16}/>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">Medical Certificate Required</p>
                      <p className="text-xs text-amber-600 mt-1">Since this sick leave exceeds 2 days, please upload a certificate.</p>
                      <input type="file" className="mt-2 block w-full text-xs text-amber-700" onChange={(e) => setFormData({...formData, attachment: !!e.target.files?.length})} />
                    </div>
                 </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <textarea required rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="e.g. Annual family trip"></textarea>
              </div>

              {/* Urgent Flag */}
              <div className="flex items-center space-x-3 bg-red-50 p-3 rounded-lg border border-red-100">
                 <div className="flex items-center h-5">
                    <input 
                      id="urgent-flag" 
                      type="checkbox" 
                      checked={formData.isUrgent}
                      onChange={(e) => setFormData({...formData, isUrgent: e.target.checked})}
                      className="w-4 h-4 text-red-600 rounded focus:ring-red-500 border-slate-300" 
                    />
                 </div>
                 <div className="text-sm">
                    <label htmlFor="urgent-flag" className="font-medium text-red-800 flex items-center gap-1">Mark as Urgent <Flame size={12} fill="currentColor"/></label>
                    <p className="text-xs text-red-600">Flag this request for immediate attention by your manager.</p>
                 </div>
              </div>

              <MultiSelectUser 
                label="Notify Colleagues" 
                options={users.filter(u => u.id !== currentUser?.id)} 
                selectedIds={formData.notifyUserIds} 
                onChange={(ids) => setFormData({...formData, notifyUserIds: ids})} 
              />
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm shadow-emerald-200">{isEditing ? 'Update Request' : 'Submit Request'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HR: Manage Leave Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{editingType ? 'Edit Leave Type' : 'Add Leave Type'}</h3>
            <form onSubmit={handleTypeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type Name</label>
                <input required type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" value={typeData.name} onChange={e => setTypeData({...typeData, name: e.target.value})} placeholder="e.g. Sabbatical" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Default Days per Year</label>
                <input required type="number" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" value={typeData.days} onChange={e => setTypeData({...typeData, days: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                <textarea required rows={2} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" value={typeData.description} onChange={e => setTypeData({...typeData, description: e.target.value})} placeholder="Short description..."></textarea>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                 <input type="checkbox" id="isActive" checked={typeData.isActive} onChange={e => setTypeData({...typeData, isActive: e.target.checked})} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"/>
                 <label htmlFor="isActive" className="text-sm text-slate-700">Active (Visible to employees)</label>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowTypeModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm">{editingType ? 'Save Changes' : 'Create Type'}</button>
              </div>
            </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;