
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Users, UserCheck, CalendarOff, TrendingUp } from 'lucide-react';
import { Employee, EmployeeStatus, LeaveRequest, LeaveStatus, Department } from '../types';

interface DashboardProps {
  employees: Employee[];
  leaves: LeaveRequest[];
  departments: Department[];
}

// Teal-based palette
const COLORS = ['#0f766e', '#f59e0b', '#ef4444']; 

const StatCard = ({ title, value, icon: Icon, color, subtext }: { title: string, value: string | number, icon: any, color: string, subtext?: string }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color} bg-opacity-10 dark:bg-opacity-20`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ employees, leaves, departments }) => {
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === EmployeeStatus.ACTIVE).length;
  const onLeaveEmployees = employees.filter(e => e.status === EmployeeStatus.ON_LEAVE).length;
  
  // --- DYNAMIC SUBTEXT CALCULATIONS ---
  
  // 1. New Hires this month
  const newHiresThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return employees.filter(emp => {
      const joinDate = new Date(emp.joinDate);
      return joinDate.getMonth() === currentMonth && joinDate.getFullYear() === currentYear;
    }).length;
  }, [employees]);

  // 2. Active Workforce Percentage
  const activePercentage = useMemo(() => {
    if (totalEmployees === 0) return 0;
    return Math.round((activeEmployees / totalEmployees) * 100);
  }, [activeEmployees, totalEmployees]);

  // 3. Approved Leaves for Today
  const approvedLeavesToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return leaves.filter(leave => {
      if (leave.status !== LeaveStatus.APPROVED) return false;
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      return today >= start && today <= end;
    }).length;
  }, [leaves]);

  // 4. Department Count for Open Positions (Positions usually tied to departments)
  const deptCount = departments.length;

  // Data for Department Chart
  const deptCounts = employees.reduce((acc, curr) => {
    acc[curr.department] = (acc[curr.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const deptData = Object.keys(deptCounts).map(key => ({
    name: key,
    employees: deptCounts[key]
  }));

  // Data for Status Chart
  const statusData = [
    { name: 'Active', value: activeEmployees },
    { name: 'On Leave', value: onLeaveEmployees },
    { name: 'Inactive', value: totalEmployees - activeEmployees - onLeaveEmployees }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard Overview</h2>
          <p className="text-slate-500 dark:text-slate-400">Welcome back, here's what's happening today.</p>
        </div>
        <div className="mt-4 md:mt-0 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-4 py-2 rounded-lg text-sm font-medium">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Employees" 
          value={totalEmployees} 
          icon={Users} 
          color="bg-teal-600"
          subtext={`+${newHiresThisMonth} new this month`}
        />
        <StatCard 
          title="Active Now" 
          value={activeEmployees} 
          icon={UserCheck} 
          color="bg-emerald-500"
          subtext={`${activePercentage}% of total workforce`}
        />
        <StatCard 
          title="On Leave" 
          value={onLeaveEmployees} 
          icon={CalendarOff} 
          color="bg-amber-500"
          subtext={`${approvedLeavesToday} approved for today`}
        />
        <StatCard 
          title="Open Positions" 
          value="8" 
          icon={TrendingUp} 
          color="bg-violet-500"
          subtext={`Across ${deptCount} departments`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Employees by Department</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" strokeOpacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#fff', color: '#333' }} />
                <Bar dataKey="employees" fill="#0f766e" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Employee Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
