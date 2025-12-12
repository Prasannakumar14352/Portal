
import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { FileText, Download, Plus, DollarSign, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../types';

const Payslips = () => {
  const { payslips, generatePayslips, currentUser, employees } = useAppContext();
  const [month, setMonth] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const isHR = currentUser?.role === UserRole.HR;

  const handleGenerate = async () => {
      if (!month) return;
      setIsGenerating(true);
      await generatePayslips(month);
      setIsGenerating(false);
  };

  // Filter based on role
  const visiblePayslips = isHR 
    ? payslips 
    : payslips.filter(p => p.userId === currentUser?.id);

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Payslips</h2>
                <p className="text-slate-500 text-sm">View and download monthly salary slips.</p>
            </div>
            
            {isHR && (
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <input 
                        type="month" 
                        className="border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                    />
                    <button 
                        onClick={handleGenerate}
                        disabled={!month || isGenerating}
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isGenerating ? 'Generating...' : <><Plus size={16}/> Bulk Generate</>}
                    </button>
                </div>
            )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Employee</th>
                            <th className="px-6 py-4">Month</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Generated Date</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {visiblePayslips.map((slip) => (
                            <tr key={slip.id} className="hover:bg-slate-50 transition">
                                <td className="px-6 py-4 font-medium text-slate-800">{slip.userName}</td>
                                <td className="px-6 py-4 text-slate-600">{slip.month}</td>
                                <td className="px-6 py-4 font-mono font-medium text-emerald-600">
                                    ${slip.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs font-medium border border-green-100">
                                        <CheckCircle2 size={12} /> {slip.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-500 text-sm">
                                    {new Date(slip.generatedDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 ml-auto">
                                        <Download size={16} /> Download
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {visiblePayslips.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">No payslips found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default Payslips;
