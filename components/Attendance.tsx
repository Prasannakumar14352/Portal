
import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceRecord, UserRole } from '../types';
import { PlayCircle, StopCircle, CheckCircle2, Edit2, Trash2, Lock, Info, Clock, Calendar } from 'lucide-react';
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
  const { checkIn, checkOut, timeEntries, addTimeEntry, currentUser, updateAttendanceRecord, deleteAttendanceRecord, showToast } = useAppContext();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [showEarlyReasonModal, setShowEarlyReasonModal] = useState(false);
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
  const [editForm, setEditForm] = useState({ checkInDate: '', checkInTime: '', checkOutDate: '', checkOutTime: '' });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);

  const isHR = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;

  const todayRecord = useMemo(() => {
    if (!currentUser) return undefined;
    const todayStr = formatDateISO(currentTime);
    const sessions = records.filter(r => String(r.employeeId) === String(currentUser.id) && r.date === todayStr);
    if (sessions.length === 0) return undefined;
    return sessions.find(r => !r.checkOut) || sessions[sessions.length - 1];
  }, [records, currentUser, currentTime.getDate()]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const calculateDuration = (record: AttendanceRecord) => {
    const start = record.checkInTime ? new Date(record.checkInTime) : null;
    let end = record.checkOutTime ? new Date(record.checkOutTime) : null;
    if (start && !end && String(record.employeeId) === String(currentUser?.id)) {
        end = currentTime;
    }
    if (!start || !end) return '--';
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return '0h 0m';
    const hrs = diffMs / (1000 * 60 * 60);
    return `${Math.floor(hrs)}h ${Math.floor((hrs % 1) * 60)}m`;
  };

  const formatSessionString = (record: AttendanceRecord) => {
      const cinDate = record.checkInTime ? new Date(record.checkInTime) : null;
      const coutDate = record.checkOutTime ? new Date(record.checkOutTime) : null;
      
      const isNightShift = cinDate && coutDate && cinDate.toDateString() !== coutDate.toDateString();

      return (
          <div className="flex items-center gap-3">
              <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase w-8">Start</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">{record.checkIn}</span>
                      {isNightShift && <span className="text-[10px] font-medium text-emerald-600">({cinDate?.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})})</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase w-8">End</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">{record.checkOut || '--:--'}</span>
                      {isNightShift && <span className="text-[10px] font-medium text-rose-500">({coutDate?.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})})</span>}
                  </div>
              </div>
          </div>
      );
  };

  const handleCheckOutClick = () => {
    if (!currentUser) return;
    const todayStr = formatDateISO(new Date());
    const hasLog = timeEntries.some(t => String(t.userId) === String(currentUser.id) && t.date === todayStr);
    const actionType = (todayRecord?.checkInTime && (currentTime.getTime() - new Date(todayRecord.checkInTime).getTime()) / 3600000 < 9) ? 'early' : 'normal';
    if (!hasLog) {
        setPendingCheckoutAction(actionType);
        setLogForm({ projectId: '', task: '', hours: '8', minutes: '00', description: '', includeExtra: false, extraHours: '0', extraMinutes: '00' });
        setShowTimeLogModal(true);
        return;
    }
    actionType === 'early' ? setShowEarlyReasonModal(true) : checkOut();
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
      const cinISO = new Date(`${editForm.checkInDate}T${editForm.checkInTime}:00`).toISOString();
      const coutISO = editForm.checkOutTime ? new Date(`${editForm.checkOutDate}T${editForm.checkOutTime}:00`).toISOString() : "";
      await updateAttendanceRecord({ 
        ...editingRecord, 
        date: editForm.checkInDate,
        checkIn: formatTime12(new Date(cinISO)), 
        checkInTime: cinISO, 
        checkOut: coutISO ? formatTime12(new Date(coutISO)) : "", 
        checkOutTime: coutISO 
      });
      setShowEditModal(false);
  };

  const paginatedRecords = useMemo(() => {
    let filtered = records;
    if (!isHR && currentUser) filtered = filtered.filter(r => String(r.employeeId) === String(currentUser.id));
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [records, isHR, currentUser, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6">
      {/* Attendance Stats Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col lg:flex-row justify-between items-center gap-6">
         <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Attendance</h2>
            <div className="mt-1 text-3xl font-mono text-teal-600 dark:text-teal-400 font-bold uppercase tracking-tight">
               {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
         </div>

         <div className="flex flex-col items-center gap-3">
             {!todayRecord ? (
                <button onClick={() => checkIn()} className="flex flex-col items-center justify-center w-32 h-32 bg-emerald-50 dark:bg-emerald-900/20 rounded-full border-4 border-emerald-100 dark:border-emerald-800 hover:scale-105 transition-transform cursor-pointer group">
                   <PlayCircle size={36} className="text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
                   <span className="font-black text-[10px] text-emerald-700 uppercase tracking-widest">Check In</span>
                </button>
             ) : todayRecord.checkOut ? (
                <div className="flex flex-col items-center justify-center w-32 h-32 bg-slate-50 dark:bg-slate-800 rounded-full border-4 border-slate-100 dark:border-slate-700">
                   <CheckCircle2 size={36} className="text-emerald-500 mb-1" />
                   <span className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Shift Done</span>
                </div>
             ) : (
                <button onClick={handleCheckOutClick} className="flex flex-col items-center justify-center w-32 h-32 bg-rose-50 dark:bg-rose-900/20 rounded-full border-4 border-rose-100 dark:border-rose-800 hover:scale-105 transition-transform cursor-pointer group">
                   <StopCircle size={36} className="text-rose-600 mb-1 group-hover:scale-110 transition-transform" />
                   <span className="font-black text-[10px] text-rose-700 uppercase tracking-widest">Check Out</span>
                   <span className="text-[10px] font-mono font-bold text-slate-500 mt-1">{calculateDuration(todayRecord)}</span>
                </button>
             )}
         </div>

         <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 min-w-[220px]">
            <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-2"><Clock size={12}/> Current Session</h4>
            <div className="space-y-3">
               <div className="flex justify-between items-center"><span className="text-xs text-slate-500 font-medium">Punch In</span><span className="text-xs font-black text-slate-800 dark:text-white uppercase">{todayRecord?.checkIn || '--:--'}</span></div>
               <div className="flex justify-between items-center"><span className="text-xs text-slate-500 font-medium">Logged</span><span className="text-xs font-black text-teal-600">{calculateDuration(todayRecord || {id: 0, employeeId: 0, employeeName: '', date: '', checkIn: '', checkOut: '', status: 'Absent'})}</span></div>
            </div>
         </div>
      </div>

      {/* Records Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest font-black border-b border-slate-200 dark:border-slate-700">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Shift Details</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {paginatedRecords.map((record) => {
                // Precise Permission Logic
                const recordDate = new Date(record.date);
                const today = new Date();
                today.setHours(0,0,0,0);
                recordDate.setHours(0,0,0,0);
                const diffTime = today.getTime() - recordDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                
                const isOwn = String(record.employeeId) === String(currentUser?.id);
                
                // Logic: 
                // 1. Block Today (diffDays === 0)
                // 2. Allow Yesterday (diffDays === 1)
                // 3. Special Weekend Case: If check-in was Friday (5), allow edit on Sat(1), Sun(2), Mon(3)
                const isFriday = recordDate.getDay() === 5;
                const canManage = isHR || (isOwn && (diffDays === 1 || (isFriday && diffDays <= 3)));
                
                let lockReason = "";
                if (!canManage) {
                    if (diffDays === 0) lockReason = "Editing opens tomorrow";
                    else if (diffDays > 1) lockReason = "Window closed - Contact HR";
                    else lockReason = "Read Only Access";
                }

                return (
                  <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                    <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{record.employeeName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">#{record.employeeId}</div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-bold text-xs font-mono bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded border border-slate-100 dark:border-slate-800 w-fit">
                            <Calendar size={12} className="text-slate-400" />
                            {record.date}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        {formatSessionString(record)}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm font-black text-slate-800 dark:text-teal-400">{calculateDuration(record)}</td>
                    <td className="px-6 py-4">
                      {canManage ? (
                        <div className="flex justify-center gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => openEditModal(record)} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors shadow-sm bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600"><Edit2 size={16} /></button>
                           <button onClick={() => { setRecordToDelete(record); setShowDeleteConfirm(true); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shadow-sm bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600"><Trash2 size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                            <div className="group/lock relative">
                                <Lock size={14} className="text-slate-200 dark:text-slate-700" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-[9px] font-bold uppercase rounded-lg opacity-0 group-hover/lock:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-20">
                                    {lockReason}
                                </div>
                            </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginatedRecords.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic font-medium">No activity logs found for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <DraggableModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Correct Session Data" width="max-w-md">
          <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Shift Start</label>
                    <div className="grid grid-cols-2 gap-3">
                        <input required type="date" className="px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={editForm.checkInDate} onChange={e => setEditForm({...editForm, checkInDate: e.target.value})} />
                        <input required type="time" className="px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={editForm.checkInTime} onChange={e => setEditForm({...editForm, checkInTime: e.target.value})} />
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <label className="block text-[10px] font-black text-rose-600 uppercase tracking-widest mb-3">Shift End</label>
                    <div className="grid grid-cols-2 gap-3">
                        <input required type="date" className="px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={editForm.checkOutDate} onChange={e => setEditForm({...editForm, checkOutDate: e.target.value})} />
                        <input type="time" className="px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={editForm.checkOutTime} onChange={e => setEditForm({...editForm, checkOutTime: e.target.value})} />
                    </div>
                  </div>
              </div>
              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-800">
                  <Info className="text-amber-600 shrink-0" size={16} />
                  <p className="text-[10px] text-amber-800 dark:text-amber-300 font-bold uppercase tracking-tight leading-normal">Updates are only permitted during the Day+1 window. All manual adjustments are audited.</p>
              </div>
              <button type="submit" className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition shadow-lg shadow-teal-500/20 text-xs uppercase tracking-widest">Update Record</button>
          </form>
      </DraggableModal>

      <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Deletion" width="max-w-sm">
          <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100 dark:border-red-800"><Trash2 className="text-red-600" size={32} /></div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Delete Log?</h3>
              <p className="text-slate-500 text-sm px-4">This action cannot be undone. Standard employees can only delete records within the valid Day+1 window.</p>
          </div>
          <div className="flex gap-3 mt-6 pt-6 border-t dark:border-slate-700">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={async () => { if (recordToDelete) { await deleteAttendanceRecord(recordToDelete.id); setShowDeleteConfirm(false); } }} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-700 transition-colors">Delete</button>
          </div>
      </DraggableModal>
    </div>
  );
};

export default Attendance;
