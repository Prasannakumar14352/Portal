
import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceRecord, UserRole } from '../types';
import { Calendar, Clock, MapPin, Search, Filter, PlayCircle, StopCircle, CheckCircle2, AlertTriangle, X, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

interface AttendanceProps {
  records: AttendanceRecord[];
}

const LOCATIONS = [
  'Office HQ India',
  'WFH India',
  'UAE Office',
  'UAE Client Location',
  'USA'
];

const Attendance: React.FC<AttendanceProps> = ({ records }) => {
  const { checkIn, checkOut, getTodayAttendance, timeEntries, addTimeEntry, projects, currentUser } = useAppContext();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchName, setSearchName] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

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

  // Toggle between project tasks and custom input
  const [isCustomTask, setIsCustomTask] = useState(false);

  const todayRecord = getTodayAttendance();
  const isHR = currentUser?.role === UserRole.HR;

  // Derived state for tasks based on selected project
  const selectedProjectTasks = useMemo(() => {
    return projects.find(p => p.id === logForm.projectId)?.tasks || [];
  }, [logForm.projectId, projects]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate elapsed time for today
  const checkInTimeObj = todayRecord?.checkInTime ? new Date(todayRecord.checkInTime) : null;
  const elapsedMs = checkInTimeObj ? currentTime.getTime() - checkInTimeObj.getTime() : 0;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const isEarlyLogout = elapsedHours < 9;

  const handleCheckOutClick = () => {
    if (!currentUser) return;

    // 1. Check if a time log exists for today
    const todayStr = new Date().toISOString().split('T')[0];
    const hasLog = timeEntries.some(t => t.userId === currentUser.id && t.date === todayStr);

    // Determine intended action
    const actionType = isEarlyLogout ? 'early' : 'normal';

    if (!hasLog) {
        setPendingCheckoutAction(actionType);
        // Reset log form defaults
        setLogForm({ projectId: '', task: '', hours: '8', minutes: '00', description: '' });
        setIsCustomTask(false);
        setShowTimeLogModal(true);
        return;
    }

    // 2. Proceed if log exists
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
      date: new Date().toISOString().split('T')[0],
      durationMinutes: duration,
      description: logForm.description,
      status: 'Pending',
      isBillable: true
    });
    
    setShowTimeLogModal(false);
    
    // Resume the pending action
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

  const filteredRecords = records.filter(record => {
    // Permission Check: If not HR, only show own records
    if (!isHR && record.employeeId !== currentUser?.id) return false;

    // Filter by Name
    const nameMatch = record.employeeName.toLowerCase().includes(searchName.toLowerCase());
    
    // Filter by Date Range
    let dateMatch = true;
    if (startDate && endDate) {
      const recDate = new Date(record.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      dateMatch = recDate >= start && recDate <= end;
    } else if (startDate) {
      const recDate = new Date(record.date);
      const start = new Date(startDate);
      dateMatch = recDate >= start;
    }

    return nameMatch && dateMatch;
  });

  // Reset pagination when filters or items per page change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchName, startDate, endDate, itemsPerPage]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Filter projects assigned to user
  const userProjects = projects.filter(p => currentUser?.projectIds?.includes(p.id));

  return (
    <div className="space-y-6">
      
      {/* Interactive Attendance Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col lg:flex-row justify-between items-center gap-6">
         <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-800">Attendance Tracker</h2>
            <p className="text-slate-500">Manage your daily work hours.</p>
            <div className="mt-2 text-3xl font-mono text-slate-700 font-semibold tracking-wider">
               {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <p className="text-sm text-slate-400">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
         </div>

         <div className="flex flex-col items-center gap-3">
             {!todayRecord ? (
                <div className="flex flex-col items-center">
                  <div className="mb-3 w-full">
                    <select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {LOCATIONS.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    onClick={() => checkIn(selectedLocation)}
                    className="flex flex-col items-center justify-center w-36 h-36 md:w-40 md:h-40 bg-emerald-50 rounded-full border-4 border-emerald-100 hover:bg-emerald-100 hover:scale-105 transition-all group cursor-pointer shadow-sm"
                  >
                     <PlayCircle size={48} className="text-emerald-600 mb-2 group-hover:text-emerald-700" />
                     <span className="font-bold text-emerald-700">Check In</span>
                     <span className="text-xs text-emerald-500">Start your day</span>
                  </button>
                </div>
             ) : todayRecord.checkOut ? (
                <div className="flex flex-col items-center justify-center w-36 h-36 md:w-40 md:h-40 bg-gray-50 rounded-full border-4 border-gray-100">
                   <CheckCircle2 size={48} className="text-gray-400 mb-2" />
                   <span className="font-bold text-gray-500">Completed</span>
                   <span className="text-xs text-gray-400">Good job today!</span>
                </div>
             ) : (
                <button 
                  onClick={handleCheckOutClick}
                  className={`flex flex-col items-center justify-center w-36 h-36 md:w-40 md:h-40 rounded-full border-4 hover:scale-105 transition-all group cursor-pointer shadow-sm ${
                    isEarlyLogout ? 'bg-amber-50 border-amber-100 hover:bg-amber-100' : 'bg-red-50 border-red-100 hover:bg-red-100'
                  }`}
                >
                   <StopCircle size={48} className={`mb-2 ${isEarlyLogout ? 'text-amber-600' : 'text-red-600'}`} />
                   <span className={`font-bold ${isEarlyLogout ? 'text-amber-700' : 'text-red-700'}`}>
                     {isEarlyLogout ? 'Early Logout' : 'Check Out'}
                   </span>
                   <span className={`text-xs ${isEarlyLogout ? 'text-amber-500' : 'text-red-500'}`}>
                     {Math.floor(elapsedHours)}h {Math.floor((elapsedHours % 1) * 60)}m elapsed
                   </span>
                </button>
             )}
         </div>

         <div className="w-full lg:w-auto bg-slate-50 p-4 rounded-lg border border-slate-100 min-w-[200px]">
            <h4 className="text-sm font-bold text-slate-700 mb-2 uppercase">Today's Session</h4>
            <div className="space-y-2 text-sm">
               <div className="flex justify-between">
                 <span className="text-slate-500">Check In:</span>
                 <span className="font-medium text-slate-800">{todayRecord?.checkIn || '--:--'}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-slate-500">Check Out:</span>
                 <span className="font-medium text-slate-800">{todayRecord?.checkOut || '--:--'}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-slate-500">Location:</span>
                 <span className="font-medium text-slate-800 truncate max-w-[100px]" title={todayRecord?.workLocation}>{todayRecord?.workLocation || '--'}</span>
               </div>
               <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                 <span className="text-slate-500">Status:</span>
                 <span className={`font-bold ${todayRecord?.status === 'Late' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {todayRecord?.status || 'Pending'}
                 </span>
               </div>
            </div>
         </div>
      </div>

      {/* Required Time Log Modal */}
      {showTimeLogModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
              <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                       <Clock size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-bold text-gray-800">Daily Time Log Required</h3>
                       <p className="text-xs text-gray-500">You must log your work before checking out.</p>
                    </div>
                 </div>
                 <button onClick={() => { setShowTimeLogModal(false); setPendingCheckoutAction(null); }} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
              </div>

              <form onSubmit={handleQuickLogSubmit} className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project</label>
                    <select 
                       required
                       className="w-full border rounded-lg p-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                       value={logForm.projectId}
                       onChange={e => {
                         setLogForm({...logForm, projectId: e.target.value, task: ''});
                         setIsCustomTask(false);
                       }}
                    >
                       <option value="">Select Project...</option>
                       {userProjects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                       ))}
                       <option value="NO_PROJECT">General / Other</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Task</label>
                    {selectedProjectTasks.length > 0 && !isCustomTask ? (
                      <div className="flex gap-2">
                        <select 
                          className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={logForm.task}
                          onChange={e => setLogForm({...logForm, task: e.target.value})}
                          required
                        >
                          <option value="">Select Task...</option>
                          {selectedProjectTasks.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button type="button" onClick={() => setIsCustomTask(true)} className="px-3 border rounded-lg hover:bg-gray-50 text-xs font-bold text-gray-500 whitespace-nowrap">Other</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input 
                          required
                          type="text" 
                          placeholder="What did you work on today?"
                          className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={logForm.task}
                          onChange={e => setLogForm({...logForm, task: e.target.value})}
                          autoFocus={isCustomTask}
                        />
                         {selectedProjectTasks.length > 0 && (
                            <button type="button" onClick={() => setIsCustomTask(false)} className="px-3 border rounded-lg hover:bg-gray-50 text-xs font-bold text-gray-500 whitespace-nowrap">List</button>
                         )}
                      </div>
                    )}
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hours</label>
                       <input 
                          type="number" min="0" max="23"
                          className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={logForm.hours}
                          onChange={e => setLogForm({...logForm, hours: e.target.value})}
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Minutes</label>
                       <select 
                          className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={logForm.minutes}
                          onChange={e => setLogForm({...logForm, minutes: e.target.value})}
                       >
                          <option value="00">00</option>
                          <option value="15">15</option>
                          <option value="30">30</option>
                          <option value="45">45</option>
                       </select>
                    </div>
                 </div>

                 <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                     <textarea 
                        required
                        className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                        rows={3}
                        value={logForm.description}
                        onChange={e => setLogForm({...logForm, description: e.target.value})}
                        placeholder="Brief summary of work..."
                     />
                 </div>
                 
                 <button type="submit" className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-bold shadow-md hover:bg-emerald-700 transition flex items-center justify-center gap-2 mt-2">
                    <ShieldCheck size={18} /> Save & Check Out
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Early Logout Reason Modal */}
      {showEarlyReasonModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
              <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-3 text-amber-600">
                    <AlertTriangle size={24} />
                    <h3 className="text-lg font-bold text-gray-800">Early Logout</h3>
                 </div>
                 <button onClick={() => setShowEarlyReasonModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={20}/>
                 </button>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                 You are logging out before completing 9 hours. Please provide a reason for the record.
              </p>
              <form onSubmit={handleEarlyReasonSubmit} className="space-y-4">
                 <textarea 
                    required
                    className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    rows={3}
                    placeholder="E.g., Medical appointment, Half-day leave..."
                    value={earlyReason}
                    onChange={(e) => setEarlyReason(e.target.value)}
                 />
                 <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowEarlyReasonModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium">Confirm & Logout</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="sm:col-span-2">
           <label className="block text-xs font-medium text-slate-500 mb-1">Search Employee</label>
           <div className="relative">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
             <input
               type="text"
               placeholder="Search by name..."
               value={searchName}
               onChange={(e) => setSearchName(e.target.value)}
               disabled={!isHR} // Disable search for non-HR
               className={`w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${!isHR ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
             />
           </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px] md:min-w-0">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Check In</th>
                <th className="px-6 py-4">Check Out</th>
                <th className="px-6 py-4">Work Location</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {record.employeeName}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {record.date}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2 text-slate-700">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span>{record.checkIn}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2 text-slate-700">
                      {record.checkOut ? (
                         <>
                           <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                           <span>{record.checkOut}</span>
                         </>
                      ) : (
                         <span className="text-slate-400 text-xs italic">Active</span>
                      )}
                    </div>
                    {record.notes && <p className="text-xs text-amber-600 mt-1 max-w-[150px] truncate" title={record.notes}>{record.notes}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1 text-slate-500 text-sm">
                      <MapPin size={14} />
                      <span>{record.workLocation || 'Office HQ India'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold
                      ${record.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : 
                        record.status === 'Late' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
              {paginatedRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    {isHR ? "No attendance records found matching your filters." : "You have no attendance records matching the criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 bg-slate-50/50 gap-4 sm:gap-0">
           <div className="flex items-center gap-2 text-xs text-slate-500">
             <span>Show</span>
             <select 
               value={itemsPerPage}
               onChange={(e) => setItemsPerPage(Number(e.target.value))}
               className="border border-slate-300 rounded p-1 outline-none bg-white focus:ring-2 focus:ring-blue-500"
             >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
             </select>
             <span>per page</span>
             <span className="hidden sm:inline mx-2 text-slate-300">|</span>
             <span className="hidden sm:inline">
               Showing <span className="font-medium text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-slate-700">{Math.min(currentPage * itemsPerPage, filteredRecords.length)}</span> of <span className="font-medium text-slate-700">{filteredRecords.length}</span> results
             </span>
           </div>
           <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white bg-white text-slate-600 shadow-sm"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-medium text-slate-600 px-2">
                 Page {currentPage} of {totalPages || 1}
              </span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white bg-white text-slate-600 shadow-sm"
              >
                <ChevronRight size={16} />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
