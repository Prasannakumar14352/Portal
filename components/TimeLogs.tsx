
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TimeEntry, Project, UserRole } from '../types';
import { 
  Clock, Plus, Filter, FileText, ChevronDown, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Edit2, Trash2,
  DollarSign, FileSpreadsheet, File as FileIcon, AlertTriangle, CheckCircle2, Briefcase, Search, MoreHorizontal, X, Download, SlidersHorizontal
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
  
  // View State
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false); // Mobile filter toggle
  
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
      setExpandedProjects(prev => ({...initialState, ...prev})); 
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

     if (!isHR) relevantEntries = relevantEntries.filter(e => e.userId === currentUser?.id);
     if (filterProject !== 'All') relevantEntries = relevantEntries.filter(e => (e.projectId || NO_PROJECT_ID) === filterProject);

     const report: { projectId: string, days: number[], total: number }[] = [];
     const relevantProjectIds = Array.from(new Set(relevantEntries.map(e => e.projectId || NO_PROJECT_ID))) as string[];
     
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
            e.task.replace(/,/g, ' '),
            userName,
            e.durationMinutes,
            e.status,
            e.isBillable ? 'Yes' : 'No'
          ];
      });

      if (type === 'pdf') {
          const doc = new jsPDF();
          doc.text("Timesheet Report", 14, 15);
          doc.setFontSize(10);
          doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 20);
          
          autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 25,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [16, 185, 129] }, // Emerald-500
          });
          
          doc.save(`timesheet_${new Date().toISOString().split('T')[0]}.pdf`);
          showToast("PDF report downloaded.", "success");
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
          'Pending': 'bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
          'Approved': 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
          'Rejected': 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
      };
      return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'}`}>
              {status}
          </span>
      );
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
       
       {/* Top Header & Actions */}
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
             <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Clock className="text-emerald-600" /> Time Logs
             </h2>
             <p className="text-sm text-slate-500 dark:text-slate-400">View and manage your time entries</p>
          </div>
          <div className="flex flex-col sm:flex-row w-full xl:w-auto gap-2">
             <div className="flex gap-2 w-full sm:w-auto">
                <button 
                    onClick={() => setShowFilters(!showFilters)} 
                    className="flex-1 sm:flex-none xl:hidden flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition"
                >
                    <SlidersHorizontal size={16} /> {showFilters ? 'Hide Filters' : 'Filters'}
                </button>
                <button onClick={() => { resetForm(); setShowModal(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm transition">
                    <Plus size={18} /> <span>Log Time</span>
                </button>
             </div>
             
             {/* Export Menu (Desktop) */}
             <div className="hidden sm:flex gap-2">
                <button onClick={() => handleExport('csv')} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"><FileSpreadsheet size={16}/></button>
                <button onClick={() => handleExport('pdf')} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"><FileText size={16}/></button>
             </div>
          </div>
       </div>

       {/* Filters Section (Collapsible on Mobile) */}
       <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-5 transition-all duration-300 ${!showFilters ? 'hidden xl:block' : 'block'}`}>
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
             {/* Left: Time Period */}
             <div className="w-full lg:w-auto">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Time Period</label>
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                   <button 
                     onClick={() => setDateRange('Week')}
                     className={`flex-1 lg:flex-none px-3 py-1 text-xs font-medium rounded-md transition ${dateRange === 'Week' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                   >
                     Week
                   </button>
                   <button 
                     onClick={() => setDateRange('Month')}
                     className={`flex-1 lg:flex-none px-3 py-1 text-xs font-medium rounded-md transition ${dateRange === 'Month' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                   >
                     Month
                   </button>
                </div>
             </div>

             {/* Center: Date Navigation */}
             <div className="flex flex-col items-center w-full lg:w-auto">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Date Range</label>
                <div className="flex items-center gap-2 w-full lg:w-auto justify-center">
                   <button onClick={() => handleDateNavigation('prev')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500 dark:text-slate-400"><ChevronLeft size={16} /></button>
                   <div className="flex-1 lg:flex-none px-4 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[180px] text-center shadow-sm">
                      {dateRange === 'Month' 
                        ? viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
                        : `${weekDays[0].toLocaleDateString()} - ${weekDays[4].toLocaleDateString()}`
                      }
                   </div>
                   <button onClick={() => handleDateNavigation('next')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500 dark:text-slate-400"><ChevronRight size={16} /></button>
                   <button onClick={resetDateToToday} className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline ml-2">Today</button>
                </div>
             </div>

             {/* Right: Spacer */}
             <div className="hidden lg:block w-32"></div> 
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
             <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Filter by Project</label>
                <div className="relative">
                   <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <select 
                      value={filterProject}
                      onChange={e => setFilterProject(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                   >
                      <option className="bg-white dark:bg-slate-800" value="All">All Projects</option>
                      {projects.map(p => (
                         <option className="bg-white dark:bg-slate-800" key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      <option className="bg-white dark:bg-slate-800" value={NO_PROJECT_ID}>No Client - General</option>
                   </select>
                </div>
             </div>
             
             <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Filter by Status</label>
                <div className="relative">
                   <CheckCircle2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <select 
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                   >
                      <option className="bg-white dark:bg-slate-800" value="All">All Status</option>
                      <option className="bg-white dark:bg-slate-800" value="Pending">Pending</option>
                      <option className="bg-white dark:bg-slate-800" value="Approved">Approved</option>
                      <option className="bg-white dark:bg-slate-800" value="Rejected">Rejected</option>
                   </select>
                </div>
             </div>

             {isHR && (
               <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Search Employee</label>
                  <div className="relative">
                     <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input 
                        type="text"
                        placeholder="Search name..."
                        value={searchEmployee}
                        onChange={e => setSearchEmployee(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                     />
                  </div>
               </div>
             )}
          </div>
       </div>

       {/* Weekly Summary (Visible on Desktop) */}
       <div className="hidden lg:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
             <h3 className="font-bold text-slate-800 dark:text-white text-sm">Weekly Timesheet Matrix</h3>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                   <tr>
                      <th className="px-4 py-3">Project</th>
                      {weekDays.map((d, i) => (
                         <th key={i} className="px-4 py-3 text-center">{d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</th>
                      ))}
                      <th className="px-4 py-3 text-right">Total</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                   {weeklyReportData.map((row) => (
                      <tr key={row.projectId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                         <td className="px-4 py-3 font-medium text-slate-800 dark:text-white truncate max-w-[200px]" title={getProjectName(row.projectId)}>
                            {getProjectName(row.projectId)}
                         </td>
                         {row.days.map((min, idx) => (
                            <td key={idx} className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">
                               {min > 0 ? formatDuration(min) : '-'}
                            </td>
                         ))}
                         <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-white">
                            {formatDuration(row.total)}
                         </td>
                      </tr>
                   ))}
                   {weeklyReportData.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No logs for this week.</td></tr>
                   )}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-900/30 font-bold text-sm text-slate-800 dark:text-white border-t border-slate-200 dark:border-slate-700">
                   <tr>
                      <td className="px-4 py-3">Total</td>
                      {weeklyGrandTotals.days.map((min, idx) => (
                         <td key={idx} className="px-4 py-3 text-center">{min > 0 ? formatDuration(min) : '-'}</td>
                      ))}
                      <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatDuration(weeklyGrandTotals.total)}</td>
                   </tr>
                </tfoot>
             </table>
          </div>
       </div>

       {/* Detailed Log List */}
       <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
             <h3 className="font-bold text-slate-800 dark:text-white text-sm">Detailed Logs</h3>
             <span className="text-xs text-slate-500 dark:text-slate-400">{visibleEntries.length} entries found</span>
          </div>
          
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
             {Object.keys(groupedEntries).map(projectId => {
                const projectEntries = groupedEntries[projectId];
                const isExpanded = expandedProjects[projectId];
                const projectName = getProjectName(projectId);
                const totalMins = projectEntries.reduce((acc, curr) => acc + curr.durationMinutes, 0);

                return (
                   <div key={projectId} className="bg-white dark:bg-slate-800">
                      {/* Group Header */}
                      <div 
                        onClick={() => toggleProjectGroup(projectId)}
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                         <div className="flex items-center gap-3">
                            <button className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400">
                               {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            <div>
                               <h4 className="font-bold text-slate-800 dark:text-white text-sm">{projectName}</h4>
                               <p className="text-xs text-slate-500 dark:text-slate-400">{projectEntries.length} entries</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatDuration(totalMins)}</span>
                         </div>
                      </div>

                      {/* Entries List */}
                      {isExpanded && (
                         <div className="bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-700">
                            {projectEntries.map(entry => {
                               const user = users.find(u => u.id === entry.userId);
                               return (
                                  <div key={entry.id} className="p-4 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-white dark:hover:bg-slate-800 transition-colors group relative">
                                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                           <div className="flex items-center gap-2 mb-1">
                                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{entry.date}</span>
                                              <StatusBadge status={entry.status} />
                                              {entry.isBillable && <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900 flex items-center gap-1"><DollarSign size={10}/> Billable</span>}
                                           </div>
                                           <h5 className="font-medium text-slate-800 dark:text-white text-sm truncate">{entry.task}</h5>
                                           <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{entry.description}</p>
                                           {isHR && user && <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">{user.firstName} {user.lastName}</p>}
                                        </div>
                                        
                                        <div className="flex items-center gap-4 self-end sm:self-center">
                                           <span className="text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDuration(entry.durationMinutes)}</span>
                                           
                                           {/* Actions Menu */}
                                           <div className="relative">
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === entry.id ? null : entry.id); }}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
                                              >
                                                 <MoreHorizontal size={16} />
                                              </button>
                                              
                                              {activeMenuId === entry.id && (
                                                 <div 
                                                   ref={menuRef} 
                                                   className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                                                 >
                                                    <button onClick={() => handleEdit(entry)} className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Edit2 size={12}/> Edit</button>
                                                    <button onClick={() => initiateDelete(entry.id)} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"><Trash2 size={12}/> Delete</button>
                                                 </div>
                                              )}
                                           </div>
                                        </div>
                                     </div>
                                  </div>
                               );
                            })}
                         </div>
                      )}
                   </div>
                );
             })}
             {visibleEntries.length === 0 && (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                   <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Clock size={32} className="text-slate-300 dark:text-slate-600" />
                   </div>
                   <p className="font-medium">No time logs found</p>
                   <p className="text-xs mt-1">Try adjusting filters or log a new entry.</p>
                </div>
             )}
          </div>
       </div>

       {/* Modals */}
       
       {/* 1. Log Time Modal */}
       {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                   <h3 className="font-bold text-slate-800 dark:text-white">{editingId ? 'Edit Time Log' : 'Log Time'}</h3>
                   <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                   {/* Project Selection */}
                   <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Project / Client</label>
                      <div className="relative">
                         <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                         <select 
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 appearance-none dark:text-white"
                            value={formData.projectId}
                            onChange={e => {
                               setFormData({...formData, projectId: e.target.value, task: ''});
                               setIsCustomTask(false);
                            }}
                            required
                         >
                            <option value="" disabled>Select Project...</option>
                            {projects.filter(p => p.status === 'Active' || p.id === formData.projectId).map(p => (
                               <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                            <option value={NO_PROJECT_ID}>General / Internal (No Client)</option>
                         </select>
                         <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                   </div>

                   {/* Task Selection */}
                   <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Task</label>
                      {hasPredefinedTasks && !isCustomTask ? (
                         <div className="flex gap-2">
                            <div className="relative flex-1">
                               <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                               <select 
                                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 appearance-none dark:text-white"
                                  value={formData.task}
                                  onChange={e => setFormData({...formData, task: e.target.value})}
                                  required
                               >
                                  <option value="" disabled>Select Task...</option>
                                  {selectedProjectTasks.map(t => <option key={t} value={t}>{t}</option>)}
                               </select>
                               <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            <button type="button" onClick={() => setIsCustomTask(true)} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600">Other</button>
                         </div>
                      ) : (
                         <div className="flex gap-2">
                            <input 
                               type="text" 
                               placeholder="What are you working on?" 
                               className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                               value={formData.task}
                               onChange={e => setFormData({...formData, task: e.target.value})}
                               required
                               autoFocus={isCustomTask}
                            />
                            {hasPredefinedTasks && <button type="button" onClick={() => setIsCustomTask(false)} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600">List</button>}
                         </div>
                      )}
                   </div>

                   {/* Date & Duration */}
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Date</label>
                         <div className="relative">
                            <CalendarIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                               type="date" 
                               className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                               value={formData.date}
                               onChange={e => setFormData({...formData, date: e.target.value})}
                               required
                            />
                         </div>
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Duration (HH:MM)</label>
                         <div className="flex gap-2">
                            <input 
                               type="number" min="0" max="23" placeholder="HH" 
                               className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-center dark:text-white"
                               value={durationInput.hours}
                               onChange={e => setDurationInput({...durationInput, hours: e.target.value})}
                            />
                            <span className="self-center font-bold text-slate-400">:</span>
                            <select 
                               className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-center dark:text-white"
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

                   {/* Description */}
                   <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Description</label>
                      <textarea 
                         rows={3} 
                         className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none dark:text-white"
                         placeholder="Optional details..."
                         value={formData.description}
                         onChange={e => setFormData({...formData, description: e.target.value})}
                      />
                   </div>

                   {/* Billable Toggle */}
                   <div className="flex items-center gap-3 pt-2">
                      <div 
                        className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${formData.isBillable ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                        onClick={() => setFormData({...formData, isBillable: !formData.isBillable})}
                      >
                         <div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${formData.isBillable ? 'translate-x-5' : ''}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Billable Entry</span>
                   </div>

                   <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700 mt-2">
                      <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition">Cancel</button>
                      <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm transition flex items-center gap-2">
                         <CheckCircle2 size={16}/> Save Entry
                      </button>
                   </div>
                </form>
             </div>
          </div>
       )}

       {/* 2. Delete Confirmation Modal */}
       {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                   <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
                      <AlertTriangle size={24} />
                   </div>
                   <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Delete Time Log?</h3>
                   <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Are you sure you want to remove this entry? This action cannot be undone.</p>
                   <div className="flex gap-3 w-full">
                      <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                      <button 
                        onClick={() => {
                           if (itemToDelete) deleteTimeEntry(itemToDelete);
                           setShowDeleteConfirm(false);
                        }} 
                        className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-sm transition"
                      >
                         Delete
                      </button>
                   </div>
                </div>
             </div>
          </div>
       )}

    </div>
  );
};

export default TimeLogs;
