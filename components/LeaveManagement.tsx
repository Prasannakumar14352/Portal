
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserRole, LeaveStatus, LeaveStatus as LeaveStatusEnum, LeaveRequest, LeaveTypeConfig, User, LeaveDurationType } from '../types';
import { 
  Upload, Paperclip, CheckSquare, Search, Edit2, Calendar as CalendarIcon, 
  List, Settings, Trash2, Plus, Calendar, CheckCircle, XCircle, Users, AlertTriangle, Flame, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, X, CheckCheck, PieChart, Layers, Filter, UserCheck, BookOpen
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
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(sid => sid !== id));
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
          const user = options.find(u => String(u.id) === id);
          return (
            <span key={id} className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase px-2 py-1 rounded flex items-center gap-1.5 border border-emerald-100">
              {user?.name}
              <X size={10} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleSelect(id); }} />
            </span>
          );
        })}
        <ChevronDown size={14} className="ml-auto text-slate-400" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-50 p-2">
            {options.map(user => (
              <div key={user.id} onClick={() => handleSelect(String(user.id))} className={`flex items-center px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedIds.includes(String(user.id)) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${selectedIds.includes(String(user.id)) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-200'}`}>
                  {selectedIds.includes(String(user.id)) && <CheckCircle size={10} className="text-white" />}
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
  const { showToast } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [viewMode, setViewMode] = useState<'requests' | 'balances' | 'types' | 'calendar' | 'team'>('requests');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    type: '', startDate: '', endDate: '', durationType: 'Full Day' as LeaveDurationType, reason: '', notifyUserIds: [], approverId: '', isUrgent: false
  });

  const [typeData, setTypeData] = useState({
    name: '', days: 10, description: '', isActive: true, color: 'text-emerald-600'
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

  const getBalance = (typeName: string, limit: number) => {
    const used = leaves
      .filter(l => String(l.userId) === String(currentUser?.id) && l.type === typeName && l.status === LeaveStatusEnum.APPROVED)
      .reduce((acc, l) => acc + getDaysDiff(l.startDate, l.endDate, l.durationType), 0);
    return Math.max(0, limit - used);
  };

  const handleOpenCreate = () => {
    setIsEditing(null);
    setFormData({ 
      type: leaveTypes.filter(t => t.isActive)[0]?.name || '', 
      startDate: '', endDate: '', durationType: 'Full Day', reason: '', notifyUserIds: [], 
      approverId: String(currentUser?.managerId || ''), isUrgent: false
    });
    setShowModal(true);
  };

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingType) updateLeaveType(editingType, typeData);
    else addLeaveType({ ...typeData, id: Math.random().toString(36).substr(2, 9) });
    setShowTypeModal(false);
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = {
        ...formData,
        endDate: formData.durationType === 'Half Day' ? formData.startDate : formData.endDate
    };
    if (isEditing) editLeave(isEditing, finalData);
    else addLeave(finalData);
    setShowModal(false);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      [LeaveStatusEnum.APPROVED]: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      [LeaveStatusEnum.REJECTED]: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      'Pending': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
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
            {['requests', 'balances', 'types', 'calendar'].map(m => (
                <button key={m} onClick={() => setViewMode(m as any)} className={`px-4 py-1.5 rounded-md text-sm transition capitalize ${viewMode === m ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>{m}</button>
            ))}
          </div>
          <button onClick={handleOpenCreate} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center space-x-2 text-sm font-bold uppercase tracking-tight shadow-lg shadow-emerald-500/20"><Plus size={18} /><span>New Request</span></button>
        </div>
      </div>

      {viewMode === 'requests' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b">
                  <tr><th className="px-6 py-4">Employee</th><th className="px-6 py-4">Category</th><th className="px-6 py-4">Period</th><th className="px-6 py-4">Duration</th><th className="px-6 py-4">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {leaves.map(leave => (
                    <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200 text-sm">{leave.userName}</td>
                      <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400 text-xs uppercase">{leave.type}</td>
                      <td className="px-6 py-4 font-mono text-[10px] text-slate-500">
                        {leave.durationType === 'Half Day' ? leave.startDate : `${leave.startDate} to ${leave.endDate}`}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700 dark:text-white text-xs">{getDaysDiff(leave.startDate, leave.endDate, leave.durationType)} Days {leave.durationType === 'Half Day' && <span className="ml-1 text-[8px] font-black uppercase bg-amber-50 text-amber-600 px-1 py-0.5 rounded border border-amber-100">Half</span>}</td>
                      <td className="px-6 py-4"><StatusBadge status={leave.status} /></td>
                    </tr>
                  ))}
                  {leaves.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No records found.</td></tr>}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {viewMode === 'types' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><BookOpen className="text-emerald-600" /> Organizational Leave Policies</h3>
            {isHR && (
              <button onClick={() => { setEditingType(null); setTypeData({ name: '', days: 10, description: '', isActive: true, color: 'text-emerald-600' }); setShowTypeModal(true); }} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all"><Plus size={16} /> Add Leave Type</button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leaveTypes.map(type => (
              <div key={type.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm relative group hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 ${type.color || 'text-emerald-600'}`}>
                      <Calendar size={24} />
                    </div>
                    {isHR && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingType(String(type.id)); setTypeData(type as any); setShowTypeModal(true); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Edit2 size={16}/></button>
                        <button onClick={() => { if(window.confirm('Delete this policy?')) deleteLeaveType(type.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                      </div>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{type.name}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 h-10">{type.description}</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="block text-2xl font-black text-slate-800 dark:text-white">{type.days}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Days / Year</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${type.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>{type.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title={isEditing ? 'Edit Request' : 'New Leave Request'} width="max-w-xl">
        <form onSubmit={handleLeaveSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Leave Category</label>
                <div className="relative">
                  <select 
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none" 
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
                  <p className="text-[10px] text-emerald-600 mt-2 font-black uppercase ml-1">
                    {getBalance(formData.type, leaveTypes.find(lt => lt.name === formData.type)?.days || 0)} Days Remaining
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Approving Manager</label>
                <div className="relative">
                  <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select required className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none" value={formData.approverId} onChange={e => setFormData({...formData, approverId: e.target.value})}>
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
                        className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${formData.durationType === 'Full Day' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                    >
                        Full Day
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setFormData({...formData, durationType: 'Half Day'})}
                        className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${formData.durationType === 'Half Day' ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
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

            <div><label className="block text-[10px] font-black text-slate-500 uppercase ml-1">Reason for Absence</label><textarea required rows={3} className="w-full border rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="Why are you taking leave?"></textarea></div>

            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 flex items-center gap-3">
               <input type="checkbox" id="urgent-check" checked={formData.isUrgent} onChange={e => setFormData({...formData, isUrgent: e.target.checked})} className="w-5 h-5 text-red-600 rounded border-red-200 focus:ring-red-500" />
               <label htmlFor="urgent-check" className="text-xs font-black uppercase text-red-700 flex items-center gap-1.5 cursor-pointer">Mark as Urgent <Flame size={14} /></label>
            </div>

            <MultiSelectUser label="Notify Colleagues" options={users.filter(u => String(u.id) !== String(currentUser?.id))} selectedIds={formData.notifyUserIds} onChange={ids => setFormData({...formData, notifyUserIds: ids as any})} />

            <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
              <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-slate-400 text-xs font-black uppercase">Cancel</button>
              <button type="submit" className="px-8 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95">Submit Request</button>
            </div>
        </form>
      </DraggableModal>

      {/* Leave Type Modal */}
      <DraggableModal isOpen={showTypeModal} onClose={() => setShowTypeModal(false)} title={editingType ? 'Edit Leave Policy' : 'Define New Policy'} width="max-w-md">
        <form onSubmit={handleTypeSubmit} className="space-y-4">
            <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Type Name</label><input required type="text" className="w-full border rounded-xl p-3 text-sm dark:bg-slate-700 dark:text-white outline-none" value={typeData.name} onChange={e => setTypeData({...typeData, name: e.target.value})} placeholder="e.g. Wellness Break" /></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Annual Allowance (Days)</label><input required type="number" className="w-full border rounded-xl p-3 text-sm dark:bg-slate-700 dark:text-white outline-none" value={typeData.days} onChange={e => setTypeData({...typeData, days: parseInt(e.target.value)})} /></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Description</label><textarea required rows={2} className="w-full border rounded-xl p-3 text-sm dark:bg-slate-700 dark:text-white outline-none" value={typeData.description} onChange={e => setTypeData({...typeData, description: e.target.value})} placeholder="Eligibility details..." /></div>
            <div className="flex items-center gap-2 py-2">
              <input type="checkbox" id="active-check" checked={typeData.isActive} onChange={e => setTypeData({...typeData, isActive: e.target.checked})} className="w-4 h-4 text-emerald-600 rounded border-slate-300" />
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
