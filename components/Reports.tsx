
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { useAppContext } from '../contexts/AppContext';
import { Filter, Download, FileText, FileSpreadsheet, Clock, CalendarCheck, Zap } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserRole } from '../types';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#6366f1'];
const STATUS_COLORS: Record<string, string> = {
  'Present': '#10b981', 
  'Late': '#f59e0b',    
  'Absent': '#ef4444',  
  'Half Day': '#8b5cf6' 
};

const Reports = () => {
  const { timeEntries, projects, users, attendance, currentUser, showToast } = useAppContext();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [filterPeriod, setFilterPeriod] = useState('This Month');
  
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

  // 1. Unified Record Normal vs Extra Hours Distribution
  const extraHoursDistribution = useMemo(() => {
      let normal = 0;
      let extra = 0;
      timeEntries.forEach(e => {
          normal += e.durationMinutes;
          extra += (e.extraMinutes || 0);
      });
      return [
          { name: 'Normal Hours', value: parseFloat((normal / 60).toFixed(1)) },
          { name: 'Extra Hours', value: parseFloat((extra / 60).toFixed(1)) }
      ];
  }, [timeEntries]);

  // 2. Project Time Allocation (Combined Normal + Extra)
  const projectTimeAllocation = useMemo(() => {
    const allocation: Record<string, number> = {};
    timeEntries.forEach(e => {
        const projName = projects.find(p => p.id === e.projectId)?.name || 'General';
        allocation[projName] = (allocation[projName] || 0) + e.durationMinutes + (e.extraMinutes || 0);
    });
    return Object.keys(allocation).map(name => ({ 
        name, 
        value: parseFloat((allocation[name] / 60).toFixed(1))
    }));
  }, [timeEntries, projects]);

  // 3. Team Member Contributions (Unified Stacked Bar)
  const teamContributionData = useMemo(() => {
    const contrib: Record<string, { normal: number, extra: number }> = {};
    timeEntries.forEach(e => {
        const user = users.find(u => u.id === e.userId);
        const name = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
        if (!contrib[name]) contrib[name] = { normal: 0, extra: 0 };
        
        contrib[name].normal += e.durationMinutes;
        contrib[name].extra += (e.extraMinutes || 0);
    });
    return Object.keys(contrib).map(name => ({
        name,
        normalHours: parseFloat((contrib[name].normal / 60).toFixed(1)),
        extraHours: parseFloat((contrib[name].extra / 60).toFixed(1)),
        totalHours: parseFloat(((contrib[name].normal + contrib[name].extra) / 60).toFixed(1))
    })).sort((a, b) => b.totalHours - a.totalHours);
  }, [timeEntries, users]);

  const billableData = useMemo(() => {
      let billable = 0;
      let nonBillable = 0;
      timeEntries.forEach(e => {
          const total = e.durationMinutes + (e.extraMinutes || 0);
          if (e.isBillable) billable += total;
          else nonBillable += total;
      });
      return [
          { name: 'Billable', value: parseFloat((billable / 60).toFixed(1)) },
          { name: 'Non-Billable', value: parseFloat((nonBillable / 60).toFixed(1)) }
      ];
  }, [timeEntries]);

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
            dataToExport = timeEntries.map(t => ({ 
                Date: t.date, 
                Project: projects.find(p => p.id === t.projectId)?.name || 'N/A', 
                User: users.find(u => u.id === t.userId)?.firstName || 'Unknown', 
                Task: t.task,
                NormalHours: (t.durationMinutes/60).toFixed(2),
                ExtraHours: ((t.extraMinutes || 0)/60).toFixed(2),
                Billable: t.isBillable ? 'Yes' : 'No'
            }));
            break;
        case 'Team Performance':
             title = 'Team Performance Report';
             filename = 'team_performance_report';
             dataToExport = teamContributionData.map(d => ({
                 Employee: d.name,
                 NormalHours: d.normalHours,
                 ExtraHours: d.extraHours,
                 TotalHours: d.totalHours
             }));
             break;
        default:
             title = 'Dashboard Summary Report';
             filename = 'dashboard_report';
             dataToExport = [
                { Metric: 'Normal Hours', Value: extraHoursDistribution[0].value },
                { Metric: 'Extra Hours', Value: extraHoursDistribution[1].value }
             ];
    }

    if (format === 'pdf') {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(title, 14, 15);
        autoTable(doc, {
            head: [Object.keys(dataToExport[0])],
            body: dataToExport.map(row => Object.values(row)),
            startY: 25,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [16, 185, 129] },
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
            <div className="relative w-full sm:w-auto" ref={exportMenuRef}>
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors">
                <Download size={16} /> Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-full sm:w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"><FileText size={16}/> PDF Summary</button>
                    <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"><FileSpreadsheet size={16}/> CSV Details</button>
                </div>
              )}
            </div>
        </div>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        <nav className="flex space-x-8 min-w-max pb-1">
          {['Dashboard', 'Time Logs', 'Attendance', 'Team Performance'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>{tab}</button>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Extra Hours Pie Chart */}
        {(activeTab === 'Dashboard' || activeTab === 'Time Logs') && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
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
             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
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

        {/* Team Performance - Stacked Bar */}
        {(activeTab === 'Dashboard' || activeTab === 'Team Performance') && (
            <div className="col-span-1 lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Total Effort per Team Member (Stacked)</h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={teamContributionData} margin={{bottom: 20}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" strokeOpacity={0.2} />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} tick={{fontSize: 11}} stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                            <Legend verticalAlign="top" align="right" />
                            <Bar dataKey="normalHours" stackId="a" fill="#10b981" name="Normal Hours" radius={[0, 0, 0, 0]} barSize={30} />
                            <Bar dataKey="extraHours" stackId="a" fill="#8b5cf6" name="Extra Hours" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
