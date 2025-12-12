
import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { FileText, Download, Plus, DollarSign, CheckCircle2, Settings, Folder, Archive } from 'lucide-react';
import { UserRole } from '../types';
import jsPDF from 'jspdf';
import JSZip from 'jszip';

const Payslips = () => {
  const { payslips, generatePayslips, currentUser, employees, showToast } = useAppContext();
  const [month, setMonth] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Configuration State
  const [showConfig, setShowConfig] = useState(false);
  const [networkPath, setNetworkPath] = useState('\\\\192.168.1.10\\HR\\Payslips\\Repository');

  const isHR = currentUser?.role === UserRole.HR;

  const handleGenerate = async () => {
      if (!month) {
          showToast("Please select a month and year.", "error");
          return;
      }
      
      setIsGenerating(true);
      
      // 1. Generate Database Records
      await generatePayslips(month);

      // 2. Generate ZIP File containing PDFs
      try {
          const zip = new JSZip();
          const folderName = `Payslips_${month}`;
          const folder = zip.folder(folderName);
          const activeEmployees = employees.filter(e => e.status === 'Active');

          if (!folder) throw new Error("Failed to create zip folder");

          // Generate a PDF for each active employee
          activeEmployees.forEach((emp) => {
              const doc = new jsPDF();
              
              // Header
              doc.setFillColor(16, 185, 129); // Emerald color
              doc.rect(0, 0, 210, 40, 'F');
              doc.setTextColor(255, 255, 255);
              doc.setFontSize(22);
              doc.text("EmpowerCorp", 14, 25);
              doc.setFontSize(12);
              doc.text("Payslip / Salary Statement", 14, 35);
              
              // Info
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(10);
              doc.text(`Employee: ${emp.firstName} ${emp.lastName}`, 14, 60);
              doc.text(`Role: ${emp.role}`, 14, 66);
              doc.text(`Department: ${emp.department}`, 14, 72);
              doc.text(`Pay Period: ${month}`, 150, 60);
              doc.text(`Generated: ${new Date().toLocaleDateString()}`, 150, 66);

              // Mock Financials
              const basic = (emp.salary / 12) * 0.7;
              const hra = (emp.salary / 12) * 0.2;
              const allowances = (emp.salary / 12) * 0.1;
              const total = emp.salary / 12;

              doc.setDrawColor(200, 200, 200);
              doc.line(14, 85, 196, 85);

              doc.setFontSize(12);
              doc.text("Earnings", 14, 95);
              doc.setFontSize(10);
              doc.text(`Basic Salary: $${basic.toFixed(2)}`, 14, 105);
              doc.text(`HRA: $${hra.toFixed(2)}`, 14, 112);
              doc.text(`Special Allowances: $${allowances.toFixed(2)}`, 14, 119);

              doc.line(14, 130, 196, 130);
              doc.setFontSize(14);
              doc.setFont("helvetica", "bold");
              doc.text(`Net Payable: $${total.toFixed(2)}`, 14, 145);

              doc.setFontSize(8);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(100, 100, 100);
              doc.text(`This payslip is system generated and digitally signed.`, 14, 280);
              doc.text(`Network Source: ${networkPath}`, 14, 285);

              const pdfBlob = doc.output('blob');
              folder.file(`${emp.firstName}_${emp.lastName}_${month}.pdf`, pdfBlob);
          });

          // Generate the zip file
          const content = await zip.generateAsync({ type: "blob" });
          
          // Trigger download
          const url = window.URL.createObjectURL(content);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${folderName}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          showToast(`Payslips generated and archived to ${folderName}.zip`, "success");

      } catch (error) {
          console.error(error);
          showToast("Failed to generate ZIP archive.", "error");
      }

      setIsGenerating(false);
  };

  // Filter based on role
  const visiblePayslips = isHR 
    ? payslips 
    : payslips.filter(p => p.userId === currentUser?.id);

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Payslips</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">View and download monthly salary slips.</p>
            </div>
            
            {isHR && (
                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                    {/* Config Toggle */}
                    <button 
                        onClick={() => setShowConfig(!showConfig)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${showConfig ? 'bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                    >
                        <Settings size={16} /> Config
                    </button>

                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-full sm:w-auto">
                        <input 
                            type="month" 
                            className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500 bg-transparent dark:text-slate-100"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                        />
                        <button 
                            onClick={handleGenerate}
                            disabled={!month || isGenerating}
                            className="bg-emerald-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                        >
                            {isGenerating ? 'Processing...' : <><Archive size={16}/> Bulk Generate & Zip</>}
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Configuration Panel */}
        {isHR && showConfig && (
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 animate-in slide-in-from-top-2">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <Folder size={16} /> Network Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Target Network Folder Path</label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm">
                                Path:
                            </span>
                            <input 
                                type="text" 
                                value={networkPath}
                                onChange={(e) => setNetworkPath(e.target.value)}
                                className="flex-1 block w-full rounded-none rounded-r-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-slate-900 dark:text-slate-100"
                                placeholder="\\Server\Share\Path"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Generated ZIP files will be structured for archival in this directory.</p>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-4">Employee</th>
                            <th className="px-6 py-4">Month</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Generated Date</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {visiblePayslips.map((slip) => (
                            <tr key={slip.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{slip.userName}</td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{slip.month}</td>
                                <td className="px-6 py-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                    ${slip.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1 rounded-full text-xs font-medium border border-green-100 dark:border-green-800">
                                        <CheckCircle2 size={12} /> {slip.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">
                                    {new Date(slip.generatedDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1 ml-auto">
                                        <Download size={16} /> Download
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {visiblePayslips.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 dark:text-slate-500 italic">No payslips found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default Payslips;
