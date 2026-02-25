
import React, { useMemo } from 'react';
import { 
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Users, UserCheck, CalendarOff, TrendingUp, ArrowUpRight } from 'lucide-react';
import { Employee, EmployeeStatus, LeaveRequest, LeaveStatus, Department } from '../types';
import ChartCard from './ChartCard';

interface DashboardProps {
  employees: Employee[];
  leaves: LeaveRequest[];
  departments: Department[];
}

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#6366f1']; 

const StatCard = ({ title, value, icon: Icon, gradient, subtext }: { title: string, value: string | number, icon: any, gradient: string, subtext?: string }) => (
  <div className={`relative overflow-hidden rounded-3xl p-6 shadow-lg ${gradient} text-white group transition-transform hover:scale-[1.02] duration-300`}>
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
    <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                <Icon size={24} className="text-white" />
            </div>
            <span className="flex items-center gap-1 text-[10px] font-bold bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg uppercase tracking-wider">
                <ArrowUpRight size={10} /> +2.5%
            </span>
        </div>
        <div>
            <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-4xl font-black tracking-tight">{value}</h3>
            {subtext && <p className="text-white/60 text-xs font-medium mt-2">{subtext}</p>}
        </div>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ employees, leaves }) => {
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === EmployeeStatus.ACTIVE).length;
  const onLeaveEmployees = employees.filter(e => e.status === EmployeeStatus.ON_LEAVE).length;
  
  const newHiresThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return employees.filter(emp => {
      const joinDate = new Date(emp.joinDate);
      return joinDate.getMonth() === currentMonth && joinDate.getFullYear() === currentYear;
    }).length;
  }, [employees]);

  const activePercentage = useMemo(() => {
    if (totalEmployees === 0) return 0;
    return Math.round((activeEmployees / totalEmployees) * 100);
  }, [activeEmployees, totalEmployees]);

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

  const statusData = [
    { name: 'Active', value: activeEmployees },
    { name: 'On Leave', value: onLeaveEmployees },
    { name: 'Inactive', value: totalEmployees - activeEmployees - onLeaveEmployees }
  ];

  const departmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(e => {
        const dept = e.department || 'General';
        counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Top 5
  }, [employees]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Overview</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Real-time metrics and workforce analytics.</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Employees" 
          value={totalEmployees} 
          icon={Users} 
          gradient="bg-gradient-to-br from-primary-500 to-purple-600"
          subtext={`+${newHiresThisMonth} new this month`}
        />
        <StatCard 
          title="Active Now" 
          value={activeEmployees} 
          icon={UserCheck} 
          gradient="bg-gradient-to-br from-emerald-400 to-teal-600"
          subtext={`${activePercentage}% of total workforce`}
        />
        <StatCard 
          title="On Leave" 
          value={onLeaveEmployees} 
          icon={CalendarOff} 
          gradient="bg-gradient-to-br from-amber-400 to-orange-500"
          subtext={`${approvedLeavesToday} approved for today`}
        />
        <StatCard 
          title="Open Positions" 
          value="8" 
          icon={TrendingUp} 
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          subtext="Active recruitment"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ChartCard 
          title="Workforce Distribution" 
          subtext="Employee status breakdown"
          height="h-72"
          className="rounded-3xl shadow-sm"
          data={statusData}
        >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  cornerRadius={6}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#fff' }} 
                    itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
        </ChartCard>

        <ChartCard 
          title="Department Structure" 
          subtext="Staff count by department"
          height="h-72"
          className="rounded-3xl shadow-sm"
          data={departmentData}
        >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={departmentData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fontWeight: 600, fill: '#64748b'}} interval={0} />
                    <Tooltip 
                        cursor={{fill: 'transparent'}} 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={24} name="Staff Count">
                        {departmentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
};

export default Dashboard;
