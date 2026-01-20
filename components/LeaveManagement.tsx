import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserRole, LeaveStatus, LeaveStatus as LeaveStatusEnum, LeaveRequest, LeaveTypeConfig, User, LeaveDurationType } from '../types';
import { 
  Plus, Calendar, CheckCircle, X, ChevronDown, Edit2, Trash2, CheckCircle2, XCircle, AlertTriangle, Mail, Layers, Activity, GripHorizontal, MessageSquare, ShieldCheck, Users, MousePointerClick
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
              <div key={user.id} onClick={() => handleSelect(user.id)} className={`flex items-center px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedIds.map(String).includes(String(user.id)) ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}>
                <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${selectedIds.map(String).includes(String(user.id)) ? 'bg-teal-600 border-teal-600' : 'border-slate-200'}`}>
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
  const { showToast, notify, employees, deleteLeave, sendLeaveStatusEmail } = useAppContext();
  
  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);

  // Active data state
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRequest | null>(null);
  const [leaveToProcess, setLeaveToProcess] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'requests' | 'balances' | 'types' | 'team'>('requests');
  const [isEditingId, setIsEditingId] = useState<string | number | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | number | null>(null);

  const [formData, setFormData] = useState({
    type: '', startDate: '', endDate: '', durationType: 'Full Day' as LeaveDurationType, reason: '', notifyUserIds: [] as (string|number)[], approverId: '', isUrgent: false
  });

  const [typeData, setTypeData] = useState({
    name: '', days: 10, description: '', isActive: true, color: 'text-teal-600'
  });

  const isHR = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;

  const availableManagers = useMemo(() => {
    return users.filter(u => {
      const isApprover = u.role === UserRole.ADMIN || u.role === UserRole.HR || u.role === UserRole.MANAGER;
      return isApprover && String(u.id) !== String(currentUser?.id);
    });
  }, [users, currentUser]);

  const otherEmployees = useMemo(() => {
    return users.filter(u => String(u.id) !== String(currentUser?.id));
  }, [users, currentUser]);

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
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          usedDays += diffDays;
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
  }, [leaveTypes, leaves, currentUser]);

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
      isUrgent: !!leave.isUrgent
    });
    setShowModal(true);
  };

  const handleTypeClick = (type: LeaveTypeConfig) => {
      if (!type.isActive) {
          showToast("This leave category is currently inactive.", "warning");
          return;
      }
      setIsEditingId(null);
      setFormData({ 
        type: type.name, 
        startDate: '', endDate: '', durationType: 'Full Day', reason: '', notifyUserIds: [], 
        approverId: String(currentUser?.managerId || ''), isUrgent: false
      });
      setShowModal(true);
  };

  const handleAddType = () => {
    setEditingTypeId(null);
    setTypeData({ name: '', days: 10, description: '', isActive: true, color: 'text-teal-600' });
    setShowTypeModal(true);
  };

  const handleEditType = (type: LeaveTypeConfig) => {
    setEditingTypeId(type.id);
    setTypeData({
      name: type.name,
      days: type.days,
      description: type.description || '',
      isActive: type.isActive,
      color: type.color || 'text-teal-600'
    });
    setShowTypeModal(true);
  };

  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingTypeId) {
        await updateLeaveType(editingTypeId, typeData);
        showToast("Leave type updated.", "success");
      } else {
        await addLeaveType({ ...typeData, id: Math.random().toString(36).substr(2, 9) });
        showToast("Leave type created.", "success");
      }
      setShowTypeModal(false);
    } catch (err) {
      showToast("Error processing leave type", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTrigger = (leave: LeaveRequest) => {
    setLeaveToDelete(leave);
    setShowDeleteConfirm(true);
  };

  const handleWithdrawal = async () => {
    if (!leaveToDelete) return;
    setIsProcessing(true);
    try {
      await deleteLeave(leaveToDelete.id);
      showToast("Leave request withdrawn.", "info");
    } catch (err) {
      showToast("Error withdrawing request", "error");
    } finally {
      setIsProcessing(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const finalData = { ...formData, endDate: formData.durationType === 'Half Day' ? formData.startDate : formData.endDate };
      if (isEditingId) await editLeave(isEditingId, finalData);
      else await addLeave(finalData);

      const manager = employees.find(emp => String(emp.id) === String(formData.approverId));
      if (manager) {
          await notify(`${currentUser?.name} submitted a ${formData.type} request for approval.`, manager.id);
      }
      
      if (formData.notifyUserIds.length > 0) {
        formData.notifyUserIds.forEach(async (uid) => {
           await notify(`${currentUser?.name} tagged you in a ${formData.type} request.`, uid);
        });
      }

      setShowModal(false);
      showToast(isEditingId ? "Updated." : "Submitted.", "success");
    } catch (err) {
      showToast("Error processing request", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusUpdate = async (leave: LeaveRequest, newStatus: LeaveStatusEnum, comment: string = '') => {
      setIsProcessing(true);
      try {
        await updateLeaveStatus(leave.id, newStatus, comment);
        
        const employee = employees.find(emp => String(emp.id) === String(leave.userId));
        
        // Logical Workflow: Notify HR if Manager just approved to second level
        if (newStatus === LeaveStatusEnum.PENDING_HR) {
            const hrManagers = users.filter(u => u.role === UserRole.HR || u.role === UserRole.ADMIN);
            hrManagers.forEach(hr => notify(`Manager approved ${leave.userName}'s leave. Final action required.`, hr.id));
        } else if (employee) {
            // Standard notification for final statuses
            await notify(`Your leave status for ${leave.type} is now: ${newStatus}`, employee.id);
            if (employee.email) {
                await sendLeaveStatusEmail({
                    to: employee.email,
                    employeeName: leave.userName,
                    status: newStatus,
                    type: leave.type,
                    managerComment: comment
                });
            }
        }

        showToast(`Status updated to ${newStatus}`, "success");
        setShowRejectModal(false);
        setShowApproveModal(false);
        setRejectionReason('');
        setApprovalComment('');
      } catch (err) {
        showToast("Failed to update status", "error");
      } finally {
        setIsProcessing(false);
      }
  };

  const openRejectDialog = (leave: LeaveRequest) => {
    setLeaveToProcess(leave);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const openApproveDialog = (leave: LeaveRequest) => {
      setLeaveToProcess(leave);
      setApprovalComment('');
      setShowApproveModal(true);
  };

  const handleApproveConfirm = async () => {
    if (!leaveToProcess || !currentUser) return;
    
    let nextStatus: LeaveStatusEnum = LeaveStatusEnum.APPROVED;
    
    // Sequential Flow Logic
    if (leaveToProcess.status === LeaveStatusEnum.PENDING_MANAGER) {
        // If HR is the approver, they approve DIRECTLY.
        if (currentUser.role === UserRole.HR || currentUser.role === UserRole.ADMIN) {
            nextStatus = LeaveStatusEnum.APPROVED;
        } else {
            // Only standard managers move the request to HR verification
            nextStatus = LeaveStatusEnum.PENDING_HR;
        }
    } else if (leaveToProcess.status === LeaveStatusEnum.PENDING_HR) {
        // HR approving at the second level
        nextStatus = LeaveStatusEnum.APPROVED;
    }

    await handleStatusUpdate(leaveToProcess, nextStatus, approvalComment);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      [LeaveStatusEnum.APPROVED]: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      [LeaveStatusEnum.REJECTED]: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      [LeaveStatusEnum.PENDING_MANAGER]: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      [LeaveStatusEnum.PENDING_HR]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styles[status] || 'bg-slate-100'}`}>{status}</span>;
  };

  return (
    <div className="space-y-6 relative">
      {isProcessing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 max-w-sm text-center border border-slate-200 dark:border-slate-700">
              <div className="relative">
                 <div className="w-16 h-16 border-4 border-teal-600/20 border-t-teal-600 rounded-full animate-spin"></div>
                 <Mail size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-teal-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Syncing Records...</h3>
           </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Leave Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Approvals and tracking based on system roles.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {['requests', 'balances', 'types', ...(teamMembers.length > 0 || isHR ? ['team'] : [])].map(tab => (
                <button key={tab} onClick={() => setViewMode(tab as any)} className={`px-4 py-1.5 rounded-md text-sm transition capitalize ${viewMode === tab ? 'bg-white dark:bg-slate-700 shadow text-teal-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>
                  {tab}
                </button>
            ))}
          </div>
          {viewMode === 'types' && isHR ? (
             <button onClick={handleAddType} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center space-x-2 text-sm font-bold shadow-lg shadow-blue-500/20"><Plus size={18} /><span>Add Leave Type</span></button>
          ) : (
            <button onClick={handleOpenCreate} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-bold shadow-lg shadow-teal-500/20"><Plus size={18} /><span>Apply Leave</span></button>
          )}
        </div>
      </div>

      {viewMode === 'requests' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b">
                  <tr><th className="px-6 py-4">Employee</th><th className="px-6 py-4">Category</th><th className="px-6 py-4">Period</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {leaves.map(leave => {
                      // Robust ID comparison using trim and toString to avoid numeric/string mismatches
                      const currentUserIdStr = String(currentUser?.id || '').trim();
                      const leaveUserIdStr = String(leave.userId || '').trim();
                      const leaveApproverIdStr = String(leave.approverId || '').trim();

                      const isDesignatedApprover = leaveApproverIdStr === currentUserIdStr;
                      const isOwnRequest = leaveUserIdStr === currentUserIdStr;
                      
                      // Sequential Visibility Logic:
                      // 1. Manager level: Show if user is the assigned approver for this request
                      const isPendingManagerLevel = leave.status === LeaveStatusEnum.PENDING_MANAGER;
                      const canManagerAction = isDesignatedApprover && isPendingManagerLevel;
                      
                      // 2. HR level: Show if user has HR/Admin role AND manager has already approved
                      const isPendingHRLevel = leave.status === LeaveStatusEnum.PENDING_HR;
                      const canHRAction = isHR && isPendingHRLevel;

                      // Final Permission check
                      const canApprove = (canManagerAction || canHRAction) && !isOwnRequest;
                      const canEditDelete = isOwnRequest && isPendingManagerLevel;

                      return (
                        <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-sm">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-700 dark:text-slate-200">{leave.userName}</span>
                                {isOwnRequest && <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">My Req</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-teal-600 dark:text-teal-400 text-xs uppercase">
                            {leave.type}
                            {leave.durationType === 'Half Day' && <span className="ml-2 bg-amber-100 text-amber-700 text-[8px] px-1.5 py-0.5 rounded uppercase">Half Day</span>}
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{leave.startDate} {leave.durationType !== 'Half Day' ? `to ${leave.endDate}` : ''}</td>
                          <td className="px-6 py-4"><StatusBadge status={leave.status} /></td>
                          <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                  {canApprove && (
                                      <>
                                          <button onClick={() => openApproveDialog(leave)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors" title="Approve"><CheckCircle2 size={16}/></button>
                                          <button onClick={() => openRejectDialog(leave)} className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors" title="Reject"><XCircle size={16}/></button>
                                      </>
                                  )}
                                  {canEditDelete && (
                                      <>
                                          <button onClick={() => handleEditClick(leave)} className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 hover:bg-blue-100"><Edit2 size={16}/></button>
                                          <button onClick={() => handleDeleteTrigger(leave)} className="p-2 bg-slate-50 text-slate-400 hover:text-red-600 rounded-lg border border-slate-100 hover:bg-slate-100"><Trash2 size={16}/></button>
                                      </>
                                  )}
                              </div>
                          </td>
                        </tr>
                      );
                  })}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {viewMode === 'types' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leaveTypes.map(type => (
            <div 
                key={type.id} 
                onClick={() => handleTypeClick(type)}
                className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col hover:shadow-md transition-all group cursor-pointer hover:border-teal-500/30 ${!type.isActive ? 'opacity-70' : ''}`}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 border border-teal-100 dark:border-teal-800">
                        <Layers size={24} />
                    </div>
                    <div className="flex flex-col items-end">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider mb-2 ${type.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
                          {type.isActive ? 'Active' : 'Disabled'}
                        </span>
                        <span className="text-xl font-black text-slate-800 dark:text-white leading-none">{type.days}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Annual Limit</span>
                    </div>
                </div>
                
                <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{type.name}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 italic flex-grow">
                    {type.description || 'No specific description provided for this leave category.'}
                </p>
                
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MousePointerClick size={14} /> <span>Click to Apply</span>
                </div>

                {isHR && (
                  <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-50 dark:border-slate-700 relative z-10">
                      <button onClick={(e) => { e.stopPropagation(); handleEditType(type); }} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Edit Configuration"><Edit2 size={16}/></button>
                      <button onClick={(e) => { e.stopPropagation(); if(window.confirm(`Permanently delete ${type.name}?`)) deleteLeaveType(type.id); }} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Remove Category"><Trash2 size={16}/></button>
                  </div>
                )}
            </div>
          ))}
          {isHR && (
             <button onClick={handleAddType} className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-teal-600 hover:border-teal-200 dark:hover:border-teal-800 transition-all group">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full group-hover:bg-teal-50 transition-colors">
                    <Plus size={32} />
                </div>
                <span className="font-bold text-sm">Define New Category</span>
             </button>
          )}
        </div>
      )}

      {viewMode === 'balances' && (
        <div className="space-y-8">
            <div className="bg-teal-600 rounded-2xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 text-center md:text-left">
                    <h3 className="text-3xl font-black tracking-tight mb-2">Leave Dashboard</h3>
                    <p className="text-teal-50 opacity-90 font-medium">Tracking entitlements for {currentUser?.name}.</p>
                </div>
                <div className="flex items-center gap-6 relative z-10">
                    <div className="text-center">
                        <p className="text-4xl font-black leading-none">{userBalances.reduce((sum, b) => sum + b.remaining, 0)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">Total Remaining</p>
                    </div>
                    <div className="w-px h-12 bg-white/20"></div>
                    <div className="text-center">
                        <p className="text-4xl font-black leading-none text-teal-200">{userBalances.reduce((sum, b) => sum + b.used, 0)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">Total Used</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {userBalances.map(bal => (
                    <div key={bal.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:scale-[1.02] transition-transform">
                        <div className="p-6 border-b border-slate-50 dark:border-slate-700/50">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                                    <Activity size={18} />
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-white truncate">{bal.name}</h4>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">{bal.remaining}</p>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Remaining Days</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-teal-600 dark:text-teal-400 leading-none">{bal.used}</p>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Used</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/20">
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-2">
                                <div 
                                    className="h-full bg-teal-500 rounded-full" 
                                    style={{ width: `${Math.min(100, (bal.used / bal.days) * 100)}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter text-slate-400">
                                <span>{((bal.used / bal.days) * 100).toFixed(0)}% Consumed</span>
                                <span>Total: {bal.days}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {viewMode === 'team' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamMembers.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                      <Users className="w-16 h-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium">No direct reports found.</p>
                      <p className="text-sm opacity-60">Team members assigned to you will appear here.</p>
                  </div>
              ) : (
                  teamMembers.map(member => {
                      const balances = getBalancesForUser(member.id);
                      return (
                          <div key={member.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
                              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-100 dark:border-slate-700">
                                      <img src={member.avatar} className="w-full h-full object-cover" alt="" />
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-slate-800 dark:text-white">{member.name}</h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-tight">{member.position}</p>
                                  </div>
                              </div>
                              <div className="space-y-4 flex-1">
                                  {balances.slice(0, 3).map(bal => (
                                      <div key={bal.id}>
                                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                                              <span className="text-slate-600 dark:text-slate-300">{bal.name}</span>
                                              <span className={bal.remaining < 3 ? 'text-rose-500' : 'text-teal-600'}>{bal.remaining} Left</span>
                                          </div>
                                          <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                              <div 
                                                  className={`h-full rounded-full ${bal.remaining < 3 ? 'bg-rose-500' : 'bg-teal-500'}`} 
                                                  style={{ width: `${Math.min(100, (bal.used / bal.days) * 100)}%` }}
                                              ></div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                              <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-700/50 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                  <span>ID: {member.employeeId}</span>
                                  <span>{employees.find(e => String(e.id) === String(member.id))?.department || 'General'}</span>
                              </div>
                          </div>
                      );
                  })
              )}
          </div>
      )}

      {/* Leave Request Modal */}
      <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title={isEditingId ? 'Modify Request' : 'Submit Leave Request'} width="max-w-2xl">
        <form onSubmit={handleLeaveSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
                <select className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} required>
                    {leaveTypes.filter(t => t.isActive).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Approver (By System Role)</label>
                <select required className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={formData.approverId} onChange={e => setFormData({...formData, approverId: e.target.value})}>
                    <option value="" disabled>Select Approving Authority...</option>
                    {availableManagers.map(mgr => (
                      <option key={mgr.id} value={String(mgr.id)}>
                        {mgr.name} ({mgr.role})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Duration</label>
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl w-full">
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, durationType: 'Full Day'})}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${formData.durationType === 'Full Day' ? 'bg-white dark:bg-slate-600 text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Full Day
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, durationType: 'Half Day'})}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${formData.durationType === 'Half Day' ? 'bg-white dark:bg-slate-600 text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Half Day
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest">{formData.durationType === 'Half Day' ? 'Date' : 'From Date'}</label>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input required type="date" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl pl-11 pr-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                    </div>
                </div>
                {formData.durationType === 'Full Day' && (
                  <div className="space-y-1.5 animate-in fade-in duration-300">
                      <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest">To Date</label>
                      <div className="relative">
                          <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input required type="date" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl pl-11 pr-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                      </div>
                  </div>
                )}
            </div>

            <MultiSelectUser 
              label="Notify People"
              options={otherEmployees}
              selectedIds={formData.notifyUserIds}
              onChange={(ids) => setFormData({...formData, notifyUserIds: ids})}
            />

            <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest">Reason</label>
                <textarea required rows={3} className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="Please explain why you need this time off..."></textarea>
            </div>
            
            <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
              <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cancel</button>
              <button type="submit" className="px-12 py-3 bg-teal-600 text-white rounded-xl text-xs font-black uppercase shadow-lg hover:bg-teal-700 transition-all hover:scale-[1.02] active:scale-95">Submit Request</button>
            </div>
        </form>
      </DraggableModal>

      {/* Rejection Modal */}
      <DraggableModal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Decline Leave Request" width="max-w-md">
          <div className="space-y-6">
              <div className="bg-rose-50 dark:bg-rose-900/20 p-5 rounded-2xl border border-rose-100 dark:border-rose-800 flex items-start gap-4">
                  <XCircle className="text-rose-600 shrink-0" size={24} />
                  <div>
                      <p className="text-xs font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wide mb-1">Confirmation Required</p>
                      <p className="text-[10px] text-rose-700 dark:text-rose-500 leading-relaxed font-medium">You are declining the <strong>{leaveToProcess?.type}</strong> request for <strong>{leaveToProcess?.userName}</strong>. A reason is <strong>mandatory</strong> to inform the employee.</p>
                  </div>
              </div>
              
              <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest">Reason for Rejection (Mandatory)</label>
                  <div className="relative">
                      <MessageSquare className="absolute left-4 top-4 text-slate-400" size={18} />
                      <textarea 
                          required 
                          rows={4} 
                          className="w-full border border-slate-200 dark:border-slate-600 rounded-2xl pl-11 pr-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 shadow-sm" 
                          value={rejectionReason} 
                          onChange={e => setRejectionReason(e.target.value)} 
                          placeholder="Provide context on why this request cannot be approved..."
                      ></textarea>
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                  <button type="button" onClick={() => setShowRejectModal(false)} className="px-6 py-3 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cancel</button>
                  <button 
                    onClick={() => { if(leaveToProcess) handleStatusUpdate(leaveToProcess, LeaveStatusEnum.REJECTED, rejectionReason); }}
                    disabled={!rejectionReason.trim()}
                    className="px-10 py-3.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition disabled:opacity-50 active:scale-95"
                  >
                    Confirm Rejection
                  </button>
              </div>
          </div>
      </DraggableModal>

      {/* Approval Confirmation Modal */}
      <DraggableModal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)} title="Approve Leave" width="max-w-md">
          <div className="space-y-6">
              <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-emerald-100 dark:border-emerald-800">
                      <CheckCircle2 className="text-emerald-600" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Authorize Request?</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 px-4 leading-relaxed">
                      Approving <strong>{leaveToProcess?.type}</strong> for <strong>{leaveToProcess?.userName}</strong>.
                      {leaveToProcess?.status === LeaveStatusEnum.PENDING_MANAGER && (
                          currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN 
                          ? <span className="block mt-2 font-bold text-emerald-600">This will be approved directly.</span>
                          : <span className="block mt-2 font-bold text-teal-600">This will be forwarded to HR for final sign-off.</span>
                      )}
                  </p>
              </div>

              <div className="space-y-1.5 px-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest">Approval Comments (Optional)</label>
                  <div className="relative">
                      <MessageSquare className="absolute left-4 top-4 text-slate-400" size={18} />
                      <textarea 
                          rows={3} 
                          className="w-full border border-slate-200 dark:border-slate-600 rounded-2xl pl-11 pr-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 shadow-sm" 
                          value={approvalComment} 
                          onChange={e => setApprovalComment(e.target.value)} 
                          placeholder="Provide any additional notes (optional)..."
                      ></textarea>
                  </div>
              </div>
              
              <div className="flex gap-3 pt-6 border-t dark:border-slate-700">
                  <button onClick={() => setShowApproveModal(false)} className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-700 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest">Go Back</button>
                  <button 
                    onClick={handleApproveConfirm}
                    className="flex-1 px-4 py-3 bg-teal-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-widest shadow-xl shadow-teal-500/20 active:scale-95 transition-all"
                  >
                    Confirm & Approve
                  </button>
              </div>
          </div>
      </DraggableModal>

      {/* Leave Type CRUD Modal */}
      <DraggableModal isOpen={showTypeModal} onClose={() => setShowTypeModal(false)} title={editingTypeId ? 'Update Leave Type' : 'Create Leave Type'} width="max-w-md">
        <form onSubmit={handleTypeSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Type Name</label>
              <input required type="text" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none" value={typeData.name} onChange={e => setTypeData({...typeData, name: e.target.value})} placeholder="e.g. Vacation, Medical" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Allocated Days (Annual)</label>
              <input required type="number" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none" value={typeData.days} onChange={e => setTypeData({...typeData, days: parseInt(e.target.value) || 0})} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Description</label>
              <textarea rows={3} className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none" value={typeData.description} onChange={e => setTypeData({...typeData, description: e.target.value})} placeholder="Policies or rules for this type..."></textarea>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="typeActive" checked={typeData.isActive} onChange={e => setTypeData({...typeData, isActive: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
              <label htmlFor="typeActive" className="text-sm font-bold text-slate-700 dark:text-slate-200">Active and available for selection</label>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
              <button type="button" onClick={() => setShowTypeModal(false)} className="px-4 py-2 text-slate-400 font-bold uppercase text-xs">Cancel</button>
              <button type="submit" className="px-10 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase shadow-lg hover:bg-blue-700">Save Type</button>
            </div>
        </form>
      </DraggableModal>

      <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Withdraw Request" width="max-w-sm">
         <div className="text-center py-4">
            <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Are you sure?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">This will cancel and remove your leave request.</p>
            <div className="flex gap-3">
               <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold rounded-xl text-xs uppercase">Keep Request</button>
               <button onClick={handleWithdrawal} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl text-xs uppercase shadow-lg shadow-rose-500/20">Withdraw</button>
            </div>
         </div>
      </DraggableModal>
    </div>
  );
};

export default LeaveManagement;