
import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceRecord, UserRole, Project, TimeEntry } from '../types';
import { PlayCircle, StopCircle, CheckCircle2, Edit2, Trash2, Lock, Info, Clock, Calendar, Filter, RotateCcw, ChevronLeft, ChevronRight, Search, Fingerprint, AlertCircle, FileText, Plus, Loader2, MapPin, ArrowUpDown, Zap, History } from 'lucide-react';
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
  const { checkIn, checkOut, timeEntries, currentUser, updateAttendanceRecord, deleteAttendanceRecord, showToast, projects, addTimeEntry, refreshData, notify } = useAppContext();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Search State
  const [employeeSearch, setEmployeeSearch] = useState('');
  
  // Date Filtering State
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(formatDateISO(firstDayOfMonth));
  const [endDate, setEndDate] = useState(formatDateISO(today));

  // Filters
  const [filterLocation, setFilterLocation] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: 'checkIn' | 'duration'; direction: 'asc' | 'desc' } | null>(null);

  const [showEarlyReasonModal, setShowEarlyReasonModal] = useState(false);
  const [showTimeLogModal, setShowTimeLogModal] = useState(false);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [earlyReason, setEarlyReason] = useState('');
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ checkInDate: '', checkInTime: '', checkOutDate: '', checkOutTime: '' });

  const [showRetroModal, setShowRetroModal] = useState(false);
  const [retroForm, setRetroForm] = useState({ date: '', time: '' });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);

  // Manual Past Entry Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
      date: formatDateISO(new Date(new Date().setDate(new Date().getDate() - 1))),
      checkInTime: '09:00',
      checkOutTime: '18:00',
      location: 'Office HQ India'
  });

  // Time Log Form State for Mandatory Checkout Popup
  const [logFormData, setLogFormData] = useState({
      projectId: '',
      task: '',
      description: '',
      isBillable: true
  });
  
  const [logDurationSplit, setLogDurationSplit] = useState({ standard: 0, extra: 0 });
  const [includeExtraInLog, setIncludeExtraInLog] = useState(false);

  const NO_PROJECT_ID = "NO_PROJECT";

  const availableTasks = useMemo(() => {
    if (!logFormData.projectId || logFormData.projectId === NO_PROJECT_ID) {
      return ['General Administration', 'Internal Meeting', 'Documentation', 'Support', 'Training'].sort();
    }
    const project = projects.find(p => String(p.id) === String(logFormData.projectId));
    if (!project) return [];
    
    let tasks = project.tasks;
    if (typeof tasks === 'string') {
        try {
            const parsed = JSON.parse(tasks);
            tasks = Array.isArray(parsed) ? parsed : [];
        } catch (e) { tasks = []; }
    }
    return Array.isArray(tasks) ? [...tasks].sort() : [];
  }, [logFormData.projectId, projects]);

  const isHR = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;

  const pendingRecord = useMemo(() => {
    if (!currentUser) return undefined;
    const userRecords = records.filter(r => String(r.employeeId) === String(currentUser.id));
    return userRecords
      .filter(r => !r.checkOut || r.checkOut === "")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [records, currentUser]);

  const uniqueLocations = useMemo(() => {
      const locs = new Set(records.map(r => r.workLocation).filter(Boolean));
      return Array.from(locs).sort();
  }, [records]);

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

  const getDurationInMinutes = (record: AttendanceRecord) => {
      const start = record.checkInTime ? new Date(record.checkInTime) : null;
      if (!start) return 0;
      const diffMs = currentTime.getTime() - start.getTime();
      return Math.max(0, Math.floor(diffMs / 60000));
  };

  const getDurationMs = (record: AttendanceRecord) => {
    const start = record.checkInTime ? new Date(record.checkInTime) : null;
    let end = record.checkOutTime ? new Date(record.checkOutTime) : null;
    if (start && !end && String(record.employeeId) === String(currentUser?.id)) {
        end = currentTime;
    }
    if (!start || !end) return -1;
    return end.getTime() - start.getTime();
  };

  const handleCheckOutClick = () => {
    if (!currentUser || !pendingRecord) return;
    
    let durationHrs = 0;
    if (pendingRecord.checkInTime) {
        const checkInTime = new Date(pendingRecord.checkInTime);
        if (!isNaN(checkInTime.getTime())) {
            durationHrs = (currentTime.getTime() - checkInTime.getTime()) / 3600000;
        }
    }
    
    if (durationHrs > 0 && durationHrs < 9) {
      setShowEarlyReasonModal(true);
      return;
    }

    proceedToLogCheck();
  };

  const handleEarlyCheckoutSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setShowEarlyReasonModal(false);
      proceedToLogCheck();
  };

  const proceedToLogCheck = () => {
      if (!currentUser || !pendingRecord) return;

      const recordDate = pendingRecord.date;
      const hasLog = timeEntries.some(t => String(t.userId) === String(currentUser.id) && t.date === recordDate);
      
      if (!hasLog) {
          setLogFormData({ projectId: '', task: '', description: '', isBillable: true });
          
          const totalMins = getDurationInMinutes(pendingRecord);
          const standard = Math.min(totalMins, 480); 
          const extra = Math.max(0, totalMins - 480);
          
          setLogDurationSplit({ standard, extra });
          setIncludeExtraInLog(false); 
          
          setShowTimeLogModal(true);
          return;
      }

      proceedToRetroCheck();
  };

  const handleMandatoryLogSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentUser || !pendingRecord) return;
      
      setIsSubmittingLog(true);
      try {
          const finalDuration = logDurationSplit.standard;
          const finalExtra = includeExtraInLog ? logDurationSplit.extra : 0;

          await addTimeEntry({
              userId: currentUser.id,
              projectId: logFormData.projectId === NO_PROJECT_ID ? "" : logFormData.projectId,
              task: logFormData.task,
              date: pendingRecord.date,
              durationMinutes: finalDuration,
              extraMinutes: finalExtra,
              description: logFormData.description,
              status: 'Pending',
              isBillable: logFormData.isBillable
          });

          showToast(includeExtraInLog ? "Timesheet synced with overtime." : "Timesheet synced (Capped at 8h).", "success");
          setShowTimeLogModal(false);
          proceedToRetroCheck();
      } catch (err) {
          showToast("Failed to sync log.", "error");
      } finally {
          setIsSubmittingLog(false);
      }
  };

  const proceedToRetroCheck = () => {
      if (!pendingRecord) return;
      const todayStr = formatDateISO(new Date());
      
      if (pendingRecord.date < todayStr) {
        setRetroForm({ 
          date: todayStr, 
          time: currentTime.toTimeString().substring(0, 5) 
        });
        setShowRetroModal(true);
        return;
      }

      checkOut(earlyReason);
      setEarlyReason('');
  };

  const handleRetroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingRecord) return;

    const checkOutDate = new Date(`${retroForm.date}T${retroForm.time}:00`);
    let checkInDate = new Date();
    if (pendingRecord.checkInTime) checkInDate = new Date(pendingRecord.checkInTime);

    if (checkOutDate < checkInDate) {
        showToast("Check-out date/time cannot be earlier than check-in date/time.", "error");
        return;
    }

    const coutISO = checkOutDate.toISOString();
    await updateAttendanceRecord({ 
      ...pendingRecord, 
      checkOut: formatTime12(new Date(coutISO)), 
      checkOutTime: coutISO 
    });
    setShowRetroModal(false);
    setEarlyReason('');
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
      
      let coutISO = "";
      if (editForm.checkOutDate && editForm.checkOutTime) {
          const outDt = new Date(`${editForm.checkOutDate}T${editForm.checkOutTime}:00`);
          const inDt = new Date(cinISO);
          if (outDt < inDt) {
              showToast("End date/time cannot be earlier than start date/time.", "error");
              return;
          }
          coutISO = outDt.toISOString();
      }

      await updateAttendanceRecord({ 
        ...editingRecord, 
        date: editForm.checkInDate,
        checkIn: formatTime12(new Date(cinISO)), 
        checkInTime: cinISO, 
        checkOut: coutISO ? formatTime12(new Date(coutISO)) : "", 
        checkOutTime: coutISO 
      });
      setShowEditModal(false);
      showToast("Attendance record updated", "success");
  };

  const handleManualEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const cinISO = new Date(`${manualForm.date}T${manualForm.checkInTime}:00`).toISOString();
    const coutISO = new Date(`${manualForm.date}T${manualForm.checkOutTime}:00`).toISOString();

    if (new Date(coutISO) <= new Date(cinISO)) {
        showToast("Check-out must be after check-in.", "error");
        return;
    }

    const record: AttendanceRecord = {
        id: Math.random().toString(36).substr(2, 9),
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        date: manualForm.date,
        checkIn: formatTime12(new Date(cinISO)),
        checkInTime: cinISO,
        checkOut: formatTime12(new Date(coutISO)),
        checkOutTime: coutISO,
        status: 'Present',
        workLocation: manualForm.location,
        notes: 'Manual historical entry'
    };

    // Use updateAttendanceRecord as it usually handles adding if id is new or call context equivalent
    // Given the context exports checkIn, we'll simulate the db call or use update if available
    await updateAttendanceRecord(record);
    await refreshData();
    setShowManualModal(false);
    showToast("Past shift logged successfully.", "success");
    notify(`Manual attendance logged for ${manualForm.date}`, currentUser.id, 'info');
  };

  const handleSort = (key: 'checkIn' | 'duration') => {
      setSortConfig(current => {
          if (current?.key === key) {
              return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
          }
          return { key, direction: 'desc' };
      });
  };

  const handleResetFilters = () => {
      setStartDate(formatDateISO(firstDayOfMonth));
      setEndDate(formatDateISO(today));
      setEmployeeSearch('');
      setFilterLocation('All');
      setFilterStatus('All');
      setSortConfig(null);
      setCurrentPage(1);
  };

  const filteredRecords = useMemo(() => {
    let filtered = [...records];
    if (!isHR && currentUser) {
        filtered = filtered.filter(r => String(r.employeeId) === String(currentUser.id));
    }
    if (employeeSearch) {
        filtered = filtered.filter(r => r.employeeName.toLowerCase().includes(employeeSearch.toLowerCase()));
    }
    if (startDate) filtered = filtered.filter(r => r.date >= startDate);
    if (endDate) filtered = filtered.filter(r => r.date <= endDate);
    if (filterLocation !== 'All') filtered = filtered.filter(r => r.workLocation === filterLocation);
    if (filterStatus !== 'All') filtered = filtered.filter(r => r.status === filterStatus);

    if (sortConfig) {
        filtered.sort((a, b) => {
            let valA, valB;
            if (sortConfig.key === 'checkIn') {
                valA = new Date(a.checkInTime || a.date).getTime();
                valB = new Date(b.checkInTime || b.date).getTime();
            } else {
                valA = getDurationMs(a);
                valB = getDurationMs(b);
            }
            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        });
    } else {
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return filtered;
  }, [records, startDate, endDate, employeeSearch, filterLocation, filterStatus, sortConfig, isHR, currentUser]); 

  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const formatSessionString = (record: AttendanceRecord) => {
      const cinDate = record.checkInTime ? new Date(record.checkInTime) : null;
      const coutDate = record.checkOutTime ? new Date(record.checkOutTime) : null;
      const isNightShift = cinDate && coutDate && cinDate.toDateString() !== coutDate.toDateString();
      return (
          <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase w-9 border-r border-slate-100 dark:border-slate-700">Start</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200 text-xs uppercase">
                      {record.checkIn}
                      {isNightShift && <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">({cinDate?.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})})</span>}
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase w-9 border-r border-slate-100 dark:border-slate-700">End</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200 text-xs uppercase">
                      {record.checkOut || '--:--'}
                      {isNightShift && <span className="text-[10px] font-medium text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">({coutDate?.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})})</span>}
                  </div>
              </div>
          </div>
      );
  };

  const totalMinsForCurrent = useMemo(() => {
      if (!pendingRecord) return 0;
      return getDurationInMinutes(pendingRecord);
  }, [pendingRecord, currentTime]);

  const isOver8Hours = totalMinsForCurrent > 480;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col lg:flex-row justify-between items-center gap-8">
         <div className="text-center lg:text-left">
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Attendance</h2>
            <div className="mt-1 text-3xl font-mono text-primary-600 dark:text-primary-400 font-black uppercase tracking-tight">
               {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}
            </div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
         </div>

         <div className="flex flex-col items-center gap-3">
             {!pendingRecord ? (
                <div className="flex gap-4 items-center">
                    <button onClick={() => checkIn()} className="flex flex-col items-center justify-center w-36 h-36 bg-emerald-50 dark:bg-emerald-900/10 rounded-full border-4 border-emerald-100 dark:border-emerald-800/50 hover:scale-105 transition-all cursor-pointer group shadow-xl shadow-emerald-500/5">
                        <PlayCircle size={44} className="text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
                        <span className="font-black text-[10px] text-emerald-700 dark:text-emerald-500 uppercase tracking-widest">Check In</span>
                    </button>
                    <button 
                        onClick={() => setShowManualModal(true)} 
                        className="flex flex-col items-center justify-center w-28 h-28 bg-slate-50 dark:bg-slate-800 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all cursor-pointer group opacity-60 hover:opacity-100"
                    >
                        <History size={24} className="text-slate-400 group-hover:text-primary-600 mb-1.5" />
                        <span className="font-bold text-[9px] text-slate-500 dark:text-slate-400 group-hover:text-primary-600 uppercase text-center px-2">Log Past Shift</span>
                    </button>
                </div>
             ) : (
                <button onClick={handleCheckOutClick} className="flex flex-col items-center justify-center w-36 h-36 bg-rose-50 dark:bg-rose-900/10 rounded-full border-4 border-rose-100 dark:border-rose-800/50 hover:scale-105 transition-all cursor-pointer group shadow-xl shadow-rose-500/5">
                   <StopCircle size={44} className="text-rose-600 mb-1.5 group-hover:scale-110 transition-transform" />
                   <span className="font-black text-[10px] text-rose-700 dark:text-rose-500 uppercase tracking-widest">Check Out</span>
                   <span className="text-xs font-mono font-bold text-slate-500 mt-1">{calculateDuration(pendingRecord)}</span>
                </button>
             )}
         </div>

         <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 min-w-[240px]">
            <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-[0.2em] flex items-center gap-2"><Clock size={14}/> Live Session</h4>
            <div className="space-y-3">
               <div className="flex justify-between items-center"><span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Clock In</span><span className="text-xs font-black text-slate-800 dark:text-white uppercase">{pendingRecord?.checkIn || '--:--'}</span></div>
               <div className="flex justify-between items-center"><span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Total Logged</span><span className="text-sm font-black text-primary-600 dark:text-primary-400">{calculateDuration(pendingRecord || {id: 0, employeeId: 0, employeeName: '', date: '', checkIn: '', checkOut: '', status: 'Absent'})}</span></div>
            </div>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col xl:flex-row gap-4 items-end">
          {isHR && (
            <div className="space-y-1.5 flex-1 w-full xl:w-auto">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Search size={12} /> Search Employee</label>
                <div className="relative">
                    <input type="text" placeholder="Search by name..." value={employeeSearch} onChange={e => { setEmployeeSearch(e.target.value); setCurrentPage(1); }} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all dark:text-white font-medium" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-[2] w-full">
              <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Calendar size={12} /> From Date</label>
                  <input type="date" value={startDate} onChange={e => { const nd = e.target.value; if (nd > endDate) { showToast("Invalid range", "warning"); return; } setStartDate(nd); setCurrentPage(1); }} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all dark:text-white font-medium" />
              </div>
              <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Calendar size={12} /> To Date</label>
                  <input type="date" value={endDate} onChange={e => { const nd = e.target.value; if (nd < startDate) { showToast("Invalid range", "warning"); return; } setEndDate(nd); setCurrentPage(1); }} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all dark:text-white font-medium" />
              </div>
              <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><MapPin size={12} /> Work Location</label>
                  <select value={filterLocation} onChange={e => { setFilterLocation(e.target.value); setCurrentPage(1); }} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all dark:text-white font-medium">
                      <option value="All">All Locations</option>
                      {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
              </div>
              <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Filter size={12} /> Status</label>
                  <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all dark:text-white font-medium">
                      <option value="All">All Status</option>
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Late">Late</option>
                  </select>
              </div>
          </div>
          <button onClick={handleResetFilters} className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-primary-600 transition-colors text-xs font-bold uppercase tracking-widest border border-transparent hover:border-primary-100 dark:hover:border-primary-900/30 rounded-lg shrink-0 h-[42px]"><RotateCcw size={14} /> Reset</button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.15em] font-black border-b border-slate-200 dark:border-slate-700">
                <th className="px-8 py-5">Employee Detail</th>
                <th className="px-6 py-5">Punch Date</th>
                <th className="px-6 py-5">
                    <button onClick={() => handleSort('checkIn')} className="flex items-center gap-2 hover:text-primary-600 transition-colors uppercase tracking-[0.15em]">
                        Shift Session <ArrowUpDown size={12} className={sortConfig?.key === 'checkIn' ? 'text-primary-600' : 'text-slate-300'} />
                    </button>
                </th>
                <th className="px-6 py-5">
                    <button onClick={() => handleSort('duration')} className="flex items-center gap-2 hover:text-primary-600 transition-colors uppercase tracking-[0.15em]">
                        Duration <ArrowUpDown size={12} className={sortConfig?.key === 'duration' ? 'text-primary-600' : 'text-slate-300'} />
                    </button>
                </th>
                <th className="px-8 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {paginatedRecords.map((record) => {
                const isOwner = String(record.employeeId) === String(currentUser?.id);
                return (
                  <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors group">
                    <td className="px-8 py-5">
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight mb-0.5">{record.employeeName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1.5">ID: <span className="text-primary-600/70">{record.employeeId}</span></div>
                    </td>
                    <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-black text-[11px] font-mono bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700 w-fit shadow-sm">
                                <Calendar size={13} className="text-slate-400" /> {record.date}
                            </div>
                            {record.notes?.includes('Manual') && (
                                <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter ml-1">Manual Entry</span>
                            )}
                        </div>
                    </td>
                    <td className="px-6 py-5">{formatSessionString(record)}</td>
                    <td className="px-6 py-5"><div className="font-mono text-sm font-black text-slate-800 dark:text-primary-400 flex items-center gap-2"><Clock size={14} className="text-slate-300" /> {calculateDuration(record)}</div></td>
                    <td className="px-8 py-5">
                        <div className="flex justify-center gap-2">
                           {(isHR || isOwner) && (
                               <button onClick={() => openEditModal(record)} className="p-2.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all shadow-sm bg-white dark:bg-slate-700 border border-slate-100" title="Edit Session">
                                   <Edit2 size={16} />
                               </button>
                           )}
                           {isHR && (
                               <button onClick={() => { setRecordToDelete(record); setShowDeleteConfirm(true); }} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm bg-white dark:bg-slate-700 border border-slate-100" title="Delete Session">
                                   <Trash2 size={16} />
                               </button>
                           )}
                           {!isHR && !isOwner && <Lock size={16} className="text-slate-200" />}
                        </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedRecords.length === 0 && (
                <tr><td colSpan={5} className="px-8 py-24 text-center text-slate-300 dark:text-slate-600 italic font-medium">No records matching your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Entry Modal */}
      <DraggableModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} title="Log Historical Shift" width="max-w-md">
          <form onSubmit={handleManualEntrySubmit} className="space-y-6">
              <div className="bg-primary-50 dark:bg-primary-900/10 p-5 rounded-2xl border border-primary-100 dark:border-primary-800/50 flex items-start gap-4">
                  <Info className="text-primary-600 shrink-0" size={24} />
                  <div>
                      <p className="text-xs font-bold text-primary-800 dark:text-primary-400 uppercase tracking-wide mb-1">Manual Attendance Recovery</p>
                      <p className="text-[10px] text-primary-700 dark:text-primary-500 leading-relaxed font-medium">Use this form to log shifts for dates you missed. Entries will be flagged as manual for review.</p>
                  </div>
              </div>

              <div className="space-y-4">
                  <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 mb-1.5">Shift Date</label>
                      <input 
                        type="date" 
                        max={formatDateISO(new Date())}
                        required
                        value={manualForm.date}
                        onChange={e => setManualForm({...manualForm, date: e.target.value})}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 mb-1.5">Check In</label>
                          <input 
                            type="time" 
                            required
                            value={manualForm.checkInTime}
                            onChange={e => setManualForm({...manualForm, checkInTime: e.target.value})}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 mb-1.5">Check Out</label>
                          <input 
                            type="time" 
                            required
                            value={manualForm.checkOutTime}
                            onChange={e => setManualForm({...manualForm, checkOutTime: e.target.value})}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          />
                      </div>
                  </div>
                  <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 mb-1.5">Working Location</label>
                      <select 
                        required
                        value={manualForm.location}
                        onChange={e => setManualForm({...manualForm, location: e.target.value})}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      >
                         <option>Office HQ India</option>
                         <option>WFH India</option>
                         <option>UAE Office</option>
                         <option>USA Office</option>
                         <option>Client Location</option>
                      </select>
                  </div>
              </div>

              <div className="flex gap-3 pt-6 border-t dark:border-slate-700">
                  <button type="button" onClick={() => setShowManualModal(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold rounded-xl text-xs uppercase">Discard</button>
                  <button type="submit" className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl text-xs uppercase shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition">Save Past Shift</button>
              </div>
          </form>
      </DraggableModal>

      <DraggableModal isOpen={showTimeLogModal} onClose={() => setShowTimeLogModal(false)} title="Log Your Daily Activity" width="max-w-xl">
          <form onSubmit={handleMandatoryLogSubmit} className="space-y-6">
              <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-800/50 flex items-start gap-4">
                  <AlertCircle className="text-amber-600 shrink-0" size={24} />
                  <div>
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide mb-1">Timesheet Requirement</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-500 leading-relaxed font-medium">
                        You are checking out for <strong>{pendingRecord?.date}</strong>. Please provide a brief summary of your activities to sync your timesheet.
                      </p>
                  </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                           <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-primary-600"><Clock size={18}/></div>
                           <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Session</p>
                               <p className="text-sm font-black text-slate-800 dark:text-white uppercase">{calculateDuration(pendingRecord || ({} as any))}</p>
                           </div>
                      </div>
                      {isOver8Hours && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1"><Zap size={10}/> Overtime Detected</span>}
                  </div>

                  {isOver8Hours && (
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-primary-100 dark:border-primary-900/30 transition-all shadow-sm">
                          <input 
                            type="checkbox" 
                            id="chkExtraInLog" 
                            checked={includeExtraInLog} 
                            onChange={(e) => setIncludeExtraInLog(e.target.checked)}
                            className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 border-slate-300"
                          />
                          <label htmlFor="chkExtraInLog" className="text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none flex items-center gap-2">
                             Log remaining time as extra hours? <span className="text-[10px] font-medium text-slate-400 italic">(Only if checked)</span>
                          </label>
                      </div>
                  )}

                  <div className={`grid gap-4 ${includeExtraInLog ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 mb-1">Standard Duration</label>
                          <input 
                              type="text" 
                              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm font-bold text-slate-500"
                              value={`${Math.floor(logDurationSplit.standard / 60)}h ${logDurationSplit.standard % 60}m`}
                              readOnly 
                          /> 
                      </div>
                      {includeExtraInLog && (
                        <div>
                             <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 mb-1">Extra Hours</label>
                             <div className="flex gap-2">
                                <input 
                                    type="number"
                                    min="0"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={Math.floor(logDurationSplit.extra / 60)}
                                    onChange={(e) => setLogDurationSplit(prev => ({ ...prev, extra: (parseInt(e.target.value) || 0) * 60 + (prev.extra % 60) }))}
                                />
                                <span className="self-center font-bold text-slate-400">:</span>
                                <input 
                                    type="number"
                                    min="0"
                                    max="59"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={logDurationSplit.extra % 60}
                                    onChange={(e) => setLogDurationSplit(prev => ({ ...prev, extra: (Math.floor(prev.extra / 60) * 60) + (parseInt(e.target.value) || 0) }))}
                                />
                             </div>
                        </div>
                      )}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Project / Client</label>
                      <select required value={logFormData.projectId} onChange={e => setLogFormData({...logFormData, projectId: e.target.value, task: ''})} className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                          <option value="" disabled>Select Project...</option>
                          {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                          <option value={NO_PROJECT_ID}>General / Administrative</option>
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Current Task</label>
                      <select required disabled={!logFormData.projectId} value={logFormData.task} onChange={e => setLogFormData({...logFormData, task: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm disabled:opacity-50">
                          <option value="" disabled>{logFormData.projectId ? "Select subtask..." : "Select project first"}</option>
                          {availableTasks.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                  </div>
              </div>

              <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Work Description</label>
                  <textarea required rows={3} value={logFormData.description} onChange={e => setLogFormData({...logFormData, description: e.target.value})} placeholder="What did you achieve today?" className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                  <button type="button" onClick={() => setShowTimeLogModal(false)} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors">Abort Checkout</button>
                  <button type="submit" disabled={isSubmittingLog} className="px-10 py-3.5 bg-primary-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-500/30 hover:bg-primary-700 transition flex items-center gap-2 active:scale-95">
                      {isSubmittingLog ? <Loader2 size={16} className="animate-spin" /> : 'SAVE & CONTINUE'}
                  </button>
              </div>
          </form>
      </DraggableModal>

      <DraggableModal isOpen={showEarlyReasonModal} onClose={() => setShowEarlyReasonModal(false)} title="Early Shift Conclusion" width="max-w-md">
          <form onSubmit={handleEarlyCheckoutSubmit} className="space-y-5">
              <div className="bg-rose-50 dark:bg-rose-900/10 p-5 rounded-2xl border border-rose-100 dark:border-rose-800/50 flex items-start gap-4">
                  <AlertCircle className="text-rose-600 shrink-0" size={24} />
                  <div>
                      <p className="text-xs font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wide mb-1">Standard Duration Notice</p>
                      <p className="text-[10px] text-rose-700 dark:text-rose-500 leading-relaxed font-medium">You have worked less than the standard 9 hours. This departure will be flagged as an 'Early Departure'.</p>
                  </div>
              </div>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Departure Reason</label>
                  <textarea required value={earlyReason} onChange={e => setEarlyReason(e.target.value)} rows={3} placeholder="Please provide a brief reason..." className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-sm" />
              </div>
              <button type="submit" className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black shadow-lg shadow-rose-500/20 text-[10px] uppercase tracking-widest hover:bg-rose-700 transition active:scale-95">Confirm Departure</button>
          </form>
      </DraggableModal>

      <DraggableModal isOpen={showRetroModal} onClose={() => setShowRetroModal(false)} title="Close Unfinished Session" width="max-w-md">
          <form onSubmit={handleRetroSubmit} className="space-y-6">
              <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-800/50 flex items-start gap-4">
                  <AlertCircle size={24} className="text-amber-600 shrink-0" />
                  <div><p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase mb-1">Previous Session Open</p><p className="text-[10px] text-amber-700 leading-relaxed font-medium">You checked in on <span className="font-black underline">{pendingRecord?.date}</span> at <span className="font-black underline">{pendingRecord?.checkIn}</span> but forgot to check out. Please provide the details below.</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Checkout Date</label><input required type="date" className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={retroForm.date} onChange={e => setRetroForm({...retroForm, date: e.target.value})} /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Checkout Time</label><input required type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={retroForm.time} onChange={e => setRetroForm({...retroForm, time: e.target.value})} /></div>
              </div>
              <button type="submit" className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black shadow-lg text-[10px] uppercase tracking-widest hover:bg-primary-700 transition active:scale-95 shadow-primary-500/20">Close Session & Check Out</button>
          </form>
      </DraggableModal>

      <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Record?" width="max-w-sm">
          <div className="text-center">
              <AlertCircle size={48} className="text-rose-600 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">Are you sure you want to permanently remove this attendance record? This action cannot be undone.</p>
              <div className="flex gap-3">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold rounded-xl text-xs uppercase">Keep Record</button>
                  <button onClick={async () => { if(recordToDelete) { await deleteAttendanceRecord(recordToDelete.id); setShowDeleteConfirm(false); } }} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl text-xs uppercase shadow-lg shadow-rose-500/20">Confirm Delete</button>
              </div>
          </div>
      </DraggableModal>

      <DraggableModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Modify Entry Records" width="max-w-md">
          <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Check In Date</label><input required type="date" className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={editForm.checkInDate} onChange={e => setEditForm({...editForm, checkInDate: e.target.value})} /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Check In Time</label><input required type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={editForm.checkInTime} onChange={e => setEditForm({...editForm, checkInTime: e.target.value})} /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Check Out Date (Optional)</label><input type="date" className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={editForm.checkOutDate} onChange={e => setEditForm({...editForm, checkOutDate: e.target.value})} /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Check Out Time (Optional)</label><input type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={editForm.checkOutTime} onChange={e => setEditForm({...editForm, checkOutTime: e.target.value})} /></div>
              </div>
              <button type="submit" className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black shadow-lg text-[10px] uppercase tracking-widest hover:bg-primary-700 transition active:scale-95 shadow-primary-500/20">Commit Overwrites</button>
          </form>
      </DraggableModal>
    </div>
  );
};

export default Attendance;
