
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { useAppContext } from '../contexts/AppContext';
import { Filter, Download, FileText, FileSpreadsheet, Clock, CalendarCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { UserRole } from '../types';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#6366f1'];
const STATUS_COLORS: Record<string, string> = {
  'Present': '#10b981', // Emerald
  'Late': '#f59e0b',    // Amber
  'Absent': '#ef4444',  // Red
  'Half Day': '#8b5cf6' // Violet
};

const Reports = () => {
  const { timeEntries, projects, users, attendance, currentUser, showToast } = useAppContext();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [filterPeriod, setFilterPeriod] = useState('This Month');
  const [filterProject, setFilterProject] = useState('All');
  
  // Export State
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const isHR = currentUser?.role === UserRole.HR;

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

  // 0. Filtered Attendance (Based on Role)
  const filteredAttendance = useMemo(() => {
      if (isHR) return attendance;
      return attendance.filter(a => a.employeeId === currentUser?.id);
  }, [attendance, currentUser, isHR]);

  // 1. Project Status Overview (Pie)
  const projectStatusData = useMemo(() => {
    const counts: Record<string, number> = { Active: 0, 'On Hold': 0, Completed: 0 };
    projects.forEach(p => {
      if (counts[p.status] !== undefined) counts[p.status]++;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [projects]);

  // 2. Project Time Allocation (Pie)
  const projectTimeAllocation = useMemo(() => {
    const allocation: Record<string, number> = {};
    timeEntries.forEach(e => {
        const projName = projects.find(p => p.id === e.projectId)?.name || 'General';
        allocation[projName] = (allocation[projName] || 0) + e.durationMinutes;
    });
    return Object.keys(allocation).map(name => ({ 
        name, 
        value: parseFloat((allocation[name] / 60).toFixed(1)) // Hours
    }));
  }, [timeEntries, projects]);

  // 3. Team Member Contributions (Bar)
  const teamContributionData = useMemo(() => {
    const contrib: Record<string, number> = {};
    timeEntries.forEach(e => {
        const user = users.find(u => u.id === e.userId);
        const name = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
        contrib[name] = (contrib[name] || 0) + e.durationMinutes;
    });
    return Object.keys(contrib).map(name => ({
        name,
        hours: parseFloat((contrib[name] / 60).toFixed(1))
    })).sort((a, b) => b.hours - a.hours);
  }, [timeEntries, users]);

  // 4. Billable vs Non-Billable (Pie)
  const billableData = useMemo(() => {
      let billable = 0;
      let nonBillable = 0;
      timeEntries.forEach(e => {
          if (e.isBillable) billable += e.durationMinutes;
          else nonBillable += e.durationMinutes;
      });
      return [
          { name: 'Billable', value: parseFloat((billable / 60).toFixed(1)) },
          { name: 'Non-Billable', value: parseFloat((nonBillable / 60).toFixed(1)) }
      ];
  }, [timeEntries]);

  // 5. Weekly Hours (Bar)
  const weeklyHoursData = useMemo(() => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const data = days.map(d => ({ day: d, hours: 0 }));
      
      // Filter for current week (mock logic: just aggregating by day name for demo)
      timeEntries.forEach(e => {
          const date = new Date(e.date);
          const dayIndex = date.getDay();
          data[dayIndex].hours += e.durationMinutes / 60;
      });
      
      return data;
  }, [timeEntries]);

  // 6. Project Progress (Bar - Mocked)
  const projectProgressData = useMemo(() => {
      return projects.map(p => {
          const completion = p.status === 'Completed' ? 100 : Math.floor(Math.random() * 80) + 10; 
          return { name: p.name, progress: completion };
      });
  }, [projects]);

  // 7. Attendance Status Distribution (Pie)
  const attendanceStatusData = useMemo(() => {
      const counts: Record<string, number> = { 'Present': 0, 'Late': 0, 'Absent': 0 };
      filteredAttendance.forEach(a => {
          const status = a.status || 'Present';
          counts[status] = (counts[status] || 0) + 1;
      });
      return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [filteredAttendance]);

  // 8. Attendance Punctuality (Bar)
  const attendancePunctualityData = useMemo(() => {
      const onTime = filteredAttendance.filter(a => a.status === 'Present').length;
      const late = filteredAttendance.filter(a => a.status === 'Late').length;
      return [
          { name: 'On Time', count: onTime },
          { name: 'Late', count: late }
      ];
  }, [filteredAttendance]);

  // 9. Daily Attendance Count (Line - HR Only)
  const dailyAttendanceData = useMemo(() => {
      if (!isHR) return [];
      const last7Days = Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split('T')[0];
      });

      return last7Days.map(date => {
          const count = attendance.filter(a => a.date === date).length;
          return { date: new Date(date).toLocaleDateString('en-US', {weekday: 'short'}), count };
      });
  }, [attendance, isHR]);

  // Mocked Task Data
  const taskStatusData = [
      { name: 'Todo', value: 45 },
      { name: 'In Progress', value: 30 },
      { name: 'Completed', value: 25 },
  ];
  const taskPriorityData = [
      { name: 'High', count: 12 },
      { name: 'Medium', count: 24 },
      { name: 'Low', count: 8 },
  ];

  // --- Export Handler ---
  const handleExport = async (format: 'pdf' | 'csv') => {
    setShowExportMenu(false);
    showToast("Generating report...", "info");
    
    // 1. Prepare Data based on Active Tab
    let dataToExport: any[] = [];
    let filename = 'report';
    let title = 'Report';

    switch(activeTab) {
        case 'Projects':
            title = 'Projects Report';
            filename = 'projects_report';
            dataToExport = projects.map(p => ({ 
                Name: p.name, 
                Status: p.status, 
                Description: p.description || '',
                Tasks: p.tasks.join('; ')
            }));
            break;
        case 'Time Logs':
            title = 'Time Logs Report';
            filename = 'time_logs_report';
            dataToExport = timeEntries.map(t => ({ 
                Date: t.date, 
                Project: projects.find(p => p.id === t.projectId)?.name || 'N/A', 
                User: users.find(u => u.id === t.userId)?.firstName || 'Unknown', 
                Task: t.task,
                Hours: (t.durationMinutes/60).toFixed(2),
                Billable: t.isBillable ? 'Yes' : 'No'
            }));
            break;
        case 'Attendance':
            title = `Attendance Report (${isHR ? 'All Employees' : 'My Records'})`;
            filename = 'attendance_report';
            dataToExport = filteredAttendance.map(a => ({
                Date: a.date,
                Employee: a.employeeName,
                CheckIn: a.checkIn,
                CheckOut: a.checkOut || 'N/A',
                Status: a.status,
                Notes: a.notes || ''
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
        default: // Dashboard Summary
             title = 'Dashboard Summary Report';
             filename = 'dashboard_report';
             dataToExport = [
                 ...projectStatusData.map(d => ({ Metric: 'Project Status', Category: d.name, Value: d.value })),
                 ...taskStatusData.map(d => ({ Metric: 'Task Status', Category: d.name, Value: d.value }))
             ];
    }

    if (dataToExport.length === 0) {
        showToast("No data available to export.", "warning");
        return;
    }

    // 2. Handle PDF Export
    if (format === 'pdf') {
        const doc = new jsPDF();
        let yPos = 20;

        doc.setFontSize(16);
        doc.text(title, 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
        yPos = 30;

        // Capture Charts
        const chartElements = document.querySelectorAll('.report-chart');
        if (chartElements.length > 0) {
            for (let i = 0; i < chartElements.length; i++) {
                const el = chartElements[i] as HTMLElement;
                // Only process visible charts
                if (el.offsetParent === null) continue;

                try {
                    const canvas = await html2canvas(el, { scale: 1.5 });
                    const imgData = canvas.toDataURL('image/png');
                    
                    const imgWidth = 180; 
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    
                    if (yPos + imgHeight > 280) {
                        doc.addPage();
                        yPos = 20;
                    }

                    doc.addImage(imgData, 'PNG', 15, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 10;
                } catch (err) {
                    console.error("Error capturing chart for PDF", err);
                }
            }
        }
        
        const headers = Object.keys(dataToExport[0]);
        const body = dataToExport.map(row => Object.values(row));

        if (yPos > 240) {
            doc.addPage();
            yPos = 20;
        }

        autoTable(doc, {
            head: [headers],
            body: body,
            startY: yPos,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [16, 185, 129] }, // Emerald-500
        });
        
        doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast("PDF report downloaded.", "success");
        return;
    }
    
    // 3. Handle CSV Export
    const headers = Object.keys(dataToExport[0]);
    const csvContent = [
        headers.join(','),
        ...dataToExport.map(row => headers.map(h => {
            const val = row[h] ? String(row[h]).replace(/"/g, '""') : '';
            return `"${val}"`;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV report downloaded.", "success");
  };

  return (
    <div className="space-y-6 pb-10 animate-fade-in print:p-0">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Reports & Analytics</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Analyze project performance, time logs, and attendance.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <select 
                className="w-full sm:w-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
            >
                <option>This Month</option>
                <option>Last Month</option>
                <option>This Year</option>
            </select>
            <select 
                className="w-full sm:w-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
            >
                <option value="All">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            
            {/* Export Dropdown */}
            <div className="relative w-full sm:w-auto" ref={exportMenuRef}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors"
              >
                <Download size={16} /> Export
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-full sm:w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-900/50">
                        Export Format
                    </div>
                    <button 
                        onClick={() => handleExport('pdf')} 
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                        <FileText size={16} className="text-slate-500"/> PDF
                    </button>
                    <button 
                        onClick={() => handleExport('csv')} 
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                        <FileSpreadsheet size={16} className="text-slate-500"/> CSV
                    </button>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 print:hidden overflow-x-auto">
        <nav className="flex space-x-8 min-w-max pb-1">
          {['Dashboard', 'Projects', 'Tasks', 'Time Logs', 'Attendance', 'Team Performance'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-6">
        
        {/* Row 1 - Attendance Specific */}
        {(activeTab === 'Dashboard' || activeTab === 'Attendance') && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:break-inside-avoid report-chart">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Attendance Status</h3>
                    <CalendarCheck size={18} className="text-slate-400"/>
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={attendanceStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {attendanceStatusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {(activeTab === 'Dashboard' || activeTab === 'Attendance') && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:break-inside-avoid report-chart">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Punctuality Overview</h3>
                    <Clock size={18} className="text-slate-400"/>
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={attendancePunctualityData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" strokeOpacity={0.2} />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis allowDecimals={false} stroke="#94a3b8" />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={50}>
                                {attendancePunctualityData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'Late' ? '#f59e0b' : '#10b981'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* HR Only Attendance Trend */}
        {isHR && activeTab === 'Attendance' && (
             <div className="col-span-1 lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:break-inside-avoid report-chart">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Daily Attendance Count (Last 7 Days)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyAttendanceData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" strokeOpacity={0.2} />
                            <XAxis dataKey="date" stroke="#94a3b8" />
                            <YAxis allowDecimals={false} stroke="#94a3b8" />
                            <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} dot={{r: 4}} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* Row 2 - Project Status (Dashboard/Projects) */}
        {(activeTab === 'Dashboard' || activeTab === 'Projects') && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:break-inside-avoid report-chart">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Project Status Overview</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={projectStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {projectStatusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {(activeTab === 'Dashboard' || activeTab === 'Tasks') && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:break-inside-avoid report-chart">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Task Completion Status</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={taskStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {taskStatusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* Row 3 - Full Width Charts */}
        {(activeTab === 'Dashboard' || activeTab === 'Projects') && (
            <div className="col-span-1 lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:break-inside-avoid report-chart">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Project Progress (%)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={projectProgressData} layout="vertical" margin={{ left: 20, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#475569" strokeOpacity={0.2} />
                            <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" />
                            <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11}} stroke="#94a3b8" />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Bar dataKey="progress" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {(activeTab === 'Dashboard' || activeTab === 'Tasks') && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:break-inside-avoid report-chart">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Task Priority Distribution</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={taskPriorityData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" strokeOpacity={0.2} />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {(activeTab === 'Dashboard' || activeTab === 'Time Logs') && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:break-inside-avoid report-chart">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Time Allocation by Project</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={projectTimeAllocation}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                dataKey="value"
                                label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                            >
                                {projectTimeAllocation.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* Row 4 - Time Logs Details */}
        {(activeTab === 'Dashboard' || activeTab === 'Time Logs') && (
            <div className="col-span-1 lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:break-inside-avoid report-chart">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Weekly Hours Logged</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyHoursData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" strokeOpacity={0.2} />
                            <XAxis dataKey="day" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Bar dataKey="hours" fill="#10b981" radius={[4, 4, 0, 0]} barSize={50} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* Row 5 - Team Performance */}
        {(activeTab === 'Dashboard' || activeTab === 'Team Performance') && (
            <div className="col-span-1 lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:break-inside-avoid report-chart">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Team Member Contributions (Hours)</h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={teamContributionData} margin={{bottom: 20}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" strokeOpacity={0.2} />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} tick={{fontSize: 11}} stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {(activeTab === 'Dashboard' || activeTab === 'Time Logs') && (
             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:break-inside-avoid report-chart">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Billable vs Non-Billable</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={billableData}
                                cx="50%"
                                cy="50%"
                                innerRadius={0}
                                outerRadius={80}
                                dataKey="value"
                                label
                            >
                                <Cell fill="#10b981" /> {/* Billable - Green */}
                                <Cell fill="#94a3b8" /> {/* Non-Billable - Gray */}
                            </Pie>
                            <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
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
