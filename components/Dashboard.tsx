
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Users, UserCheck, CalendarOff, TrendingUp } from 'lucide-react';
import { Employee, EmployeeStatus } from '../types';

interface DashboardProps {
  employees: Employee[];
}

// Teal-based palette
const COLORS = ['#0f766e', '#f59e0b', '#ef4444']; 

const StatCard = ({ title, value, icon: Icon, color, subtext }: { title: string, value: string | number, icon: any, color: string, subtext?: string }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ employees }) => {
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === EmployeeStatus.ACTIVE).length;
  const onLeaveEmployees = employees.filter(e => e.status === EmployeeStatus.ON_LEAVE).length;
  
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
          <p className="text-slate-500">Welcome back, here's what's happening today.</p>
        </div>
        <div className="mt-4 md:mt-0 bg-teal-50 text-teal-700 px-4 py-2 rounded-lg text-sm font-medium">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Employees" 
          value={totalEmployees} 
          icon={Users} 
          color="bg-teal-600"
          subtext="+4 new this month"
        />
        <StatCard 
          title="Active Now" 
          value={activeEmployees} 
          icon={UserCheck} 
          color="bg-emerald-500"
          subtext="92% of total workforce"
        />
        <StatCard 
          title="On Leave" 
          value={onLeaveEmployees} 
          icon={CalendarOff} 
          color="bg-amber-500"
          subtext="Approved leave requests"
        />
        <StatCard 
          title="Open Positions" 
          value="8" 
          icon={TrendingUp} 
          color="bg-violet-500"
          subtext="Across 3 departments"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Employees by Department</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="employees" fill="#0f766e" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Employee Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
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
                <Tooltip />
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
