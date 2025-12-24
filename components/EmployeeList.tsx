
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Mail, Filter, ChevronLeft, ChevronRight, Copy, Check, Key, Eye, EyeOff, MapPin, Building2, User as UserIcon, Phone, Briefcase, AlertTriangle, Hash, ArrowUpDown, ChevronUp, ChevronDown, UploadCloud, Info, FileSpreadsheet, UserSquare, RefreshCw, Share2, Send, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Employee, DepartmentType, EmployeeStatus, UserRole, Invitation } from '../types';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';

interface EmployeeListProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee, syncToAzure?: boolean) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string | number) => void;
}

const SYSTEM_PERMISSIONS = [
    UserRole.EMPLOYEE,
    UserRole.MANAGER,
    UserRole.HR,
    UserRole.ADMIN
];

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
  const { currentUser, showToast, departments, positions, syncAzureUsers, invitations, inviteEmployee, acceptInvitation, revokeInvitation } = useAppContext();
  const [activeTab, setActiveTab] = useState<'active' | 'invitations'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('All');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | number | null>(null);

  const [provisionInAzure, setProvisionInAzure] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;

  const [formData, setFormData] = useState<Partial<Invitation>>({
    firstName: '', lastName: '', email: '', role: UserRole.EMPLOYEE, department: '',
    salary: 0, position: '', provisionInAzure: false
  });

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = 
        emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.position || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = filterDept === 'All' || emp.department === filterDept;
      return matchesSearch && matchesDept;
    });
  }, [employees, searchTerm, filterDept]);

  const filteredInvitations = useMemo(() => {
    return invitations.filter(inv => 
      inv.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [invitations, searchTerm]);

  const paginatedItems = activeTab === 'active' 
    ? filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredInvitations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalPages = Math.ceil((activeTab === 'active' ? filteredEmployees.length : filteredInvitations.length) / itemsPerPage);

  const handleAzureSync = async () => {
    setIsSyncing(true);
    await syncAzureUsers();
    setIsSyncing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      onUpdateEmployee({ ...editingEmployee, ...formData } as Employee);
      setShowModal(false);
    } else {
      // New logic: send invitation instead of direct add
      await inviteEmployee({
          ...formData,
          provisionInAzure: provisionInAzure
      });
      setShowModal(false);
      setActiveTab('invitations');
    }
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setProvisionInAzure(false);
    setFormData({
      firstName: '', lastName: '', email: '',
      role: UserRole.EMPLOYEE, 
      department: departments.length > 0 ? departments[0].name : '',
      salary: 0, 
      position: positions.length > 0 ? positions[0].title : '',
      provisionInAzure: false
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Directory Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Onboard new team members and manage active employees.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            {isPowerUser && (
                <>
                  <button 
                    onClick={handleAzureSync} 
                    disabled={isSyncing}
                    className="flex items-center space-x-2 bg-white border border-slate-300 dark:bg-slate-700 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg shadow-sm text-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition disabled:opacity-50"
                  >
                      <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                      <span>Sync Azure</span>
                  </button>
                  <button onClick={openAddModal} className="flex items-center space-x-2 bg-teal-700 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-bold active:scale-95 transition-transform">
                      <Send size={16} />
                      <span>Invite Employee</span>
                  </button>
                </>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 text-sm font-bold transition-colors relative ${activeTab === 'active' ? 'text-teal-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Active Directory ({employees.length})
            {activeTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('invitations')}
            className={`px-6 py-3 text-sm font-bold transition-colors relative ${activeTab === 'invitations' ? 'text-teal-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Pending Invitations ({invitations.length})
            {activeTab === 'invitations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600"></div>}
          </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder={`Search ${activeTab}...`} 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          {activeTab === 'active' && (
              <select 
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm outline-none"
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
              >
                  <option value="All">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
          )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="px-6 py-4">{activeTab === 'active' ? 'Employee' : 'Invitee'}</th>
                <th className="px-6 py-4">{activeTab === 'active' ? 'ID' : 'Invited On'}</th>
                <th className="px-6 py-4">Position & Role</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">{activeTab === 'active' ? 'Status' : 'Azure Sync'}</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {activeTab === 'active' ? (
                  paginatedItems.map((emp: any) => (
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
                          <button className="text-slate-400 hover:text-blue-600 p-2"><Eye size={16} /></button>
                          {isPowerUser && <button onClick={() => { setEditingEmployee(emp); setFormData(emp); setShowModal(true); }} className="text-slate-400 hover:text-teal-600 p-2"><Edit2 size={16} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))
              ) : (
                  paginatedItems.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                             <Clock size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-white text-sm">{inv.firstName} {inv.lastName}</div>
                            <div className="text-[11px] text-slate-400 font-medium">{inv.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{inv.invitedDate}</td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-900 dark:text-slate-200 font-bold">{inv.position}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-tight">{inv.role}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 uppercase font-medium">{inv.department}</td>
                      <td className="px-6 py-4">
                        {inv.provisionInAzure ? (
                            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase">
                                <RefreshCw size={12}/> Will Provision
                            </span>
                        ) : (
                            <span className="text-slate-400 text-[10px] font-bold uppercase">Local Only</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <button 
                             onClick={() => acceptInvitation(inv.id)}
                             className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
                             title="HR can simulate the employee clicking accept here"
                           >
                             <CheckCircle size={12}/> Accept (Demo)
                           </button>
                           <button 
                             onClick={() => revokeInvitation(inv.id)}
                             className="text-slate-400 hover:text-red-600 p-2"
                             title="Revoke Invite"
                           >
                             <XCircle size={18} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
              {paginatedItems.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INVITE MODAL */}
      <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title={editingEmployee ? 'Edit Employee' : 'Send New Invitation'} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {!editingEmployee && (
              <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-xl border border-teal-100 dark:border-teal-800 flex items-start gap-4">
                  <div className="bg-teal-600 text-white p-2 rounded-lg">
                      <Mail size={20} />
                  </div>
                  <div>
                      <p className="text-sm font-bold text-teal-900 dark:text-teal-200">How invitations work</p>
                      <p className="text-xs text-teal-700 dark:text-teal-400 leading-relaxed">
                          We will send an email to this address. Once they accept, they will be added to the portal and (if selected) automatically provisioned in Azure.
                      </p>
                  </div>
              </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">First Name</label><input required type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm transition-all dark:text-white" /></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Last Name</label><input required type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm transition-all dark:text-white" /></div>
          </div>

          <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Email ID</label><div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full pl-11 pr-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm dark:text-white" /></div></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Position</label>
              <select required value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all dark:text-white">
                 <option value="" disabled>Select Position...</option>
                 {positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">System Permissions</label>
              <select required value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all dark:text-white">
                 {SYSTEM_PERMISSIONS.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Department</label><select required value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm dark:text-white">{departments.map(dept => <option key={dept.id} value={dept.name}>{dept.name}</option>)}</select></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Salary (Annual)</label><input type="number" value={formData.salary} onChange={(e) => setFormData({...formData, salary: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm dark:text-white" /></div>
          </div>

          {!editingEmployee && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <Share2 className="text-blue-600" size={20} />
                   <div>
                       <p className="text-sm font-bold text-blue-900 dark:text-teal-200 leading-tight">Provision in Azure Portal</p>
                       <p className="text-[10px] text-blue-600 dark:text-teal-400 font-medium">Create user in Azure Entra ID when they accept.</p>
                   </div>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${provisionInAzure ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                  onClick={() => setProvisionInAzure(!provisionInAzure)}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${provisionInAzure ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
            </div>
          )}

          <div className="pt-6 flex justify-end space-x-3 border-t dark:border-slate-700">
            <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-xs font-black text-slate-400 uppercase tracking-widest">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-bold text-xs shadow-lg uppercase tracking-widest">{editingEmployee ? 'Update' : 'Send Invitation'}</button>
          </div>
        </form>
      </DraggableModal>
    </div>
  );
};

export default EmployeeList;
