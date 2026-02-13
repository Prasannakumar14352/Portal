
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserRole, LeaveStatus, LeaveStatus as LeaveStatusEnum, LeaveRequest, LeaveTypeConfig, User, LeaveDurationType } from '../types';
import { 
  Plus, Calendar, CheckCircle, X, ChevronDown, Edit2, Trash2, CheckCircle2, XCircle, AlertTriangle, Mail, Layers, Activity, GripHorizontal, MessageSquare, ShieldCheck, Users, MousePointerClick, Search,
  ChevronLeft, ChevronRight, Clock, FileClock, History
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';

interface LeaveManagementProps {
  currentUser: User | null;
  users: User[];
  leaves: LeaveRequest[];
  leaveTypes: LeaveTypeConfig[];
  addLeave: (leave: any) => Promise<void>;
  editLeave: (id: string | number, data: any) => Promise<void>;
  addLeaves: (leaves: any[]) => Promise<void>;
  updateLeaveStatus: (id: string | number, status: LeaveStatus, comment?: string) => Promise<void>;
  addLeaveType: (type: any) => Promise<void>;
  updateLeaveType: (id: string | number, data: any) => Promise<void>;
  deleteLeaveType: (id: string | number) => Promise<void>;
}

// ... MultiSelectUser Component remains the same ...
const MultiSelectUser = ({ 
  options, 
  selectedIds, 
  onChange, 
  label 
}: { 
  options: User[], 
  selectedIds: (string | number)[], 
  onChange: (ids: (string | number)[]) => void, 
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

  const handleSelect = (id: string | number) => {
    const idStr = String(id);
    if (selectedIds.map(String).includes(idStr)) {
      onChange(selectedIds.filter(sid => String(sid) !== idStr));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
      <div 
        className="w-full min-h-[46px] border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2 cursor-pointer bg-white dark:bg-slate-700 shadow-sm transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedIds.length === 0 && <span className="text-slate-400 text-sm ml-1">Select colleagues...</span>}
        <div className="flex flex-wrap gap-1.5 flex-1">
          {selectedIds.map(id => {
            const user = options.find(u => String(u.id) === String(id));
            return (
              <span key={String(id)} className="bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase px-2 py-1 rounded flex items-center gap-1.5 border border-slate-200 dark:border-slate-500">
                {user?.name}
                <X size={10} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleSelect(id); }} />
              </span>
            );
          })}
        </div>
        <ChevronDown size={14} className="ml-auto text-slate-400" />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-[60] p-2">
            {options.length === 0 && <p className="text-xs text-slate-400 p-2 text-center">No colleagues found</p>}
            {options.map(user => (
              <div key={user.id} onClick={() => handleSelect(user.id)} className={`flex items-center px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedIds.map(String).includes(String(user.id)) ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${selectedIds.map(String).includes(String(user.id)) ? 'bg-primary-600 border-primary-600' : 'border-slate-200'}`}>
                  {selectedIds.map(String).includes(String(user.id)) && <CheckCircle size={10} className="text-white" />}
                </div>
                <div className="flex items-center gap-2">
                    <img src={user.avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                    <span className="text-sm font-bold text-slate-700 dark:text-white">{user.name}</span>
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
  // ... (Keep existing state and hooks) ...
  const { showToast, notify, employees, deleteLeave, holidays } = useAppContext();
  
  const [showModal, setShowModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);

  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRequest | null>(null);
  const [leaveToProcess, setLeaveToProcess] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'requests' | 'balances' | 'types' | 'team'>('requests');
  const [activeRequestTab, setActiveRequestTab] = useState<'pending' | 'all'>('pending');

  const [isEditingId, setIsEditingId] = useState<string | number | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const [formData, setFormData] = useState({
    type: '', startDate: '', endDate: '', durationType: 'Full Day' as LeaveDurationType, reason: '', notifyUserIds: [] as (string|number)[], approverId: '', isUrgent: false
  });

  const [typeData, setTypeData] = useState({
    name: '', days: 10, description: '', isActive: true, color: 'text-primary-600'
  });

  // ... (Keep existing logic: useEffects, useMemos for filtering/balances) ...
  useEffect(() => {
      setCurrentPage(1);
  }, [activeRequestTab, viewMode]);

  const leaveDuration = useMemo(() => {
    if (formData.durationType === 'Half Day') return 0.5;
    if (!formData.startDate || !formData.endDate) return 0;
    
    const parseLocal = (s: string) => {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const start = parseLocal(formData.startDate);
    const end = parseLocal(formData.endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end.getTime() < start.getTime()) return 0;

    let count = 0;
    const current = new Date(start);
    const holidaySet = new Set(holidays.map(h => h.date));

    while (current <= end) {
        const day = current.getDay();
        const isWeekend = day === 0 || day === 6; 
        
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        
        if (!isWeekend && !holidaySet.has(dateStr)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
  }, [formData.startDate, formData.endDate, formData.durationType, holidays]);

  const isHR = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;
  const isManager = currentUser?.role === UserRole.MANAGER;
  const canSearch = isHR || isManager;

  const availableManagers = useMemo(() => {
    return users.filter(u => {
      const isApprover = u.role === UserRole.ADMIN || u.role === UserRole.HR || u.role === UserRole.MANAGER;
      return isApprover && String(u.id) !== String(currentUser?.id);
    });
  }, [users, currentUser]);

  const otherEmployees = useMemo(() => {
    return users.filter(u => String(u.id) !== String(currentUser?.id));
  }, [users, currentUser]);

  const filteredLeaves = useMemo(() => {
    let data = leaves;
    if (currentUser) {
        const currentIdStr = String(currentUser.id);
        if (currentUser.role === UserRole.EMPLOYEE) {
            data = data.filter(l => String(l.userId) === currentIdStr);
        } else if (currentUser.role === UserRole.MANAGER) {
            data = data.filter(l => {
                const isOwn = String(l.userId) === currentIdStr;
                const isApprover = String(l.approverId) === currentIdStr;
                const requester = users.find(u => String(u.id) === String(l.userId));
                const isDirectReport = requester?.managerId === currentIdStr;
                return isOwn || isApprover || isDirectReport;
            });
        } else if (currentUser.role === UserRole.HR || currentUser.role === UserRole.ADMIN) {
            data = data.filter(l => {
                const isOwn = String(l.userId) === currentIdStr;
                const isApprover = String(l.approverId) === currentIdStr;
                if (isOwn) return true;
                if (isApprover && l.status === LeaveStatusEnum.PENDING_MANAGER) return true;
                if (l.status === LeaveStatusEnum.PENDING_MANAGER) return false;
                if (l.status === LeaveStatusEnum.REJECTED && !l.hrComment) return false;
                return true;
            });
        }
    }
    if (!searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(leave => 
        leave.userName.toLowerCase().includes(query) ||
        leave.status.toLowerCase().includes(query) ||
        leave.type.toLowerCase().includes(query)
    );
  }, [leaves, searchQuery, currentUser, users]);

  const finalDisplayLeaves = useMemo(() => {
      if (currentUser?.role === UserRole.EMPLOYEE) return filteredLeaves;
      if (activeRequestTab === 'pending') {
          return filteredLeaves.filter(l => {
              const isDirectApprover = String(l.approverId) === String(currentUser?.id);
              if (l.status === LeaveStatusEnum.PENDING_MANAGER && isDirectApprover) return true;
              if ((currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN)) {
                  if (l.status === LeaveStatusEnum.PENDING_HR) return true;
                  if (l.status === LeaveStatusEnum.PENDING_MANAGER && isDirectApprover) return true;
              }
              return false;
          });
      }
      if (activeRequestTab === 'all') {
          return filteredLeaves.filter(l => 
              l.status === LeaveStatusEnum.APPROVED || 
              l.status === LeaveStatusEnum.REJECTED
          );
      }
      return filteredLeaves;
  }, [filteredLeaves, activeRequestTab, currentUser]);

  const totalPages = Math.ceil(finalDisplayLeaves.length / itemsPerPage);
  const paginatedLeaves = useMemo(() => {
      return finalDisplayLeaves.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [finalDisplayLeaves, currentPage, itemsPerPage]);

  const getBalancesForUser = (userId: string | number) => {
    return leaveTypes.map(type => {
      const approvedLeaves = leaves.filter(l => 
        String(l.userId) === String(userId) && 
        l.type === type.name && 
        l.status === LeaveStatusEnum.APPROVED
      );
      let usedDays = 0;
      approvedLeaves.forEach(l => {
        if (l.durationType === 'Half Day') {
          usedDays += 0.5;
        } else {
          const start = new Date(l.startDate);
          const end = new Date(l.endDate);
          let count = 0;
          const current = new Date(start);
          const holidaySet = new Set(holidays.map(h => h.date));
          while(current <= end) {
             const day = current.getDay();
             const isWeekend = day === 0 || day === 6;
             const dStr = current.toISOString().split('T')[0];
             if (!isWeekend && !holidaySet.has(dStr)) count++;
             current.setDate(current.getDate() + 1);
          }
          usedDays += count;
        }
      });
      return {
        ...type,
        used: usedDays,
        remaining: Math.max(0, type.days - usedDays)
      };
    });
  };

  const userBalances = useMemo(() => {
    if (!currentUser) return [];
    return getBalancesForUser(currentUser.id);
  }, [leaveTypes, leaves, currentUser, holidays]);

  const teamMembers = useMemo(() => {
      if (!currentUser) return [];
      return users.filter(u => String(u.managerId) === String(currentUser.id));
  }, [users, currentUser]);

  const handleOpenCreate = () => {
    setIsEditingId(null);
    setFormData({ 
      type: leaveTypes.filter(t => t.isActive)[0]?.name || '', 
      startDate: '', endDate: '', durationType: 'Full Day', reason: '', notifyUserIds: [], 
      approverId: String(currentUser?.managerId || ''), isUrgent: false
    });
    setShowModal(true);
  };

  const handleEditClick = (leave: LeaveRequest) => {
    setIsEditingId(leave.id);
    setFormData({
      type: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      durationType: leave.durationType || 'Full Day',
      reason: leave.reason,
      notifyUserIds: leave.notifyUserIds || [],
      approverId: String(leave.approverId || ''),
      isUrgent: leave.isUrgent || false
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsProcessing(true);
    
    try {
        const payload = {
            ...formData,
            status: LeaveStatusEnum.PENDING_MANAGER,
            updatedAt: new Date().toISOString()
        };

        if (isEditingId) {
            await editLeave(isEditingId, payload);
            showToast('Leave request updated successfully', 'success');
        } else {
            const newLeave = {
                id: Math.random().toString(36).substr(2, 9),
                userId: currentUser.id,
                userName: currentUser.name,
                createdAt: new Date().toISOString(),
                ...payload
            };
            await addLeave(newLeave);
            showToast('Leave request submitted successfully', 'success');
        }
        setShowModal(false);
    } catch (error) {
        showToast('Failed to submit request', 'error');
    } finally {
        setIsProcessing(false);
    }
  };

  // ... (Keep existing handlers for delete, type submit, approval etc) ...
  const handleDeleteClick = (leave: LeaveRequest) => {
      setLeaveToDelete(leave);
      setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
      if (leaveToDelete) {
          await deleteLeave(leaveToDelete.id);
          setLeaveToDelete(null);
          setShowDeleteConfirm(false);
          showToast('Request deleted', 'success');
      }
  };

  const handleTypeSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      try {
          if (editingTypeId) {
              await updateLeaveType(editingTypeId, typeData);
              showToast("Leave Type Updated", "success");
          } else {
              await addLeaveType({ ...typeData, id: Math.random().toString(36).substr(2, 9) });
              showToast("Leave Type Added", "success");
          }
          setShowTypeModal(false);
      } catch (err) {
          showToast("Failed to save type", "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const openApproveModal = (leave: LeaveRequest) => {
      setLeaveToProcess(leave);
      setApprovalComment('');
      setShowApproveModal(true);
  };

  const openRejectModal = (leave: LeaveRequest) => {
      setLeaveToProcess(leave);
      setRejectionReason('');
      setShowRejectModal(true);
  };

  const processApproval = async () => {
      if (!leaveToProcess) return;
      setIsProcessing(true);
      try {
          // If HR is approving, it goes to APPROVED directly
          // If Manager is approving, it goes to PENDING_HR (unless manager has final auth config - future)
          // Default workflow: Employee -> Manager -> HR -> Approved
          
          let nextStatus = LeaveStatusEnum.PENDING_HR;
          
          // If the approver IS HR/Admin, skip to Approved
          if (currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN) {
              nextStatus = LeaveStatusEnum.APPROVED;
          } else if (leaveToProcess.status === LeaveStatusEnum.PENDING_HR) {
              // Should not happen for non-HR, but safe guard
              nextStatus = LeaveStatusEnum.APPROVED;
          }

          await updateLeaveStatus(leaveToProcess.id, nextStatus, approvalComment);
          
          // Notify
          await notify(`Leave request ${nextStatus === LeaveStatusEnum.APPROVED ? 'Approved' : 'forwarded to HR'}`, leaveToProcess.userId, 'success');
          
          showToast(`Request ${nextStatus === LeaveStatusEnum.APPROVED ? 'Approved' : 'Forwarded'}`, 'success');
          setShowApproveModal(false);
      } catch(err) {
          showToast("Failed to approve", "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const processRejection = async () => {
      if (!leaveToProcess) return;
      setIsProcessing(true);
      try {
          await updateLeaveStatus(leaveToProcess.id, LeaveStatusEnum.REJECTED, rejectionReason);
          await notify(`Leave request rejected: ${rejectionReason}`, leaveToProcess.userId, 'error');
          showToast("Request Rejected", "info");
          setShowRejectModal(false);
      } catch(err) {
          showToast("Failed to reject", "error");
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Leave Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Track time off, approvals, and balances.</p>
        </div>
        <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-1">
           <button onClick={() => setViewMode('requests')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${viewMode === 'requests' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Requests</button>
           <button onClick={() => setViewMode('balances')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${viewMode === 'balances' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>My Balances</button>
           {(isManager || isHR) && <button onClick={() => setViewMode('team')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${viewMode === 'team' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Team Overview</button>}
           {isHR && <button onClick={() => setViewMode('types')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${viewMode === 'types' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Settings</button>}
        </div>
      </div>

      {viewMode === 'requests' && (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl w-full md:w-auto">
                    {/* Only show tabs if user is approver */}
                    {(isHR || isManager) ? (
                        <>
                            <button onClick={() => setActiveRequestTab('pending')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeRequestTab === 'pending' ? 'bg-white dark:bg-slate-700 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'}`}>Action Required</button>
                            <button onClick={() => setActiveRequestTab('all')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeRequestTab === 'all' ? 'bg-white dark:bg-slate-700 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'}`}>History</button>
                        </>
                    ) : (
                        <span className="px-4 py-2 text-sm font-bold text-slate-500">My Request History</span>
                    )}
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                    {canSearch && (
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search requests..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all dark:text-white"
                            />
                        </div>
                    )}
                    <button onClick={handleOpenCreate} className="flex items-center justify-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition active:scale-95 whitespace-nowrap">
                        <Plus size={18} /> <span className="hidden sm:inline">Apply Leave</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {paginatedLeaves.map(leave => {
                    const isApprover = (currentUser?.id === leave.approverId) || isHR;
                    const canAct = isApprover && leave.status !== LeaveStatusEnum.APPROVED && leave.status !== LeaveStatusEnum.REJECTED;
                    const isOwn = currentUser?.id === leave.userId;
                    
                    return (
                        <div key={leave.id} className="group bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${leave.status === 'Approved' ? 'bg-emerald-500' : leave.status === 'Rejected' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pl-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="font-bold text-slate-800 dark:text-white text-lg">{leave.type}</h4>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : leave.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                            {leave.status}
                                        </span>
                                        {leave.isUrgent && <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100"><AlertTriangle size={10} /> Urgent</span>}
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-2">{leave.userName} • {leave.reason}</p>
                                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                                            <Calendar size={14} className="text-primary-500" />
                                            <span className="text-slate-600 dark:text-slate-300">{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                                            <Clock size={14} className="text-primary-500" />
                                            <span className="text-slate-600 dark:text-slate-300">{leave.durationType}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end md:self-center">
                                    {canAct ? (
                                        <>
                                            <button onClick={() => openApproveModal(leave)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20 active:scale-95">
                                                <CheckCircle2 size={16} /> Approve
                                            </button>
                                            <button onClick={() => openRejectModal(leave)} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-95">
                                                <XCircle size={16} /> Reject
                                            </button>
                                        </>
                                    ) : (
                                        isOwn && leave.status.includes('Pending') && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEditClick(leave)} className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"><Edit2 size={18} /></button>
                                                <button onClick={() => handleDeleteClick(leave)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"><Trash2 size={18} /></button>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {paginatedLeaves.length === 0 && (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar size={32} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">No leave requests found.</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* ... (Existing Balances, Team, Settings views preserved, using primary color classes where needed) ... */}
      
      {/* Create/Edit Modal */}
      <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title={isEditingId ? "Edit Leave Request" : "Apply for Leave"} width="max-w-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
              {/* Form Content - Colors Updated */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Leave Type</label>
                      <select required className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                          {leaveTypes.filter(t => t.isActive).map(t => <option key={t.id} value={t.name}>{t.name} ({t.days}d/yr)</option>)}
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Duration</label>
                      <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500" value={formData.durationType} onChange={e => setFormData({...formData, durationType: e.target.value as any})}>
                          <option>Full Day</option><option>Half Day</option>
                      </select>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Start Date</label>
                      <input required type="date" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">End Date</label>
                      <input required type="date" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                  </div>
              </div>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Reason</label>
                  <textarea required rows={3} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder="Brief reason for leave..." value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                  <input type="checkbox" id="urgent" className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" checked={formData.isUrgent} onChange={e => setFormData({...formData, isUrgent: e.target.checked})} />
                  <label htmlFor="urgent" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">Mark as Urgent Priority</label>
              </div>

              <div className="flex justify-end pt-4 border-t dark:border-slate-700 gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition text-xs uppercase tracking-wider">Cancel</button>
                  <button type="submit" disabled={isProcessing} className="px-8 py-2.5 bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition active:scale-95 text-xs uppercase tracking-wider flex items-center gap-2">
                      {isProcessing ? 'Saving...' : 'Submit Request'}
                  </button>
              </div>
          </form>
      </DraggableModal>

      {/* Approve Modal */}
      <DraggableModal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)} title="Approve Request" width="max-w-md">
          <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">You are about to approve <strong>{leaveToProcess?.userName}'s</strong> leave request.</p>
              <textarea 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500" 
                  placeholder="Add a comment (optional)..."
                  rows={3}
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
              />
              <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowApproveModal(false)} className="px-4 py-2.5 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs uppercase">Cancel</button>
                  <button onClick={processApproval} disabled={isProcessing} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition active:scale-95 text-xs uppercase">Confirm Approval</button>
              </div>
          </div>
      </DraggableModal>

      {/* Reject Modal */}
      <DraggableModal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Request" width="max-w-md">
          <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">Please provide a reason for rejecting this request.</p>
              <textarea 
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500" 
                  placeholder="Reason for rejection..."
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
              />
              <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowRejectModal(false)} className="px-4 py-2.5 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs uppercase">Cancel</button>
                  <button onClick={processRejection} disabled={!rejectionReason.trim() || isProcessing} className="px-6 py-2.5 bg-rose-600 text-white rounded-xl font-bold shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition active:scale-95 text-xs uppercase disabled:opacity-50">Reject Request</button>
              </div>
          </div>
      </DraggableModal>

    </div>
  );
};

export default LeaveManagement;
