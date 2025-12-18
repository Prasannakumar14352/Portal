
import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceRecord, UserRole } from '../types';
import { Calendar, Clock, MapPin, Search, Filter, PlayCircle, StopCircle, CheckCircle2, AlertTriangle, X, ShieldCheck, ChevronLeft, ChevronRight, Hourglass, Edit2, Lock } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';

interface AttendanceProps {
  records: AttendanceRecord[];
}

const Attendance: React.FC<AttendanceProps> = ({ records }) => {
  const { checkIn, checkOut, timeEntries, addTimeEntry, projects, currentUser, updateAttendanceRecord, showToast, employees } = useAppContext();
  
  // Use a local date string for consistent filtering across timezones
  const getLocalDateString = (date: Date = new Date()) => {
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD
  };

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchName, setSearchName] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Attendance Logic State
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Early Logout State
  const [showEarlyReasonModal, setShowEarlyReasonModal] = useState(false);
  const [earlyReason, setEarlyReason] = useState('');
  
  // Time Log Enforcement State
  const [showTimeLogModal, setShowTimeLogModal] = useState(false);
  const [pendingCheckoutAction, setPendingCheckoutAction] = useState<'normal' | 'early' | null>(null);
  const [logForm, setLogForm] = useState({
    projectId: '',
    task: '',
    hours: '8',
    minutes: '00',
    description: ''
  });

  // Edit/Correction Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ checkIn: '', checkOut: '' });

  const [isCustomTask, setIsCustomTask] = useState(false);

  // Derive today's record directly from props to ensure reactivity
  const todayRecord = useMemo(() => {
    if (!currentUser) return undefined;
    const todayStr = getLocalDateString();
    // First priority: session with no checkout
    const active = records.find(r => r.employeeId === currentUser.id && !r.checkOut);
    if (active) return active;
    // Second priority: any record for today
    return records.find(r => r.employeeId === currentUser.id && r.date === todayStr);
  }, [records, currentUser]);

  const isHR = currentUser?.role === UserRole.HR;

  const userProjects = useMemo(() => {
    return projects.filter(p => p.status === 'Active');
  }, [projects]);

  const selectedProjectTasks = useMemo(() => {
    return projects.find(p => p.id === logForm.projectId)?.tasks || [];
  }, [logForm.projectId, projects]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
      if (!startDate && !endDate) {
          const now = new Date();
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          setStartDate(getLocalDateString(firstDay));
          setEndDate(getLocalDateString(now));
      }
  }, []);

  // Calculate elapsed time for the active session
  const checkInTimeObj = todayRecord?.checkInTime ? new Date(todayRecord.checkInTime) : null;
  const elapsedMs = checkInTimeObj ? currentTime.getTime() - checkInTimeObj.getTime() : 0;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const isEarlyLogout = elapsedHours < 9;

  const getDurationHours = (record: AttendanceRecord): number => {
    if (!record.checkInTime || !record.checkOutTime) return 0;
    const start = new Date(record.checkInTime);
    const end = new Date(record.checkOutTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffMs = end.getTime() - start.getTime();
    return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
  };

  const calculateDuration = (record: AttendanceRecord) => {
    const hrs = getDurationHours(record);
    if (hrs === 0) return '--';
    const diffHrs = Math.floor(hrs);
    const diffMins = Math.floor((hrs % 1) * 60);
    return `${diffHrs}h ${diffMins}m`;
  };

  const getAllDatesInRange = (start: string, end: string) => {
      const dates = [];
      const curr = new Date(start);
      const last = new Date(end);
      while (curr <= last) {
          dates.push(getLocalDateString(curr));
          curr.setDate(curr.getDate() + 1);
      }
      return dates;
  };

  const handleCheckOutClick = () => {
    if (!currentUser) return;
    const todayStr = getLocalDateString();
    const hasLog = timeEntries.some(t => t.userId === currentUser.id && t.date === todayStr);
    const actionType = isEarlyLogout ? 'early' : 'normal';

    if (!hasLog) {
        setPendingCheckoutAction(actionType);
        setLogForm({ projectId: '', task: '', hours: '8', minutes: '00', description: '' });
        setIsCustomTask(false);
        setShowTimeLogModal(true);
        return;
    }
    proceedToCheckout(actionType);
  };

  const proceedToCheckout = (actionType: 'normal' | 'early') => {
    if (actionType === 'early') {
      setShowEarlyReasonModal(true);
    } else {
      checkOut();
    }
  };

  const handleQuickLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const duration = (parseInt(logForm.hours) || 0) * 60 + (parseInt(logForm.minutes) || 0);
    await addTimeEntry({
      userId: currentUser.id,
      projectId: logForm.projectId === 'NO_PROJECT' ? '' : logForm.projectId,
      task: logForm.task,
      date: getLocalDateString(),
      durationMinutes: duration,
      description: logForm.description,
      status: 'Pending',
      isBillable: true
    });
    setShowTimeLogModal(false);
    if (pendingCheckoutAction) {
        proceedToCheckout(pendingCheckoutAction);
        setPendingCheckoutAction(null);
    }
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
      const cin = record.checkInTime ? new Date(record.checkInTime).toTimeString().substring(0, 5) : '';
      const cout = record.checkOutTime ? new Date(record.checkOutTime).toTimeString().substring(0, 5) : '';
      setEditForm({ checkIn: cin, checkOut: cout });
      setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingRecord) return;
      const datePart = editingRecord.date;
      const newCheckInISO = editForm.checkIn ? new Date(`${datePart}T${editForm.checkIn}:00`).toISOString() : undefined;
      const newCheckOutISO = editForm.checkOut ? new Date(`${datePart}T${editForm.checkOut}:00`).toISOString() : undefined;
      
      const formatTime = (iso: string | undefined) => {
          if (!iso) return '--:--';
          return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      };

      const updatedRecord: AttendanceRecord = {
          ...editingRecord,
          checkIn: formatTime(newCheckInISO),
          checkInTime: newCheckInISO,
          checkOut: formatTime(newCheckOutISO),
          checkOutTime: newCheckOutISO,
          status: editingRecord.status
      };

      if (newCheckInISO && newCheckOutISO) {
          const diffMs = new Date(newCheckOutISO).getTime() - new Date(newCheckInISO).getTime();
          const hrs = diffMs / (1000 * 60 * 60);
          if (hrs >= 9) updatedRecord.status = 'Present';
      }

      await updateAttendanceRecord(updatedRecord);
      setShowEditModal(false);
      setEditingRecord(null);
  };

  const isYesterday = (dateStr: string) => {
      const d = new Date(dateStr);
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return d.toDateString() === y.toDateString();
  };

  const processedRecords = useMemo(() => {
      let baseRecords = records;
      if (searchName) {
          baseRecords = baseRecords.filter(r => r.employeeName.toLowerCase().includes(searchName.toLowerCase()));
      }

      let employeesToDisplay: { id: string, name: string, workLocation?: string }[] = [];
      if (!isHR) {
          if (currentUser) {
              const emp = employees.find(e => e.id === currentUser.id);
              employeesToDisplay = [emp ? { id: emp.id, name: `${emp.firstName} ${emp.lastName}`, workLocation: emp.workLocation } : { id: currentUser.id, name: currentUser.name, workLocation: currentUser.workLocation }];
          }
      } else {
          let sourceEmployees = employees;
          if (searchName) {
              sourceEmployees = sourceEmployees.filter(e => `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchName.toLowerCase()));
          }
          employeesToDisplay = sourceEmployees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, workLocation: e.workLocation }));
      }

      let finalRows: any[] = [];
      const sDate = startDate || getLocalDateString();
      const eDate = endDate || getLocalDateString();
      const rangeDates = getAllDatesInRange(sDate, eDate);
      const todayLocal = getLocalDateString();

      const recordMap: Record<string, Record<string, AttendanceRecord>> = {};
      baseRecords.forEach(r => {
          if (!recordMap[r.date]) recordMap[r.date] = {};
          recordMap[r.date][r.employeeId] = r;
      });

      if (employeesToDisplay.length > 0) {
          rangeDates.forEach(dateStr => {
              const isPast = dateStr < todayLocal;
              employeesToDisplay.forEach(emp => {
                  const existing = recordMap[dateStr]?.[emp.id];
                  if (existing) {
                      finalRows.push(existing);
                  } else if (isPast) {
                      finalRows.push({
                          id: `absent-${dateStr}-${emp.id}`,
                          employeeId: emp.id,
                          employeeName: emp.name,
                          date: dateStr,
                          checkIn: '--:--',
                          checkOut: '--:--',
                          status: 'Absent',
                          workLocation: emp.workLocation || 'Office HQ India',
                          isGhost: true
                      } as AttendanceRecord);
                  }
              });
          });
          finalRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      return finalRows;
  }, [records, startDate, endDate, searchName, isHR, currentUser, employees]);

  useEffect(() => { setCurrentPage(1); }, [searchName, startDate, endDate, itemsPerPage]);

  const totalPages = Math.ceil(processedRecords.length / itemsPerPage);
  const paginatedRecords = processedRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col lg:flex-row justify-between items-center gap-6">
         <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Attendance Tracker</h2>
            <p className="text-slate-500 dark:text-slate-400">Manage your daily work hours.</p>
            <div className="mt-2 text-3xl font-mono text-slate-700 dark:text-slate-200 font-semibold tracking-wider">
               {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <p className="text-sm text-slate-400">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
         </div>

         <div className="flex flex-col items-center gap-3">
             {!todayRecord ? (
                <div className="flex flex-col items-center">
                  <button 
                    onClick={() => checkIn()}
                    className="flex flex-col items-center justify-center w-36 h-36 md:w-40 md:h-40 bg-emerald-50 dark:bg-emerald-900/30 rounded-full border-4 border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:scale-105 transition-all group cursor-pointer shadow-sm"
                  >
                     <PlayCircle size={48} className="text-emerald-600 dark:text-emerald-400 mb-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-300" />
                     <span className="font-bold text-emerald-700 dark:text-emerald-400">Check In</span>
                     <span className="text-xs text-emerald-500 dark:text-emerald-600">Start your day</span>
                  </button>
                </div>
             ) : todayRecord.checkOut ? (
                <div className="flex flex-col items-center justify-center w-36 h-36 md:w-40 md:h-40 bg-gray-50 dark:bg-slate-700/50 rounded-full border-4 border-gray-100 dark:border-slate-600">
                   <CheckCircle2 size={48} className="text-gray-400 dark:text-gray-500 mb-2" />
                   <span className="font-bold text-gray-500 dark:text-gray-400">Completed</span>
                   <span className="text-xs text-gray-400 dark:text-gray-500">Good job today!</span>
                </div>
             ) : (
                <button 
                  onClick={handleCheckOutClick}
                  className={`flex flex-col items-center justify-center w-36 h-36 md:w-40 md:h-40 rounded-full border-4 hover:scale-105 transition-all group cursor-pointer shadow-sm ${
                    isEarlyLogout ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50' : 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50'
                  }`}
                >
                   <StopCircle size={48} className={`mb-2 ${isEarlyLogout ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`} />
                   <span className={`font-bold ${isEarlyLogout ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'}`}>
                     {isEarlyLogout ? 'Early Logout' : 'Check Out'}
                   </span>
                   <span className={`text-xs ${isEarlyLogout ? 'text-amber-500 dark:text-amber-600' : 'text-red-500 dark:text-red-600'}`}>
                     {Math.floor(elapsedHours)}h {Math.floor((elapsedHours % 1) * 60)}m elapsed
                   </span>
                </button>
             )}
         </div>

         <div className="w-full lg:w-auto bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-100 dark:border-slate-600 min-w-[200px]">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 uppercase">Today's Session</h4>
            <div className="space-y-2 text-sm">
               <div className="flex justify-between">
                 <span className="text-slate-500 dark:text-slate-400">Check In:</span>
                 <span className="font-medium text-slate-800 dark:text-white">{todayRecord?.checkIn || '--:--'}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-slate-500 dark:text-slate-400">Check Out:</span>
                 <span className="font-medium text-slate-800 dark:text-white">{todayRecord?.checkOut || '--:--'}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-slate-500 dark:text-slate-400">Location:</span>
                 <span className="font-medium text-slate-800 dark:text-white truncate max-w-[100px]" title={todayRecord?.workLocation}>{todayRecord?.workLocation || '--'}</span>
               </div>
               <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-2 mt-2">
                 <span className="text-slate-500 dark:text-slate-400">Status:</span>
                 <span className={`font-bold ${
                    todayRecord?.checkOut 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : todayRecord?.status === 'Late' 
                            ? 'text-amber-600 dark:text-amber-400' 
                            : todayRecord ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                 }`}>
                    {todayRecord?.checkOut ? 'Completed' : (todayRecord?.status || 'Pending')}
                 </span>
               </div>
            </div>
         </div>
      </div>

      <DraggableModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Update Attendance Record" width="max-w-md">
          <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg text-xs text-yellow-800 dark:text-yellow-200">
                  <p>You are updating a record for {editingRecord?.date}.</p>
                  {!isHR && <p className="mt-1 font-semibold">Note: Older records require HR approval.</p>}
              </div>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Check In Time</label>
                      <input type="time" required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={editForm.checkIn} onChange={e => setEditForm({...editForm, checkIn: e.target.value})} />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Check Out Time</label>
                      <input type="time" required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={editForm.checkOut} onChange={e => setEditForm({...editForm, checkOut: e.target.value})} />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                      <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm">Cancel</button>
                      <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Update Record</button>
                  </div>
              </form>
          </div>
      </DraggableModal>

      {showTimeLogModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg"><Clock size={24} /></div>
                    <div><h3 className="text-lg font-bold text-gray-800 dark:text-white">Daily Time Log Required</h3><p className="text-xs text-gray-500 dark:text-slate-400">You must log your work before checking out.</p></div>
                 </div>
                 <button onClick={() => { setShowTimeLogModal(false); setPendingCheckoutAction(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"><X size={20}/></button>
              </div>
              <form onSubmit={handleQuickLogSubmit} className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Project</label>
                    <select required className="w-full border dark:border-slate-600 rounded-lg p-2.5 text-sm bg-gray-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white" value={logForm.projectId} onChange={e => { setLogForm({...logForm, projectId: e.target.value, task: ''}); setIsCustomTask(false); }}>
                       <option value="">Select Project...</option>
                       {userProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                       <option value="NO_PROJECT">General / Other</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Task</label>
                    {selectedProjectTasks.length > 0 && !isCustomTask ? (
                      <div className="flex gap-2">
                        <select className="w-full border dark:border-slate-600 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white" value={logForm.task} onChange={e => setLogForm({...logForm, task: e.target.value})} required>
                          <option value="">Select Task...</option>
                          {selectedProjectTasks.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button type="button" onClick={() => setIsCustomTask(true)} className="px-3 border dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 text-xs font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap">Other</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input required type="text" placeholder="What did you work on today?" className="w-full border dark:border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none dark:bg-slate-700 dark:text-white" value={logForm.task} onChange={e => setLogForm({...logForm, task: e.target.value})} autoFocus={isCustomTask} />
                         {selectedProjectTasks.length > 0 && <button type="button" onClick={() => setIsCustomTask(false)} className="px-3 border dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 text-xs font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap">List</button>}
                      </div>
                    )}
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Hours</label><input type="number" min="0" max="23" className="w-full border dark:border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none dark:bg-slate-700 dark:text-white" value={logForm.hours} onChange={e => setLogForm({...logForm, hours: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Minutes</label><select className="w-full border dark:border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none dark:bg-slate-700 dark:text-white" value={logForm.minutes} onChange={e => setLogForm({...logForm, minutes: e.target.value})}><option value="00">00</option><option value="15">15</option><option value="30">30</option><option value="45">45</option></select></div>
                 </div>
                 <div><label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Description</label><textarea required className="w-full border dark:border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none dark:bg-slate-700 dark:text-white" rows={3} value={logForm.description} onChange={e => setLogForm({...logForm, description: e.target.value})} placeholder="Brief summary of work..." /></div>
                 <button type="submit" className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-bold shadow-md hover:bg-emerald-700 transition flex items-center justify-center gap-2 mt-2"><ShieldCheck size={18} /> Save & Check Out</button>
              </form>
           </div>
        </div>
      )}

      {showEarlyReasonModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400"><AlertTriangle size={24} /><h3 className="text-lg font-bold text-gray-800 dark:text-white">Early Logout</h3></div>
                 <button onClick={() => setShowEarlyReasonModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"><X size={20}/></button>
              </div>
              <p className="text-gray-600 dark:text-slate-300 text-sm mb-4">You are logging out before completing 9 hours. Please provide a reason for the record.</p>
              <form onSubmit={handleEarlyReasonSubmit} className="space-y-4">
                 <textarea required className="w-full border dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none dark:bg-slate-700 dark:text-white" rows={3} placeholder="E.g., Medical appointment, Half-day leave..." value={earlyReason} onChange={(e) => setEarlyReason(e.target.value)} />
                 <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowEarlyReasonModal(false)} className="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-sm">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium">Confirm & Logout</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="sm:col-span-2">
           <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search Employee</label>
           <div className="relative">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
             <input type="text" placeholder="Search by name..." value={searchName} onChange={(e) => setSearchName(e.target.value)} disabled={!isHR} className={`w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white ${!isHR ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : ''}`} />
           </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px] md:min-w-0">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Check In</th>
                <th className="px-6 py-4">Check Out</th>
                <th className="px-6 py-4">Total Hours</th>
                <th className="px-6 py-4">Work Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedRecords.map((record, index) => {
                const durationHrs = getDurationHours(record);
                const isGhost = (record as any).isGhost;
                const canEdit = isHR || isYesterday(record.date);
                let displayStatus = record.status;
                if (!isGhost && durationHrs >= 9) displayStatus = 'Present';
                const employee = employees.find(e => e.id === record.employeeId);
                const displayLocation = employee?.workLocation || record.workLocation || 'Office HQ India';

                return (
                <tr key={record.id || index} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isGhost ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{record.employeeName}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{record.date}</td>
                  <td className="px-6 py-4"><div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">{!isGhost && <div className="w-2 h-2 rounded-full bg-emerald-500"></div>}<span>{record.checkIn}</span></div></td>
                  <td className="px-6 py-4"><div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">{record.checkOut && !isGhost ? (<><div className="w-2 h-2 rounded-full bg-orange-400"></div><span>{record.checkOut}</span></>) : !isGhost ? (<span className="text-slate-400 text-xs italic">Active</span>) : (<span>--:--</span>)}</div>{record.notes && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 max-w-[150px] truncate" title={record.notes}>{record.notes}</p>}</td>
                  <td className="px-6 py-4 font-mono text-sm text-slate-700 dark:text-slate-300">{calculateDuration(record)}</td>
                  <td className="px-6 py-4"><div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400 text-sm"><MapPin size={14} /><span>{displayLocation}</span></div></td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${displayStatus === 'Present' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : displayStatus === 'Late' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{displayStatus}</span></td>
                  <td className="px-6 py-4 text-center">{isGhost ? (isHR ? (<button onClick={() => openEditModal({ ...record, id: Math.random().toString(36), isGhost: false } as AttendanceRecord)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-bold">Add</button>) : (<span className="text-xs text-slate-400 italic">Absent</span>)) : (canEdit ? (<button onClick={() => openEditModal(record)} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30 rounded transition" title="Edit Record"><Edit2 size={16} /></button>) : (<div className="group relative inline-block"><Lock size={16} className="text-slate-300 dark:text-slate-600 cursor-not-allowed" /><span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-24 bg-black text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center">Request HR</span></div>))}</td>
                </tr>
              )})}
              {paginatedRecords.length === 0 && (<tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">{isHR ? "No attendance records found matching your filters." : "You have no attendance records matching the criteria."}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 gap-4 sm:gap-0">
           <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
             <span>Show</span>
             <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="border border-slate-300 dark:border-slate-600 rounded p-1 outline-none bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500"><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select>
             <span>per page</span>
             <span className="hidden sm:inline mx-2 text-slate-300 dark:text-slate-600">|</span>
             <span className="hidden sm:inline">Showing <span className="font-medium text-slate-700 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-slate-700 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, processedRecords.length)}</span> of <span className="font-medium text-slate-700 dark:text-slate-200">{processedRecords.length}</span> results</span>
           </div>
           <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm"><ChevronLeft size={16} /></button>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 px-2">Page {currentPage} of {totalPages || 1}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm"><ChevronRight size={16} /></button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
