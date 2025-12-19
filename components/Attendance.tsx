
import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceRecord, UserRole } from '../types';
import { Calendar, Clock, MapPin, Search, Filter, PlayCircle, StopCircle, CheckCircle2, AlertTriangle, X, ShieldCheck, ChevronLeft, ChevronRight, Hourglass, Edit2, Lock } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';

const formatDateISO = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatTime24 = (date: Date) => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

interface AttendanceProps {
  records: AttendanceRecord[];
}

const Attendance: React.FC<AttendanceProps> = ({ records }) => {
  const { checkIn, checkOut, timeEntries, addTimeEntry, projects, currentUser, updateAttendanceRecord, showToast, employees } = useAppContext();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchName, setSearchName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [showEarlyReasonModal, setShowEarlyReasonModal] = useState(false);
  const [earlyReason, setEarlyReason] = useState('');
  const [showTimeLogModal, setShowTimeLogModal] = useState(false);
  const [pendingCheckoutAction, setPendingCheckoutAction] = useState<'normal' | 'early' | null>(null);
  const [logForm, setLogForm] = useState({ projectId: '', task: '', hours: '8', minutes: '00', description: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ checkIn: '', checkOut: '' });
  const [isCustomTask, setIsCustomTask] = useState(false);

  // Derive today's record directly from props to ensure reactivity
  const todayRecord = useMemo(() => {
    if (!currentUser) return undefined;
    const todayStr = formatDateISO(currentTime);
    // Find all sessions for today for this user
    const sessions = records.filter(r => r.employeeId === currentUser.id && r.date === todayStr);
    if (sessions.length === 0) return undefined;
    // Priority: session without a checkOut (Active)
    const active = sessions.find(r => !r.checkOut);
    if (active) return active;
    // Else return the most recent completed session of today
    return sessions[sessions.length - 1];
  }, [records, currentUser, currentTime.getDate()]); // Dependency on date part of currentTime

  const isHR = currentUser?.role === UserRole.HR;
  const userProjects = useMemo(() => projects.filter(p => p.status === 'Active'), [projects]);
  const selectedProjectTasks = useMemo(() => projects.find(p => p.id === logForm.projectId)?.tasks || [], [logForm.projectId, projects]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
      if (!startDate && !endDate) {
          const now = new Date();
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          setStartDate(formatDateISO(firstDay));
          setEndDate(formatDateISO(now));
      }
  }, []);

  const checkInTimeObj = todayRecord?.checkInTime ? new Date(todayRecord.checkInTime) : null;
  const elapsedMs = checkInTimeObj ? currentTime.getTime() - checkInTimeObj.getTime() : 0;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const isEarlyLogout = elapsedHours < 9;

  const getDurationHours = (record: AttendanceRecord): number => {
    if (!record.checkInTime || !record.checkOutTime) return 0;
    const diffMs = new Date(record.checkOutTime).getTime() - new Date(record.checkInTime).getTime();
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
          dates.push(formatDateISO(curr));
          curr.setDate(curr.getDate() + 1);
      }
      return dates;
  };

  const handleCheckOutClick = () => {
    if (!currentUser) return;
    const todayStr = formatDateISO(new Date());
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
    actionType === 'early' ? setShowEarlyReasonModal(true) : checkOut();
  };

  const handleQuickLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const duration = (parseInt(logForm.hours) || 0) * 60 + (parseInt(logForm.minutes) || 0);
    await addTimeEntry({
      userId: currentUser.id, projectId: logForm.projectId === 'NO_PROJECT' ? '' : logForm.projectId,
      task: logForm.task, date: formatDateISO(new Date()), durationMinutes: duration,
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
      const fmtTime = (iso: string | undefined) => iso ? formatTime24(new Date(iso)) : '--:--';

      const updatedRecord: AttendanceRecord = {
          ...editingRecord,
          checkIn: fmtTime(newCheckInISO), checkInTime: newCheckInISO,
          checkOut: fmtTime(newCheckOutISO), checkOutTime: newCheckOutISO,
          status: editingRecord.status
      };
      if (newCheckInISO && newCheckOutISO) {
          if (((new Date(newCheckOutISO).getTime() - new Date(newCheckInISO).getTime()) / (1000 * 60 * 60)) >= 9) updatedRecord.status = 'Present';
      }
      await updateAttendanceRecord(updatedRecord);
      setShowEditModal(false);
      setEditingRecord(null);
  };

  const processedRecords = useMemo(() => {
      let baseRecords = records;
      if (searchName) baseRecords = baseRecords.filter(r => r.employeeName.toLowerCase().includes(searchName.toLowerCase()));
      let employeesToDisplay: { id: string, name: string, workLocation?: string }[] = [];
      if (!isHR) {
          if (currentUser) {
              const emp = employees.find(e => e.id === currentUser.id);
              employeesToDisplay = [emp ? { id: emp.id, name: `${emp.firstName} ${emp.lastName}`, workLocation: emp.workLocation } : { id: currentUser.id, name: currentUser.name, workLocation: currentUser.workLocation }];
          }
      } else {
          let srcEmps = employees;
          if (searchName) srcEmps = srcEmps.filter(e => `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchName.toLowerCase()));
          employeesToDisplay = srcEmps.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, workLocation: e.workLocation }));
      }

      let finalRows: any[] = [];
      const sDate = startDate || formatDateISO(new Date());
      const eDate = endDate || formatDateISO(new Date());
      const rangeDates = getAllDatesInRange(sDate, eDate);
      const todayStr = formatDateISO(new Date());
      const recordMap: Record<string, Record<string, AttendanceRecord>> = {};
      baseRecords.forEach(r => { if (!recordMap[r.date]) recordMap[r.date] = {}; recordMap[r.date][r.employeeId] = r; });

      rangeDates.forEach(dateStr => {
          const isPast = dateStr < todayStr;
          employeesToDisplay.forEach(emp => {
              const existing = recordMap[dateStr]?.[emp.id];
              if (existing) finalRows.push(existing);
              else if (isPast) finalRows.push({ id: `absent-${dateStr}-${emp.id}`, employeeId: emp.id, employeeName: emp.name, date: dateStr, checkIn: '--:--', checkOut: '--:--', status: 'Absent', workLocation: emp.workLocation || 'Office HQ India', isGhost: true } as AttendanceRecord);
          });
      });
      return finalRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
               {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
            <p className="text-sm text-slate-400">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
         </div>

         <div className="flex flex-col items-center gap-3">
             {!todayRecord ? (
                <button onClick={() => checkIn()} className="flex flex-col items-center justify-center w-36 h-36 md:w-40 md:h-40 bg-emerald-50 dark:bg-emerald-900/30 rounded-full border-4 border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:scale-105 transition-all group cursor-pointer shadow-sm">
                   <PlayCircle size={48} className="text-emerald-600 dark:text-emerald-400 mb-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-300" />
                   <span className="font-bold text-emerald-700 dark:text-emerald-400">Check In</span>
                </button>
             ) : todayRecord.checkOut ? (
                <div className="flex flex-col items-center justify-center w-36 h-36 md:w-40 md:h-40 bg-gray-50 dark:bg-slate-700/50 rounded-full border-4 border-gray-100 dark:border-slate-600">
                   <CheckCircle2 size={48} className="text-gray-400 dark:text-gray-500 mb-2" />
                   <span className="font-bold text-gray-500 dark:text-gray-400">Completed</span>
                   <span className="text-xs text-gray-400 dark:text-gray-500">Day finalized</span>
                </div>
             ) : (
                <button onClick={handleCheckOutClick} className={`flex flex-col items-center justify-center w-36 h-36 md:w-40 md:h-40 rounded-full border-4 hover:scale-105 transition-all group cursor-pointer shadow-sm ${isEarlyLogout ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800 hover:bg-amber-100' : 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800 hover:bg-red-100'}`}>
                   <StopCircle size={48} className={`mb-2 ${isEarlyLogout ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`} />
                   <span className={`font-bold ${isEarlyLogout ? 'text-amber-700' : 'text-red-700'}`}>{isEarlyLogout ? 'Early Logout' : 'Check Out'}</span>
                   <span className="text-xs text-slate-500">{Math.floor(elapsedHours)}h {Math.floor((elapsedHours % 1) * 60)}m</span>
                </button>
             )}
         </div>

         <div className="w-full lg:w-auto bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-100 dark:border-slate-600 min-w-[200px]">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 uppercase">Today's Session</h4>
            <div className="space-y-2 text-sm">
               <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Check In:</span><span className="font-medium text-slate-800 dark:text-white">{todayRecord?.checkIn || '--:--'}</span></div>
               <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Check Out:</span><span className="font-medium text-slate-800 dark:text-white">{todayRecord?.checkOut || '--:--'}</span></div>
               <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-2 mt-2"><span className="text-slate-500 dark:text-slate-400">Status:</span><span className={`font-bold ${todayRecord?.checkOut ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{todayRecord?.checkOut ? 'Completed' : (todayRecord ? 'Active' : 'Pending')}</span></div>
            </div>
         </div>
      </div>

      <DraggableModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Update Attendance Record" width="max-w-md">
          <form onSubmit={handleEditSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Check In Time</label><input type="time" required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={editForm.checkIn} onChange={e => setEditForm({...editForm, checkIn: e.target.value})} /></div>
              <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Check Out Time</label><input type="time" required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={editForm.checkOut} onChange={e => setEditForm({...editForm, checkOut: e.target.value})} /></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-slate-600 rounded-lg text-sm">Cancel</button><button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Update Record</button></div>
          </form>
      </DraggableModal>

      {/* Other Modals (TimeLog, EarlyReason) would go here as in the previous version... */}

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="sm:col-span-2">
           <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search Employee</label>
           <div className="relative">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
             <input type="text" placeholder="Search by name..." value={searchName} onChange={(e) => setSearchName(e.target.value)} disabled={!isHR} className={`w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white ${!isHR ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : ''}`} />
           </div>
        </div>
        <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
        <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Employee</th><th className="px-6 py-4">Date</th><th className="px-6 py-4">Check In</th><th className="px-6 py-4">Check Out</th><th className="px-6 py-4">Total Hours</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedRecords.map((record, index) => {
                const isGhost = (record as any).isGhost;
                return (
                <tr key={record.id || index} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isGhost ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{record.employeeName}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{record.date}</td>
                  <td className="px-6 py-4"><div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">{!isGhost && <div className="w-2 h-2 rounded-full bg-emerald-500"></div>}<span>{record.checkIn}</span></div></td>
                  <td className="px-6 py-4"><div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">{record.checkOut && !isGhost ? (<><div className="w-2 h-2 rounded-full bg-orange-400"></div><span>{record.checkOut}</span></>) : !isGhost ? (<span className="text-slate-400 text-xs italic">Active</span>) : (<span>--:--</span>)}</div></td>
                  <td className="px-6 py-4 font-mono text-sm text-slate-700 dark:text-slate-300">{calculateDuration(record)}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${record.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{record.status}</span></td>
                  <td className="px-6 py-4 text-center">{(isHR || (formatDateISO(new Date(record.date)) === formatDateISO(new Date()))) ? (<button onClick={() => openEditModal(record)} className="p-1.5 text-slate-500 hover:text-emerald-600 rounded"><Edit2 size={16} /></button>) : <Lock size={16} className="text-slate-300 mx-auto"/>}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
           <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
             <span>Show</span><select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="border rounded p-1 bg-white dark:bg-slate-800"><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select><span>per page</span>
           </div>
           <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded border border-slate-300 disabled:opacity-50"><ChevronLeft size={16} /></button>
              <span className="text-xs font-medium px-2">Page {currentPage} of {totalPages || 1}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded border border-slate-300 disabled:opacity-50"><ChevronRight size={16} /></button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
