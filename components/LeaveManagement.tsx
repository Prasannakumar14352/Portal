
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserRole, LeaveStatus, LeaveRequest, LeaveTypeConfig, User } from '../types';
import { 
  Upload, Paperclip, CheckSquare, Search, Edit2, Calendar as CalendarIcon, 
  List, Settings, Trash2, Plus, Calendar, CheckCircle, XCircle, Users, AlertTriangle, Flame, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, X, CheckCheck, PieChart, Layers, Filter
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';

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
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <div 
        className="w-full min-h-[42px] border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 flex flex-wrap items-center gap-2 cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500 bg-white dark:bg-slate-700"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedIds.length === 0 && <span className="text-slate-400 text-sm ml-1">Select colleagues...</span>}
        {selectedIds.map(id => {
          const user = options.find(u => u.id === id);
          return (
            <span key={id} className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1 border border-emerald-100 dark:border-emerald-900">
              {user?.name}
              <X size={12} className="hover:text-emerald-900 dark:hover:text-emerald-200 cursor-pointer" onClick={(e) => removeTag(e, id)} />
            </span>
          );
        })}
        <div className="ml-auto">
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
          {options.map(user => (
            <div 
              key={user.id} 
              onClick={() => handleSelect(user.id)}
              className="flex items-center px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              <div className={`w-4 h-4 border rounded mr-3 flex items-center justify-center ${selectedIds.includes(user.id) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-slate-500'}`}>
                {selectedIds.includes(user.id) && <CheckCircle size={12} className="text-white" />}
              </div>
              <img src={user.avatar} className="w-6 h-6 rounded-full mr-2" alt="" />
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-white">{user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user.jobTitle}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LeaveTypeCard: React.FC<{ 
  config: LeaveTypeConfig, 
  isHR: boolean, 
  onUpdate: (id: string, data: any) => void, 
  onDelete: (id: string) => void,
  onEdit: (id: string, data: any) => void
}> = ({ config, isHR, onUpdate, onDelete, onEdit }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow relative">
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center space-x-2">
        <div className={`p-2 rounded-lg ${config.color ? config.color.replace('text-', 'bg-').replace('600', '100') + ' dark:bg-opacity-20' : 'bg-slate-100 dark:bg-slate-700'}`}>
            <Calendar className={`w-5 h-5 ${config.color || 'text-slate-600 dark:text-slate-400'}`} />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-white text-lg">{config.name}</h3>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full ${config.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
        {config.isActive ? 'Active' : 'Inactive'}
      </span>
    </div>
    
    <div className="mb-4 mt-2">
      <h4 className={`text-2xl font-bold ${config.color || 'text-slate-800 dark:text-white'}`}>{config.days} Days</h4>
      <p className="text-xs text-slate-500 dark:text-slate-400">Default allocation per year</p>
    </div>
    
    <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 h-12 line-clamp-2">{config.description}</p>
    
    {isHR && (
      <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-700 pt-4">
          <div className="flex items-center space-x-2">
          <div className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${config.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} 
              onClick={() => onUpdate(config.id, { isActive: !config.isActive })}>
              <div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${config.isActive ? 'translate-x-5' : ''}`} />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">{config.isActive ? 'Active' : 'Hidden'}</span>
          </div>
          
          <div className="flex space-x-2">
          <button 
              onClick={() => onEdit(config.id, config)}
              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30 rounded"
          >
              <Edit2 size={16} />
          </button>
          <button 
              onClick={() => {
              if (window.confirm('Delete this leave type?')) onDelete(config.id);
              }}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded"
          >
              <Trash2 size={16} />
          </button>
          </div>
      </div>
    )}
  </div>
);

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
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [reviewComment, setReviewComment] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
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
    approverId: currentUser?.managerId || '',
    isUrgent: false
  });

  // Type Config Form State
  const [typeData, setTypeData] = useState<{
    name: string;
    days: number;
    description: string;
    isActive: boolean;
    color: string;
  }>({ name: '', days: 10, description: '', isActive: true, color: 'text-emerald-600' });

  // Predefined Colors for Leave Types
  const colorOptions = [
    'text-slate-600', 'text-red-600', 'text-orange-600', 'text-amber-600', 
    'text-green-600', 'text-emerald-600', 'text-teal-600', 'text-cyan-600',
    'text-blue-600', 'text-indigo-Indie', 'text-violet-600', 'text-purple-600', 
    'text-fuchsia-600', 'text-pink-600', 'text-rose-600'
  ];

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
      const directReports = users.filter(u => u.managerId === currentUser.id).map(u => u.id);
      
      const relevantLeaves = leaves.filter(l => 
        l.userId === currentUser.id || 
        l.approverId === currentUser.id || 
        (directReports.includes(l.userId) && (!l.approverId || l.approverId === currentUser.id)) 
      );
      
      filtered = relevantLeaves;
    } else {
      filtered = leaves.filter(l => l.userId === currentUser?.id);
    }
    return filtered;
  }, [leaves, currentUser, users]);

  const searchedLeaves = useMemo(() => {
    const lowerQ = searchQuery.toLowerCase();
    
    return visibleLeaves.filter(l => {
      const matchesSearch = l.userName.toLowerCase().includes(lowerQ) ||
                            l.type.toLowerCase().includes(lowerQ) ||
                            l.status.toLowerCase().includes(lowerQ);
      const matchesStatus = statusFilter === 'All' || 
                            (statusFilter === 'Pending' ? l.status.includes('Pending') : l.status === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [visibleLeaves, searchQuery, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(searchedLeaves.length / itemsPerPage);
  const paginatedLeaves = searchedLeaves.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const pendingApprovals = useMemo(() => {
    return visibleLeaves.filter(l => 
      (currentUser?.role === UserRole.MANAGER && l.status === LeaveStatus.PENDING_MANAGER && l.userId !== currentUser.id && l.approverId === currentUser.id) ||
      (currentUser?.role === UserRole.HR && l.status === LeaveStatus.PENDING_HR)
    );
  }, [visibleLeaves, currentUser]);

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
    if (leave.status !== LeaveStatus.PENDING_MANAGER) {
        showToast("You can only edit pending requests.", "error");
        return;
    }
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

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingType) updateLeaveType(editingType, typeData);
    else addLeaveType(typeData);
    setShowTypeModal(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    if (isEditing) editLeave(isEditing, payload);
    else addLeave(payload);
    setShowModal(false);
  };

  const StatusBadge = ({ status }: { status: LeaveStatus | string }) => {
    const styles: Record<string, string> = {
      [LeaveStatus.APPROVED]: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
      [LeaveStatus.REJECTED]: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
      [LeaveStatus.PENDING_MANAGER]: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
      [LeaveStatus.PENDING_HR]: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${styles[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Leave Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Manage time off and track balances.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto">
            {['requests', 'balances', 'types', 'calendar', 'team'].filter(m => m !== 'team' || isManager).map(m => (
                <button key={m} onClick={() => setViewMode(m as any)} className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition whitespace-nowrap capitalize ${viewMode === m ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}>{m}</button>
            ))}
          </div>
          <button onClick={handleOpenCreate} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center space-x-2 text-sm shadow-sm"><Plus size={18} /><span>New Request</span></button>
        </div>
      </div>

      {viewMode === 'requests' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase border-b">
                  <tr><th className="px-6 py-4">Employee</th><th className="px-6 py-4">Details</th><th className="px-6 py-4">Duration</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {paginatedLeaves.map(leave => (
                    <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">{leave.userName}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium dark:text-white">{leave.type}</div>
                        <div className="text-xs text-slate-400">{leave.startDate} to {leave.endDate}</div>
                      </td>
                      <td className="px-6 py-4 text-sm">{getDaysDiff(leave.startDate, leave.endDate)} Days</td>
                      <td className="px-6 py-4"><StatusBadge status={leave.status} /></td>
                      <td className="px-6 py-4 text-right">
                         {(currentUser?.id === leave.userId && leave.status.includes('Pending')) ? (
                             <button onClick={() => handleOpenEdit(leave)} className="text-emerald-600 hover:text-emerald-800"><Edit2 size={16}/></button>
                         ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {/* Request Modal */}
      <DraggableModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title={isEditing ? 'Edit Request' : 'New Leave Request'} 
        width="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Leave Type</label>
              <select className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-700 dark:text-white" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} required>
                <option value="" disabled>Select a type...</option>
                {leaveTypes.filter(t => t.isActive).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
              {formData.type && <p className="text-xs text-emerald-600 mt-1 font-medium">{getSelectedTypeBalance()}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From</label>
                <input required type="date" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To</label>
                <input required type="date" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason</label>
              <textarea required rows={2} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="Why are you taking leave?"></textarea>
            </div>
            <div className="flex items-center space-x-3 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">
               <input type="checkbox" checked={formData.isUrgent} onChange={(e) => setFormData({...formData, isUrgent: e.target.checked})} className="w-4 h-4 text-red-600 rounded border-slate-300" />
               <label className="text-sm font-medium text-red-800 dark:text-red-300">Mark as Urgent <Flame size={12} className="inline ml-1" fill="currentColor"/></label>
            </div>
            <MultiSelectUser label="Notify Colleagues" options={users.filter(u => u.id !== currentUser?.id)} selectedIds={formData.notifyUserIds} onChange={(ids) => setFormData({...formData, notifyUserIds: ids})} />
            <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 text-sm">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium shadow-sm">{isEditing ? 'Update Request' : 'Submit Request'}</button>
            </div>
        </form>
      </DraggableModal>

      {/* Leave Type Modal */}
      <DraggableModal isOpen={showTypeModal} onClose={() => setShowTypeModal(false)} title={editingType ? 'Edit Leave Type' : 'Add Leave Type'} width="max-w-md">
        <form onSubmit={handleTypeSubmit} className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type Name</label><input required type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm dark:bg-slate-700 dark:text-white" value={typeData.name} onChange={e => setTypeData({...typeData, name: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Days per Year</label><input required type="number" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm dark:bg-slate-700 dark:text-white" value={typeData.days} onChange={e => setTypeData({...typeData, days: parseInt(e.target.value)})} /></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label><textarea required rows={2} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm dark:bg-slate-700 dark:text-white" value={typeData.description} onChange={e => setTypeData({...typeData, description: e.target.value})} /></div>
            <div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={() => setShowTypeModal(false)} className="px-4 py-2 text-slate-500 text-sm">Cancel</button><button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">Save Type</button></div>
        </form>
      </DraggableModal>
    </div>
  );
};

export default LeaveManagement;
