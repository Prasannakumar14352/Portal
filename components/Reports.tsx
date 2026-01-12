
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { useAppContext } from '../contexts/AppContext';
import { Filter, Download, FileText, FileSpreadsheet, Clock, CalendarCheck, Zap, Layout, TrendingUp, Users, CheckCircle2, DollarSign } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { UserRole } from '../types';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#6366f1'];
const STATUS_COLORS: Record<string, string> = {
  'Present': '#10b981', 
  'Late': '#f59e0b',    
  'Absent': '#ef4444',  
  'Half Day': '#8b5cf6' 
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

  // --- Data Aggregation Helpers ---

  // 0. Base Data Filtering (Role Based) - Used for Dashboard/Time Logs (Personalized)
  const reportTimeEntries = useMemo(() => {
      if (isPowerUser) return timeEntries;
      return timeEntries.filter(t => String(t.userId) === String(currentUser?.id));
  }, [timeEntries, currentUser, isPowerUser]);

  // 1. Unified Record Normal vs Extra Hours Distribution
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

  // 2. Project Time Allocation (Combined Normal + Extra)
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

  // 3. Project Progress (Based on Tasks Completed vs Total Tasks)
  const projectProgressData = useMemo(() => {
      return projects.map(proj => {
          const projectEntries = reportTimeEntries.filter(t => String(t.projectId) === String(proj.id));
          const uniqueTasksLogged = new Set(projectEntries.map(t => t.task)).size;
          
          // Parse tasks from project definition
          let totalTasks = 0;
          if (Array.isArray(proj.tasks)) {
              totalTasks = proj.tasks.length;
          } else if (typeof proj.tasks === 'string') {
              try { totalTasks = JSON.parse(proj.tasks).length; } catch(e) { totalTasks = 5; } // Default if parse fails
          } else {
              totalTasks = 5; // Fallback
          }
          
          if (totalTasks === 0) totalTasks = 1; // Prevent NaN

          // Calculate percentage based on unique tasks touched vs total defined
          const progress = Math.min(100, Math.round((uniqueTasksLogged / totalTasks) * 100));
          
          return {
              name: proj.name,
              progress: progress,
              hours: parseFloat((projectEntries.reduce((sum, e) => sum + e.durationMinutes + (e.extraMinutes || 0), 0) / 60).toFixed(1))
          };
      }).filter(p => p.hours > 0).sort((a, b) => b.progress - a.progress);
  }, [projects, reportTimeEntries]);

  // 4. Project Activity Timeline (Daily Hours per Project)
  const projectTimelineData = useMemo(() => {
      // Get last 7 days dates
      const dates = [...Array(7)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split('T')[0];
      });

      // Get top 3 projects
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

  // 5. Team Member Contributions - GLOBAL SCOPE (Shows ALL employees including HRs/Managers with 0 logs)
  const teamContributionData = useMemo(() => {
    const contrib: Record<string, number> = {};
    
    // Initialize all employees with 0
    employees.forEach(emp => {
        const name = `${emp.firstName} ${emp.lastName}`;
        contrib[name] = 0;
    });

    // Determine entries to process based on filter
    let entriesToUse = timeEntries;
    if (filterProject !== 'All') {
        entriesToUse = entriesToUse.filter(e => String(e.projectId) === filterProject);
    }

    // Add actual hours
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

  // 6. User Workload - GLOBAL SCOPE (Shows ALL employees including HRs/Managers)
  const userWorkloadData = useMemo(() => {
      const load: Record<string, { allTasks: Set<string>, approvedTasks: Set<string> }> = {};
      
      // Initialize all employees
      employees.forEach(emp => {
          const name = `${emp.firstName} ${emp.lastName}`;
          load[name] = { allTasks: new Set(), approvedTasks: new Set() };
      });

      // Filter entries
      let entriesToUse = timeEntries;
      if (filterProject !== 'All') {
          entriesToUse = entriesToUse.filter(e => String(e.projectId) === filterProject);
      }

      // Aggregate tasks
      entriesToUse.forEach(e => {
          const user = employees.find(u => String(u.id) === String(e.userId));
          if (user) {
              const name = `${user.firstName} ${user.lastName}`;
              // Fallback just in case user wasn't in original employees list
              if (!load[name]) load[name] = { allTasks: new Set(), approvedTasks: new Set() };
              
              load[name].allTasks.add(e.task);
              if (e.status === 'Approved') {
                  load[name].approvedTasks.add(e.task);
              }
          }
      });

      return Object.keys(load).map(name => {
          const total = load[name].allTasks.size;
          const completed = load[name].approvedTasks.size;
          const pending = total - completed;
          return {
              name,
              completed,
              pending,
              total
          };
      }).sort((a, b) => b.total - a.total);
  }, [timeEntries, employees, filterProject]);

  // Personalized Billable Data (Dashboard)
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

  // GLOBAL Billable Data (Team Performance Tab)
  const teamBillableData = useMemo(() => {
      let billable = 0;
      let nonBillable = 0;
      // Global scope for Team tab
      let entriesToUse = timeEntries;
      
      if (filterProject !== 'All') {
          entriesToUse = entriesToUse.filter(e => String(e.projectId) === filterProject);
      }

      entriesToUse.forEach(e => {
          const total = e.durationMinutes + (e.extraMinutes || 0);
          if (e.isBillable) billable += total;
          else nonBillable += total;
      });
      return [
          { name: 'Billable', value: parseFloat((billable / 60).toFixed(1)) },
          { name: 'Non-Billable', value: parseFloat((nonBillable / 60).toFixed(1)) }
      ];
  }, [timeEntries, filterProject]);

  // 7. Attendance Status Distribution
  const attendanceStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    const recordsToUse = isPowerUser ? attendance : attendance.filter(a => String(a.employeeId) === String(currentUser?.id));
    
    recordsToUse.forEach(rec => {
        const status = rec.status || 'Present';
        counts[status] = (counts[status] || 0) + 1;
    });
    return Object.keys(counts).map(status => ({
        name: status,
        value: counts[status]
    }));
  }, [attendance, isPowerUser, currentUser]);

  const handleExport = async (format: 'pdf' | 'csv') => {
    setShowExportMenu(false);
    showToast("Generating report...", "info");
    
    let dataToExport: any[] = [];
    let filename = 'report';
    let title = 'Report';

    // Prepare data based on active tab
    switch(activeTab) {
        case 'Time Logs':
            title = 'Time Logs Report';
            filename = 'time_logs_report';
            dataToExport = reportTimeEntries.map(t => ({ 
                Date: t.date, 
                Project: projects.find(p => String(p.id) === String(t.projectId))?.name || 'N/A', 
                User: employees.find(u => String(u.id) === String(t.userId))?.firstName || 'Unknown', 
                Task: t.task,
                NormalHours: (t.durationMinutes/60).toFixed(2),
                ExtraHours: ((t.extraMinutes || 0)/60).toFixed(2),
                Billable: t.isBillable ? 'Yes' : 'No'
            }));
            break;
        case 'Projects':
            title = 'Projects Performance Report';
            filename = 'projects_report';
            dataToExport = projectProgressData.map(p => ({
                Project: p.name,
                TotalHours: p.hours,
                ProgressPercent: `${p.progress}%`,
                Status: p.progress === 100 ? 'Completed' : 'In Progress'
            }));
            break;
        case 'Team Performance':
             title = 'Team Performance Report';
             filename = 'team_performance_report';
             dataToExport = teamContributionData.map(d => ({
                 Employee: d.name,
                 TotalHours: d.hours
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
                 CheckOut: a.checkOut,
                 Location: a.workLocation || 'Office'
             }));
             break;
        default: // Dashboard
             title = 'Dashboard Summary Report';
             filename = 'dashboard_report';
             dataToExport = [
                { Metric: 'Normal Hours', Value: extraHoursDistribution[0].value },
                { Metric: 'Extra Hours', Value: extraHoursDistribution[1].value }
             ];
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

        // Header
        doc.setFontSize(16);
        doc.text(title, 14, currentY);
        currentY += 8;
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, currentY);
        currentY += 10;

        // Determine which charts to capture
        let chartIds: string[] = [];
        if (activeTab === 'Dashboard') {
             chartIds = ['chart-effort-split', 'chart-billable', 'chart-attendance', 'chart-team-contributions']; 
        } else if (activeTab === 'Time Logs') {
             chartIds = ['chart-effort-split', 'chart-billable'];
        } else if (activeTab === 'Projects') {
             chartIds = ['chart-project-allocation', 'chart-project-progress', 'chart-project-activity'];
        } else if (activeTab === 'Attendance') {
             chartIds = ['chart-attendance'];
        } else if (activeTab === 'Team Performance') {
             chartIds = ['chart-team-contributions', 'chart-user-workload', 'chart-team-billable'];
        }

        // Capture Charts
        for (const id of chartIds) {
            const element = document.getElementById(id);
            if (element) {
                try {
                    const canvas = await html2canvas(element, { 
                        scale: 2, 
                        useCORS: true, 
                        backgroundColor: '#ffffff'
                    });
                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = doc.getImageProperties(imgData);
                    const pdfWidth = pageWidth - 28;
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    if (currentY + pdfHeight > pageHeight - 20) {
                        doc.addPage();
                        currentY = 20;
                    }

                    doc.addImage(imgData, 'PNG', 14, currentY, pdfWidth, pdfHeight);
                    currentY += pdfHeight + 10;
                } catch (e) {
                    console.warn(`Chart capture failed for ${id}`, e);
                }
            }
        }

        // Add Table
        autoTable(doc, {
            head: [Object.keys(dataToExport[0])],
            body: dataToExport.map(row => Object.values(row)),
            startY: currentY,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [16, 185, 129] },
            margin: { top: 20 },
            pageBreak: 'auto'
        });
        
        doc.save(`${filename}_${Date.now()}.pdf`);
    } else {
        const headers = Object.keys(dataToExport[0]);
        const csvContent = [headers.join(','), ...dataToExport.map(row => headers.map(h => `"${row[h]}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
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
          <p className="text-slate-500 dark:text-slate-400 text-sm">Unified analysis of normal and extra working hours.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <select className="w-full sm:w-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}>
                <option>This Month</option><option>Last Month</option><option>This Year</option>
            </select>
            
            <select className="w-full sm:w-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
                <option value="All">All Projects</option>
                {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>

            <div className="relative w-full sm:w-auto" ref={exportMenuRef}>
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors">
                <Download size={16} /> Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-full sm:w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"><FileText size={16}/> PDF Report</button>
                    <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"><FileSpreadsheet size={16}/> CSV Details</button>
                </div>
              )}
            </div>
        </div>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        <nav className="flex space-x-8 min-w-max pb-1">
          {['Dashboard', 'Projects', 'Time Logs', 'Attendance', 'Team Performance'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>{tab}</button>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* --- TEAM PERFORMANCE TAB CONTENT --- */}
        {activeTab === 'Team Performance' && (
            <div className="col-span-1 lg:col-span-2 space-y-6">
                {/* 1. Team Contributions - Bar Chart */}
                <div id="chart-team-contributions" className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Users size={18} className="text-purple-500" /> Team Member Contributions
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Hours logged by team members over time.</p>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={teamContributionData} margin={{bottom: 20}}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" strokeOpacity={0.2} />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} tick={{fontSize: 11}} stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                                <Legend verticalAlign="top" align="right" />
                                <Bar dataKey="hours" name="Hours Logged" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={25} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. User Workload - Stacked Bar Chart */}
                <div id="chart-user-workload" className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-blue-500" /> User Workload
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Tasks breakdown per user (Stacked).</p>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={userWorkloadData} margin={{bottom: 20}}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" strokeOpacity={0.2} />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} tick={{fontSize: 11}} stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                                <Legend verticalAlign="top" align="right" />
                                <Bar dataKey="completed" stackId="a" name="Completed Tasks" fill="#10b981" radius={[0, 0, 4, 4]} barSize={30} />
                                <Bar dataKey="pending" stackId="a" name="Pending Tasks" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Billable vs Non-billable - Pie Chart */}
                <div id="chart-team-billable" className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <DollarSign size={18} className="text-emerald-500" /> Billable vs Non-billable (Global)
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Time tracking distribution by billable status for all projects.</p>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={teamBillableData}
                                    cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                                    label={({name, percent}) => percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                >
                                    <Cell fill="#10b981" />
                                    <Cell fill="#8b5cf6" />
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )}

        {/* --- PROJECTS TAB CONTENT --- */}
        {activeTab === 'Projects' && (
            <>
                {/* 1. Allocation Pie Chart */}
                <div id="chart-project-allocation" className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Layout size={18} className="text-blue-500" /> Project Time Allocation
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Total effort hours distributed by project.</p>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={projectTimeAllocation}
                                    cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" 
                                    label={({name, percent}) => percent > 0.1 ? `${(percent * 100).toFixed(0)}%` : ''}
                                >
                                    {projectTimeAllocation.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Progress Bar Chart */}
                <div id="chart-project-progress" className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-500" /> Project Progress
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Completion % based on engaged tasks vs. total scope.</p>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={projectProgressData} layout="vertical" margin={{ left: 20, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#475569" strokeOpacity={0.2} />
                                <XAxis type="number" domain={[0, 100]} hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} stroke="#94a3b8" />
                                <Tooltip 
                                    cursor={{fill: 'transparent'}} 
                                    contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}
                                    formatter={(value: any) => [`${value}%`, 'Progress']}
                                />
                                <Bar dataKey="progress" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} name="Progress %">
                                    {projectProgressData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Activity Line Chart (Full Width) */}
                <div id="chart-project-activity" className="col-span-1 lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-amber-500" /> Project Activity Timeline (Last 7 Days)
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={projectTimelineData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" strokeOpacity={0.1} />
                                <XAxis dataKey="date" tick={{fontSize: 12}} stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                                <Legend />
                                {Object.keys(projectTimelineData[0] || {}).filter(k => k !== 'date').map((key, index) => (
                                    <Line 
                                        key={key} 
                                        type="monotone" 
                                        dataKey={key} 
                                        stroke={COLORS[index % COLORS.length]} 
                                        strokeWidth={2}
                                        dot={{r: 3}}
                                        activeDot={{r: 6}}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </>
        )}
        
        {/* --- EXISTING TABS CONTENT --- */}

        {/* Extra Hours Pie Chart */}
        {(activeTab === 'Dashboard' || activeTab === 'Time Logs') && (
            <div id="chart-effort-split" className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Zap size={18} className="text-purple-500" /> Unified Effort Split</h3>
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={extraHoursDistribution}
                                cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}
                            >
                                <Cell fill="#10b981" />
                                <Cell fill="#8b5cf6" />
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* Billable Chart */}
        {(activeTab === 'Dashboard' || activeTab === 'Time Logs') && (
             <div id="chart-billable" className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Unified Billing Summary (Hours)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={billableData}
                                cx="50%" cy="50%" outerRadius={80} dataKey="value"
                            >
                                {billableData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#94a3b8'} />)}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* Attendance Chart - Added for Attendance Tab */}
        {(activeTab === 'Dashboard' || activeTab === 'Attendance') && (
            <div id="chart-attendance" className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <CalendarCheck size={18} className="text-emerald-500" /> 
                    Attendance Overview
                </h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={attendanceStatusData}
                                cx="50%" cy="50%" 
                                innerRadius={60} 
                                outerRadius={80} 
                                paddingAngle={5} 
                                dataKey="value"
                            >
                                {attendanceStatusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
