
import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceRecord, UserRole } from '../types';
// Fixed missing Info import from lucide-react
import { Calendar, Clock, MapPin, Search, Filter, PlayCircle, StopCircle, CheckCircle2, AlertTriangle, X, ShieldCheck, ChevronLeft, ChevronRight, Hourglass, Edit2, Trash2, Lock, Zap, Info } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';

const formatDateISO = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatTime12 = (date: Date) => {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }).toLowerCase();
};

interface AttendanceProps {
  records: AttendanceRecord[];
}

const Attendance: React.FC<AttendanceProps> = ({ records }) => {
  const { checkIn, checkOut, timeEntries, addTimeEntry, projects, currentUser, updateAttendanceRecord, deleteAttendanceRecord, showToast } = useAppContext();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [showEarlyReasonModal, setShowEarlyReasonModal] = useState(false);
  const [earlyReason, setEarlyReason] = useState('');
  const [showTimeLogModal, setShowTimeLogModal] = useState(false);
  const [pendingCheckoutAction, setPendingCheckoutAction] = useState<'normal' | 'early' | null>(null);
  
  const [logForm, setLogForm] = useState({ 
    projectId: '', 
    task: '', 
    hours: '8', 
    minutes: '00', 
    description: '',
    includeExtra: false,
    extraHours: '0',
    extraMinutes: '00'
  });
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  
  // Updated state to handle night shifts (cross-day checkout)
  const [editForm, setEditForm] = useState({ 
    checkInDate: '', 
    checkInTime: '', 
    checkOutDate: '', 
    checkOutTime: '' 
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);

  const todayRecord = useMemo(() => {
    if (!currentUser) return undefined;
    const todayStr = formatDateISO(currentTime);
    const sessions = records.filter(r => String(r.employeeId) === String(currentUser.id) && r.date === todayStr);
    if (sessions.length === 0) return undefined;
    const active = sessions.find(r => !r.checkOut);
    if (active) return active;
    return sessions[sessions.length - 1];
  }, [records, currentUser, currentTime.getDate()]);

  const isHR = currentUser?.role === UserRole.HR;
  
  const userProjects = useMemo(() => projects.filter(p => p.status === 'Active'), [projects]);
  const selectedProjectTasks = useMemo(() => {
    if (!logForm.projectId || logForm.projectId === 'NO_PROJECT') return ['General Administration', 'Internal Meeting', 'Documentation', 'Support'];
    return projects.find(p => String(p.id) === String(logForm.projectId))?.tasks || [];
  }, [logForm.projectId, projects]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const checkInTimeObj = todayRecord?.checkInTime ? new Date(todayRecord.checkInTime) : null;
  const elapsedMs = checkInTimeObj ? currentTime.getTime() - checkInTimeObj.getTime() : 0;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const isEarlyLogout = elapsedHours < 9;

  const calculateDuration = (record: AttendanceRecord) => {
    if (!record.checkInTime || !record.checkOutTime) return '--';
    const hrs = (new Date(record.checkOutTime).getTime() - new Date(record.checkInTime).getTime()) / (1000 * 60 * 60);
    const diffHrs = Math.floor(hrs);
    const diffMins = Math.floor((hrs % 1) * 60);
    return `${diffHrs}h ${diffMins}m`;
  };

  const handleCheckOutClick = () => {
    if (!currentUser) return;
    const todayStr = formatDateISO(new Date());
    const hasLog = timeEntries.some(t => String(t.userId) === String(currentUser.id) && t.date === todayStr);
    const actionType = isEarlyLogout ? 'early' : 'normal';
    if (!hasLog) {
        setPendingCheckoutAction(actionType);
        setLogForm({ projectId: '', task: '', hours: '8', minutes: '00', description: '', includeExtra: false, extraHours: '0', extraMinutes: '00' });
        setShowTimeLogModal(true);
        return;
    }
    proceedToCheckout(actionType);
  };

  const proceedToCheckout = (actionType: 'normal' | 'early') => {
    actionType === 'early' ? setShowEarlyReasonModal(true) : checkOut();
  };

  const handleQuickLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const duration = (parseInt(logForm.hours) || 0) * 60 + (parseInt(logForm.minutes) || 0);
    const extraDuration = logForm.includeExtra ? (parseInt(logForm.extraHours) || 0) * 60 + (parseInt(logForm.extraMinutes) || 0) : 0;
    
    await addTimeEntry({
      userId: currentUser.id, projectId: logForm.projectId === 'NO_PROJECT' ? '' : logForm.projectId,
      task: logForm.task, date: formatDateISO(new Date()), durationMinutes: duration,
      extraMinutes: extraDuration,
      description: logForm.description, status: 'Pending', isBillable: true
    });
    setShowTimeLogModal(false);
    if (pendingCheckoutAction) { proceedToCheckout(pendingCheckoutAction); setPendingCheckoutAction(null); }
  };

  const handleEarlyReasonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!earlyReason.trim()) return;
    checkOut(earlyReason);
    setShowEarlyReasonModal(false);
    setEarlyReason('');
  };

  const openEditModal = (record: AttendanceRecord) => {
      setEditingRecord(record);
      
      const cinDateObj = record.checkInTime ? new Date(record.checkInTime) : new Date(record.date);
      const coutDateObj = record.checkOutTime ? new Date(record.checkOutTime) : null;

      setEditForm({ 
        checkInDate: formatDateISO(cinDateObj),
        checkInTime: cinDateObj.toTimeString().substring(0, 5),
        checkOutDate: coutDateObj ? formatDateISO(coutDateObj) : formatDateISO(cinDateObj),
        checkOutTime: coutDateObj ? coutDateObj.toTimeString().substring(0, 5) : ''
      });
      setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingRecord) return;

      const newCheckInISO = new Date(`${editForm.checkInDate}T${editForm.checkInTime}:00`).toISOString();
      const newCheckOutISO = editForm.checkOutTime 
        ? new Date(`${editForm.checkOutDate}T${editForm.checkOutTime}:00`).toISOString() 
        : undefined;

      const fmtTime = (iso: string | undefined) => iso ? formatTime12(new Date(iso)) : '--:--';
      
      const updatedRecord: AttendanceRecord = { 
        ...editingRecord, 
        // Use check-in date as the primary record date
        date: editForm.checkInDate,
        checkIn: fmtTime(newCheckInISO), 
        checkInTime: newCheckInISO, 
        checkOut: fmtTime(newCheckOutISO), 
        checkOutTime: newCheckOutISO 
      };

      await updateAttendanceRecord(updatedRecord);
      setShowEditModal(false);
      setEditingRecord(null);
  };

  const openDeleteConfirm = (record: AttendanceRecord) => {
    setRecordToDelete(record);
    setShowDeleteConfirm(true);
  };

  const handleDeleteSubmit = async () => {
    if (recordToDelete) {
      await deleteAttendanceRecord(recordToDelete.id);
      setShowDeleteConfirm(false);
      setRecordToDelete(null);
    }
  };

  const paginatedRecords = useMemo(() => {
    let filtered = records;
    if (!isHR && currentUser) filtered = filtered.filter(r => String(r.employeeId) === String(currentUser.id));
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [records, isHR, currentUser, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6">
      {/* Clock & Status Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col lg:flex-row justify-between items-center gap-6">
         <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Attendance</h2>
            <div className="mt-2 text-3xl font-mono text-slate-700 dark:text-slate-200 font-semibold uppercase">
               {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}
            </div>
            <p className="text-sm text-slate-400">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
         </div>

         <div className="flex flex-col items-center gap-3">
             {!todayRecord ? (
                <button onClick={() => checkIn()} className="flex flex-col items-center justify-center w-36 h-36 bg-emerald-50 dark:bg-emerald-900/30 rounded-full border-4 border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer">
                   <PlayCircle size={40} className="text-emerald-600 mb-2" />
                   <span className="font-bold text-emerald-700">Check In</span>
                </button>
             ) : todayRecord.checkOut ? (
                <div className="flex flex-col items-center justify-center w-36 h-36 bg-gray-50 dark:bg-slate-700/50 rounded-full border-4 border-gray-100">
                   <CheckCircle2 size={40} className="text-emerald-500 mb-2" />
                   <span className="font-bold text-gray-500">Done</span>
                </div>
             ) : (
                <button onClick={handleCheckOutClick} className={`flex flex-col items-center justify-center w-36 h-36 rounded-full border-4 hover:scale-105 transition-all cursor-pointer ${isEarlyLogout ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                   <StopCircle size={40} className={`${isEarlyLogout ? 'text-amber-600' : 'text-red-600'} mb-2`} />
                   <span className="font-bold">{isEarlyLogout ? 'Early Out' : 'Check Out'}</span>
                   <span className="text-xs text-slate-500">{Math.floor(elapsedHours)}h {Math.floor((elapsedHours % 1) * 60)}m</span>
                </button>
             )}
         </div>

         <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border min-w-[200px]">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Today</h4>
            <div className="space-y-2 text-sm">
               <div className="flex justify-between"><span>Check In:</span><span className="font-bold uppercase">{todayRecord?.checkIn || '--:--'}</span></div>
               <div className="flex justify-between"><span>Check Out:</span><span className="font-bold uppercase">{todayRecord?.checkOut || '--:--'}</span></div>
            </div>
         </div>
      </div>

      {/* Checkout Time Log Modal */}
      <DraggableModal isOpen={showTimeLogModal} onClose={() => setShowTimeLogModal(false)} title="Quick Time Log" width="max-w-lg">
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start gap-2 mb-6">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-amber-800">You must log your work hours before checking out.</p>
          </div>
          <form onSubmit={handleQuickLogSubmit} className="space-y-5">
              <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Project</label>
                  <select required className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none dark:bg-slate-700 bg-white dark:text-white transition shadow-sm" value={logForm.projectId} onChange={e => setLogForm({...logForm, projectId: e.target.value, task: ''})}>
                    <option value="" disabled>Choose project...</option>
                    {userProjects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                    <option value="NO_PROJECT">General / Administration</option>
                  </select>
              </div>
              <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Work Done (Subtask)</label>
                  <select required className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none dark:bg-slate-700 bg-white dark:text-white transition shadow-sm" value={logForm.task} onChange={e => setLogForm({...logForm, task: e.target.value})}>
                    <option value="" disabled>Select subtask...</option>
                    {selectedProjectTasks.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="Other">Other (Custom)</option>
                  </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Standard Hours</label>
                    <div className="flex gap-2">
                        <input type="number" min="0" className="w-full px-2 py-2 border rounded-xl text-center dark:bg-slate-700" value={logForm.hours} onChange={e => setLogForm({...logForm, hours: e.target.value})} />
                        <span className="self-center">:</span>
                        <select className="w-full border rounded-xl px-2 py-2 dark:bg-slate-700" value={logForm.minutes} onChange={e => setLogForm({...logForm, minutes: e.target.value})}>
                           <option value="00">00</option><option value="30">30</option>
                        </select>
                    </div>
                  </div>
                  <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer">
                         <input type="checkbox" checked={logForm.includeExtra} onChange={(e) => setLogForm({...logForm, includeExtra: e.target.checked})} className="w-4 h-4 text-purple-600 rounded" />
                         <span className="text-xs font-bold text-slate-500">Overtime?</span>
                      </label>
                  </div>
              </div>
              {logForm.includeExtra && (
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 dark:bg-purple-900/20 dark:border-purple-800 animate-in slide-in-from-top-2">
                     <label className="block text-[10px] font-bold text-purple-600 uppercase mb-2">Overtime Duration</label>
                     <div className="flex gap-4">
                        <input type="number" placeholder="HH" className="w-full px-3 py-2 border rounded-lg text-center dark:bg-slate-800 dark:text-white" value={logForm.extraHours} onChange={e => setLogForm({...logForm, extraHours: e.target.value})} />
                        <select className="w-full border rounded-lg px-2 py-2 dark:bg-slate-800 dark:text-white" value={logForm.extraMinutes} onChange={e => setLogForm({...logForm, extraMinutes: e.target.value})}>
                           <option value="00">00</option><option value="30">30</option>
                        </select>
                     </div>
                  </div>
              )}
              <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Effort Description</label>
                  <textarea 
                    required 
                    rows={5} 
                    className="w-full px-4 py-3 border rounded-xl text-sm outline-none dark:bg-slate-700 bg-white dark:text-white resize-none custom-scrollbar" 
                    value={logForm.description} 
                    onChange={e => setLogForm({...logForm, description: e.target.value})}
                    placeholder="Provide details about your achievements today..."
                  />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button type="button" onClick={() => setShowTimeLogModal(false)} className="px-4 py-2 text-slate-400 font-bold hover:text-slate-600">Cancel</button>
                  <button type="submit" className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition">Save & Checkout</button>
              </div>
          </form>
      </DraggableModal>

      {/* Early Logout Modal */}
      <DraggableModal isOpen={showEarlyReasonModal} onClose={() => setShowEarlyReasonModal(false)} title="Early Checkout" width="max-w-md">
          <div className="text-center mb-6">
              <Hourglass className="text-amber-500 mx-auto mb-4" />
              <p className="text-sm text-slate-600 dark:text-slate-400">Please provide a reason for leaving before the 9-hour mark.</p>
          </div>
          <form onSubmit={handleEarlyReasonSubmit} className="space-y-4">
              <textarea required rows={3} className="w-full px-4 py-3 border rounded-xl text-sm dark:bg-slate-700 bg-white dark:text-white" placeholder="Reason for early departure..." value={earlyReason} onChange={e => setEarlyReason(e.target.value)} />
              <button type="submit" className="w-full py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors">Submit & Checkout</button>
          </form>
      </DraggableModal>

      {/* Attendance Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 text-xs uppercase border-b">
                <th className="px-6 py-4">Employee</th><th className="px-6 py-4">Date</th><th className="px-6 py-4">Session</th><th className="px-6 py-4">Duration</th><th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {paginatedRecords.map((record, index) => {
                const canManage = isHR || String(record.employeeId) === String(currentUser?.id);
                return (
                  <tr key={record.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{record.employeeName}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{record.date}</td>
                    <td className="px-6 py-4 uppercase text-xs text-slate-700 dark:text-slate-300">{record.checkIn} - {record.checkOut || '--:--'}</td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-700 dark:text-slate-300">{calculateDuration(record)}</td>
                    <td className="px-6 py-4 text-center">
                      {canManage ? (
                        <div className="flex justify-center gap-2">
                           <button onClick={() => openEditModal(record)} className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors" title="Edit Session"><Edit2 size={16} /></button>
                           <button onClick={() => openDeleteConfirm(record)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" title="Delete Session"><Trash2 size={16} /></button>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
              {paginatedRecords.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic font-medium">No attendance logs found for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Edit Modal - Updated for Night Shifts */}
      <DraggableModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Attendance Session" width="max-w-md">
          <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="space-y-4">
                  {/* Check In Group */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Shift Start (Check-In)</label>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Date</label>
                            <input required type="date" className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={editForm.checkInDate} onChange={e => setEditForm({...editForm, checkInDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Time</label>
                            <input required type="time" className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={editForm.checkInTime} onChange={e => setEditForm({...editForm, checkInTime: e.target.value})} />
                        </div>
                    </div>
                  </div>

                  {/* Check Out Group */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <label className="block text-[10px] font-black text-rose-600 uppercase tracking-widest mb-3">Shift End (Check-Out)</label>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Date</label>
                            <input required type="date" className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={editForm.checkOutDate} onChange={e => setEditForm({...editForm, checkOutDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Time</label>
                            <input type="time" className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={editForm.checkOutTime} onChange={e => setEditForm({...editForm, checkOutTime: e.target.value})} />
                        </div>
                    </div>
                  </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-100 dark:border-amber-800 flex items-start gap-2">
                  <Info className="text-amber-600 shrink-0 mt-0.5" size={14} />
                  <p className="text-[10px] text-amber-800 dark:text-amber-200 leading-relaxed font-medium">Night shift records will calculate hours correctly based on these dates. Ensure the checkout date is accurate.</p>
              </div>

              <div className="pt-2">
                  <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20 active:scale-[0.98] text-sm uppercase tracking-widest">Update Session</button>
              </div>
          </form>
      </DraggableModal>

      {/* Delete Confirmation Modal */}
      <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Deletion" width="max-w-sm">
          <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100 dark:border-red-800">
                  <Trash2 className="text-red-600 dark:text-red-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Are you sure?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm px-4">
                  This action will permanently remove this attendance entry. This cannot be undone.
              </p>
          </div>
          <div className="flex gap-3 mt-6 pt-6 border-t dark:border-slate-700">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200">Cancel</button>
              <button onClick={handleDeleteSubmit} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-red-700">Delete</button>
          </div>
      </DraggableModal>
    </div>
  );
};

export default Attendance;
