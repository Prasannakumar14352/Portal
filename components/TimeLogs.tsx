
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TimeEntry, Project, UserRole } from '../types';
import { 
  Clock, Plus, Filter, FileText, ChevronDown, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Edit2, Trash2,
  DollarSign, FileSpreadsheet, AlertTriangle, CheckCircle2, MoreHorizontal, X, SlidersHorizontal, Zap, AlignLeft
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const TimeLogs = () => {
  const { currentUser, projects, timeEntries, addTimeEntry, updateTimeEntry, deleteTimeEntry, users, showToast } = useAppContext();
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [includeExtra, setIncludeExtra] = useState(false);
  
  // View State
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false); 
  
  // Filters
  const [filterProject, setFilterProject] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterTask, setFilterTask] = useState('All');
  const [searchEmployee, setSearchEmployee] = useState(''); 
  const [dateRange, setDateRange] = useState<'Week' | 'Month'>('Month');
  const [viewDate, setViewDate] = useState(new Date());

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    projectId: '',
    task: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    isBillable: true
  });

  const [normalInput, setNormalInput] = useState({ hours: '8', minutes: '00' });
  const [extraInput, setExtraInput] = useState({ hours: '0', minutes: '00' });

  const isHR = currentUser?.role === UserRole.HR;
  const NO_PROJECT_ID = "NO_PROJECT";

  // Dynamic Tasks based on selected project
  const selectedProjectTasks = useMemo(() => {
    if (!formData.projectId || formData.projectId === NO_PROJECT_ID) return ['General Administration', 'Internal Meeting', 'Documentation', 'Support'];
    const proj = projects.find(p => p.id === formData.projectId);
    return proj?.tasks || [];
  }, [formData.projectId, projects]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Helpers ---
  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };
  
  const getProjectName = (id?: string) => {
      if (!id || id === NO_PROJECT_ID) return 'No Client - General';
      return projects.find(p => p.id === id)?.name || 'Unknown Project';
  };

  const getWeekDays = (date: Date) => {
    const curr = new Date(date);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(curr.setDate(diff));
    const week = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        week.push(d);
    }
    return week;
  };

  const weekDays = getWeekDays(viewDate);
  
  const handleDateNavigation = (direction: 'prev' | 'next') => {
      const newDate = new Date(viewDate);
      if (dateRange === 'Month') {
          newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      } else {
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      }
      setViewDate(newDate);
  };

  const visibleEntries = useMemo(() => {
    let entries = timeEntries;
    if (isHR) {
       if (searchEmployee) {
          const lowerQ = searchEmployee.toLowerCase();
          entries = entries.filter(e => {
             const u = users.find(usr => usr.id === e.userId);
             return u && `${u.firstName} ${u.lastName}`.toLowerCase().includes(lowerQ);
          });
       }
    } else {
       entries = entries.filter(e => e.userId === currentUser?.id);
    }
    if (filterProject !== 'All') entries = entries.filter(e => (e.projectId || NO_PROJECT_ID) === filterProject);
    if (filterStatus !== 'All') entries = entries.filter(e => e.status === filterStatus);
    if (filterTask !== 'All') entries = entries.filter(e => e.task === filterTask);
    if (dateRange === 'Month') {
        const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
        const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59);
        entries = entries.filter(e => {
            const d = new Date(e.date);
            return d >= startOfMonth && d <= endOfMonth;
        });
    } else {
        const startOfWeek = weekDays[0];
        const realEndOfWeek = new Date(startOfWeek);
        realEndOfWeek.setDate(startOfWeek.getDate() + 6);
        realEndOfWeek.setHours(23, 59, 59);
        entries = entries.filter(e => {
            const d = new Date(e.date);
            return d >= startOfWeek && d <= realEndOfWeek;
        });
    }
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [timeEntries, currentUser, filterProject, filterStatus, filterTask, searchEmployee, viewDate, isHR, dateRange, weekDays, users]);

  const groupedEntries = useMemo(() => {
      const groups: Record<string, TimeEntry[]> = {};
      visibleEntries.forEach(entry => {
          const pid = entry.projectId || NO_PROJECT_ID;
          if (!groups[pid]) groups[pid] = [];
          groups[pid].push(entry);
      });
      return groups;
  }, [visibleEntries]);

  const toggleProjectGroup = (pid: string) => {
      setExpandedProjects(prev => ({...prev, [pid]: !prev[pid]}));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const nh = parseInt(normalInput.hours) || 0;
    const nm = parseInt(normalInput.minutes) || 0;
    const normalMinutes = nh * 60 + nm;

    const eh = includeExtra ? (parseInt(extraInput.hours) || 0) : 0;
    const em = includeExtra ? (parseInt(extraInput.minutes) || 0) : 0;
    const extraMinutes = eh * 60 + em;

    const entryData = {
        userId: currentUser.id, 
        projectId: formData.projectId === NO_PROJECT_ID ? '' : formData.projectId,
        task: formData.task,
        date: formData.date,
        durationMinutes: normalMinutes,
        extraMinutes: extraMinutes,
        description: formData.description,
        status: 'Pending' as const,
        isBillable: formData.isBillable
    };
    
    if (editingId) updateTimeEntry(editingId, entryData);
    else addTimeEntry(entryData);
    setShowModal(false);
    resetForm();
  };

  const handleEdit = (entry: TimeEntry) => {
      setEditingId(entry.id);
      const nh = Math.floor(entry.durationMinutes / 60);
      const nm = entry.durationMinutes % 60;
      setNormalInput({ hours: nh.toString(), minutes: nm.toString().padStart(2, '0') });
      
      const emins = entry.extraMinutes || 0;
      const eh = Math.floor(emins / 60);
      const em = emins % 60;
      setExtraInput({ hours: eh.toString(), minutes: em.toString().padStart(2, '0') });
      setIncludeExtra(emins > 0);

      setFormData({
          projectId: entry.projectId || NO_PROJECT_ID,
          task: entry.task,
          date: entry.date,
          description: entry.description || '',
          isBillable: entry.isBillable
      });
      setShowModal(true);
      setActiveMenuId(null);
  };

  const resetForm = () => {
      setEditingId(null);
      setIncludeExtra(false);
      setFormData({ 
        projectId: '', 
        task: '', 
        date: new Date().toISOString().split('T')[0], 
        description: '', 
        isBillable: true
      });
      setNormalInput({ hours: '8', minutes: '00' });
      setExtraInput({ hours: '0', minutes: '00' });
  };

  const handleExport = (type: 'csv' | 'pdf') => {
      const headers = ['Date', 'Project', 'Task', 'User', 'Normal (min)', 'Extra (min)', 'Status', 'Billable'];
      const rows = visibleEntries.map(e => {
          const user = users.find(u => u.id === e.userId);
          const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
          return [
            e.date,
            getProjectName(e.projectId),
            e.task.replace(/,/g, ' '),
            userName,
            e.durationMinutes,
            e.extraMinutes || 0,
            e.status,
            e.isBillable ? 'Yes' : 'No'
          ];
      });
      if (type === 'pdf') {
          const doc = new jsPDF();
          doc.text("Unified Timesheet Report", 14, 15);
          autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 25,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [16, 185, 129] },
          });
          doc.save(`timesheet_${new Date().toISOString().split('T')[0]}.pdf`);
          return;
      }
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.body.appendChild(document.createElement("a"));
      link.href = url;
      link.download = `timesheet_${Date.now()}.csv`;
      link.click();
      document.body.removeChild(link);
  };

  const StatusBadge = ({ status }: { status: string }) => {
      const styles = {
          'Pending': 'bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
          'Approved': 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
          'Rejected': 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
      };
      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[status as keyof typeof styles]}`}>{status}</span>;
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
             <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Clock className="text-emerald-600" /> Time Logs</h2>
             <p className="text-sm text-slate-500 dark:text-slate-400">Track and manage project effort efficiently.</p>
          </div>
          <div className="flex flex-col sm:flex-row w-full xl:w-auto gap-2">
             <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => setShowFilters(!showFilters)} className="flex-1 sm:flex-none xl:hidden flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-50 shadow-sm transition"><SlidersHorizontal size={16} /> {showFilters ? 'Hide Filters' : 'Filters'}</button>
                <button onClick={() => { resetForm(); setShowModal(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm transition"><Plus size={18} /> <span>Log Time</span></button>
             </div>
             <div className="hidden sm:flex gap-2">
                <button onClick={() => handleExport('csv')} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm"><FileSpreadsheet size={16}/></button>
                <button onClick={() => handleExport('pdf')} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm"><FileText size={16}/></button>
             </div>
          </div>
       </div>

       {/* Filters Section */}
       <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-5 ${!showFilters ? 'hidden xl:block' : 'block'}`}>
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
             <div className="w-full lg:w-auto">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Time Period</label>
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                   <button onClick={() => setDateRange('Week')} className={`flex-1 lg:flex-none px-3 py-1 text-xs font-medium rounded-md transition ${dateRange === 'Week' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600' : 'text-slate-500'}`}>Week</button>
                   <button onClick={() => setDateRange('Month')} className={`flex-1 lg:flex-none px-3 py-1 text-xs font-medium rounded-md transition ${dateRange === 'Month' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600' : 'text-slate-500'}`}>Month</button>
                </div>
             </div>
             <div className="flex flex-col items-center w-full lg:w-auto">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date Range</label>
                <div className="flex items-center gap-2">
                   <button onClick={() => handleDateNavigation('prev')} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"><ChevronLeft size={16} /></button>
                   <div className="px-4 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold min-w-[180px] text-center">{dateRange === 'Month' ? viewDate.toLocaleString('default', { month: 'long', year: 'numeric' }) : `${weekDays[0].toLocaleDateString()} - ${weekDays[4].toLocaleDateString()}`}</div>
                   <button onClick={() => handleDateNavigation('next')} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"><ChevronRight size={16} /></button>
                </div>
             </div>
             <div className="hidden lg:block w-32"></div> 
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter by Project</label>
                <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white">
                    <option value="All">All Projects</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    <option value={NO_PROJECT_ID}>General (No Client)</option>
                </select>
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter by Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white">
                    <option value="All">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                </select>
             </div>
             {isHR && (
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Search Employee</label>
                  <input type="text" placeholder="Search name..." value={searchEmployee} onChange={e => setSearchEmployee(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white" />
               </div>
             )}
          </div>
       </div>

       {/* Log List */}
       <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
             {Object.keys(groupedEntries).map(projectId => {
                const projectEntries = groupedEntries[projectId];
                const isExpanded = expandedProjects[projectId];
                const projectName = getProjectName(projectId);
                const totalNormal = projectEntries.reduce((acc, curr) => acc + curr.durationMinutes, 0);
                const totalExtra = projectEntries.reduce((acc, curr) => acc + (curr.extraMinutes || 0), 0);

                return (
                   <div key={projectId}>
                      <div onClick={() => toggleProjectGroup(projectId)} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                         <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronDown size={16} className="text-slate-400"/> : <ChevronRight size={16} className="text-slate-400"/>}
                            <div>
                               <h4 className="font-bold text-slate-800 dark:text-white text-sm">{projectName}</h4>
                               <p className="text-xs text-slate-500">{projectEntries.length} unified records</p>
                            </div>
                         </div>
                         <div className="text-right flex flex-col items-end">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatDuration(totalNormal + totalExtra)}</span>
                            {totalExtra > 0 && <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full mt-1">Incl. {formatDuration(totalExtra)} Extra</span>}
                         </div>
                      </div>
                      {isExpanded && (
                         <div className="bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-700">
                            {projectEntries.map(entry => (
                               <div key={entry.id} className={`p-4 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-white dark:hover:bg-slate-800 transition-colors group relative ${(entry.extraMinutes || 0) > 0 ? 'border-l-4 border-l-purple-400' : ''}`}>
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                     <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                           <span className="text-xs font-bold text-slate-500">{entry.date}</span>
                                           <StatusBadge status={entry.status} />
                                           {entry.isBillable && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-1 font-bold"><DollarSign size={10}/> Billable</span>}
                                        </div>
                                        <h5 className="font-medium text-slate-800 dark:text-white text-sm truncate">{entry.task}</h5>
                                        {entry.description && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 italic">"{entry.description}"</p>}
                                     </div>
                                     <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatDuration(entry.durationMinutes + (entry.extraMinutes || 0))}</span>
                                            {(entry.extraMinutes || 0) > 0 && <p className="text-[10px] text-purple-600 font-bold">+{formatDuration(entry.extraMinutes!)} Overtime</p>}
                                        </div>
                                        <div className="relative">
                                           <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === entry.id ? null : entry.id); }} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"><MoreHorizontal size={16} /></button>
                                           {activeMenuId === entry.id && (
                                              <div ref={menuRef} className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 rounded-lg shadow-xl border z-20 overflow-hidden">
                                                 <button onClick={() => handleEdit(entry)} className="w-full text-left px-3 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Edit2 size={12}/> Edit Log</button>
                                                 <button onClick={() => { if (confirm('Delete this entry?')) deleteTimeEntry(entry.id); }} className="w-full text-left px-3 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 border-t"><Trash2 size={12}/> Delete</button>
                                              </div>
                                           )}
                                        </div>
                                     </div>
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                );
             })}
          </div>
       </div>

       {/* Unified Modal with Max Height & Scrolling */}
       {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-2xl">
                   <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold">
                       <Clock className="text-emerald-600" size={20} />
                       <h3>{editingId ? 'Edit Time Log' : 'Add Time Log'}</h3>
                   </div>
                   <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition p-1"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Project Selection */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Project / Client</label>
                        <select required className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white transition shadow-sm" value={formData.projectId} onChange={e => setFormData({...formData, projectId: e.target.value, task: ''})}>
                          <option value="" disabled>Choose a project...</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          <option value={NO_PROJECT_ID}>Internal - General Administration</option>
                        </select>
                    </div>

                    {/* Subtask Dropdown */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Work Done (Subtask)</label>
                        <select required className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white transition shadow-sm" value={formData.task} onChange={e => setFormData({...formData, task: e.target.value})}>
                          <option value="" disabled>Select subtask...</option>
                          {selectedProjectTasks.map(task => <option key={task} value={task}>{task}</option>)}
                          <option value="Other">Other (Custom Task)</option>
                        </select>
                        {formData.task === 'Other' && (
                            <input type="text" placeholder="Enter custom task name" className="mt-2 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-emerald-500" onChange={e => setFormData({...formData, task: e.target.value})} />
                        )}
                    </div>

                    {/* Date & Normal Hours Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Date</label>
                          <input required type="date" className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white transition shadow-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Normal Hours</label>
                          <div className="flex gap-2">
                              <input type="number" min="0" className="w-full px-2 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-center dark:bg-slate-700 dark:text-white shadow-sm" value={normalInput.hours} onChange={e => setNormalInput({...normalInput, hours: e.target.value})} />
                              <span className="self-center font-bold text-slate-300">:</span>
                              <select className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-2 py-2.5 dark:bg-slate-700 dark:text-white shadow-sm" value={normalInput.minutes} onChange={e => setNormalInput({...normalInput, minutes: e.target.value})}>
                                <option value="00">00</option><option value="15">15</option><option value="30">30</option><option value="45">45</option>
                              </select>
                          </div>
                        </div>
                    </div>

                    {/* Extra Hours Toggle */}
                    <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer group w-fit">
                          <input type="checkbox" checked={includeExtra} onChange={(e) => setIncludeExtra(e.target.checked)} className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-slate-300" />
                          <span className={`text-sm font-bold transition-colors ${includeExtra ? 'text-purple-700 dark:text-purple-400' : 'text-slate-500'}`}>Include Extra Hours / Overtime</span>
                          {includeExtra && <Zap size={14} className="text-purple-500 animate-pulse" fill="currentColor" />}
                        </label>
                        
                        {includeExtra && (
                            <div className="mt-3 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800 animate-in slide-in-from-top-2 duration-300">
                              <label className="block text-[10px] font-bold text-purple-600 uppercase mb-2">Overtime Duration</label>
                              <div className="flex gap-4">
                                  <div className="flex-1">
                                      <span className="text-[10px] text-slate-400 uppercase block mb-1">Hours</span>
                                      <input type="number" min="0" className="w-full px-3 py-2 border border-purple-200 dark:border-purple-800 rounded-lg text-center bg-white dark:bg-slate-800 dark:text-white" value={extraInput.hours} onChange={e => setExtraInput({...extraInput, hours: e.target.value})} />
                                  </div>
                                  <div className="flex-1">
                                      <span className="text-[10px] text-slate-400 uppercase block mb-1">Minutes</span>
                                      <select className="w-full border border-purple-200 dark:border-purple-800 rounded-lg px-2 py-2 bg-white dark:bg-slate-800 dark:text-white" value={extraInput.minutes} onChange={e => setExtraInput({...extraInput, minutes: e.target.value})}>
                                        <option value="00">00</option><option value="15">15</option><option value="30">30</option><option value="45">45</option>
                                      </select>
                                  </div>
                              </div>
                            </div>
                        )}
                    </div>

                    {/* Description Area */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Effort Description</label>
                        <textarea 
                          required 
                          rows={5} 
                          placeholder="Detail the work performed today..." 
                          className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white transition shadow-sm resize-none" 
                          value={formData.description} 
                          onChange={e => setFormData({...formData, description: e.target.value})}
                        />
                    </div>

                    {/* Billable Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                              <DollarSign size={18} className="text-blue-500" />
                            </div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Billable to Client</span>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all duration-300 ${formData.isBillable ? 'bg-blue-600 shadow-inner' : 'bg-slate-300 dark:bg-slate-600'}`} onClick={() => setFormData({...formData, isBillable: !formData.isBillable})}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${formData.isBillable ? 'translate-x-6' : ''}`} />
                        </div>
                    </div>

                    {/* Submit Row inside form for accessibility */}
                    <div className="pt-4 flex justify-end items-center gap-6 border-t border-slate-100 dark:border-slate-700">
                        <button type="button" onClick={() => setShowModal(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-sm font-bold transition">Cancel</button>
                        <button type="submit" className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-200 dark:shadow-none transition flex items-center gap-2">
                            <CheckCircle2 size={20}/> {editingId ? 'Update Entry' : 'Save Entry'}
                        </button>
                    </div>
                  </form>
                </div>
             </div>
          </div>
       )}
    </div>
  );
};

export default TimeLogs;
