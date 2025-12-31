
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserRole, LeaveStatus, LeaveStatus as LeaveStatusEnum, LeaveRequest, LeaveTypeConfig, User, LeaveDurationType } from '../types';
import { 
  Plus, Calendar, CheckCircle, X, ChevronLeft, ChevronRight, ChevronDown, BookOpen, Clock, PieChart, Info, MapPin, CalendarDays, UserCheck, Flame, Edit2, Trash2, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';

interface LeaveManagementProps {
  currentUser: User | null;
  users: User[];
  leaves: LeaveRequest[];
  leaveTypes: LeaveTypeConfig[];
  addLeave: (leave: any) => void;
  editLeave: (id: string | number, data: any) => void;
  addLeaves: (leaves: any[]) => void;
  updateLeaveStatus: (id: string | number, status: LeaveStatusEnum, comment?: string) => void;
  addLeaveType: (type: any) => void;
  updateLeaveType: (id: string | number, data: any) => void;
  deleteLeaveType: (id: string | number) => void;
}

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
    const idStr = String(id);
    if (selectedIds.map(String).includes(idStr)) {
      onChange(selectedIds.filter(sid => String(sid) !== idStr));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
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
              <X size={10} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleSelect(String(id)); }} />
            </span>
          );
        })}
        <ChevronDown size={14} className="ml-auto text-slate-400" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-50 p-2">
            {options.map(user => (
              <div key={user.id} onClick={() => handleSelect(String(user.id))} className={`flex items-center px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedIds.map(String).includes(String(user.id)) ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}>
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
    return users.filter(u => 
        (u.role === UserRole.MANAGER || u.role === UserRole.HR || u.role === UserRole.ADMIN) && 
        String(u.id) !== String(currentUser?.id)
    );
  }, [users, currentUser]);

  const getDaysDiff = (start: string, end: string, durationType: LeaveDurationType = 'Full Day') => {
    if (!start || !end) return 0;
    if (durationType === 'Half Day') return 0.5;
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = e.getTime() - s.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  };

  const getUsedDays = (typeName: string) => {
    return leaves
      .filter(l => String(l.userId) === String(currentUser?.id) && l.type === typeName && l.status === LeaveStatusEnum.APPROVED)
      .reduce((acc, l) => acc + getDaysDiff(l.startDate, l.endDate, l.durationType), 0);
  };

  const getBalance = (typeName: string, limit: number) => {
    const used = getUsedDays(typeName);
    return Math.max(0, limit - used);
  };

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
    
    // Notify Manager
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
    setShowDeleteConfirm(false);
    showToast("Leave request withdrawn.", "info");
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = {
        ...formData,
        endDate: formData.durationType === 'Half Day' ? formData.startDate : formData.endDate
    };
    
    if (isEditingId) await editLeave(isEditingId, finalData);
    else await addLeave(finalData);

    // Notification Logic
    const manager = employees.find(emp => String(emp.id) === String(formData.approverId));
    const colleagueEmails = employees
      .filter(emp => formData.notifyUserIds.map(String).includes(String(emp.id)))
      .map(emp => emp.email);

    if (manager) {
        showToast(isEditingId ? "Updating notifications..." : "Dispatching notifications...", "info");
        
        // SMTP Email
        await sendLeaveRequestEmail({
            to: manager.email,
            cc: colleagueEmails,
            employeeName: currentUser?.name || 'Employee',
            type: formData.type,
            startDate: finalData.startDate,
            endDate: finalData.endDate,
            reason: formData.reason,
            isUpdate: !!isEditingId
        });

        // In-App
        const updateMsg = isEditingId ? "updated their" : "submitted a";
        await notify(`${currentUser?.name} ${updateMsg} ${formData.type} request.`, manager.id);
        
        formData.notifyUserIds.forEach(async (id) => {
            const matchedColleague = employees.find(e => String(e.id) === String(id));
            if (matchedColleague) {
              await notify(`${currentUser?.name} is applying for leave (CC).`, matchedColleague.id);
            }
        });
    }

    setShowModal(false);
    showToast(isEditingId ? "Leave request updated." : "Leave request submitted.", "success");
  };

  const handleStatusUpdate = async (leave: LeaveRequest, newStatus: LeaveStatusEnum, comment: string = '') => {
      await updateLeaveStatus(leave.id, newStatus, comment);
      
      const employee = employees.find(emp => String(emp.id) === String(leave.userId));
      const hrUsers = employees.filter(emp => emp.role === UserRole.HR || emp.role === UserRole.ADMIN);

      if (employee) {
          // Notify Employee
          await notify(`Your leave request status is now: ${newStatus}`, employee.id);
          await sendLeaveStatusEmail({
              to: employee.email,
              employeeName: employee.firstName,
              status: newStatus,
              type: leave.type,
              managerComment: comment,
              hrAction: isHR
          });

          // If Manager approves -> Notify HR
          if (newStatus === LeaveStatusEnum.PENDING_HR || (newStatus === LeaveStatusEnum.APPROVED && !isHR)) {
              for (const hr of hrUsers) {
                  await notify(`${leave.userName}'s leave request needs HR approval.`, hr.id);
                  await sendLeaveStatusEmail({
                      to: hr.email,
                      employeeName: leave.userName,
                      status: 'Awaiting HR Approval',
                      type: leave.type,
                      managerComment: comment
                  });
              }
          }
      }
      showToast(`Status updated to ${newStatus}`, "success");
  };

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingType) updateLeaveType(editingType, typeData);
    else addLeaveType({ ...typeData, id: Math.random().toString(36).substr(2, 9) });
    setShowTypeModal(false);
  };

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const startDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const calendarDays = useMemo(() => {
    const days = [];
    const totalDays = daysInMonth(currentCalDate);
    const startOffset = startDayOfMonth(currentCalDate);
    for (let i = 0; i < startOffset; i++) days.push({ date: null });
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentCalDate.getFullYear()}-${String(currentCalDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLeaves = leaves.filter(l => {
          if (String(l.userId) !== String(currentUser?.id)) return false;
          const start = new Date(l.startDate);
          const end = new Date(l.endDate);
          const current = new Date(dateStr);
          start.setHours(0,0,0,0);
          end.setHours(0,0,0,0);
          current.setHours(0,0,0,0);
          return current >= start && current <= end;
      });
      days.push({ date: dateStr, leaves: dayLeaves });
    }
    return days;
  }, [currentCalDate, leaves, currentUser]);

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      [LeaveStatusEnum.APPROVED]: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      [LeaveStatusEnum.REJECTED]: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      [LeaveStatusEnum.PENDING_MANAGER]: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      [LeaveStatusEnum.PENDING_HR]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'Pending': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    };
    const styleClass = styles[status] || styles['Pending'];
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styleClass}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Leave Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Track team absences and configure policies.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto">
            {[
                { id: 'requests', label: 'Requests', icon: BookOpen },
                { id: 'balances', label: 'Balances', icon: PieChart },
                { id: 'types', label: 'Policies', icon: Info },
                { id: 'calendar', label: 'Calendar', icon: Calendar }
            ].map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setViewMode(tab.id as any)} 
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition ${viewMode === tab.id ? 'bg-white dark:bg-slate-700 shadow text-teal-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <tab.icon size={14} />
                  <span>{tab.label}</span>
                </button>
            ))}
          </div>
          <button onClick={handleOpenCreate} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-bold uppercase tracking-tight shadow-lg shadow-teal-500/20"><Plus size={18} /><span>New Request</span></button>
        </div>
      </div>

      {/* REQUESTS VIEW */}
      {viewMode === 'requests' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b">
                  <tr><th className="px-6 py-4">Employee</th><th className="px-6 py-4">Category</th><th className="px-6 py-4">Period</th><th className="px-6 py-4">Duration</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {leaves.map(leave => {
                      const canApprove = (currentUser?.role === UserRole.MANAGER && String(leave.approverId) === String(currentUser?.id)) || isHR;
                      const isOwnRequest = String(leave.userId) === String(currentUser?.id);
                      const isPending = leave.status === LeaveStatusEnum.PENDING_MANAGER || leave.status === LeaveStatusEnum.PENDING_HR;
                      const canEditDelete = isOwnRequest && leave.status === LeaveStatusEnum.PENDING_MANAGER;

                      return (
                        <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-sm">
                          <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{leave.userName}</td>
                          <td className="px-6 py-4 font-bold text-teal-600 dark:text-teal-400 text-xs uppercase">{leave.type}</td>
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-500">
                            {leave.durationType === 'Half Day' ? leave.startDate : `${leave.startDate} to ${leave.endDate}`}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700 dark:text-white text-xs">
                            {getDaysDiff(leave.startDate, leave.endDate, leave.durationType)} Days 
                            {leave.durationType === 'Half Day' && <span className="ml-1 text-[8px] font-black uppercase bg-amber-50 text-amber-600 px-1 py-0.5 rounded border border-amber-100">Half</span>}
                          </td>
                          <td className="px-6 py-4"><StatusBadge status={leave.status} /></td>
                          <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                  {canApprove && isPending && (
                                      <>
                                          <button onClick={() => handleStatusUpdate(leave, LeaveStatusEnum.APPROVED)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition shadow-sm border border-emerald-100" title="Approve"><CheckCircle2 size={16}/></button>
                                          <button onClick={() => { const reason = window.prompt("Reason for rejection:"); if(reason) handleStatusUpdate(leave, LeaveStatusEnum.REJECTED, reason); }} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition shadow-sm border border-rose-100" title="Reject"><XCircle size={16}/></button>
                                      </>
                                  )}
                                  {canEditDelete && (
                                      <>
                                          <button onClick={() => handleEditClick(leave)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition shadow-sm border border-blue-100" title="Modify"><Edit2 size={16}/></button>
                                          <button onClick={() => handleDeleteTrigger(leave)} className="p-2 bg-slate-50 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition shadow-sm border border-slate-100" title="Withdraw"><Trash2 size={16}/></button>
                                      </>
                                  )}
                              </div>
                          </td>
                        </tr>
                      );
                  })}
                  {leaves.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No records found.</td></tr>}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {/* BALANCES VIEW */}
      {viewMode === 'balances' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {leaveTypes.filter(t => t.isActive).map(type => {
                const used = getUsedDays(type.name);
                const total = type.days;
                const percent = Math.min(100, Math.round((used / total) * 100));
                return (
                    <div key={type.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl text-teal-600">
                                <PieChart size={24} />
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remaining</span>
                                <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">{total - used}</p>
                            </div>
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-white mb-1">{type.name}</h4>
                        <p className="text-xs text-slate-500 mb-4">{type.description}</p>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                                <span>Used: {used}</span>
                                <span>Total: {total}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-600" style={{ width: `${percent}%` }}></div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      )}

      {/* TYPES (POLICIES) VIEW - MATCHING BALANCES STYLE */}
      {viewMode === 'types' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><BookOpen className="text-teal-600" /> Organizational Leave Policies</h3>
            {isHR && (
              <button onClick={() => { setEditingType(null); setTypeData({ name: '', days: 10, description: '', isActive: true, color: 'text-teal-600' }); setShowTypeModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all"><Plus size={16} /> Add Leave Type</button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {leaveTypes.map(type => (
              <div key={type.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm relative group hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600`}>
                      <CalendarDays size={24} />
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Allowance</span>
                        <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">{type.days}</p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="font-bold text-slate-800 dark:text-white mb-1">{type.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 h-8 leading-relaxed">{type.description}</p>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-50 dark:border-slate-700/50">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${type.isActive ? 'bg-teal-50 text-teal-600 border border-teal-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>{type.isActive ? 'Active' : 'Inactive'}</span>
                    
                    {isHR && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingType(String(type.id)); setTypeData(type as any); setShowTypeModal(true); }} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={14}/></button>
                        <button onClick={() => { if(window.confirm('Delete this policy permanently?')) deleteLeaveType(type.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors"><Trash2 size={14}/></button>
                      </div>
                    )}
                  </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === 'calendar' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                      {currentCalDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex gap-2">
                      <button onClick={() => setCurrentCalDate(new Date(currentCalDate.setMonth(currentCalDate.getMonth() - 1)))} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><ChevronLeft size={20}/></button>
                      <button onClick={() => setCurrentCalDate(new Date(currentCalDate.setMonth(currentCalDate.getMonth() + 1)))} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><ChevronRight size={20}/></button>
                  </div>
              </div>
              <div className="grid grid-cols-7 border-b dark:border-slate-700">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 border-r last:border-0 dark:border-slate-700">{d}</div>
                  ))}
              </div>
              <div className="grid grid-cols-7">
                  {calendarDays.map((day, idx) => (
                      <div key={idx} className={`min-h-[120px] p-2 border-r border-b last:border-r-0 dark:border-slate-700 transition-colors ${!day.date ? 'bg-slate-50/50 dark:bg-slate-900/20' : 'hover:bg-slate-50/50'}`}>
                          {day.date && (
                              <>
                                <span className="text-[10px] font-bold text-slate-400">{day.date.split('-')[2]}</span>
                                <div className="mt-2 space-y-1">
                                    {day.leaves?.map(l => (
                                        <div key={l.id} className="text-[9px] font-bold p-1 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 rounded border border-teal-100 dark:border-teal-800 line-clamp-1 truncate" title={l.type}>
                                            {l.type} {l.durationType === 'Half Day' ? '(H)' : ''}
                                        </div>
                                    ))}
                                </div>
                              </>
                          )}
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* NEW/EDIT REQUEST MODAL */}
      <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title={isEditingId ? 'Modify Leave Request' : 'New Leave Request'} width="max-w-xl">
        <form onSubmit={handleLeaveSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Leave Category</label>
                <div className="relative">
                  <select 
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 dark:text-white font-bold outline-none focus:ring-2 focus:ring-teal-500/20 appearance-none" 
                    value={formData.type} 
                    onChange={e => setFormData({...formData, type: e.target.value})} 
                    required
                  >
                    <option value="" disabled>Select a type...</option>
                    {leaveTypes.filter(t => t.isActive).map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
                {formData.type && (
                  <p className="text-[10px] text-teal-600 mt-2 font-black uppercase ml-1">
                    {getBalance(formData.type, leaveTypes.find(lt => lt.name === formData.type)?.days || 0)} Days Remaining
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Approving Manager</label>
                <div className="relative">
                  <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select required className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-teal-500/20 appearance-none" value={formData.approverId} onChange={e => setFormData({...formData, approverId: e.target.value})}>
                    <option value="" disabled>Select Approver...</option>
                    {availableManagers.map(mgr => <option key={mgr.id} value={String(mgr.id)}>{mgr.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Duration Type</label>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        type="button" 
                        onClick={() => setFormData({...formData, durationType: 'Full Day'})}
                        className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${formData.durationType === 'Full Day' ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                    >
                        Full Day
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setFormData({...formData, durationType: 'Half Day'})}
                        className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${formData.durationType === 'Half Day' ? 'bg-amber-50 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                    >
                        Half Day
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase ml-1">{formData.durationType === 'Half Day' ? 'Request Date' : 'From Date'}</label>
                <input required type="date" className="w-full border rounded-xl px-4 py-2.5 text-sm dark:bg-slate-700 dark:text-white font-bold outline-none" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
              </div>
              {formData.durationType === 'Full Day' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-right-1 duration-200">
                    <label className="block text-[10px] font-black text-slate-500 uppercase ml-1">To Date</label>
                    <input required type="date" className="w-full border rounded-xl px-4 py-2.5 text-sm dark:bg-slate-700 dark:text-white font-bold outline-none" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                  </div>
              )}
            </div>

            <div><label className="block text-[10px] font-black text-slate-500 uppercase ml-1">Reason for Absence</label><textarea required rows={3} className="w-full border rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500/20" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="Why are you taking leave?"></textarea></div>

            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 flex items-center gap-3">
               <input type="checkbox" id="urgent-check" checked={formData.isUrgent} onChange={e => setFormData({...formData, isUrgent: e.target.checked})} className="w-5 h-5 text-red-600 rounded border-red-200 focus:ring-red-500" />
               <label htmlFor="urgent-check" className="text-xs font-black uppercase text-red-700 flex items-center gap-1.5 cursor-pointer">Mark as Urgent <Flame size={14} /></label>
            </div>

            <MultiSelectUser label="Notify Colleagues (CC)" options={users.filter(u => String(u.id) !== String(currentUser?.id))} selectedIds={formData.notifyUserIds} onChange={ids => setFormData({...formData, notifyUserIds: ids as any})} />

            <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
              <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-slate-400 text-xs font-black uppercase">Cancel</button>
              <button type="submit" className="px-8 py-3 bg-teal-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-teal-500/20 hover:bg-teal-700 transition-all active:scale-95">{isEditingId ? 'Update Request' : 'Submit Request'}</button>
            </div>
        </form>
      </DraggableModal>

      {/* WITHDRAW CONFIRM MODAL */}
      <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Withdraw Request" width="max-w-md">
          <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100 dark:border-red-800">
                  <AlertTriangle className="text-red-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Withdraw Leave Request?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm px-4">
                  Are you sure you want to withdraw this pending leave request? This action cannot be undone and your manager will be notified.
              </p>
          </div>
          <div className="flex gap-3 mt-6 pt-6 border-t dark:border-slate-700">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200">Keep Request</button>
              <button onClick={handleWithdrawal} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-red-700">Withdraw Now</button>
          </div>
      </DraggableModal>

      {/* POLICY MODAL */}
      <DraggableModal isOpen={showTypeModal} onClose={() => setShowTypeModal(false)} title={editingType ? 'Edit Leave Policy' : 'Define New Policy'} width="max-w-md">
        <form onSubmit={handleTypeSubmit} className="space-y-4">
            <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Type Name</label><input required type="text" className="w-full border rounded-xl p-3 text-sm dark:bg-slate-700 dark:text-white outline-none" value={typeData.name} onChange={e => setTypeData({...typeData, name: e.target.value})} placeholder="e.g. Wellness Break" /></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Annual Allowance (Days)</label><input required type="number" className="w-full border rounded-xl p-3 text-sm dark:bg-slate-700 dark:text-white outline-none" value={typeData.days} onChange={e => setTypeData({...typeData, days: parseInt(e.target.value)})} /></div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Description</label>
              <textarea required rows={2} className="w-full border rounded-xl p-3 text-sm dark:bg-slate-700 dark:text-white outline-none" value={typeData.description} onChange={e => setTypeData({...typeData, description: e.target.value})} placeholder="Eligibility details..."></textarea>
            </div>
            <div className="flex items-center gap-2 py-2">
              <input type="checkbox" id="active-check" checked={typeData.isActive} onChange={e => setTypeData({...typeData, isActive: e.target.checked})} className="w-4 h-4 text-teal-600 rounded border-slate-300" />
              <label htmlFor="active-check" className="text-xs font-bold text-slate-600 dark:text-slate-300">Visible to Employees</label>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
              <button type="button" onClick={() => setShowTypeModal(false)} className="px-4 py-2 text-slate-500 text-sm font-bold uppercase">Cancel</button>
              <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-black uppercase shadow-sm">Save Policy</button>
            </div>
        </form>
      </DraggableModal>
    </div>
  );
};

export default LeaveManagement;
