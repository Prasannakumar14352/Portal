import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceRecord, UserRole } from '../types';
import { PlayCircle, StopCircle, CheckCircle2, Edit2, Trash2, Lock, Info, Clock, Calendar, Filter, RotateCcw, ChevronLeft, ChevronRight, Search, Fingerprint, AlertCircle } from 'lucide-react';
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
  const { checkIn, checkOut, timeEntries, currentUser, updateAttendanceRecord, deleteAttendanceRecord, showToast } = useAppContext();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Search State
  const [employeeSearch, setEmployeeSearch] = useState('');
  
  // Date Filtering State
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [filterStartDate, setFilterStartDate] = useState(formatDateISO(firstDayOfMonth));
  const [filterEndDate, setFilterEndDate] = useState(formatDateISO(today));

  const [showEarlyReasonModal, setShowEarlyReasonModal] = useState(false);
  const [showTimeLogModal, setShowTimeLogModal] = useState(false);
  const [pendingCheckoutAction, setPendingCheckoutAction] = useState<'normal' | 'early' | null>(null);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ checkInDate: '', checkInTime: '', checkOutDate: '', checkOutTime: '' });

  const [showRetroModal, setShowRetroModal] = useState(false);
  const [retroForm, setRetroForm] = useState({ date: '', time: '' });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);

  // Strict check for HR or Admin roles
  const isHR = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;

  // Detect unclosed session (even from previous days)
  const pendingRecord = useMemo(() => {
    if (!currentUser) return undefined;
    const userRecords = records.filter(r => String(r.employeeId) === String(currentUser.id));
    // Find the latest record that hasn't been checked out
    // Ensuring we treat empty string or null as unclosed
    return userRecords
      .filter(r => !r.checkOut || r.checkOut === "")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [records, currentUser]);

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
          <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase w-9 border-r border-slate-100 dark:border-slate-700">Start</span>
                  <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">{record.checkIn}</span>
                      {isNightShift && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">({cinDate?.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})})</span>}
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase w-9 border-r border-slate-100 dark:border-slate-700">End</span>
                  <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">{record.checkOut || '--:--'}</span>
                      {isNightShift && <span className="text-[10px] font-medium text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-1.5 py-0.5 rounded">({coutDate?.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})})</span>}
                  </div>
              </div>
          </div>
      );
  };

  const handleCheckOutClick = () => {
    if (!currentUser || !pendingRecord) return;
    
    const todayStr = formatDateISO(new Date());
    
    // If it's from a previous day, trigger the retroactive date/time picker
    if (pendingRecord.date < todayStr) {
      setRetroForm({ 
        date: todayStr, 
        time: currentTime.toTimeString().substring(0, 5) 
      });
      setShowRetroModal(true);
      return;
    }

    // Normal checkout logic for today
    const hasLog = timeEntries.some(t => String(t.userId) === String(currentUser.id) && t.date === todayStr);
    const actionType = (pendingRecord?.checkInTime && (currentTime.getTime() - new Date(pendingRecord.checkInTime).getTime()) / 3600000 < 9) ? 'early' : 'normal';
    
    if (!hasLog) {
        setPendingCheckoutAction(actionType);
        setShowTimeLogModal(true);
        return;
    }
    
    if (actionType === 'early') {
      setShowEarlyReasonModal(true);
    } else {
      checkOut();
    }
  };

  const handleRetroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingRecord) return;
    
    const coutISO = new Date(`${retroForm.date}T${retroForm.time}:00`).toISOString();
    
    await updateAttendanceRecord({ 
      ...pendingRecord, 
      checkOut: formatTime12(new Date(coutISO)), 
      checkOutTime: coutISO 
    });
    
    setShowRetroModal(false);
    showToast("Session closed successfully", "success");
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

  const filteredRecords = useMemo(() => {
    let filtered = [...records];
    
    // Role based filtering
    if (!isHR && currentUser) {
      filtered = filtered.filter(r => String(r.employeeId) === String(currentUser.id));
    }

    // Name search filtering
    if (employeeSearch) {
        filtered = filtered.filter(r => 
            r.employeeName.toLowerCase().includes(employeeSearch.toLowerCase())
        );
    }

    // Date range filtering
    if (filterStartDate) {
      filtered = filtered.filter(r => r.date >= filterStartDate);
    }
    if (filterEndDate) {
      filtered = filtered.filter(r => r.date <= filterEndDate);
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, isHR, currentUser, filterStartDate, filterEndDate, employeeSearch]);

  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const resetFilters = () => {
    setFilterStartDate(formatDateISO(firstDayOfMonth));
    setFilterEndDate(formatDateISO(today));
    setEmployeeSearch('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Attendance Stats Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col lg:flex-row justify-between items-center gap-8">
         <div className="text-center lg:text-left">
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Attendance</h2>
            <div className="mt-1 text-3xl font-mono text-teal-600 dark:text-teal-400 font-black uppercase tracking-tight">
               {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}
            </div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
         </div>

         <div className="flex flex-col items-center gap-3">
             {!pendingRecord ? (
                <button onClick={() => checkIn()} className="flex flex-col items-center justify-center w-36 h-36 bg-emerald-50 dark:bg-emerald-900/10 rounded-full border-4 border-emerald-100 dark:border-emerald-800/50 hover:scale-105 transition-all cursor-pointer group shadow-xl shadow-emerald-500/5">
                   <PlayCircle size={44} className="text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
                   <span className="font-black text-[10px] text-emerald-700 dark:text-emerald-500 uppercase tracking-widest">Check In</span>
                </button>
             ) : (
                <button onClick={handleCheckOutClick} className="flex flex-col items-center justify-center w-36 h-36 bg-rose-50 dark:bg-rose-900/10 rounded-full border-4 border-rose-100 dark:border-rose-800/50 hover:scale-105 transition-all cursor-pointer group shadow-xl shadow-rose-500/5">
                   <StopCircle size={44} className="text-rose-600 mb-1.5 group-hover:scale-110 transition-transform" />
                   <span className="font-black text-[10px] text-rose-700 dark:text-rose-500 uppercase tracking-widest">Check Out</span>
                   <span className="text-xs font-mono font-bold text-slate-500 mt-1">{calculateDuration(pendingRecord)}</span>
                   {pendingRecord.date < formatDateISO(new Date()) && (
                       <span className="text-[8px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-black uppercase mt-1">Pending Sync</span>
                   )}
                </button>
             )}
         </div>

         <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 min-w-[240px]">
            <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-[0.2em] flex items-center gap-2"><Clock size={14}/> Live Session</h4>
            <div className="space-y-3">
               <div className="flex justify-between items-center"><span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Clock In</span><span className="text-xs font-black text-slate-800 dark:text-white uppercase">{pendingRecord?.checkIn || '--:--'}</span></div>
               <div className="flex justify-between items-center"><span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Total Logged</span><span className="text-sm font-black text-teal-600 dark:text-teal-400">{calculateDuration(pendingRecord || {id: 0, employeeId: 0, employeeName: '', date: '', checkIn: '', checkOut: '', status: 'Absent'})}</span></div>
            </div>
         </div>
      </div>

      {/* Unified Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-1.5 flex-1 w-full">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <Search size={12} /> Search Employee
                  </label>
                  <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Search by name..." 
                        value={employeeSearch} 
                        onChange={e => { setEmployeeSearch(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all dark:text-white font-medium"
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-[2] w-full">
                  <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Calendar size={12} /> From Date
                      </label>
                      <input 
                        type="date" 
                        value={filterStartDate} 
                        onChange={e => { setFilterStartDate(e.target.value); setCurrentPage(1); }}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all dark:text-white font-medium"
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Calendar size={12} /> To Date
                      </label>
                      <input 
                        type="date" 
                        value={filterEndDate} 
                        onChange={e => { setFilterEndDate(e.target.value); setCurrentPage(1); }}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all dark:text-white font-medium"
                      />
                  </div>
              </div>
              <button 
                onClick={resetFilters}
                className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-teal-600 transition-colors text-xs font-bold uppercase tracking-widest border border-transparent hover:border-teal-100 dark:hover:border-teal-900/30 rounded-lg shrink-0 h-[42px]"
              >
                  <RotateCcw size={14} /> Reset
              </button>
          </div>
      </div>

      {/* Records Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.15em] font-black border-b border-slate-200 dark:border-slate-700">
                <th className="px-8 py-5">Employee Detail</th>
                <th className="px-6 py-5">Punch Date</th>
                <th className="px-6 py-5">Shift Session</th>
                <th className="px-6 py-5">Duration</th>
                {isHR && <th className="px-8 py-5 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {paginatedRecords.map((record) => {
                return (
                  <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors group">
                    <td className="px-8 py-5">
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight mb-0.5">{record.employeeName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1.5">ID: <span className="text-teal-600/70">{record.employeeId}</span></div>
                    </td>
                    <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-black text-[11px] font-mono bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700 w-fit shadow-sm">
                            <Calendar size={13} className="text-slate-400" />
                            {record.date}
                        </div>
                    </td>
                    <td className="px-6 py-5">
                        {formatSessionString(record)}
                    </td>
                    <td className="px-6 py-5">
                        <div className="font-mono text-sm font-black text-slate-800 dark:text-teal-400 flex items-center gap-2">
                            <Clock size={14} className="text-slate-300" />
                            {calculateDuration(record)}
                        </div>
                    </td>
                    {isHR && (
                    <td className="px-8 py-5">
                        <div className="flex justify-center gap-2">
                           <button onClick={() => openEditModal(record)} className="p-2.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-xl transition-all shadow-sm bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600" title="Edit Session"><Edit2 size={16} /></button>
                           <button onClick={() => { setRecordToDelete(record); setShowDeleteConfirm(true); }} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all shadow-sm bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600" title="Delete Session"><Trash2 size={16} /></button>
                        </div>
                    </td>
                    )}
                  </tr>
                );
              })}
              {paginatedRecords.length === 0 && (
                <tr><td colSpan={isHR ? 5 : 4} className="px-8 py-24 text-center text-slate-300 dark:text-slate-600 italic font-medium">No records matching your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        
        {filteredRecords.length > itemsPerPage && (
          <div className="px-8 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Showing {(currentPage-1)*itemsPerPage + 1} to {Math.min(currentPage*itemsPerPage, filteredRecords.length)} of {filteredRecords.length} records
              </p>
              <div className="flex gap-2">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 disabled:opacity-30 hover:text-teal-600 transition-colors shadow-sm"
                  >
                      <ChevronLeft size={16} />
                  </button>
                  <button 
                    disabled={currentPage * itemsPerPage >= filteredRecords.length}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 disabled:opacity-30 hover:text-teal-600 transition-colors shadow-sm"
                  >
                      <ChevronRight size={16} />
                  </button>
              </div>
          </div>
        )}
      </div>

      <DraggableModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Correct Session Data" width="max-w-md">
          <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-5">
                  <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 border-b border-emerald-100 pb-2">Shift Commencement</label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Start Date</label>
                           <input required type="date" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-inner" value={editForm.checkInDate} onChange={e => setEditForm({...editForm, checkInDate: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Start Time</label>
                           <input required type="time" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-inner" value={editForm.checkInTime} onChange={e => setEditForm({...editForm, checkInTime: e.target.value})} />
                        </div>
                    </div>
                  </div>
                  <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <label className="block text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mb-4 border-b border-rose-100 pb-2">Shift Conclusion</label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-1">End Date</label>
                           <input required type="date" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-inner" value={editForm.checkOutDate} onChange={e => setEditForm({...editForm, checkOutDate: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-1">End Time</label>
                           <input type="time" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-inner" value={editForm.checkOutTime} onChange={e => setEditForm({...editForm, checkOutTime: e.target.value})} />
                        </div>
                    </div>
                  </div>
              </div>
              <button type="submit" className="w-full py-4 bg-teal-600 text-white rounded-2xl font-black hover:bg-teal-700 transition shadow-xl shadow-teal-500/20 text-xs uppercase tracking-[0.2em] active:scale-[0.98]">Commit Record Update</button>
          </form>
      </DraggableModal>

      {/* Forgotten Checkout / Retroactive Modal */}
      <DraggableModal isOpen={showRetroModal} onClose={() => setShowRetroModal(false)} title="Close Unfinished Session" width="max-w-md">
          <form onSubmit={handleRetroSubmit} className="space-y-6">
              <div className="flex items-start gap-4 bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-800/50 mb-4">
                  <AlertCircle size={24} className="text-amber-600 shrink-0" />
                  <div>
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase mb-1">Previous Session Open</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-500 leading-relaxed font-medium">
                          You checked in on <span className="font-black underline">{pendingRecord?.date}</span> at <span className="font-black underline">{pendingRecord?.checkIn}</span> but forgot to check out. Please provide the checkout details below.
                      </p>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Checkout Date</label>
                      <input 
                        required 
                        type="date" 
                        className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
                        value={retroForm.date} 
                        onChange={e => setRetroForm({...retroForm, date: e.target.value})} 
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Checkout Time</label>
                      <input 
                        required 
                        type="time" 
                        className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
                        value={retroForm.time} 
                        onChange={e => setRetroForm({...retroForm, time: e.target.value})} 
                      />
                  </div>
              </div>

              <button type="submit" className="w-full py-4 bg-teal-600 text-white rounded-2xl font-black shadow-lg shadow-teal-500/20 text-xs uppercase tracking-widest hover:bg-teal-700 transition active:scale-95">Close Session & Check Out</button>
          </form>
      </DraggableModal>

      <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Remove Log Record" width="max-w-sm">
          <div className="text-center py-6">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-red-100 dark:border-red-800"><Trash2 className="text-red-600" size={36} /></div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">Delete this entry?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs px-6 leading-relaxed">This action cannot be undone.</p>
          </div>
          <div className="flex gap-3 mt-4 pt-6 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-4 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors">Abort</button>
              <button onClick={async () => { if (recordToDelete) { await deleteAttendanceRecord(recordToDelete.id); setShowDeleteConfirm(false); } }} className="flex-1 px-4 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-red-500/20 hover:bg-red-700 transition-colors">Purge Record</button>
          </div>
      </DraggableModal>
    </div>
  );
};

export default Attendance;