import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TimeEntry, Project, UserRole } from '../types';
import { 
  Clock, Plus, FileText, ChevronDown, ChevronRight, ChevronLeft, Edit2, Trash2,
  DollarSign, FileSpreadsheet, AlertTriangle, CheckCircle2, MoreHorizontal, SlidersHorizontal, Zap, 
  Calendar as CalendarIcon, Search, Filter, Download, MoreVertical, Coffee, RefreshCcw, PartyPopper,
  Mail, Send, ShieldAlert
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import DraggableModal from './DraggableModal';

const TimeLogs = () => {
  const { currentUser, projects, timeEntries, addTimeEntry, updateTimeEntry, deleteTimeEntry, employees, showToast, syncHolidayLogs, holidays, notifyMissingTimesheets, notifyWeeklyCompliance } = useAppContext();
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [includeExtra, setIncludeExtra] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  
  // View State
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  
  // Filters & Navigation
  const [viewDate, setViewDate] = useState(new Date());
  const [timePeriod, setTimePeriod] = useState<'Week' | 'Month'>('Month');
  const [filterProject, setFilterProject] = useState('All');
  const [filterTask, setFilterTask] = useState('All Tasks');
  const [filterStatus, setFilterStatus] = useState('All Statuses');
  
  const exportRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    projectId: '',
    task: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    isBillable: true,
    isHoliday: false
  });

  const [normalInput, setNormalInput] = useState({ hours: '8', minutes: '00' });
  const [extraInput, setExtraInput] = useState({ hours: '0', minutes: '00' });

  const isHR = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;
  const NO_PROJECT_ID = "NO_PROJECT";

  // Dynamic Subtasks
  const availableTasks = useMemo(() => {
    if (formData.isHoliday) return ['Public Holiday'];
    if (!formData.projectId || formData.projectId === NO_PROJECT_ID) {
      return ['General Administration', 'Internal Meeting', 'Documentation', 'Support', 'Training', 'Public Holiday'].sort();
    }
    const project = projects.find(p => String(p.id) === String(formData.projectId));
    if (!project) return [];
    
    let tasks = project.tasks;
    if (typeof tasks === 'string') {
        try {
            const parsed = JSON.parse(tasks);
            tasks = Array.isArray(parsed) ? parsed : [];
        } catch (e) { tasks = []; }
    }
    return Array.isArray(tasks) ? [...tasks].sort() : [];
  }, [formData.projectId, formData.isHoliday, projects]);

  const allUniqueTasks = useMemo(() => {
      const tasks = new Set<string>();
      timeEntries.forEach(t => tasks.add(t.task));
      projects.forEach(p => {
          let pTasks = p.tasks;
          if (typeof pTasks === 'string') { try { pTasks = JSON.parse(pTasks); } catch { pTasks = []; } }
          if (Array.isArray(pTasks)) pTasks.forEach(t => tasks.add(t));
      });
      return Array.from(tasks).sort();
  }, [timeEntries, projects]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
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

  const formatDurationShort = (minutes: number) => {
    if (minutes === 0) return '0:00';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  };
  
  const getProjectName = (id?: string | number) => {
      if (!id || String(id) === NO_PROJECT_ID || id === "") return 'Internal / General';
      return projects.find(p => String(p.id) === String(id))?.name || 'Unknown Project';
  };

  const getDayNameAndDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return {
          day: d.toLocaleDateString('en-US', { day: '2-digit' }),
          monthYear: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          weekday: d.toLocaleDateString('en-US', { weekday: 'short' })
      };
  };

  const getWeekDays = (date: Date) => {
    const curr = new Date(date);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    const monday = new Date(curr);
    monday.setDate(diff);
    
    const week = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        week.push(d);
    }
    return week;
  };

  const weekDays = useMemo(() => getWeekDays(viewDate), [viewDate]);
  
  const handleDateNavigation = (direction: 'prev' | 'next') => {
      const newDate = new Date(viewDate);
      if (timePeriod === 'Week') {
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      } else {
          newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      }
      setViewDate(newDate);
  };

  // --- Data Logic ---
  const visibleEntries = useMemo(() => {
    let entries = [...timeEntries];
    if (!isHR) {
       entries = entries.filter(e => String(e.userId) === String(currentUser?.id));
    }
    
    // Filter by Date
    if (timePeriod === 'Month') {
        const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
        const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59);
        entries = entries.filter(e => {
            const d = new Date(e.date);
            return d >= startOfMonth && d <= endOfMonth;
        });
    } else {
        // Week view not fully implemented for main table filtering in this snippet logic, defaulting to month-like behavior or specific range if needed.
        // For simplicity, keeping month filter for table or implementing week logic:
        const startOfWeek = new Date(weekDays[0]); 
        startOfWeek.setHours(0,0,0,0);
        const endOfWeek = new Date(weekDays[4]); // Friday
        endOfWeek.setDate(endOfWeek.getDate() + 2); // Include weekend
        endOfWeek.setHours(23,59,59);
        
        if (timePeriod === 'Week') {
             entries = entries.filter(e => {
                const d = new Date(e.date);
                return d >= startOfWeek && d <= endOfWeek;
            });
        }
    }
    
    // Apply filters
    return entries.filter(e => {
        const matchesProject = filterProject === 'All' || String(e.projectId || NO_PROJECT_ID) === filterProject;
        const matchesTask = filterTask === 'All Tasks' || e.task === filterTask;
        const matchesStatus = filterStatus === 'All Statuses' || e.status === filterStatus;
        return matchesProject && matchesTask && matchesStatus;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [timeEntries, currentUser, viewDate, isHR, timePeriod, weekDays, filterProject, filterTask, filterStatus]);

  const groupedEntries = useMemo(() => {
      const groups: Record<string, TimeEntry[]> = {};
      visibleEntries.forEach(entry => {
          const pid = String(entry.projectId || NO_PROJECT_ID);
          if (!groups[pid]) groups[pid] = [];
          groups[pid].push(entry);
      });
      return groups;
  }, [visibleEntries]);

  // Weekly Report Data
  const weeklyReportData = useMemo(() => {
    const report: Record<string, { total: number, days: number[], tasks: Record<string, number[]> }> = {};
    const startOfWeek = new Date(weekDays[0]);
    startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(weekDays[4]);
    endOfWeek.setHours(23,59,59,999);

    const weekEntries = timeEntries.filter(e => {
        if (!isHR && String(e.userId) !== String(currentUser?.id)) return false;
        const d = new Date(e.date);
        return d >= startOfWeek && d <= endOfWeek;
    });

    weekEntries.forEach(e => {
        const pid = String(e.projectId || NO_PROJECT_ID);
        const d = new Date(e.date);
        // Get day index relative to the week array (Mon=0)
        const dayDiff = Math.floor((d.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dayDiff >= 0 && dayDiff <= 4) {
            if (!report[pid]) report[pid] = { total: 0, days: [0,0,0,0,0], tasks: {} };
            
            const mins = e.durationMinutes + (e.extraMinutes || 0);
            report[pid].days[dayDiff] += mins;
            report[pid].total += mins;
        }
    });

    return report;
  }, [timeEntries, weekDays, isHR, currentUser]);

  const grandTotals = useMemo(() => {
    const totals = [0, 0, 0, 0, 0];
    let grand = 0;
    Object.values(weeklyReportData).forEach((p: any) => {
        p.days.forEach((m: number, i: number) => totals[i] += m);
        grand += p.total;
    });
    return { days: totals, grand };
  }, [weeklyReportData]);

  // --- Handlers ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const normalMinutes = (parseInt(normalInput.hours) || 0) * 60 + (parseInt(normalInput.minutes) || 0);
    const extraMinutes = includeExtra ? (parseInt(extraInput.hours) || 0) * 60 + (parseInt(extraInput.minutes) || 0) : 0;
    
    const entryData = {
        userId: currentUser.id, 
        projectId: formData.isHoliday ? '' : (String(formData.projectId) === NO_PROJECT_ID ? '' : formData.projectId),
        task: formData.isHoliday ? 'Public Holiday' : formData.task,
        date: formData.date,
        durationMinutes: normalMinutes,
        extraMinutes: extraMinutes,
        description: formData.description,
        status: (formData.isHoliday ? 'Approved' : 'Pending') as 'Approved' | 'Pending',
        isBillable: formData.isHoliday ? false : formData.isBillable
    };
    
    if (editingId) updateTimeEntry(editingId, entryData as Partial<TimeEntry>);
    else addTimeEntry(entryData as Omit<TimeEntry, 'id'>);
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
      setEditingId(null);
      setIncludeExtra(false);
      setFormData({ projectId: '', task: '', date: new Date().toISOString().split('T')[0], description: '', isBillable: true, isHoliday: false });
      setNormalInput({ hours: '8', minutes: '00' });
      setExtraInput({ hours: '0', minutes: '00' });
  };

  const handleEdit = (entry: TimeEntry) => {
      const isHol = entry.task === 'Public Holiday';
      setEditingId(String(entry.id));
      setFormData({ 
        projectId: String(entry.projectId || NO_PROJECT_ID), 
        task: entry.task, 
        date: entry.date, 
        description: entry.description || '', 
        isBillable: entry.isBillable,
        isHoliday: isHol
      });
      const nh = Math.floor(entry.durationMinutes / 60);
      const nm = entry.durationMinutes % 60;
      setNormalInput({ hours: nh.toString(), minutes: nm.toString().padStart(2, '0') });
      const eh = Math.floor((entry.extraMinutes || 0) / 60);
      const em = (entry.extraMinutes || 0) % 60;
      setExtraInput({ hours: eh.toString(), minutes: em.toString().padStart(2, '0') });
      setIncludeExtra((entry.extraMinutes || 0) > 0);
      setShowModal(true);
  };

  const handleDeleteTrigger = (id: string | number) => {
      setItemToDelete(String(id));
      setShowDeleteConfirm(true);
  };

  // Stubbed Exports
  const exportCSV = () => showToast("Exporting to CSV...", "info");
  const exportExcel = () => showToast("Exporting to Excel...", "info");
  const exportPDF = () => showToast("Exporting to PDF...", "info");

  return (
    <div className="space-y-8 pb-20 animate-fade-in text-slate-800 dark:text-slate-200">
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Time Logs</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">View and manage your time entries</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <button onClick={exportCSV} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><FileText size={16}/> Export CSV</button>
              <button onClick={exportPDF} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><FileText size={16}/> Export PDF</button>
              <button onClick={exportExcel} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><FileSpreadsheet size={16}/> Export Excel</button>
              <button 
                onClick={() => { resetForm(); setShowModal(true); }}
                className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-lg shadow-teal-500/20 transition-all active:scale-95"
              >
                  <Plus size={18} />
                  <span>Add Time Entry</span>
              </button>
          </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-6">
          <h4 className="font-bold text-slate-800 dark:text-white text-sm">Filters</h4>
          
          <div className="flex flex-col lg:flex-row justify-between gap-6 items-end">
              <div className="flex flex-col sm:flex-row gap-8 w-full">
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Time Period</label>
                      <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" checked={timePeriod === 'Week'} onChange={() => setTimePeriod('Week')} className="text-teal-600 focus:ring-teal-500" />
                              <span className="text-sm font-medium">Week</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" checked={timePeriod === 'Month'} onChange={() => setTimePeriod('Month')} className="text-teal-600 focus:ring-teal-500" />
                              <span className="text-sm font-medium">Month</span>
                          </label>
                      </div>
                  </div>

                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Date Range</label>
                      <div className="flex items-center gap-2">
                          <button onClick={() => handleDateNavigation('prev')} className="p-1.5 border rounded hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"><ChevronLeft size={16}/></button>
                          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-1.5 rounded text-sm font-medium min-w-[140px] text-center">
                              {timePeriod === 'Month' ? viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `${weekDays[0].toLocaleDateString()} - ${weekDays[4].toLocaleDateString()}`}
                          </div>
                          <button onClick={() => handleDateNavigation('next')} className="p-1.5 border rounded hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"><ChevronRight size={16}/></button>
                          <button onClick={() => setViewDate(new Date())} className="ml-2 px-3 py-1.5 border rounded hover:bg-slate-50 text-sm font-medium dark:border-slate-600 dark:hover:bg-slate-700">Today</button>
                      </div>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Filter by Project</label>
                  <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-teal-500">
                      <option value="All">All Projects</option>
                      {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                      <option value={NO_PROJECT_ID}>Internal - General</option>
                  </select>
              </div>
              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Filter by Task</label>
                  <select value={filterTask} onChange={(e) => setFilterTask(e.target.value)} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-teal-500">
                      <option>All Tasks</option>
                      {allUniqueTasks.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
              </div>
              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Filter by Status</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-teal-500">
                      <option>All Statuses</option>
                      <option>Pending</option>
                      <option>Approved</option>
                      <option>Rejected</option>
                  </select>
              </div>
          </div>
      </div>

      <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300">Timesheet for {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>

      {/* 1. Grouped Detail Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs table-fixed border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <th className="px-6 py-4 w-[110px]">Date</th>
                    <th className="px-6 py-4 w-[140px]">Project</th>
                    <th className="px-6 py-4 w-[150px]">Task</th>
                    <th className="px-6 py-4 w-auto min-w-[200px]">Task Description</th>
                    <th className="px-6 py-4 w-[150px]">User</th>
                    <th className="px-6 py-4 w-[90px]">Duration</th>
                    <th className="px-6 py-4 w-[110px]">Status</th>
                    <th className="px-6 py-4 w-[90px]">Billable</th>
                    <th className="px-6 py-4 w-[90px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(Object.entries(groupedEntries) as [string, TimeEntry[]][]).map(([pid, entries]) => (
                    <React.Fragment key={pid}>
                      <tr 
                        className="bg-slate-50/50 dark:bg-slate-900/20 hover:bg-slate-100/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700"
                        onClick={() => setExpandedProjects(prev => ({...prev, [pid]: !prev[pid]}))}
                      >
                        <td colSpan={9} className="px-6 py-3 font-bold text-teal-700 dark:text-teal-400">
                           <div className="flex items-center gap-3">
                               <div className="p-1 rounded bg-teal-100 dark:bg-teal-900/30">
                                   {expandedProjects[pid] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                               </div>
                               <span className="uppercase tracking-tight whitespace-nowrap">{getProjectName(pid)} ({entries.length} entries)</span>
                           </div>
                        </td>
                      </tr>
                      {expandedProjects[pid] && entries.map(e => {
                        const { day, monthYear } = getDayNameAndDate(e.date);
                        const user = employees.find(u => String(u.id) === String(e.userId));
                        const isHolidayLog = e.task === 'Public Holiday';
                        return (
                          <tr key={e.id} className={`hover:bg-slate-50/50 transition-colors group ${isHolidayLog ? 'bg-emerald-50/20 dark:bg-emerald-900/5' : 'bg-white dark:bg-slate-800'}`}>
                            <td className="px-6 py-4 align-top">
                               <div className="leading-tight">
                                   <div className="font-bold text-slate-800 dark:text-white text-sm whitespace-nowrap">{monthYear.split(' ')[0]} {day},</div>
                                   <div className="text-slate-400 text-[10px] uppercase font-bold">{monthYear.split(' ')[1]}</div>
                               </div>
                            </td>
                            <td className="px-6 py-4 align-top">
                                <div className="whitespace-normal">
                                    <span className={`${isHolidayLog ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'} font-bold text-xs uppercase`}>
                                        {isHolidayLog ? 'Company Holiday' : getProjectName(e.projectId)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 align-top">
                                <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 whitespace-normal break-words">
                                    {e.task}
                                </div>
                            </td>
                            <td className="px-6 py-4 align-top">
                                <div className="text-slate-500 leading-relaxed break-words whitespace-normal line-clamp-2 text-xs">
                                    {e.description}
                                </div>
                            </td>
                            <td className="px-6 py-4 align-top">
                                <div className="text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                    {user ? `${user.firstName} ${user.lastName}` : 'Unknown'}
                                </div>
                            </td>
                            <td className="px-6 py-4 align-top text-center">
                                <div className="font-mono font-bold text-slate-800 dark:text-white">
                                    {formatDuration(e.durationMinutes + (e.extraMinutes || 0))}
                                </div>
                            </td>
                            <td className="px-6 py-4 align-top text-center">
                               <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide border inline-block whitespace-nowrap ${e.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : e.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                  {e.status}
                               </span>
                            </td>
                            <td className="px-6 py-4 align-top text-center">
                               {e.isBillable ? <CheckCircle2 size={16} className="text-emerald-500 mx-auto" /> : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="px-6 py-4 align-top text-right">
                               <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => handleEdit(e)} className="text-slate-300 hover:text-teal-600 transition-colors p-2 rounded-lg hover:bg-teal-50" title="Edit Log">
                                     <Edit2 size={15} />
                                  </button>
                                  <button onClick={() => handleDeleteTrigger(e.id)} className="text-slate-300 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50" title="Delete Log">
                                     <Trash2 size={15} />
                                  </button>
                                </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                  {Object.keys(groupedEntries).length === 0 && (
                      <tr><td colSpan={9} className="text-center py-10 text-slate-400">No time entries found for selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
      </div>

      {/* Weekly Timesheet Report */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Weekly Timesheet Report</h3>
              <div className="flex items-center gap-2">
                  <button onClick={() => handleDateNavigation('prev')} className="p-1.5 border rounded hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"><ChevronLeft size={16}/></button>
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2">
                      <CalendarIcon size={14} className="text-slate-400"/>
                      {weekDays[0].toLocaleDateString(undefined, {month:'long', day:'numeric'})}, {weekDays[0].getFullYear()}
                  </div>
                  <button onClick={() => handleDateNavigation('next')} className="p-1.5 border rounded hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"><ChevronRight size={16}/></button>
              </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold text-xs uppercase border-b border-slate-200 dark:border-slate-700">
                      <tr>
                          <th className="px-4 py-3 border-r border-slate-200 dark:border-slate-700">Client & Project</th>
                          {weekDays.map(d => (
                              <th key={d.toISOString()} className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-700 min-w-[100px]">
                                  {d.toLocaleDateString(undefined, {weekday:'short', day:'numeric', month:'short'})}
                              </th>
                          ))}
                          <th className="px-4 py-3 text-center min-w-[80px]">Total</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {Object.keys(weeklyReportData).map(pid => (
                          <tr key={pid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-700">
                                  {getProjectName(pid)}
                              </td>
                              {weeklyReportData[pid].days.map((mins, i) => (
                                  <td key={i} className="px-4 py-3 text-center font-mono text-xs border-r border-slate-100 dark:border-slate-700">
                                      {formatDurationShort(mins)}
                                  </td>
                              ))}
                              <td className="px-4 py-3 text-center font-mono font-bold text-teal-600">
                                  {formatDurationShort(weeklyReportData[pid].total)}
                              </td>
                          </tr>
                      ))}
                      <tr className="bg-slate-50 dark:bg-slate-900/50 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-700">Grand Total</td>
                          {grandTotals.days.map((total, i) => (
                              <td key={i} className="px-4 py-3 text-center font-mono border-r border-slate-200 dark:border-slate-700">
                                  {formatDurationShort(total)}
                              </td>
                          ))}
                          <td className="px-4 py-3 text-center font-mono text-teal-700 dark:text-teal-400">
                              {formatDurationShort(grandTotals.grand)}
                          </td>
                      </tr>
                  </tbody>
              </table>
          </div>
      </div>

      {/* Shared Edit Modal */}
      <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? "Edit Time Log" : "Log New Session"} width="max-w-xl">
           <form onSubmit={handleSubmit} className="space-y-6">
               <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl cursor-pointer transition-all">
                  <input 
                    type="checkbox" 
                    id="isHoliday" 
                    checked={formData.isHoliday} 
                    onChange={e => {
                        const checked = e.target.checked;
                        setFormData({
                            ...formData, 
                            isHoliday: checked,
                            projectId: checked ? NO_PROJECT_ID : '',
                            task: checked ? 'Public Holiday' : '',
                            isBillable: checked ? false : true,
                            description: checked ? 'Public / National Holiday observed.' : formData.description
                        });
                        if (checked) setNormalInput({ hours: '8', minutes: '00' });
                    }} 
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <label htmlFor="isHoliday" className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest cursor-pointer flex items-center gap-2">
                    <PartyPopper size={14} /> Mark as Public / National Holiday
                  </label>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Date</label>
                       <input required type="date" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-white outline-none focus:ring-2 focus:ring-teal-500" value={formData.date} onChange={e => setFormData({...formData,date: e.target.value})} />
                   </div>
                   <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Project</label>
                       <select 
                        required 
                        disabled={formData.isHoliday}
                        className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-white outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:bg-slate-50" 
                        value={formData.projectId} 
                        onChange={e => {
                         const pid = e.target.value;
                         setFormData({...formData, projectId: pid, task: ''}); // Reset task when project changes
                       }}>
                          <option value="" disabled>Select Project</option>
                          {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                          <option value={NO_PROJECT_ID}>Internal - General</option>
                       </select>
                   </div>
               </div>
               <div>
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Task / Subtask</label>
                   <select 
                      required 
                      disabled={!formData.projectId || formData.isHoliday}
                      className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-white outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:bg-slate-50 transition-all shadow-sm" 
                      value={formData.task} 
                      onChange={e => setFormData({...formData, task: e.target.value})}
                   >
                    <option value="" disabled>{formData.isHoliday ? 'Public Holiday' : (formData.projectId ? "Select subtask..." : "Select project first")}</option>
                    {availableTasks.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Standard Hours</label>
                        <div className="flex gap-2">
                            <input type="number" min="0" max="24" className="w-full px-3 py-2 border rounded-xl text-center dark:bg-slate-700" value={normalInput.hours} onChange={e => setNormalInput({...normalInput, hours: e.target.value})} />
                            <input 
                              type="number" 
                              min="0" 
                              max="59" 
                              className="w-full px-3 py-2 border rounded-xl text-center dark:bg-slate-700" 
                              value={normalInput.minutes} 
                              placeholder="MM"
                              onChange={e => setNormalInput({...normalInput, minutes: e.target.value.padStart(2, '0').slice(-2)})} 
                            />
                        </div>
                   </div>
                   <div className="flex flex-col justify-end">
                      {!formData.isHoliday && (
                        <>
                          <label className="flex items-center gap-2 cursor-pointer pb-2">
                            <input type="checkbox" checked={includeExtra} onChange={(e) => setIncludeExtra(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Include Overtime?</span>
                          </label>
                          {includeExtra && (
                              <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                                <input type="number" placeholder="H" className="w-full px-2 py-1.5 border border-purple-200 rounded-lg dark:bg-slate-800 outline-none focus:ring-1 focus:ring-purple-500 text-center" value={extraInput.hours} onChange={e => setExtraInput({...extraInput, hours: e.target.value})} />
                                <input 
                                  type="number" 
                                  min="0" 
                                  max="59" 
                                  placeholder="M" 
                                  className="w-full px-2 py-1.5 border border-purple-200 rounded-lg dark:bg-slate-800 outline-none focus:ring-1 focus:ring-purple-500 text-center" 
                                  value={extraInput.minutes} 
                                  onChange={e => setExtraInput({...extraInput, minutes: e.target.value.padStart(2, '0').slice(-2)})} 
                                />
                              </div>
                          )}
                        </>
                      )}
                   </div>
               </div>
               <div>
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Detailed Notes</label>
                   <textarea required rows={4} className="w-full px-4 py-3 border rounded-xl text-sm dark:bg-slate-700 bg-white outline-none focus:ring-2 focus:ring-teal-500" placeholder="What did you achieve? Provide bullet points if possible." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
               </div>
               <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors">Cancel</button>
                  <button type="submit" className="px-10 py-3 bg-teal-600 text-white rounded-2xl font-bold shadow-xl shadow-teal-500/20 hover:bg-teal-700 transition active:scale-95">
                     {editingId ? 'Update Log' : 'Save Session'}
                  </button>
               </div>
           </form>
      </DraggableModal>

      {/* Delete Confirmation */}
      <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Remove Entry?" width="max-w-sm">
           <div className="text-center">
              <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-300 mb-6">Are you sure you want to delete this log? This cannot be undone.</p>
              <div className="flex justify-center gap-3">
                 <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-slate-500 font-bold">Cancel</button>
                 <button onClick={() => { if (itemToDelete) { deleteTimeEntry(itemToDelete); setShowDeleteConfirm(false); setItemToDelete(null); } }} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95">Delete Log</button>
              </div>
           </div>
      </DraggableModal>
    </div>
  );
};

export default TimeLogs;