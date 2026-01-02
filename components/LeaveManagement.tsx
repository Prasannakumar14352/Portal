
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserRole, LeaveStatus, LeaveStatus as LeaveStatusEnum, LeaveRequest, LeaveTypeConfig, User, LeaveDurationType } from '../types';
import { 
  Plus, Calendar, CheckCircle, X, ChevronLeft, ChevronRight, ChevronDown, BookOpen, Clock, PieChart, Info, MapPin, CalendarDays, UserCheck, Flame, Edit2, Trash2, CheckCircle2, XCircle, AlertTriangle, Loader2, Mail, User as UserIcon
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
        {selectedIds.map(id => {
          const user = options.find(u => String(u.id) === String(id));
          return (
            <span key={String(id)} className="bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-[10px] font-black uppercase px-2 py-1 rounded flex items-center gap-1.5 border border-teal-100">
              {user?.name}
              <X size={10} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleSelect(id); }} />
            </span>
          );
        })}
        <ChevronDown size={14} className="ml-auto text-slate-400" />
      </div>
      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-50 p-2">
            {options.map(user => (
              <div key={user.id} onClick={() => handleSelect(user.id)} className={`flex items-center px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedIds.map(String).includes(String(user.id)) ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}>
                <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${selectedIds.map(String).includes(String(user.id)) ? 'bg-teal-600 border-teal-600' : 'border-slate-200'}`}>
                  {selectedIds.map(String).includes(String(user.id)) && <CheckCircle size={10} className="text-white" />}
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-white">{user.name}</span>
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
  const { showToast, notify, sendLeaveRequestEmail, sendLeaveStatusEmail, employees, deleteLeave } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRequest | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'requests' | 'balances' | 'types' | 'calendar'>('requests');
  const [currentCalDate, setCurrentCalDate] = useState(new Date());
  const [isEditingId, setIsEditingId] = useState<string | number | null>(null);
  const [editingType, setEditingType] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    type: '', startDate: '', endDate: '', durationType: 'Full Day' as LeaveDurationType, reason: '', notifyUserIds: [] as (string|number)[], approverId: '', isUrgent: false
  });

  const [typeData, setTypeData] = useState({
    name: '', days: 10, description: '', isActive: true, color: 'text-teal-600'
  });

  const isHR = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;

  const availableManagers = useMemo(() => {
    return users.filter(u => {
      const position = (u.position || '').toLowerCase();
      const isManagerByPosition = position.includes('manager');
      return isManagerByPosition && String(u.id) !== String(currentUser?.id);
    });
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

  const handleDeleteTrigger = (leave: LeaveRequest) => {
    setLeaveToDelete(leave);
    setShowDeleteConfirm(true);
  };

  const handleWithdrawal = async () => {
    if (!leaveToDelete) return;
    setIsProcessing(true);
    try {
      const manager = employees.find(emp => String(emp.id) === String(leaveToDelete.approverId));
      if (manager) {
          await notify(`Leave request from ${currentUser?.name} was withdrawn.`, manager.id);
          await sendLeaveRequestEmail({
              to: manager.email,
              employeeName: currentUser?.name || 'Employee',
              type: leaveToDelete.type,
              startDate: leaveToDelete.startDate,
              endDate: leaveToDelete.endDate,
              reason: leaveToDelete.reason,
              isWithdrawal: true
          });
      }
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
          await sendLeaveRequestEmail({
              to: manager.email,
              employeeName: currentUser?.name || 'Employee',
              type: formData.type,
              startDate: finalData.startDate,
              endDate: finalData.endDate,
              reason: formData.reason,
              isUpdate: !!isEditingId
          });
          await notify(`${currentUser?.name} ${isEditingId ? 'updated' : 'submitted'} a ${formData.type} request.`, manager.id);
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
        if (employee) {
            await notify(`Leave status: ${newStatus}`, employee.id);
            await sendLeaveStatusEmail({
                to: employee.email,
                employeeName: employee.firstName,
                status: newStatus,
                type: leave.type,
                managerComment: comment,
                hrAction: isHR
            });
        }
        showToast(`Status: ${newStatus}`, "success");
      } catch (err) {
        showToast("Failed to update status", "error");
      } finally {
        setIsProcessing(false);
      }
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
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Processing Request...</h3>
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
            {['requests', 'balances', 'types'].map(tab => (
                <button key={tab} onClick={() => setViewMode(tab as any)} className={`px-4 py-1.5 rounded-md text-sm transition capitalize ${viewMode === tab ? 'bg-white dark:bg-slate-700 shadow text-teal-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>
                  {tab}
                </button>
            ))}
          </div>
          <button onClick={handleOpenCreate} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-bold shadow-lg shadow-teal-500/20"><Plus size={18} /><span>Apply Leave</span></button>
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
                      // CRITICAL APPROVAL LOGIC: Designated Manager OR HR/Admin
                      const isDesignatedManager = String(leave.approverId) === String(currentUser?.id);
                      const canApprove = isDesignatedManager || isHR;
                      
                      const isOwnRequest = String(leave.userId) === String(currentUser?.id);
                      const isPending = leave.status === LeaveStatusEnum.PENDING_MANAGER || leave.status === LeaveStatusEnum.PENDING_HR;
                      const canEditDelete = isOwnRequest && leave.status === LeaveStatusEnum.PENDING_MANAGER;

                      return (
                        <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-sm">
                          <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{leave.userName}</td>
                          <td className="px-6 py-4 font-bold text-teal-600 dark:text-teal-400 text-xs uppercase">{leave.type}</td>
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{leave.startDate} to {leave.endDate}</td>
                          <td className="px-6 py-4"><StatusBadge status={leave.status} /></td>
                          <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                  {canApprove && isPending && !isOwnRequest && (
                                      <>
                                          <button onClick={() => handleStatusUpdate(leave, LeaveStatusEnum.APPROVED)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100" title="Approve"><CheckCircle2 size={16}/></button>
                                          <button onClick={() => { const reason = window.prompt("Reason for rejection:"); if(reason) handleStatusUpdate(leave, LeaveStatusEnum.REJECTED, reason); }} className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100" title="Reject"><XCircle size={16}/></button>
                                      </>
                                  )}
                                  {canEditDelete && (
                                      <>
                                          <button onClick={() => handleEditClick(leave)} className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100"><Edit2 size={16}/></button>
                                          <button onClick={() => handleDeleteTrigger(leave)} className="p-2 bg-slate-50 text-slate-400 hover:text-red-600 rounded-lg border border-slate-100"><Trash2 size={16}/></button>
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

      <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title={isEditingId ? 'Modify Request' : 'Submit Leave Request'} width="max-w-xl">
        <form onSubmit={handleLeaveSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
                <select className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} required>
                    {leaveTypes.filter(t => t.isActive).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Approver (By Position)</label>
                <select required className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none" value={formData.approverId} onChange={e => setFormData({...formData, approverId: e.target.value})}>
                    <option value="" disabled>Select Approving Manager...</option>
                    {availableManagers.map(mgr => <option key={mgr.id} value={String(mgr.id)}>{mgr.name} ({mgr.position})</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest">From</label>
                    <input required type="date" className="w-full border rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest">To</label>
                    <input required type="date" className="w-full border rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest">Reason</label>
                <textarea required rows={3} className="w-full border rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})}></textarea>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 font-bold uppercase text-xs">Cancel</button>
              <button type="submit" className="px-10 py-3 bg-teal-600 text-white rounded-xl text-xs font-black uppercase shadow-lg hover:bg-teal-700">Submit</button>
            </div>
        </form>
      </DraggableModal>
    </div>
  );
};

export default LeaveManagement;
