
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Mail, Filter, ChevronLeft, ChevronRight, Copy, Check, Key, Eye, EyeOff, MapPin, Building2, User as UserIcon, Phone, Briefcase, AlertTriangle, Hash, ArrowUpDown, ChevronUp, ChevronDown, UploadCloud, Info, FileSpreadsheet, UserSquare } from 'lucide-react';
import { Employee, DepartmentType, EmployeeStatus, UserRole } from '../types';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';
import { read, utils } from 'xlsx';

interface EmployeeListProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string | number) => void;
}

const COUNTRY_CODES = [
  { code: '+91', country: 'IN' },
  { code: '+1', country: 'US' },
  { code: '+44', country: 'UK' },
  { code: '+971', country: 'UAE' },
  { code: '+61', country: 'AU' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+81', country: 'JP' },
  { code: '+86', country: 'CN' },
  { code: '+65', country: 'SG' },
];

const WORK_LOCATIONS = [
  'Office HQ India',
  'WFH India',
  'UAE Office',
  'UAE Client Location',
  'USA'
];

const SYSTEM_PERMISSIONS = [
    UserRole.EMPLOYEE,
    UserRole.MANAGER,
    UserRole.HR,
    UserRole.ADMIN
];

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
  const { currentUser, showToast, departments, positions } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); 
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | number | null>(null);

  const [generatedCreds, setGeneratedCreds] = useState<{email: string, password: string} | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  const isHR = currentUser?.role === UserRole.HR;
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isPowerUser = isHR || isAdmin;
  const isSuperAdmin = String(currentUser?.id) === 'super1' || currentUser?.email === 'superadmin@empower.com';
  
  const canViewPasswords = isSuperAdmin || isPowerUser;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Employee>>({
    firstName: '', lastName: '', email: '', role: UserRole.EMPLOYEE, department: '', employeeId: '',
    status: EmployeeStatus.ACTIVE, salary: 0, phone: '', location: { latitude: 0, longitude: 0, address: '' }, workLocation: '',
    position: '' 
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredEmployees = useMemo(() => {
    let result = employees.filter(emp => {
      const matchesSearch = 
        emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(emp.employeeId).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.position || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = filterDept === 'All' || emp.department === filterDept;
      const matchesStatus = filterStatus === 'All' || emp.status === filterStatus;
      return matchesSearch && matchesDept && matchesStatus;
    });
    return result;
  }, [employees, searchTerm, filterDept, filterStatus, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredEmployees.length / itemsPerPage);
  const paginatedEmployees = sortedAndFilteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      onUpdateEmployee({ ...editingEmployee, ...formData } as Employee);
      setShowModal(false);
    } else {
      const numericIds = employees.map(emp => Number(emp.id)).filter(id => !isNaN(id));
      const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1001;
      const newEmployee: Employee = {
        id: nextId,
        employeeId: formData.employeeId || nextId.toString(),
        joinDate: new Date().toISOString().split('T')[0],
        avatar: formData.avatar || `https://ui-avatars.com/api/?name=${formData.firstName}+${formData.lastName}&background=0D9488&color=fff`,
        password: Math.random().toString(36).substr(2, 8), 
        ...formData
      } as unknown as Employee;
      onAddEmployee(newEmployee);
      setGeneratedCreds({ email: newEmployee.email, password: newEmployee.password! });
      setShowModal(false);
      setShowSuccessModal(true);
    }
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      firstName: '', lastName: '', email: '', employeeId: '',
      role: UserRole.EMPLOYEE, 
      department: departments.length > 0 ? departments[0].name : '',
      status: EmployeeStatus.ACTIVE, salary: 0, phone: '', location: undefined,
      workLocation: WORK_LOCATIONS[0],
      position: positions.length > 0 ? positions[0].title : ''
    });
    setShowModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData(emp);
    setShowModal(true);
  };

  const openViewModal = (emp: Employee) => {
    setViewingEmployee(emp);
    setShowViewModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Employee Directory</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Central command for human capital.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            {canViewPasswords && (
                <button onClick={() => setShowPasswords(!showPasswords)} className="flex items-center space-x-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">
                    {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                    <span>{showPasswords ? 'Hide' : 'Show'} Passwords</span>
                </button>
            )}
            {isPowerUser && (
                <button onClick={openAddModal} className="flex items-center space-x-2 bg-teal-700 text-white px-4 py-2 rounded-lg shadow-sm text-sm">
                    <Plus size={18} />
                    <span>Add Employee</span>
                </button>
            )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Position</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img src={emp.avatar} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm" />
                      <div>
                        <div className="font-bold text-slate-800 dark:text-white text-sm">{emp.firstName} {emp.lastName}</div>
                        <div className="text-[11px] text-slate-400 font-medium">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-slate-500">{emp.employeeId || emp.id}</td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-900 dark:text-slate-200 font-bold">{emp.position || 'Consultant'}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-tight">{emp.role}</div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 uppercase font-medium">{emp.department}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${emp.status === EmployeeStatus.ACTIVE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{emp.status}</span></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button onClick={() => openViewModal(emp)} className="text-slate-400 hover:text-blue-600 transition-colors"><Eye size={16} /></button>
                      {isPowerUser && <button onClick={() => openEditModal(emp)} className="text-slate-400 hover:text-teal-600 transition-colors"><Edit2 size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE/EDIT MODAL */}
      <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title={editingEmployee ? 'Edit Employee' : 'Add Employee'} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">First Name</label><input required type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm transition-all dark:text-white" /></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Last Name</label><input required type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm transition-all dark:text-white" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Numeric Employee ID</label><div className="relative"><Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="number" placeholder="1001" value={formData.employeeId} onChange={(e) => setFormData({...formData, employeeId: e.target.value})} className="w-full pl-11 pr-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm font-mono dark:text-white" /></div></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Email ID</label><div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full pl-11 pr-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm dark:text-white" /></div></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Position</label>
              <select 
                required 
                value={formData.position} 
                onChange={(e) => setFormData({...formData, position: e.target.value})} 
                className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all dark:text-white"
              >
                 <option value="" disabled>Select Position...</option>
                 {positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                 {positions.length === 0 && <option value="Consultant">Consultant (Default)</option>}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">System Permissions</label>
              <select 
                required 
                value={formData.role} 
                onChange={(e) => setFormData({...formData, role: e.target.value})} 
                className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all dark:text-white"
              >
                 {SYSTEM_PERMISSIONS.map(role => (
                   <option key={role} value={role}>{role}</option>
                 ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Project/Department</label><select required value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm dark:text-white">{departments.map(dept => <option key={dept.id} value={dept.name}>{dept.name}</option>)}</select></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Salary (Annual)</label><input type="number" value={formData.salary} onChange={(e) => setFormData({...formData, salary: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm dark:text-white" /></div>
          </div>

          <div className="pt-6 flex justify-end space-x-3 border-t dark:border-slate-700">
            <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-xs font-black text-slate-400 uppercase tracking-widest">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-bold text-xs shadow-lg uppercase tracking-widest">{editingEmployee ? 'Update' : 'Create'} Employee</button>
          </div>
        </form>
      </DraggableModal>
    </div>
  );
};

export default EmployeeList;
