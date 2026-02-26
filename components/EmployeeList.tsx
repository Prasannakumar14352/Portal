
import React, { useState, useRef } from 'react';
import { Employee, EmployeeStatus, UserRole } from '../types';
import { Edit2, Trash2, Search, UploadCloud, Plus, UserPlus, FileSpreadsheet, X, Download, Save, Loader2, Mail } from 'lucide-react';
import { read, utils } from 'xlsx';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';

interface EmployeeListProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => Promise<void>;
  onUpdateEmployee: (emp: Employee) => Promise<void>;
  onDeleteEmployee: (id: string | number) => Promise<void>;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
  const { bulkAddEmployees, showToast, positions, departments } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for Add/Edit Employee Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({
      firstName: '', lastName: '', email: '', role: 'Employee', position: '', department: '', salary: 0, 
      joinDate: new Date().toISOString().split('T')[0], status: EmployeeStatus.ACTIVE
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
             avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent((row['FirstName'] || 'U') + ' ' + (row['LastName'] || ''))}&background=7c3aed&color=fff`,
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
      const template = [
          { "FirstName": "John", "LastName": "Doe", "Email": "john.doe@example.com", "Role": "Employee", "Position": "Developer", "Department": "IT", "Salary": 60000, "JoinDate": "2024-01-01" }
      ];
      const ws = utils.json_to_sheet(template);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Template");
      console.log("Template structure:", template);
      showToast("Template structure logged to console.", "info");
  };

  const handleEditClick = (emp: Employee) => {
      setNewEmployee({ ...emp });
      setIsEditing(true);
      setShowAddModal(true);
  };

  const handleCloseModal = () => {
      setShowAddModal(false);
      setIsEditing(false);
      setNewEmployee({ 
          firstName: '', lastName: '', email: '', role: 'Employee', position: '', 
          department: '', salary: 0, joinDate: new Date().toISOString().split('T')[0], 
          status: EmployeeStatus.ACTIVE 
      });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          if (isEditing && newEmployee.id) {
              await onUpdateEmployee(newEmployee as Employee);
              showToast("Employee updated successfully.", "success");
          } else {
              const emp: Employee = {
                  id: Math.random().toString(36).substr(2, 9),
                  employeeId: `EMP-${Math.floor(Math.random()*10000)}`,
                  firstName: newEmployee.firstName || '',
                  lastName: newEmployee.lastName || '',
                  email: newEmployee.email || '',
                  password: 'password123',
                  role: newEmployee.role || 'Employee',
                  position: newEmployee.position || 'Staff',
                  department: newEmployee.department || 'General',
                  salary: Number(newEmployee.salary) || 0,
                  joinDate: newEmployee.joinDate || new Date().toISOString().split('T')[0],
                  status: newEmployee.status || EmployeeStatus.ACTIVE,
                  avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent((newEmployee.firstName||'') + ' ' + (newEmployee.lastName||''))}&background=7c3aed&color=fff`,
                  projectIds: [],
                  location: { latitude: 20.5937, longitude: 78.9629, address: 'Office HQ' },
                  workLocation: 'Office HQ',
                  managerId: '',
                  settings: {
                    notifications: { emailLeaves: true, emailAttendance: false, pushWeb: true, pushMobile: true, systemAlerts: true },
                    appConfig: { aiAssistant: true, azureSync: true, strictSso: false }
                 }
              } as Employee;

              await onAddEmployee(emp);
              showToast("Employee added successfully.", "success");
          }
          handleCloseModal();
      } catch(err) {
          showToast("Operation failed.", "error");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search employees..." 
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 outline-none dark:text-slate-200 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <button 
                onClick={() => { setIsEditing(false); setShowAddModal(true); }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg hover:bg-primary-700 transition shadow-lg shadow-primary-500/20 font-bold text-sm active:scale-95"
              >
                  <Plus size={18} /> <span>Add Employee</span>
              </button>

              <input type="file" ref={fileInputRef} onChange={handleBulkImport} className="hidden" accept=".xlsx,.xls,.csv" />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isImporting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm font-medium text-sm disabled:opacity-50"
              >
                  {isImporting ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16} />} 
                  <span>Import</span>
              </button>
              <button 
                 onClick={handleDownloadTemplate}
                 className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm font-medium text-sm"
              >
                 <Download size={16} /> <span className="hidden md:inline">Template</span>
              </button>
          </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-bold uppercase text-[10px] tracking-widest">
                        <th className="px-6 py-4">Employee Profile</th>
                        <th className="px-6 py-4">Role & Position</th>
                        <th className="px-6 py-4">Department</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredEmployees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm">
                                        <img src={emp.avatar || undefined} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white text-sm">{emp.firstName} {emp.lastName}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5"><Mail size={10} /> {emp.email}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <p className="font-bold text-slate-700 dark:text-slate-200 text-xs uppercase">{emp.position}</p>
                                <p className="text-[10px] font-medium text-slate-400 mt-0.5 bg-slate-100 dark:bg-slate-700 w-fit px-2 py-0.5 rounded-full">{emp.role}</p>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{emp.department}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${emp.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                    {emp.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            handleEditClick(emp);
                                        }}
                                        title="Edit Employee"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        onClick={(e) => { e.stopPropagation(); onDeleteEmployee(emp.id); }}
                                        title="Delete Employee"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredEmployees.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-12 text-slate-400 italic">No employees found matching criteria.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Single Employee Add/Edit Modal */}
      <DraggableModal isOpen={showAddModal} onClose={handleCloseModal} title={isEditing ? "Edit Employee" : "Add New Employee"} width="max-w-2xl">
          <form onSubmit={handleAddSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">First Name</label>
                      <input required type="text" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={newEmployee.firstName} onChange={e => setNewEmployee({...newEmployee, firstName: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Last Name</label>
                      <input required type="text" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={newEmployee.lastName} onChange={e => setNewEmployee({...newEmployee, lastName: e.target.value})} />
                  </div>
              </div>
              
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Email Address</label>
                  <input required type="email" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Role / Access</label>
                      <select required className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})}>
                          <option value="Employee">Employee</option>
                          <option value="Team Manager">Team Manager</option>
                          <option value="HR Manager">HR Manager</option>
                          <option value="Admin">Admin</option>
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Designation</label>
                      <select required className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={newEmployee.position} onChange={e => setNewEmployee({...newEmployee, position: e.target.value})}>
                          <option value="" disabled>Select Designation</option>
                          {positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                      </select>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Department</label>
                      <select required className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={newEmployee.department} onChange={e => setNewEmployee({...newEmployee, department: e.target.value})}>
                          <option value="" disabled>Select Dept</option>
                          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                          <option value="General">General</option>
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Join Date</label>
                      <input type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm" value={newEmployee.joinDate} onChange={e => setNewEmployee({...newEmployee, joinDate: e.target.value})} />
                  </div>
              </div>

              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Account Status</label>
                  <select 
                    required 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm" 
                    value={newEmployee.status} 
                    onChange={e => setNewEmployee({...newEmployee, status: e.target.value as any})}
                  >
                      <option value={EmployeeStatus.ACTIVE}>Active</option>
                      <option value={EmployeeStatus.ON_LEAVE}>On Leave</option>
                      <option value={EmployeeStatus.INACTIVE}>Inactive</option>
                      <option value={EmployeeStatus.INVITED}>Invited</option>
                  </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                  <button type="button" onClick={handleCloseModal} className="px-6 py-2.5 text-slate-500 font-bold hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors uppercase text-xs tracking-wider">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition active:scale-95 flex items-center gap-2 uppercase text-xs tracking-wider">
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : (isEditing ? 'Update Employee' : 'Create Employee')}
                  </button>
              </div>
          </form>
      </DraggableModal>
    </div>
  );
};

export default EmployeeList;
