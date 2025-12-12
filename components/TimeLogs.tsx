import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TimeEntry, Project, UserRole } from '../types';
import { 
  Clock, Plus, Filter, FileText, ChevronDown, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Edit2, Trash2,
  DollarSign, FileSpreadsheet, File as FileIcon, AlertTriangle, CheckCircle2, Briefcase, Search, MoreHorizontal, X, Download
} from 'lucide-react';

const TimeLogs = () => {
  const { currentUser, projects, timeEntries, addTimeEntry, updateTimeEntry, deleteTimeEntry, users, showToast } = useAppContext();
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // View State
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  
  // Filters
  const [filterProject, setFilterProject] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterTask, setFilterTask] = useState('All');
  const [searchEmployee, setSearchEmployee] = useState(''); 
  const [dateRange, setDateRange] = useState<'Week' | 'Month'>('Month');
  const [viewDate, setViewDate] = useState(new Date());

  // Action Menu State
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

  // Time Entry Method State
  const [entryMethod, setEntryMethod] = useState<'duration' | 'range'>('duration');
  const [durationInput, setDurationInput] = useState({ hours: '8', minutes: '00' });
  const [isCustomTask, setIsCustomTask] = useState(false);

  const isHR = currentUser?.role === UserRole.HR;
  const NO_PROJECT_ID = "NO_PROJECT";

  // Derived state for tasks based on selected project
  const selectedProjectTasks = useMemo(() => {
    return projects.find(p => p.id === formData.projectId)?.tasks || [];
  }, [formData.projectId, projects]);

  const hasPredefinedTasks = selectedProjectTasks.length > 0;

  // Derived unique tasks for filter
  const uniqueTasks = useMemo(() => {
      const tasks = new Set<string>();
      timeEntries.forEach(t => tasks.add(t.task));
      return Array.from(tasks);
  }, [timeEntries]);

  // Close menu when clicking outside
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
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(curr.setDate(diff));
    
    const week = [];
    for (let i = 0; i < 5; i++) { // Mon-Fri
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

  const resetDateToToday = () => setViewDate(new Date());

  // --- Filtering & Grouping ---
  const visibleEntries = useMemo(() => {
    let entries = timeEntries;
    
    // User Filter
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

    // Dropdown Filters
    if (filterProject !== 'All') entries = entries.filter(e => (e.projectId || NO_PROJECT_ID) === filterProject);
    if (filterStatus !== 'All') entries = entries.filter(e => e.status === filterStatus);
    if (filterTask !== 'All') entries = entries.filter(e => e.task === filterTask);

    // Date Filter
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
        const endOfWeek = new Date(weekDays[4]); // Friday
        endOfWeek.setHours(23, 59, 59);
        // Usually weeks include weekends, but assuming work week for this view based on screenshot
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

  // Group by Project
  const groupedEntries = useMemo(() => {
      const groups: Record<string, TimeEntry[]> = {};
      visibleEntries.forEach(entry => {
          const pid = entry.projectId || NO_PROJECT_ID;
          if (!groups[pid]) groups[pid] = [];
          groups[pid].push(entry);
      });
      return groups;
  }, [visibleEntries]);

  // Set all projects expanded by default initially
  useEffect(() => {
      const allIds = Object.keys(groupedEntries);
      const initialState: Record<string, boolean> = {};
      allIds.forEach(id => initialState[id] = true);
      setExpandedProjects(prev => ({...initialState, ...prev})); // Keep existing toggles if any
  }, [groupedEntries]);

  const toggleProjectGroup = (pid: string) => {
      setExpandedProjects(prev => ({...prev, [pid]: !prev[pid]}));
  };

  // Weekly Report Matrix Data
  const weeklyReportData = useMemo(() => {
     const startOfWeek = weekDays[0];
     const endOfWeek = new Date(weekDays[0]);
     endOfWeek.setDate(startOfWeek.getDate() + 6);
     endOfWeek.setHours(23, 59, 59);

     let relevantEntries = timeEntries.filter(e => {
        const d = new Date(e.date);
        return d >= startOfWeek && d <= endOfWeek;
     });

     // Apply same user/project filters
     if (!isHR) relevantEntries = relevantEntries.filter(e => e.userId === currentUser?.id);
     if (filterProject !== 'All') relevantEntries = relevantEntries.filter(e => (e.projectId || NO_PROJECT_ID) === filterProject);

     const report: { projectId: string, days: number[], total: number }[] = [];
     const relevantProjectIds = Array.from(new Set(relevantEntries.map(e => e.projectId || NO_PROJECT_ID)));
     
     relevantProjectIds.forEach(projId => {
        const projEntries = relevantEntries.filter(e => (e.projectId || NO_PROJECT_ID) === projId);
        const dayTotals = [0, 0, 0, 0, 0]; // Mon-Fri
        let rowTotal = 0;

        projEntries.forEach(e => {
            const d = new Date(e.date);
            const dayIdx = d.getDay() - 1; // 0=Mon
            if (dayIdx >= 0 && dayIdx < 5) {
                dayTotals[dayIdx] += e.durationMinutes;
                rowTotal += e.durationMinutes;
            }
        });

        report.push({ projectId: projId, days: dayTotals, total: rowTotal });
     });

     return report;
  }, [timeEntries, weekDays, currentUser, isHR, filterProject]);

  // Grand totals for weekly report
  const weeklyGrandTotals = useMemo(() => {
      const totals = [0, 0, 0, 0, 0];
      let grand = 0;
      weeklyReportData.forEach(row => {
          row.days.forEach((val, i) => totals[i] += val);
          grand += row.total;
      });
      return { days: totals, total: grand };
  }, [weeklyReportData]);


  // --- CRUD Handlers ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    let durationMinutes = 0;
    if (entryMethod === 'duration') {
        const h = parseInt(durationInput.hours) || 0;
        const m = parseInt(durationInput.minutes) || 0;
        durationMinutes = h * 60 + m;
    }
    
    const entryData = {
        userId: currentUser.id, 
        projectId: formData.projectId === NO_PROJECT_ID ? '' : formData.projectId,
        task: formData.task,
        date: formData.date,
        durationMinutes: durationMinutes,
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
      setFormData({
          projectId: entry.projectId || NO_PROJECT_ID,
          task: entry.task,
          date: entry.date,
          description: entry.description,
          isBillable: entry.isBillable
      });
      setShowModal(true);
      setActiveMenuId(null);
  };

  const initiateDelete = (id: string) => {
      setItemToDelete(id);
      setShowDeleteConfirm(true);
      setActiveMenuId(null);
  };

  const resetForm = () => {
      setEditingId(null);
      setFormData({ 
        projectId: '', 
        task: '', 
        date: new Date().toISOString().split('T')[0], 
        description: '', 
        isBillable: true 
      });
  };

  // --- Export Handlers ---
  const handleExport = (type: 'csv' | 'pdf' | 'excel') => {
      const headers = ['Date', 'Project', 'Task', 'User', 'Duration (min)', 'Status', 'Billable'];
      const rows = visibleEntries.map(e => {
          const user = users.find(u => u.id === e.userId);
          const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
          return [
            e.date,
            getProjectName(e.projectId),
            e.task.replace(/,/g, ' '), // Remove commas for CSV
            userName,
            e.durationMinutes,
            e.status,
            e.isBillable ? 'Yes' : 'No'
          ];
      });

      if (type === 'pdf') {
          window.print();
          return;
      }

      if (type === 'excel') {
          const tableContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
              <meta charset="UTF-8">
            </head>
            <body>
              <table border="1">
                <thead>
                  <tr>${headers.map(h => `<th style="background-color:#f0fdf4; font-weight:bold;">${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                  ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
                </tbody>
              </table>
            </body>
            </html>
          `;
          const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `timesheet_export_${new Date().toISOString().split('T')[0]}.xls`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast("Excel file downloaded.", "success");
          return;
      }

      // CSV Export
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `timesheet_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("CSV file downloaded.", "success");
  };

  // --- Render Helpers ---
  const StatusBadge = ({ status }: { status: string }) => {
      const styles = {
          'Pending': 'bg-orange-100 text-orange-600 border-orange-200',
          'Approved': 'bg-emerald-100 text-emerald-600 border-emerald-200',
          'Rejected': 'bg-red-100 text-red-600 border-red-200'
      };
      return (
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status as keyof typeof styles] || 'bg-gray-100'}`}>
              {status}
          </span>
      );
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
       
       {/* Top Header & Actions */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Clock className="text-emerald-600" /> Time Logs
             </h2>
             <p className="text-sm text-slate-500">View and manage your time entries</p>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => handleExport('csv')} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition">
                <FileSpreadsheet size={16} /> Export CSV
             </button>
             <button onClick={() => handleExport('pdf')} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition">
                <FileText size={16} /> Export PDF
             </button>
             <button onClick={() => handleExport('excel')} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition">
                <Download size={16} /> Export Excel
             </button>
             <button 
                onClick={() => { resetForm(); setShowModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm transition ml-2"
             >
                <Plus size={18} /> Add Time Entry
             </button>
          </div>
       </div>

       {/* Filters Section */}
       <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-4">
             {/* Left: Time Period */}
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Time Period</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                   <button 
                     onClick={() => setDateRange('Week')}
                     className={`px-3 py-1 text-xs font-medium rounded-md transition ${dateRange === 'Week' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}
                   >
                     Week
                   </button>
                   <button 
                     onClick={() => setDateRange('Month')}
                     className={`px-3 py-1 text-xs font-medium rounded-md transition ${dateRange === 'Month' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}
                   >
                     Month
                   </button>
                </div>
             </div>

             {/* Center: Date Navigation */}
             <div className="flex flex-col items-center">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date Range</label>
                <div className="flex items-center gap-2">
                   <button onClick={() => handleDateNavigation('prev')} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"><ChevronLeft size={16} /></button>
                   <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 min-w-[180px] text-center shadow-sm">
                      {dateRange === 'Month' 
                        ? viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
                        : `${weekDays[0].toLocaleDateString()} - ${weekDays[4].toLocaleDateString()}`
                      }
                   </div>
                   <button onClick={() => handleDateNavigation('next')} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"><ChevronRight size={16} /></button>
                   <button onClick={resetDateToToday} className="text-xs text-emerald-600 font-medium hover:underline ml-2">Today</button>
                </div>
             </div>

             {/* Right: Status Placeholder/Spacer */}
             <div className="hidden md:block w-32"></div> 
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter by Project</label>
                <div className="relative">
                   <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <select 
                      value={filterProject}
                      onChange={e => setFilterProject(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
                   >
                      <option value="All">All Projects</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value={NO_PROJECT_ID}>No Client - General</option>
                   </select>
                   <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
             </div>
             
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter by Task</label>
                <div className="relative">
                   <CheckCircle2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <select 
                      value={filterTask}
                      onChange={e => setFilterTask(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
                   >
                      <option value="All">All Tasks</option>
                      {uniqueTasks.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                   <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
             </div>

             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter by Status</label>
                <div className="relative">
                   <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <select 
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
                   >
                      <option value="All">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                   </select>
                   <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
             </div>
          </div>
       </div>

       {/* Timesheet List Grouped by Project */}
       <div>
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 rounded-t-xl font-semibold text-slate-700 text-sm">
             Timesheet for {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </div>
          <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-sm">
             {/* Table Header */}
             <div className="grid grid-cols-12 bg-slate-50/50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase px-4 py-3">
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Project</div>
                <div className="col-span-3">Task</div>
                <div className="col-span-2">User</div>
                <div className="col-span-1">Duration</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-1 text-right">Actions</div>
             </div>

             {/* Entries */}
             {Object.keys(groupedEntries).length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm italic">No entries found for this period.</div>
             ) : (
                Object.keys(groupedEntries).map(pid => {
                   const isExpanded = expandedProjects[pid];
                   const entries = groupedEntries[pid];
                   const projectName = getProjectName(pid);

                   return (
                      <div key={pid} className="border-b border-slate-100 last:border-0">
                         {/* Group Header */}
                         <div 
                            onClick={() => toggleProjectGroup(pid)}
                            className="flex items-center gap-2 px-4 py-3 bg-slate-50/30 cursor-pointer hover:bg-slate-50 transition border-l-4 border-l-transparent hover:border-l-emerald-500"
                         >
                            <button className="text-slate-400">
                               {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                            </button>
                            <span className="text-sm font-semibold text-slate-800">{projectName}</span>
                            <span className="text-xs text-slate-500">({entries.length} entries)</span>
                         </div>

                         {/* Entries List */}
                         {isExpanded && entries.map(entry => {
                            const user = users.find(u => u.id === entry.userId);
                            const entryDate = new Date(entry.date);
                            return (
                               <div key={entry.id} className="grid grid-cols-12 items-center px-4 py-3 border-t border-slate-100 hover:bg-blue-50/30 text-sm transition relative group">
                                  <div className="col-span-2 flex flex-col">
                                     <span className="font-medium text-slate-700">{entryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                     <span className="text-xs text-slate-400">{entryDate.getFullYear()}</span>
                                  </div>
                                  <div className="col-span-2 truncate pr-2 text-slate-600 text-xs" title={projectName}>
                                     {projectName}
                                  </div>
                                  <div className="col-span-3 pr-2">
                                     <p className="text-slate-800 font-medium truncate">{entry.task}</p>
                                     {entry.description && <p className="text-xs text-slate-400 truncate">{entry.description}</p>}
                                  </div>
                                  <div className="col-span-2 text-slate-600 text-xs">
                                     {user ? `${user.firstName} ${user.lastName}` : 'Unknown'}
                                  </div>
                                  <div className="col-span-1 font-mono text-slate-700">
                                     {formatDuration(entry.durationMinutes)}
                                  </div>
                                  <div className="col-span-1 flex flex-col gap-1 items-start">
                                     <StatusBadge status={entry.status} />
                                     {entry.isBillable && (
                                        <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded font-bold border border-green-200">Billable</span>
                                     )}
                                  </div>
                                  <div className="col-span-1 text-right relative">
                                     <button 
                                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === entry.id ? null : entry.id); }}
                                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                     >
                                        <MoreHorizontal size={16} />
                                     </button>
                                     {activeMenuId === entry.id && (
                                        <div ref={menuRef} className="absolute right-0 top-8 w-32 bg-white rounded-lg shadow-lg border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-100">
                                           <button onClick={() => handleEdit(entry)} className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                                              <Edit2 size={12} /> Edit
                                           </button>
                                           <button onClick={() => initiateDelete(entry.id)} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                                              <Trash2 size={12} /> Delete
                                           </button>
                                        </div>
                                     )}
                                  </div>
                               </div>
                            );
                         })}
                      </div>
                   );
                })
             )}
          </div>
       </div>

       {/* Weekly Timesheet Report */}
       <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50/50">
             <h3 className="font-bold text-slate-800">Weekly Timesheet Report</h3>
             <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs font-medium text-slate-600 shadow-sm">
                <CalendarIcon size={14} className="text-slate-400" />
                {weekDays[0].toLocaleDateString()} - {weekDays[4].toLocaleDateString()}
             </div>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse text-sm">
                <thead>
                   <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
                      <th className="px-6 py-3 border-b border-slate-200">Client & Project</th>
                      {weekDays.map((d, i) => (
                         <th key={i} className="px-4 py-3 border-b border-slate-200 text-center w-24">
                            {d.toLocaleDateString('en-US', { weekday: 'short' })} <span className="text-slate-400 font-normal ml-1">{d.getDate()}</span>
                         </th>
                      ))}
                      <th className="px-4 py-3 border-b border-slate-200 text-right w-24">Total</th>
                   </tr>
                </thead>
                <tbody>
                   {weeklyReportData.map((row) => (
                      <tr key={row.projectId} className="hover:bg-slate-50/50 border-b border-slate-100 last:border-0">
                         <td className="px-6 py-3 font-medium text-slate-700">
                            {getProjectName(row.projectId)}
                         </td>
                         {row.days.map((min, i) => (
                            <td key={i} className="px-4 py-3 text-center text-slate-600">
                               {min > 0 ? formatDuration(min) : <span className="text-slate-300">-</span>}
                            </td>
                         ))}
                         <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {formatDuration(row.total)}
                         </td>
                      </tr>
                   ))}
                   {weeklyReportData.length > 0 && (
                      <tr className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
                         <td className="px-6 py-3">Grand Total</td>
                         {weeklyGrandTotals.days.map((val, i) => (
                            <td key={i} className="px-4 py-3 text-center">{formatDuration(val)}</td>
                         ))}
                         <td className="px-4 py-3 text-right">{formatDuration(weeklyGrandTotals.total)}</td>
                      </tr>
                   )}
                   {weeklyReportData.length === 0 && (
                      <tr><td colSpan={7} className="p-6 text-center text-slate-400 italic">No data available for this week.</td></tr>
                   )}
                </tbody>
             </table>
          </div>
       </div>

       {/* Modals remain mostly the same (Add/Delete) - Implementation abbreviated for existing logic */}
       {showModal && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Time Log' : 'Log Time'}</h3>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
               </div>
               
               <form onSubmit={handleSubmit} className="space-y-4">
                  {/* ... (Existing form logic same as previous version) ... */}
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project</label>
                     <select 
                        required
                        className="w-full border rounded-lg p-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={formData.projectId}
                        onChange={e => {
                           setFormData({...formData, projectId: e.target.value, task: ''});
                           setIsCustomTask(false);
                        }}
                     >
                        <option value="">Select Project...</option>
                        {projects.map(p => (
                           <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                        <option value={NO_PROJECT_ID}>No Client - General</option>
                     </select>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Task</label>
                     {hasPredefinedTasks && !isCustomTask ? (
                       <div className="flex gap-2">
                         <select 
                           className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                           value={formData.task}
                           onChange={e => setFormData({...formData, task: e.target.value})}
                           required
                         >
                           <option value="">Select Task...</option>
                           {selectedProjectTasks.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                         </select>
                         <button type="button" onClick={() => setIsCustomTask(true)} className="px-3 border rounded-lg hover:bg-gray-50 text-xs font-bold text-gray-500 whitespace-nowrap">Other</button>
                       </div>
                     ) : (
                       <div className="flex gap-2">
                         <input 
                           required
                           type="text" 
                           placeholder="What did you work on?"
                           className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                           value={formData.task}
                           onChange={e => setFormData({...formData, task: e.target.value})}
                           autoFocus={hasPredefinedTasks && isCustomTask}
                         />
                         {hasPredefinedTasks && (
                            <button type="button" onClick={() => setIsCustomTask(false)} className="px-3 border rounded-lg hover:bg-gray-50 text-xs font-bold text-gray-500 whitespace-nowrap">List</button>
                         )}
                       </div>
                     )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                        <input 
                           type="date" 
                           required
                           className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                           value={formData.date}
                           onChange={e => setFormData({...formData, date: e.target.value})}
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hours</label>
                        <div className="flex items-center gap-2">
                           <input 
                              type="number" min="0" max="23"
                              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={durationInput.hours}
                              onChange={e => setDurationInput({...durationInput, hours: e.target.value})}
                           />
                           <span className="text-gray-400">:</span>
                           <select 
                              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={durationInput.minutes}
                              onChange={e => setDurationInput({...durationInput, minutes: e.target.value})}
                           >
                              <option value="00">00</option>
                              <option value="15">15</option>
                              <option value="30">30</option>
                              <option value="45">45</option>
                           </select>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center pt-2">
                     <label className="flex items-center cursor-pointer select-none">
                        <input 
                           type="checkbox" 
                           className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                           checked={formData.isBillable}
                           onChange={e => setFormData({...formData, isBillable: e.target.checked})}
                        />
                        <span className="ml-2 text-sm text-gray-700">Billable</span>
                     </label>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                      <textarea 
                         required
                         className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                         rows={3}
                         value={formData.description}
                         onChange={e => setFormData({...formData, description: e.target.value})}
                         placeholder="Work summary..."
                      />
                  </div>
                  
                  <button type="submit" className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-bold shadow-md hover:bg-emerald-700 transition">
                     {editingId ? 'Update Log' : 'Save Log'}
                  </button>
               </form>
            </div>
         </div>
       )}

       {/* Delete Confirm Modal */}
       {showDeleteConfirm && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in fade-in duration-200">
              <div className="flex items-center space-x-3 text-red-600 mb-4">
                 <AlertTriangle size={24} />
                 <h3 className="text-lg font-bold text-gray-800">Delete Entry?</h3>
              </div>
              <p className="text-gray-600 mb-6">
                 Are you sure you want to delete this time entry? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                 <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                 <button onClick={() => { deleteTimeEntry(itemToDelete!); setShowDeleteConfirm(false); }} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium shadow-sm">Delete</button>
              </div>
           </div>
        </div>
       )}
    </div>
  );
};

export default TimeLogs;