
import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Mail, Filter, ChevronLeft, ChevronRight, Copy, Check, Key, Eye, EyeOff } from 'lucide-react';
import { Employee, DepartmentType, EmployeeStatus, UserRole } from '../types';
import { useAppContext } from '../contexts/AppContext';

interface EmployeeListProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
  const { currentUser, showToast } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  const [showModal, setShowModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<{email: string, password: string} | null>(null);
  const [copied, setCopied] = useState(false);

  // Super Admin Password Visibility
  const [showPasswords, setShowPasswords] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const isHR = currentUser?.role === UserRole.HR;
  // Identify Super Admin specifically by ID or Email
  const isSuperAdmin = currentUser?.id === 'super1' || currentUser?.email === 'superadmin@empower.com';

  // Form State
  const [formData, setFormData] = useState<Partial<Employee>>({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    department: DepartmentType.IT,
    status: EmployeeStatus.ACTIVE,
    salary: 0,
  });

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDept = filterDept === 'All' || emp.department === filterDept;
    const matchesStatus = filterStatus === 'All' || emp.status === filterStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDept, filterStatus, itemsPerPage]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const generatePassword = () => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
      let password = "";
      for (let i = 0; i < 10; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      // Allow Role Update if Super Admin
      const updatedData = { ...editingEmployee, ...formData } as Employee;
      onUpdateEmployee(updatedData);
      closeModal();
    } else {
      // Generate unique password for new employee
      const newPassword = generatePassword();
      
      const newEmployee: Employee = {
        id: Math.random().toString(36).substr(2, 9),
        joinDate: new Date().toISOString().split('T')[0],
        avatar: `https://picsum.photos/seed/${Math.random()}/100`,
        password: newPassword, // Store password
        ...formData
      } as Employee;
      
      onAddEmployee(newEmployee);
      
      // Show success modal with credentials
      setGeneratedCreds({ email: newEmployee.email, password: newPassword });
      setShowModal(false);
      setShowSuccessModal(true);
    }
  };

  const copyToClipboard = () => {
      if (generatedCreds) {
          const text = `Email: ${generatedCreds.email}\nPassword: ${generatedCreds.password}`;
          navigator.clipboard.writeText(text);
          setCopied(true);
          showToast("Credentials copied to clipboard", "success");
          setTimeout(() => setCopied(false), 2000);
      }
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      role: '',
      department: DepartmentType.IT,
      status: EmployeeStatus.ACTIVE,
      salary: 50000,
    });
    setShowModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData(emp);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Employee Directory</h2>
          <p className="text-slate-500">Manage your team members and their account details.</p>
        </div>
        <div className="flex gap-2">
            {isSuperAdmin && (
                <button 
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                    {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                    <span>{showPasswords ? 'Hide Passwords' : 'Show Passwords'}</span>
                </button>
            )}
            {isHR && (
            <button 
                onClick={openAddModal}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
                <Plus size={18} />
                <span>Add Employee</span>
            </button>
            )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Filters and Search */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex flex-col md:flex-row gap-2 flex-1">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search employees..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            
            <div className="flex gap-2">
              <select 
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="All">All Departments</option>
                {Object.values(DepartmentType).map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="All">All Status</option>
                {Object.values(EmployeeStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="text-sm text-slate-500 flex items-center">
            Showing <span className="font-semibold text-slate-700 mx-1">{filteredEmployees.length}</span> employees
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Role & Dept</th>
                {isSuperAdmin && showPasswords && <th className="px-6 py-4 text-red-600">Password</th>}
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Join Date</th>
                {isHR && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img src={emp.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      <div>
                        <div className="font-medium text-slate-900">{emp.firstName} {emp.lastName}</div>
                        <div className="text-xs text-slate-500">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-900 font-medium">{emp.role}</div>
                    <div className="text-xs text-slate-500">{emp.department}</div>
                  </td>
                  {isSuperAdmin && showPasswords && (
                      <td className="px-6 py-4 text-sm font-mono text-red-600 bg-red-50/50">
                          {emp.password}
                      </td>
                  )}
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center space-x-1
                      ${emp.status === EmployeeStatus.ACTIVE ? 'bg-emerald-100 text-emerald-700' : 
                        emp.status === EmployeeStatus.INACTIVE ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full 
                        ${emp.status === EmployeeStatus.ACTIVE ? 'bg-emerald-500' : 
                          emp.status === EmployeeStatus.INACTIVE ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      <span>{emp.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {emp.joinDate}
                  </td>
                  {isHR && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => openEditModal(emp)} className="text-slate-400 hover:text-blue-600 p-1">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => onDeleteEmployee(emp.id)} className="text-slate-400 hover:text-red-600 p-1">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {paginatedEmployees.length === 0 && (
                <tr>
                  <td colSpan={isHR ? (isSuperAdmin && showPasswords ? 6 : 5) : 4} className="px-6 py-8 text-center text-slate-500">
                    No employees found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center p-4 border-t border-slate-200 bg-slate-50/50">
           <div className="flex items-center gap-2 text-xs text-slate-500">
             <span>Show</span>
             <select 
               value={itemsPerPage}
               onChange={(e) => setItemsPerPage(Number(e.target.value))}
               className="border border-slate-300 rounded p-1 outline-none bg-white focus:ring-2 focus:ring-blue-500"
             >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
             </select>
             <span>per page</span>
             <span className="mx-2 text-slate-300">|</span>
             <span>
               Showing <span className="font-medium text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-slate-700">{Math.min(currentPage * itemsPerPage, filteredEmployees.length)}</span> of <span className="font-medium text-slate-700">{filteredEmployees.length}</span> results
             </span>
           </div>
           <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white bg-white text-slate-600 shadow-sm"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-medium text-slate-600 px-2">
                 Page {currentPage} of {totalPages || 1}
              </span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white bg-white text-slate-600 shadow-sm"
              >
                <ChevronRight size={16} />
              </button>
           </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">
                {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    required
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                {!editingEmployee && <p className="text-xs text-slate-500 mt-1">A secure password will be generated automatically.</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role/Title</label>
                  {isSuperAdmin ? (
                       <select 
                         value={formData.role} 
                         onChange={(e) => setFormData({...formData, role: e.target.value})}
                         className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                       >
                         <option value="Employee">Employee</option>
                         <option value="Team Manager">Team Manager</option>
                         <option value="HR Manager">HR Manager</option>
                         <option value="Software Engineer">Software Engineer</option>
                         <option value="Sales Manager">Sales Manager</option>
                         <option value="Marketing Lead">Marketing Lead</option>
                       </select>
                  ) : (
                      <input
                        required
                        type="text"
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. Software Engineer"
                      />
                  )}
                  {isSuperAdmin && <p className="text-[10px] text-emerald-600 mt-1">Super Admin Privileges Active</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {Object.values(DepartmentType).map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                   <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as EmployeeStatus})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {Object.values(EmployeeStatus).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Salary ($)</label>
                  <input
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({...formData, salary: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
               </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={closeModal}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingEmployee ? 'Save Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Credentials Modal */}
      {showSuccessModal && generatedCreds && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-300 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
              
              <div className="flex flex-col items-center text-center mb-6">
                 <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <Key size={32} className="text-emerald-600" />
                 </div>
                 <h3 className="text-2xl font-bold text-slate-800">Employee Created</h3>
                 <p className="text-slate-500 mt-2">A unique password has been generated. Please share these credentials with the employee securely.</p>
                 <p className="text-xs text-blue-500 mt-1">An email notification has also been sent.</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-6 relative">
                 <div className="mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Username / Email</p>
                    <p className="font-mono text-slate-800 font-medium select-all">{generatedCreds.email}</p>
                 </div>
                 <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">One-Time Password</p>
                    <p className="font-mono text-xl text-slate-800 font-bold select-all tracking-wide">{generatedCreds.password}</p>
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <button 
                   onClick={copyToClipboard}
                   className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-md"
                 >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    <span>{copied ? 'Copied to Clipboard' : 'Copy Credentials'}</span>
                 </button>
                 <button 
                   onClick={() => setShowSuccessModal(false)}
                   className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 py-3 rounded-lg font-medium transition-colors"
                 >
                    Close
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
