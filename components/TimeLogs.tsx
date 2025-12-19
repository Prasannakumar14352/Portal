
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TimeEntry, Project, UserRole } from '../types';
import { 
  Clock, Plus, FileText, ChevronDown, ChevronRight, ChevronLeft, Edit2, Trash2,
  DollarSign, FileSpreadsheet, AlertTriangle, CheckCircle2, MoreHorizontal, SlidersHorizontal, Zap
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import DraggableModal from './DraggableModal';

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
    const proj = projects.find(p => String(p.id) === String(formData.projectId));
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

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };
  
  const getProjectName = (id?: string | number) => {
      if (!id || String(id) === NO_PROJECT_ID) return 'No Client - General';
      return projects.find(p => String(p.id) === String(id))?.name || 'Unknown Project';
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
             const u = users.find(usr => String(usr.id) === String(e.userId));
             return u && `${u.firstName} ${u.lastName}`.toLowerCase().includes(lowerQ);
          });
       }
    } else {
       entries = entries.filter(e => String(e.userId) === String(currentUser?.id));
    }
    if (filterProject !== 'All') entries = entries.filter(e => String(e.projectId || NO_PROJECT_ID) === filterProject);
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
            return d >= startOfMonth && d <= endOfMonth;
        });
    }
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [timeEntries, currentUser, filterProject, filterStatus, filterTask, searchEmployee, viewDate, isHR, dateRange, weekDays, users]);

  const groupedEntries = useMemo(() => {
      const groups: Record<string, TimeEntry[]> = {};
      visibleEntries.forEach(entry => {
          const pid = String(entry.projectId || NO_PROJECT_ID);
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
        projectId: String(formData.projectId) === NO_PROJECT_ID ? '' : formData.projectId,
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
      setEditingId(String(entry.id));
      const nh = Math.floor(entry.durationMinutes / 60);
      const nm = entry.durationMinutes % 60;
      setNormalInput({ hours: nh.toString(), minutes: nm.toString().padStart(2, '0') });
      
      const emins = entry.extraMinutes || 0;
      const eh = Math.floor(emins / 60);
      const em = emins % 60;
      setExtraInput({ hours: eh.toString(), minutes: em.toString().padStart(2, '0') });
      setIncludeExtra(emins > 0);

      setFormData({
          projectId: String(entry.projectId || NO_PROJECT_ID),
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
      if (visibleEntries.length === 0) {
          showToast("No data to export", "warning");
          return;
      }
      const headers = ['Date', 'Project', 'Task', 'User', 'Normal (min)', 'Extra (min)', 'Status', 'Billable'];
      const rows = visibleEntries.map(e => {
          const user = users.find(u => String(u.id) === String(e.userId));
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
                <button onClick={() => handleExport('csv')} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm transition-colors" title="Export CSV"><FileSpreadsheet size={16}/></button>
                <button onClick={() => handleExport('pdf')} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm transition-colors" title="Export PDF"><FileText size={16}/></button>
             </div>
          </div>
       </div>

       {/* Filters Section */}
       <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-5 ${!showFilters ? 'hidden xl:block' : 'block'}`}>
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
             <div className="w-full lg:w-auto">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Time Period</label>
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                   <button onClick={() => setDateRange('Week')} className={`flex-1 lg:flex-none px-3 py-1 text-xs font-medium rounded-md transition ${dateRange === 'Week' ? 'bg-white dark:bg-slate-600 text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Week</button>
                   <button onClick={() => setDateRange('Month')} className={`flex-1 lg:flex-none px-3 py-1 text-xs font-medium rounded-md transition ${dateRange === 'Month' ? 'bg-white dark:bg-slate-600 text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Month</button>
                </div>
             </div>
             <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
                <button onClick={() => handleDateNavigation('prev')} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"><ChevronLeft size={20}/></button>
                <h3 className="font-bold text-slate-800 dark:text-white min-w-[120px] text-center">
                    {dateRange === 'Month' 
                        ? viewDate.toLocaleString('default', { month: 'long', year: 'numeric' }) 
                        : `${weekDays[0].toLocaleDateString('default', { day: 'numeric', month: 'short' })} - ${weekDays[4].toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </h3>
                <button onClick={() => handleDateNavigation('next')} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"><ChevronRight size={20}/></button>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             {isHR && (
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Employee</label>
                   <input type="text" placeholder="Search name..." className="w-full px-3 py-2 text-sm border dark:border-slate-600 rounded-lg dark:bg-slate-700 bg-white" value={searchEmployee} onChange={e => setSearchEmployee(e.target.value)} />
                </div>
             )}
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Project</label>
                <select className="w-full px-3 py-2 text-sm border dark:border-slate-600 rounded-lg dark:bg-slate-700 bg-white" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                   <option value="All">All Projects</option>
                   {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                   <option value={NO_PROJECT_ID}>Internal - General</option>
                </select>
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Status</label>
                <select className="w-full px-3 py-2 text-sm border dark:border-slate-600 rounded-lg dark:bg-slate-700 bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                   <option value="All">Any Status</option>
                   <option value="Pending">Pending</option>
                   <option value="Approved">Approved</option>
                   <option value="Rejected">Rejected</option>
                </select>
             </div>
          </div>
       </div>

       {/* Time Logs List */}
       <div className="space-y-4">
          {Object.keys(groupedEntries).length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
                  <Clock className="mx-auto text-slate-300 mb-4" size={48} />
                  <p className="text-slate-500 dark:text-slate-400 font-medium">No time logs found for the selected period.</p>
              </div>
          ) : (
              Object.entries(groupedEntries).map(([pid, entries]) => (
                  <div key={pid} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <button 
                        onClick={() => toggleProjectGroup(pid)}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-xs">
                               <BriefcaseIcon pid={pid} />
                            </div>
                            <div className="text-left">
                               <h4 className="font-bold text-slate-800 dark:text-white">{getProjectName(pid)}</h4>
                               <p className="text-xs text-slate-500">{entries.length} entries in this period</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                             <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Logged</p>
                                <p className="font-bold text-slate-700 dark:text-emerald-400">
                                   {formatDuration(entries.reduce((acc, e) => acc + e.durationMinutes + (e.extraMinutes || 0), 0))}
                                </p>
                             </div>
                             {expandedProjects[pid] ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}
                         </div>
                      </button>

                      {expandedProjects[pid] && (
                          <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
                              <table className="w-full text-left">
                                 <thead className="bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b">
                                    <tr>
                                       <th className="px-6 py-3">Date</th>
                                       {isHR && <th className="px-6 py-3">Employee</th>}
                                       <th className="px-6 py-3">Task & Description</th>
                                       <th className="px-6 py-3">Duration</th>
                                       <th className="px-6 py-3">Status</th>
                                       <th className="px-6 py-3"></th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {entries.map(entry => (
                                        <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                           <td className="px-6 py-4 whitespace-nowrap">
                                              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{new Date(entry.date).toLocaleDateString('default', { day: 'numeric', month: 'short' })}</p>
                                              <p className="text-[10px] text-slate-400">{new Date(entry.date).toLocaleDateString('default', { weekday: 'short' })}</p>
                                           </td>
                                           {isHR && (
                                              <td className="px-6 py-4">
                                                 <div className="flex items-center gap-2">
                                                    <img src={users.find(u => String(u.id) === String(entry.userId))?.avatar} className="w-6 h-6 rounded-full" alt=""/>
                                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                                       {users.find(u => String(u.id) === String(entry.userId))?.firstName}
                                                    </p>
                                                 </div>
                                              </td>
                                           )}
                                           <td className="px-6 py-4">
                                              <div className="flex items-center gap-2 mb-1">
                                                 <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{entry.task}</span>
                                                 {/* Fixed: Wrapped DollarSign icon in a span to handle title prop correctly */}
                                                 {entry.isBillable && <span title="Billable"><DollarSign size={10} className="text-emerald-500" /></span>}
                                              </div>
                                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xs">{entry.description}</p>
                                           </td>
                                           <td className="px-6 py-4 whitespace-nowrap">
                                              <div className="flex items-center gap-1.5">
                                                 <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDuration(entry.durationMinutes)}</span>
                                                 {(entry.extraMinutes || 0) > 0 && (
                                                     <span className="flex items-center gap-0.5 text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-bold">
                                                        <Zap size={8} fill="currentColor" /> +{formatDuration(entry.extraMinutes || 0)}
                                                     </span>
                                                 )}
                                              </div>
                                           </td>
                                           <td className="px-6 py-4">
                                              <StatusBadge status={entry.status} />
                                           </td>
                                           <td className="px-6 py-4 text-right">
                                              <div className="flex justify-end gap-1">
                                                  {(isHR || String(entry.userId) === String(currentUser?.id)) && entry.status === 'Pending' && (
                                                      <>
                                                        <button onClick={() => handleEdit(entry)} className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"><Edit2 size={14}/></button>
                                                        <button onClick={() => { setItemToDelete(String(entry.id)); setShowDeleteConfirm(true); }} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                                                      </>
                                                  )}
                                              </div>
                                           </td>
                                        </tr>
                                    ))}
                                 </tbody>
                              </table>
                          </div>
                      )}
                  </div>
              ))
          )}
       </div>

       {/* Log Time Modal */}
       <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? "Edit Time Log" : "Log New Work Session"} width="max-w-xl">
           <form onSubmit={handleSubmit} className="space-y-6">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Date</label>
                       <input required type="date" className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                   </div>
                   <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Project / Client</label>
                       <select required className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" value={formData.projectId} onChange={e => setFormData({...formData, projectId: e.target.value})}>
                          <option value="" disabled>Select Project</option>
                          {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                          <option value={NO_PROJECT_ID}>No Project - General</option>
                       </select>
                   </div>
               </div>

               <div>
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Subtask / Activity</label>
                   <select required className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" value={formData.task} onChange={e => setFormData({...formData, task: e.target.value})}>
                      <option value="" disabled>Select Activity</option>
                      {selectedProjectTasks.map(t => <option key={t} value={t}>{t}</option>)}
                      <option value="Other">Other (Custom)</option>
                   </select>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Standard Hours</label>
                        <div className="flex items-center gap-2">
                            <input type="number" min="0" max="24" className="w-full px-3 py-2 border rounded-xl text-center dark:bg-slate-700 font-bold" value={normalInput.hours} onChange={e => setNormalInput({...normalInput, hours: e.target.value})} />
                            <span className="font-bold text-slate-400">:</span>
                            <select className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 font-bold" value={normalInput.minutes} onChange={e => setNormalInput({...normalInput, minutes: e.target.value})}>
                               <option value="00">00</option>
                               <option value="15">15</option>
                               <option value="30">30</option>
                               <option value="45">45</option>
                            </select>
                        </div>
                      </div>
                      <div className="flex items-center">
                          <label className="flex items-center gap-2 cursor-pointer group">
                             <div className={`w-10 h-5 rounded-full p-1 transition-colors ${includeExtra ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`} onClick={() => setIncludeExtra(!includeExtra)}>
                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${includeExtra ? 'translate-x-5' : 'translate-x-0'}`} />
                             </div>
                             <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-purple-600 transition-colors">Overtime Session?</span>
                          </label>
                      </div>
                   </div>

                   {includeExtra && (
                       <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl animate-in slide-in-from-right-2">
                          <div className="flex items-center gap-2 mb-3">
                             <Zap size={14} className="text-purple-600" fill="currentColor" />
                             <label className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Extra Effort</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="number" min="0" max="24" className="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-center dark:bg-slate-800 font-bold" value={extraInput.hours} onChange={e => setExtraInput({...extraInput, hours: e.target.value})} />
                            <span className="font-bold text-purple-300">:</span>
                            <select className="w-full px-2 py-1.5 border border-purple-200 rounded-lg dark:bg-slate-800 font-bold" value={extraInput.minutes} onChange={e => setExtraInput({...extraInput, minutes: e.target.value})}>
                               <option value="00">00</option><option value="15">15</option><option value="30">30</option><option value="45">45</option>
                            </select>
                          </div>
                       </div>
                   )}
               </div>

               <div>
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Notes / Summary</label>
                   <textarea required rows={4} className="w-full px-4 py-3 border rounded-xl text-sm dark:bg-slate-700 bg-white dark:text-white resize-none" placeholder="Explain what was accomplished..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
               </div>

               <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-slate-500 font-bold">Cancel</button>
                  <button type="submit" className="px-10 py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition transform hover:scale-[1.02]">
                     {editingId ? 'Update Entry' : 'Log Entry'}
                  </button>
               </div>
           </form>
       </DraggableModal>

       {/* Delete Confirmation */}
       <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Remove Entry?" width="max-w-sm">
           <div className="text-center">
              <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-300 mb-6">Are you sure you want to delete this log? This action cannot be reversed.</p>
              <div className="flex justify-center gap-3">
                 <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-slate-500 font-bold">Cancel</button>
                 <button onClick={() => { if (itemToDelete) { deleteTimeEntry(itemToDelete); setShowDeleteConfirm(false); setItemToDelete(null); } }} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold">Delete Log</button>
              </div>
           </div>
       </DraggableModal>
    </div>
  );
};

const BriefcaseIcon = ({ pid }: { pid: string }) => {
    if (pid === "NO_PROJECT") return <Zap className="text-amber-500" size={20} />;
    return <FileText className="text-blue-500" size={20} />;
};

export default TimeLogs;
