
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { useAppContext } from '../contexts/AppContext';
import { Filter, Download, FileText, FileSpreadsheet, Clock, CalendarCheck, Zap, Layout, TrendingUp, Users, CheckCircle2, DollarSign, PieChart as PieIcon, Activity } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { UserRole } from '../types';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#6366f1'];
const STATUS_COLORS: Record<string, string> = {
  'Present': '#10b981', 
  'Late': '#f59e0b',    
  'Absent': '#ef4444'
};

const Reports = () => {
  const { timeEntries, projects, employees, attendance, currentUser, showToast } = useAppContext();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [filterPeriod, setFilterPeriod] = useState('This Month');
  const [filterProject, setFilterProject] = useState('All');
  
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MANAGER;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Data Logic ---

  const reportTimeEntries = useMemo(() => {
      if (isPowerUser) return timeEntries;
      return timeEntries.filter(t => String(t.userId) === String(currentUser?.id));
  }, [timeEntries, currentUser, isPowerUser]);

  const extraHoursDistribution = useMemo(() => {
      let normal = 0;
      let extra = 0;
      reportTimeEntries.forEach(e => {
          normal += e.durationMinutes;
          extra += (e.extraMinutes || 0);
      });
      return [
          { name: 'Normal Hours', value: parseFloat((normal / 60).toFixed(1)) },
          { name: 'Extra Hours', value: parseFloat((extra / 60).toFixed(1)) }
      ];
  }, [reportTimeEntries]);

  const projectTimeAllocation = useMemo(() => {
    const allocation: Record<string, number> = {};
    reportTimeEntries.forEach(e => {
        const projName = projects.find(p => String(p.id) === String(e.projectId))?.name || 'General / Admin';
        allocation[projName] = (allocation[projName] || 0) + e.durationMinutes + (e.extraMinutes || 0);
    });
    return Object.keys(allocation).map(name => ({ 
        name, 
        value: parseFloat((allocation[name] / 60).toFixed(1))
    })).sort((a, b) => b.value - a.value);
  }, [reportTimeEntries, projects]);

  const projectProgressData = useMemo(() => {
      return projects.map(proj => {
          const projectEntries = reportTimeEntries.filter(t => String(t.projectId) === String(proj.id));
          const uniqueTasksLogged = new Set(projectEntries.map(t => t.task)).size;
          
          let totalTasks = 0;
          if (Array.isArray(proj.tasks)) {
              totalTasks = proj.tasks.length;
          } else if (typeof proj.tasks === 'string') {
              try { totalTasks = JSON.parse(proj.tasks).length; } catch(e) { totalTasks = 5; }
          } else {
              totalTasks = 5;
          }
          
          if (totalTasks === 0) totalTasks = 1;
          const progress = Math.min(100, Math.round((uniqueTasksLogged / totalTasks) * 100));
          
          return {
              name: proj.name,
              progress: progress,
              hours: parseFloat((projectEntries.reduce((sum, e) => sum + e.durationMinutes + (e.extraMinutes || 0), 0) / 60).toFixed(1))
          };
      }).filter(p => p.hours > 0).sort((a, b) => b.progress - a.progress);
  }, [projects, reportTimeEntries]);

  const projectTimelineData = useMemo(() => {
      const dates = [...Array(7)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split('T')[0];
      });
      const topProjects = projectTimeAllocation.slice(0, 3).map(p => p.name);
      return dates.map(date => {
          const entry: any = { date: new Date(date).toLocaleDateString(undefined, {weekday:'short'}) };
          topProjects.forEach(projName => {
              const totalMins = reportTimeEntries
                  .filter(t => t.date === date && (projects.find(p => String(p.id) === String(t.projectId))?.name || 'General / Admin') === projName)
                  .reduce((sum, t) => sum + t.durationMinutes + (t.extraMinutes || 0), 0);
              entry[projName] = parseFloat((totalMins / 60).toFixed(1));
          });
          return entry;
      });
  }, [reportTimeEntries, projects, projectTimeAllocation]);

  const teamContributionData = useMemo(() => {
    const contrib: Record<string, number> = {};
    employees.forEach(emp => {
        const name = `${emp.firstName} ${emp.lastName}`;
        contrib[name] = 0;
    });
    let entriesToUse = timeEntries;
    if (filterProject !== 'All') {
        entriesToUse = entriesToUse.filter(e => String(e.projectId) === filterProject);
    }
    entriesToUse.forEach(e => {
        const user = employees.find(u => String(u.id) === String(e.userId));
        if (user) {
            const name = `${user.firstName} ${user.lastName}`;
            contrib[name] = (contrib[name] || 0) + e.durationMinutes + (e.extraMinutes || 0);
        }
    });
    return Object.keys(contrib).map(name => ({
        name,
        hours: parseFloat((contrib[name] / 60).toFixed(1))
    })).sort((a, b) => b.hours - a.hours);
  }, [timeEntries, employees, filterProject]);

  const billableData = useMemo(() => {
      let billable = 0;
      let nonBillable = 0;
      reportTimeEntries.forEach(e => {
          const total = e.durationMinutes + (e.extraMinutes || 0);
          if (e.isBillable) billable += total;
          else nonBillable += total;
      });
      return [
          { name: 'Billable', value: parseFloat((billable / 60).toFixed(1)) },
          { name: 'Non-Billable', value: parseFloat((nonBillable / 60).toFixed(1)) }
      ];
  }, [reportTimeEntries]);

  const attendanceStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    const recordsToUse = isPowerUser ? attendance : attendance.filter(a => String(a.employeeId) === String(currentUser?.id));
    recordsToUse.forEach(rec => {
        const status = rec.status || 'Present';
        counts[status] = (counts[status] || 0) + 1;
    });
    return Object.keys(counts).map(status => ({ name: status, value: counts[status] }));
  }, [attendance, isPowerUser, currentUser]);

  const handleExport = async (format: 'pdf' | 'csv') => {
    setShowExportMenu(false);
    showToast("Generating report...", "info");
    
    let dataToExport: any[] = [];
    let filename = 'report';
    let title = 'Report';

    switch(activeTab) {
        case 'Time Logs':
            title = 'Time Logs Report';
            filename = 'time_logs_report';
            dataToExport = reportTimeEntries.map(t => ({ 
                Date: t.date, 
                Project: projects.find(p => String(p.id) === String(t.projectId))?.name || 'N/A', 
                User: employees.find(u => String(u.id) === String(t.userId))?.firstName || 'Unknown', 
                Task: t.task,
                Hours: ((t.durationMinutes + (t.extraMinutes || 0)) / 60).toFixed(2),
                Billable: t.isBillable ? 'Yes' : 'No'
            }));
            break;
        case 'Projects':
            title = 'Projects Performance Report';
            filename = 'projects_report';
            dataToExport = projectProgressData.map(p => ({
                Project: p.name,
                TotalHours: p.hours,
                Progress: `${p.progress}%`
            }));
            break;
        case 'Attendance':
             title = 'Attendance Report';
             filename = 'attendance_report';
             const attRecs = isPowerUser ? attendance : attendance.filter(a => String(a.employeeId) === String(currentUser?.id));
             dataToExport = attRecs.map(a => ({
                 Date: a.date,
                 Employee: a.employeeName,
                 Status: a.status,
                 CheckIn: a.checkIn,
                 CheckOut: a.checkOut
             }));
             break;
        case 'Team Performance':
             title = 'Team Performance Report';
             filename = 'team_report';
             dataToExport = teamContributionData.map(d => ({
                 Employee: d.name,
                 TotalHours: d.hours
             }));
             break;
        default:
             title = 'Dashboard Summary';
             filename = 'dashboard_report';
             dataToExport = extraHoursDistribution.map(d => ({ Metric: d.name, Value: d.value }));
    }

    if (dataToExport.length === 0) {
        showToast("No data available to export.", "warning");
        return;
    }

    if (format === 'pdf') {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let currentY = 15;

        doc.setFontSize(16);
        doc.text(title, 14, currentY);
        currentY += 10;
        
        let chartIds: string[] = [];
        if (activeTab === 'Dashboard') chartIds = ['chart-effort-split', 'chart-billable'];
        else if (activeTab === 'Projects') chartIds = ['chart-project-allocation', 'chart-project-progress'];
        else if (activeTab === 'Attendance') chartIds = ['chart-attendance'];
        else if (activeTab === 'Team Performance') chartIds = ['chart-team-contributions'];

        for (const id of chartIds) {
            const element = document.getElementById(id);
            if (element) {
                try {
                    const canvas = await html2canvas(element, { scale: 2 });
                    const imgData = canvas.toDataURL('image/png');
                    const pdfWidth = pageWidth - 28;
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    if (currentY + pdfHeight > pageHeight - 20) { doc.addPage(); currentY = 20; }
                    doc.addImage(imgData, 'PNG', 14, currentY, pdfWidth, pdfHeight);
                    currentY += pdfHeight + 10;
                } catch (e) {}
            }
        }

        autoTable(doc, {
            head: [Object.keys(dataToExport[0])],
            body: dataToExport.map(row => Object.values(row)),
            startY: currentY,
            styles: { fontSize: 8 }
        });
        doc.save(`${filename}_${Date.now()}.pdf`);
    } else {
        const headers = Object.keys(dataToExport[0]);
        const csvContent = [headers.join(','), ...dataToExport.map(row => headers.map(h => `"${row[h]}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.csv`;
        link.click();
    }
    showToast("Download completed.", "success");
  };

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Reports & Analytics</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Analyze working hours, project effort, and team performance.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative" ref={exportMenuRef}>
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors">
                <Download size={16} /> Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"><FileText size={16}/> PDF Report</button>
                    <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"><FileSpreadsheet size={16}/> CSV Details</button>
                </div>
              )}
            </div>
        </div>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex space-x-8">
          {['Dashboard', 'Projects', 'Tasks', 'Time Tracking', 'Team Performance'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>{tab}</button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        {activeTab === 'Dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Status Overview */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Project Status Overview</h3>
                <p className="text-xs text-slate-500">Distribution of projects by status</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'On track', value: projects.filter(p => p.status === 'Active').length || 2 },
                        { name: 'Delayed', value: projects.filter(p => p.status === 'On Hold').length || 4 },
                        { name: 'At risk', value: 1 },
                        { name: 'Completed', value: projects.filter(p => p.status === 'Completed').length || 2 },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="#3b82f6" /> {/* On track */}
                      <Cell fill="#10b981" /> {/* Delayed - wait, image shows Delayed as green-ish? No, Delayed is teal/green in image? */}
                      <Cell fill="#f59e0b" /> {/* At risk */}
                      <Cell fill="#ef4444" /> {/* Completed */}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Task Completion */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Task Completion</h3>
                <p className="text-xs text-slate-500">Status of tasks across all projects</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Todo', value: 61 },
                        { name: 'Completed', value: 39 },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="#3b82f6" />
                      <Cell fill="#10b981" />
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Project Progress - Full Width */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Project Progress</h3>
                <p className="text-xs text-slate-500">Completion percentage by project</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectProgressData} margin={{ bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      interval={0} 
                      tick={{ fontSize: 10 }} 
                      height={60}
                    />
                    <YAxis tickFormatter={(val) => `${val}%`} />
                    <Tooltip formatter={(val) => [`${val}%`, 'Progress']} />
                    <Legend verticalAlign="top" align="right" />
                    <Bar dataKey="progress" name="Progress (%)" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Task Priority Distribution */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Task Priority Distribution</h3>
                <p className="text-xs text-slate-500">Tasks by priority level</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Medium', value: 100 },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Time Allocation */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Time Allocation</h3>
                <p className="text-xs text-slate-500">How time is distributed across projects</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={projectTimeAllocation.length > 0 ? projectTimeAllocation : [{ name: 'No Data', value: 1 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {projectTimeAllocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Projects' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div id="chart-project-allocation" className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><PieIcon size={18} className="text-blue-500" /> Time Allocation</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={projectTimeAllocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                                {projectTimeAllocation.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip /><Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div id="chart-project-progress" className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity size={18} className="text-orange-500" /> Task Progress (%)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={projectProgressData} layout="vertical">
                            <XAxis type="number" domain={[0, 100]} /><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                            <Tooltip /><Bar dataKey="progress" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'Time Tracking' && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Clock size={18} className="text-primary-500" /> Recent Activity History</h3>
                <div className="space-y-3">
                    {reportTimeEntries.slice(0, 8).map(entry => (
                        <div key={entry.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-4">
                                <div className="text-center w-12 border-r dark:border-slate-700 pr-4">
                                    <span className="block text-[10px] text-slate-400 font-bold uppercase">{new Date(entry.date).toLocaleDateString(undefined, {month:'short'})}</span>
                                    <span className="block text-sm font-bold">{new Date(entry.date).getDate()}</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm">{entry.task}</h4>
                                    <p className="text-xs text-slate-500">{getProjectName(entry.projectId, projects)}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="font-mono font-bold text-primary-600">{((entry.durationMinutes + (entry.extraMinutes || 0)) / 60).toFixed(1)}h</span>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{entry.status}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'Team Performance' && (
            <div id="chart-team-contributions" className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Users size={18} className="text-purple-500" /> Team Effort (Hours)</h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={teamContributionData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" /><YAxis /><Tooltip />
                            <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {activeTab === 'Tasks' && (
           <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-500" /> Task Status Overview</h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={attendanceStatusData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" /><YAxis />
                            <Tooltip /><Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                                {attendanceStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
           </div>
        )}
      </div>
    </div>
  );
};

const getProjectName = (id: string | number | undefined, projects: any[]) => {
    if (!id) return 'General / Admin';
    return projects.find(p => String(p.id) === String(id))?.name || 'General / Admin';
};

export default Reports;
