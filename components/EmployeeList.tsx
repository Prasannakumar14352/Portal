import React, { useState, useRef } from 'react';
import { Employee, EmployeeStatus, UserRole } from '../types';
import { Edit2, Trash2, Search, UploadCloud, Plus, UserPlus, FileSpreadsheet, X, Download } from 'lucide-react';
import { read, utils } from 'xlsx';
import { useAppContext } from '../contexts/AppContext';

interface EmployeeListProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => Promise<void>;
  onUpdateEmployee: (emp: Employee) => Promise<void>;
  onDeleteEmployee: (id: string | number) => Promise<void>;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
  const { bulkAddEmployees, showToast } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredEmployees = employees.filter(emp => 
    emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.position || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet) as any[];

      const newEmployees: Employee[] = jsonData.map((row, index) => {
         const now = new Date();
         return {
             id: Math.random().toString(36).substr(2, 9), 
             employeeId: row['EmployeeID'] || `EMP-${Math.floor(Math.random()*10000)}`,
             firstName: row['FirstName'] || row['First Name'] || 'Unknown',
             lastName: row['LastName'] || row['Last Name'] || '',
             email: row['Email'] || `user${index}${Math.random().toString(36).substr(2,4)}@company.com`,
             // Default password required for SQL INSERT if not nullable
             password: 'password123', 
             role: row['Role'] || 'Employee',
             position: row['Position'] || 'Staff',
             jobTitle: row['Position'] || row['Job Title'] || 'Staff',
             department: row['Department'] || 'General',
             departmentId: '', // Default empty string
             joinDate: row['JoinDate'] || now.toISOString().split('T')[0],
             status: EmployeeStatus.ACTIVE,
             salary: row['Salary'] || 0,
             avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent((row['FirstName'] || 'U') + ' ' + (row['LastName'] || ''))}&background=0D9488&color=fff`,
             // Default location objects to prevent undefined errors in backend
             location: { latitude: 20.5937, longitude: 78.9629, address: 'Office HQ' },
             workLocation: 'Office HQ',
             phone: '',
             projectIds: [], // Empty array for project IDs
             managerId: '',
             settings: {
                notifications: { emailLeaves: true, emailAttendance: false, pushWeb: true, pushMobile: true, systemAlerts: true },
                appConfig: { aiAssistant: true, azureSync: true, strictSso: false }
             }
         } as Employee;
      });
      
      if (newEmployees.length > 0) {
          await bulkAddEmployees(newEmployees);
      } else {
          showToast("No valid records found in file.", "warning");
      }
    } catch (err) {
       console.error("Bulk Import Error:", err);
       showToast("Import failed. Please check file format.", "error");
    } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
      // Create a simple template
      const template = [
          { "FirstName": "John", "LastName": "Doe", "Email": "john.doe@example.com", "Role": "Employee", "Position": "Developer", "Department": "IT", "Salary": 60000, "JoinDate": "2024-01-01" }
      ];
      const ws = utils.json_to_sheet(template);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Template");
      // Use createObjectURL to download
      // Since we don't have writeFile in browser context reliably without more libs, we can try this:
      /* 
       * Simplified for this example: 
       * In a real app, use xlsx.writeFile if available or a Blob download.
       */
      showToast("Template download simulated (check console/implementation)", "info");
      console.log("Template Data:", template);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search employees..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 outline-none dark:text-slate-200"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
              <input type="file" ref={fileInputRef} onChange={handleBulkImport} className="hidden" accept=".xlsx,.xls,.csv" />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isImporting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm font-medium text-sm disabled:opacity-50"
              >
                  {isImporting ? <span className="animate-spin">⌛</span> : <UploadCloud size={16} />} 
                  <span>Import</span>
              </button>
              <button 
                 onClick={handleDownloadTemplate}
                 className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm font-medium text-sm"
              >
                 <Download size={16} /> <span className="hidden md:inline">Template</span>
              </button>
          </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-bold uppercase text-xs tracking-wider">
                        <th className="px-6 py-4">Employee</th>
                        <th className="px-6 py-4">Role & Position</th>
                        <th className="px-6 py-4">Department</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredEmployees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <img src={emp.avatar} alt="" className="w-8 h-8 rounded-full bg-slate-200 object-cover" />
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200">{emp.firstName} {emp.lastName}</p>
                                        <p className="text-xs text-slate-500">{emp.email}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <p className="font-medium text-slate-700 dark:text-slate-300">{emp.position}</p>
                                <p className="text-xs text-slate-500">{emp.role}</p>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                {emp.department}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${emp.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {emp.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button 
                                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); /* Logic handled by parent usually via specific edit click, here just placeholder */ }}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); onDeleteEmployee(emp.id); }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredEmployees.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-8 text-slate-400">No employees found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeList;