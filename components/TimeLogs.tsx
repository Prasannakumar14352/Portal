
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TimeEntry, Project, UserRole } from '../types';
import { 
  Clock, Plus, FileText, ChevronDown, ChevronRight, ChevronLeft, Edit2, Trash2,
  DollarSign, FileSpreadsheet, AlertTriangle, CheckCircle2, MoreHorizontal, SlidersHorizontal, Zap, 
  Calendar as CalendarIcon, Search, Filter, Download, MoreVertical, Coffee, RefreshCcw, PartyPopper
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import DraggableModal from './DraggableModal';

const TimeLogs = () => {
  const { currentUser, projects, timeEntries, addTimeEntry, updateTimeEntry, deleteTimeEntry, users, showToast, syncHolidayLogs, holidays } = useAppContext();
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [includeExtra, setIncludeExtra] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // View State
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedSummary, setExpandedSummary] = useState<Record<string, boolean>>({});
  
  // Filters & Navigation
  const [viewDate, setViewDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProject, setFilterProject] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  
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
      return ['General Administration', 'Internal Meeting', 'Documentation', 'Support', 'Training', 'Public Holiday'];
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
    return Array.isArray(tasks) ? tasks : [];
  }, [formData.projectId, formData.isHoliday, projects]);

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
    if (minutes === 0) return '--';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  };
  
  const getProjectName = (id?: string | number) => {
      if (!id || String(id) === NO_PROJECT_ID || id === "") return 'No Client - General';
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

  const weekDays = useMemo(() => getWeekDays(viewDate), [viewDate]);
  
  const handleDateNavigation = (direction: 'prev' | 'next') => {
      const newDate = new Date(viewDate);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      setViewDate(newDate);
  };

  // --- Data Logic ---
  const visibleEntries = useMemo(() => {
    let entries = [...timeEntries];
    if (!isHR) {
       entries = entries.filter(e => String(e.userId) === String(currentUser?.id));
    }
    
    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59);
    
    return entries.filter(e => {
        const d = new Date(e.date);
        const matchesDate = d >= startOfMonth && d <= endOfMonth;
        const matchesSearch = e.task.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             e.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = filterProject === 'All' || String(e.projectId || NO_PROJECT_ID) === filterProject;
        const matchesStatus = filterStatus === 'All' || e.status === filterStatus;
        
        return matchesDate && matchesSearch && matchesProject && matchesStatus;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [timeEntries, currentUser, viewDate, isHR, searchTerm, filterProject, filterStatus]);

  const groupedEntries = useMemo(() => {
      const groups: Record<string, TimeEntry[]> = {};
      visibleEntries.forEach(entry => {
          const pid = String(entry.projectId || NO_PROJECT_ID);
          if (!groups[pid]) groups[pid] = [];
          groups[pid].push(entry);
      });
      return groups;
  }, [visibleEntries]);

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
        const taskName = e.task;
        const d = new Date(e.date);
        const dayIdx = (d.getDay() + 6) % 7; 
        if (dayIdx > 4) return;

        if (!report[pid]) report[pid] = { total: 0, days: [0,0,0,0,0], tasks: {} };
        if (!report[pid].tasks[taskName]) report[pid].tasks[taskName] = [0,0,0,0,0];

        const mins = e.durationMinutes + (e.extraMinutes || 0);
        report[pid].days[dayIdx] += mins;
        report[pid].tasks[taskName][dayIdx] += mins;
        report[pid].total += mins;
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
    
    // Fix: Explicitly cast status to ensure it matches 'Pending' | 'Approved' | 'Rejected'
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

  const handleSyncHolidays = async () => {
      const year = viewDate.getFullYear().toString();
      await syncHolidayLogs(year);
  };

  // --- Specialized Exports Matching User Requirement ---

  const formatDateLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const exportCSV = () => {
    // Filename format: timesheet_YYYY_MM.csv
    const year = viewDate.getFullYear();
    const month = String(viewDate.getMonth() + 1).padStart(2, '0');
    const filename = `timesheet_${year}_${month}.csv`;

    const headers = ["Date", "Resource", "Category", "Project", "Task", "Time", "Description", "Status", "Billable"];
    const rows = visibleEntries.map(e => {
        const user = users.find(u => String(u.id) === String(e.userId));
        const resourceName = user ? `${user.firstName}${user.lastName?.charAt(0) || ''}` : 'Unknown';
        const totalHours = ((e.durationMinutes + (e.extraMinutes || 0)) / 60).toFixed(2);
        const category = user?.department || 'Product Development';
        
        return [
            e.date,
            resourceName,
            category,
            getProjectName(e.projectId),
            e.task,
            totalHours,
            e.description,
            e.status.toLowerCase(),
            e.isBillable ? 'Yes' : 'No'
        ];
    });

    const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    link.click();
    setShowExportMenu(false);
    showToast("CSV Exported", "success");
  };

  const exportExcel = () => {
    // Filename format: TimeLog_YYYY-MM-DD HH_mm_ss_month.xlsx
    const now = new Date();
    const stamp = now.toISOString().split('T')[0] + ' ' + 
                  now.getHours().toString().padStart(2, '0') + '_' + 
                  now.getMinutes().toString().padStart(2, '0') + '_' + 
                  now.getSeconds().toString().padStart(2, '0');
    const filename = `TimeLog_${stamp}_month.xlsx`;

    // 1. Time Entries Sheet
    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    const rangeStr = `${formatDateLabel(startOfMonth)} - ${formatDateLabel(endOfMonth)}`;
    const generatedStr = `Generated on ${now.toISOString().split('T')[0]} ${now.getHours()}:${now.getMinutes()}`;

    const ws1Data = [
        ["Time Entries"],
        [rangeStr],
        ["", "", "", "", "", "", generatedStr],
        ["Date", "Resource", "Category", "Project", "Task", "Time", "Description", "Status", "Billable"]
    ];

    let grandTotalMinutes = 0;
    visibleEntries.forEach(e => {
        const user = users.find(u => String(u.id) === String(e.userId));
        const resourceName = user ? `${user.firstName}${user.lastName?.charAt(0) || ''}` : 'Unknown';
        const totalMins = e.durationMinutes + (e.extraMinutes || 0);
        grandTotalMinutes += totalMins;
        const hours = (totalMins / 60).toFixed(2);
        
        ws1Data.push([
            e.date,
            resourceName,
            user?.department || 'Product Development',
            getProjectName(e.projectId),
            e.task,
            hours,
            e.description,
            e.status.toLowerCase(),
            e.isBillable ? 'Yes' : 'No'
        ]);
    });

    ws1Data.push(["GRAND TOTAL", "", "", "", "", (grandTotalMinutes / 60).toFixed(2)]);

    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    
    // Set column widths for better auto-formatting appearance
    ws1['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, 
        { wch: 15 }, { wch: 10 }, { wch: 40 }, { wch: 12 }, { wch: 10 }
    ];

    // 2. Project Summary Sheet
    const ws2Data = [
        ["Approved & Locked Project Hours Summary"],
        [],
        ["Project", "Total Hours", "Approved Hours", "Locked Hours"]
    ];

    const projSummary: Record<string, { total: number, approved: number }> = {};
    visibleEntries.forEach(e => {
        const name = getProjectName(e.projectId);
        if(!projSummary[name]) projSummary[name] = { total: 0, approved: 0 };
        const mins = e.durationMinutes + (e.extraMinutes || 0);
        projSummary[name].total += mins;
        if(e.status === 'Approved') projSummary[name].approved += mins;
    });

    Object.entries(projSummary).forEach(([name, vals]) => {
        ws2Data.push([
            name, 
            (vals.total / 60).toFixed(2), 
            (vals.approved / 60).toFixed(2), 
            "0.00" // Locked placeholder
        ]);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    ws2['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Time Entries");
    XLSX.utils.book_append_sheet(wb, ws2, "Project Summary");

    XLSX.writeFile(wb, filename);
    setShowExportMenu(false);
    showToast("Excel Exported", "success");
  };

  const exportPDF = () => {
    // Filename format: TimeLog_YYYY-MM-DD_month.pdf
    const now = new Date();
    const filename = `TimeLog_${now.toISOString().split('T')[0]}_month.pdf`;

    const doc = new jsPDF('l', 'mm', 'a4');
    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    const rangeStr = `${formatDateLabel(startOfMonth)} - ${formatDateLabel(endOfMonth)}`;

    // Top Right generated on
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated on ${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`, 280, 10, { align: 'right' });

    // Main Title - Centered
    doc.setFontSize(22);
    doc.setTextColor(33, 33, 33);
    doc.text(`Time Entries Report`, 148, 20, { align: 'center' });
    
    // Date Range - Centered
    doc.setFontSize(11);
    doc.text(rangeStr, 148, 28, { align: 'center' });

    const tableData = visibleEntries.map(e => {
        const user = users.find(u => String(u.id) === String(e.userId));
        const resourceName = user ? `${user.firstName}${user.lastName?.charAt(0) || ''}` : 'Unknown';
        return [
            e.date,
            resourceName,
            getProjectName(e.projectId),
            e.task,
            `${((e.durationMinutes + (e.extraMinutes || 0)) / 60).toFixed(1)}h`,
            e.status.toLowerCase(),
            e.isBillable ? 'Yes' : 'No'
        ];
    });

    autoTable(doc, {
      head: [["Date", "Resource", "Project", "Task", "Time", "Status", "Billable"]],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 14, right: 14 }
    });

    doc.save(filename);
    setShowExportMenu(false);
    showToast("PDF Exported", "success");
  };

  return (
    <div className="space-y-8 pb-20 animate-fade-in text-slate-800 dark:text-slate-200">
      
      {/* --- Main Header with Actions --- */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Time Logs</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Track daily activities and project effort.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              {isHR && (
                  <button 
                    onClick={handleSyncHolidays}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all hover:bg-slate-50"
                  >
                      <RefreshCcw size={18} className="text-emerald-500" />
                      <span>Sync Holiday Logs</span>
                  </button>
              )}
              <button 
                onClick={() => { resetForm(); setShowModal(true); }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-teal-500/20 transition-all active:scale-95"
              >
                  <Plus size={18} />
                  <span>Log Time</span>
              </button>

              {/* Export Dropdown */}
              <div className="relative" ref={exportRef}>
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
                >
                    <Download size={18} className="text-slate-400" />
                    <span>Export</span>
                    <ChevronDown size={14} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={exportPDF} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors border-b dark:border-slate-700">
                        <FileText size={16} className="text-red-500" /> PDF Report
                    </button>
                    <button onClick={exportExcel} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors border-b dark:border-slate-700">
                        <FileSpreadsheet size={16} className="text-emerald-600" /> Excel (.xlsx)
                    </button>
                    <button onClick={exportCSV} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors">
                        <FileSpreadsheet size={16} className="text-slate-400" /> CSV Details
                    </button>
                  </div>
                )}
              </div>
          </div>
      </div>

      {/* --- Filter Bar --- */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search tasks or descriptions..." 
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          
          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border rounded-lg px-3 py-1.5 border-slate-200 dark:border-slate-700">
                  <Filter size={14} className="text-slate-400" />
                  <select className="text-xs font-medium outline-none bg-transparent" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                      <option value="All">All Projects</option>
                      {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                      <option value={NO_PROJECT_ID}>General / Internal</option>
                  </select>
              </div>

              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border rounded-lg px-3 py-1.5 border-slate-200 dark:border-slate-700">
                  <Clock size={14} className="text-slate-400" />
                  <select className="text-xs font-medium outline-none bg-transparent" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="All">All Status</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                  </select>
              </div>

              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border rounded-lg px-3 py-1.5 border-slate-200 dark:border-slate-700">
                  <CalendarIcon size={14} className="text-slate-400" />
                  <input 
                    type="month" 
                    className="text-xs font-medium outline-none bg-transparent" 
                    value={`${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`}
                    onChange={e => {
                        const [y, m] = e.target.value.split('-');
                        setViewDate(new Date(parseInt(y), parseInt(m) - 1));
                    }}
                  />
              </div>
          </div>
      </div>

      {/* 1. Grouped Detail Table */}
      <section className="space-y-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs table-fixed border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase tracking-wider border-b">
                    <th className="px-6 py-4 w-[110px]">Date</th>
                    <th className="px-6 py-4 w-[140px]">Project</th>
                    <th className="px-6 py-4 w-[150px]">Task</th>
                    <th className="px-6 py-4 w-auto min-w-[200px]">Task Description</th>
                    <th className="px-6 py-4 w-[180px]">User</th>
                    <th className="px-6 py-4 w-[90px]">Duration</th>
                    <th className="px-6 py-4 w-[110px]">Status</th>
                    <th className="px-6 py-4 w-[90px]">Billable</th>
                    <th className="px-6 py-4 w-[90px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(Object.entries(groupedEntries) as [string, TimeEntry[]][]).map(([pid, entries]) => (
                    <React.Fragment key={pid}>
                      {/* Project Header Row */}
                      <tr 
                        className="bg-slate-50/50 dark:bg-slate-900/20 hover:bg-slate-100/50 cursor-pointer transition-colors border-b"
                        onClick={() => setExpandedProjects(prev => ({...prev, [pid]: !prev[pid]}))}
                      >
                        <td colSpan={9} className="px-6 py-4 font-bold text-teal-700 dark:text-teal-400">
                           <div className="flex items-center gap-3">
                               <div className="p-1 rounded bg-teal-100 dark:bg-teal-900/30">
                                   {expandedProjects[pid] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                               </div>
                               <span className="uppercase tracking-tight whitespace-nowrap">{getProjectName(pid)} ({entries.length} {entries.length === 1 ? 'entry' : 'entries'})</span>
                           </div>
                        </td>
                      </tr>
                      {/* Project Detail Rows */}
                      {expandedProjects[pid] && entries.map(e => {
                        const { day, monthYear } = getDayNameAndDate(e.date);
                        const user = users.find(u => String(u.id) === String(e.userId));
                        const isHolidayLog = e.task === 'Public Holiday';
                        return (
                          <tr key={e.id} className={`hover:bg-slate-50/50 transition-colors group ${isHolidayLog ? 'bg-emerald-50/20 dark:bg-emerald-900/5' : 'bg-white dark:bg-slate-800'}`}>
                            <td className="px-6 py-5 align-top">
                               <div className="leading-tight">
                                   <div className="font-bold text-slate-800 dark:text-white text-sm whitespace-nowrap">{monthYear.split(' ')[0]} {day},</div>
                                   <div className="text-slate-400 text-[10px] uppercase font-bold">{monthYear.split(' ')[1]}</div>
                               </div>
                            </td>
                            <td className="px-6 py-5 align-top">
                                <div className="whitespace-normal">
                                    <span className={`${isHolidayLog ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'} font-bold px-2 py-1 rounded text-[10px] uppercase inline-block`}>
                                        {isHolidayLog ? 'Company Holiday' : getProjectName(e.projectId)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-5 align-top">
                                <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 whitespace-normal break-words">
                                    {e.task}
                                    {isHolidayLog && <Coffee size={12} className="text-emerald-500 shrink-0" />}
                                </div>
                            </td>
                            <td className="px-6 py-5 align-top">
                                <div className="text-slate-500 leading-relaxed break-words whitespace-normal line-clamp-3">
                                    {e.description}
                                </div>
                            </td>
                            <td className="px-6 py-5 align-top">
                                <div className="text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                    {user ? `${user.firstName} ${user.lastName}` : 'Unknown'}
                                </div>
                            </td>
                            <td className="px-6 py-5 align-top text-center bg-slate-50/30 dark:bg-slate-900/10">
                                <div className="font-mono font-bold text-slate-800 dark:text-white">
                                    {formatDuration(e.durationMinutes + (e.extraMinutes || 0))}
                                </div>
                            </td>
                            <td className="px-6 py-5 align-top text-center">
                               <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide border inline-block whitespace-nowrap ${e.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : e.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                  {e.status}
                               </span>
                            </td>
                            <td className="px-6 py-5 align-top text-center">
                               {e.isBillable && <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">Billable</span>}
                            </td>
                            <td className="px-6 py-5 align-top text-right">
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
                    <tr><td colSpan={9} className="px-6 py-20 text-center text-slate-400 italic">
                        <div className="flex flex-col items-center gap-3">
                            <Clock size={40} className="text-slate-200" />
                            <p className="text-lg font-medium text-slate-300">No time logs found for this period</p>
                            <button onClick={() => { resetForm(); setShowModal(true); }} className="text-teal-600 font-bold hover:underline">Log your first session</button>
                        </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
        </div>
      </section>

      {/* 2. Weekly Summary View */}
      <section className="space-y-6 pt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Zap size={20} className="text-amber-500" />
                Weekly Timesheet Report
            </h2>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <button onClick={() => handleDateNavigation('prev')} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"><ChevronLeft size={18}/></button>
                <div className="flex items-center gap-2 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <CalendarIcon size={14} className="text-slate-400" />
                    {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[4].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <button onClick={() => handleDateNavigation('next')} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"><ChevronRight size={18}/></button>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase border-b">
                    <th className="px-6 py-4 w-72 border-r border-slate-200 dark:border-slate-700">Client & Project</th>
                    {weekDays.map(d => (
                        <th key={d.toISOString()} className="px-4 py-4 text-center border-r border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
                            <div className="text-slate-800 dark:text-slate-100">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                            <div className="text-[10px] text-slate-400">{d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</div>
                        </th>
                    ))}
                    <th className="px-6 py-4 text-center font-bold text-slate-600 bg-teal-50/50 dark:bg-teal-900/10">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(Object.entries(weeklyReportData) as [string, any][]).map(([pid, data]) => (
                    <React.Fragment key={pid}>
                      {/* Project Row */}
                      <tr 
                        className="bg-white dark:bg-slate-800 hover:bg-slate-50/80 cursor-pointer group"
                        onClick={() => setExpandedSummary(prev => ({...prev, [pid]: !prev[pid]}))}
                      >
                        <td className="px-6 py-4 border-r border-slate-200 dark:border-slate-700 font-bold flex items-center gap-3">
                           <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:text-teal-600 transition-colors">
                               {expandedSummary[pid] ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                           </div>
                           <span className="text-slate-700 dark:text-slate-200">{pid === NO_PROJECT_ID ? 'General / System' : `Project - ${getProjectName(pid)}`} ({Object.keys(data.tasks).length} task)</span>
                        </td>
                        {data.days.map((m: number, i: number) => (
                            <td key={i} className={`px-4 py-4 text-center border-r border-slate-200 dark:border-slate-700 font-bold ${m > 0 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-300'}`}>
                                {formatDurationShort(m)}
                            </td>
                        ))}
                        <td className="px-6 py-4 text-center font-black text-slate-900 dark:text-white bg-teal-50/30 dark:bg-teal-900/5">{formatDurationShort(data.total)}</td>
                      </tr>
                      {/* Task Detail Rows */}
                      {expandedSummary[pid] && (Object.entries(data.tasks) as [string, number[]][]).map(([task, days]) => (
                        <tr key={task} className="bg-slate-50/30 dark:bg-slate-900/10">
                            <td className="px-12 py-3 border-r border-slate-200 dark:border-slate-700 italic text-slate-500 font-medium">
                                {task}
                            </td>
                            {days.map((m: number, i: number) => (
                                <td key={i} className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-700 text-slate-400">
                                    {formatDurationShort(m)}
                                </td>
                            ))}
                            <td className="px-6 py-3 text-center font-bold text-slate-400">
                                {formatDurationShort(days.reduce((a: number, b: number) => a + b, 0))}
                            </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {/* Grand Total Row */}
                  <tr className="bg-slate-50 dark:bg-slate-900 font-black border-t-2 border-slate-200 dark:border-slate-700">
                    <td className="px-6 py-5 border-r border-slate-200 dark:border-slate-700 uppercase tracking-widest text-slate-600 dark:text-slate-400">Grand Total</td>
                    {grandTotals.days.map((m, i) => (
                        <td key={i} className="px-4 py-5 text-center border-r border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-800/30">
                            {formatDurationShort(m)}
                        </td>
                    ))}
                    <td className="px-6 py-5 text-center text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 text-sm">
                        {formatDurationShort(grandTotals.grand)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
        </div>
      </section>

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
                       <input required type="date" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-white outline-none focus:ring-2 focus:ring-teal-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
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
