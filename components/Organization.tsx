
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Department, Project, Employee } from '../types';
import { Briefcase, FolderPlus, Trash2, Building2, Users, Edit2, Layers, CheckCircle, Filter, Plus, Minus, X, ListTodo, GripVertical, Eye, ChevronLeft, ChevronRight, Network } from 'lucide-react';
import EmployeeList from './EmployeeList';

// --- Org Chart Helper Types & Logic ---
interface TreeNode extends Employee {
  children: TreeNode[];
}

const buildOrgTree = (employees: Employee[]): TreeNode[] => {
  const empMap: Record<string, TreeNode> = {};
  
  // Initialize map
  employees.forEach(emp => {
    empMap[emp.id] = { ...emp, children: [] };
  });

  const roots: TreeNode[] = [];

  // Build relationships
  employees.forEach(emp => {
    const node = empMap[emp.id];
    if (emp.managerId && empMap[emp.managerId]) {
      empMap[emp.managerId].children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

// --- Org Chart Component ---
const OrgChartNode: React.FC<{ node: TreeNode }> = ({ node }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div className="flex flex-col items-center relative">
        <div className="org-node-card group bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all w-48 relative z-10 group-hover:border-emerald-400">
           <div className="flex flex-col items-center">
             <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-100 mb-2 group-hover:border-emerald-100">
                <img src={node.avatar} alt={node.firstName} className="w-full h-full object-cover" />
             </div>
             <div className="text-center w-full">
                <h4 className="font-bold text-slate-800 text-sm truncate px-1" title={`${node.firstName} ${node.lastName}`}>
                  {node.firstName} {node.lastName}
                </h4>
                <p className="text-xs text-emerald-600 font-medium truncate mb-1" title={node.jobTitle || node.role}>
                  {node.jobTitle || node.role}
                </p>
                {node.department && (
                  <span className="inline-block text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    {node.department}
                  </span>
                )}
             </div>
           </div>
        </div>
        
        {/* Toggle Button */}
        {hasChildren && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="absolute -bottom-3 z-20 bg-white border border-slate-300 text-slate-400 hover:text-emerald-600 hover:border-emerald-400 rounded-full w-6 h-6 flex items-center justify-center shadow-sm transition-all"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <Minus size={12} /> : <Plus size={12} />}
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <ul className="animate-in fade-in slide-in-from-top-2 duration-300">
          {node.children.map(child => (
            <OrgChartNode key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
};

const Organization = () => {
  const { 
    currentUser, 
    departments, addDepartment, updateDepartment, deleteDepartment, 
    projects, addProject, updateProject, deleteProject, 
    users, updateUser, notify,
    employees, addEmployee, updateEmployee, deleteEmployee 
  } = useAppContext();
  
  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'projects' | 'allocations' | 'chart'>('departments');
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showProjModal, setShowProjModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showConfirmAlloc, setShowConfirmAlloc] = useState(false);

  // Filters
  const [projFilter, setProjFilter] = useState<'All' | 'Active' | 'Completed' | 'On Hold'>('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6); // Default 6 for grid layout (multiple of 3)

  // Form States
  const [deptForm, setDeptForm] = useState<{ id?: string, name: string, description: string, managerId: string }>({ name: '', description: '', managerId: '' });
  const [projForm, setProjForm] = useState<{ id?: string, name: string, description: string, status: string, tasks: string[] }>({ name: '', description: '', status: 'Active', tasks: [] });
  
  // Task Management State (Local to modal)
  const [newTaskInput, setNewTaskInput] = useState('');
  const [draggedTaskIndex, setDraggedTaskIndex] = useState<number | null>(null);

  // Allocation State
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [allocForm, setAllocForm] = useState<{ departmentId: string, projectIds: string[] }>({ departmentId: '', projectIds: [] });

  const isHR = currentUser?.role === UserRole.HR;
  const showEmployeesTab = currentUser?.role !== UserRole.EMPLOYEE;

  // Memoized Tree Data
  const orgTreeData = useMemo(() => buildOrgTree(users), [users]);

  // -- Handlers --

  // Reset pagination on tab, filter or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, projFilter, itemsPerPage]);

  const handleDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHR) return; // Guard
    if (deptForm.id) {
       updateDepartment(deptForm.id, { name: deptForm.name, description: deptForm.description, managerId: deptForm.managerId });
    } else {
       addDepartment({ name: deptForm.name, description: deptForm.description, managerId: deptForm.managerId });
    }
    setShowDeptModal(false);
    setDeptForm({ name: '', description: '', managerId: '' });
  };

  const openDeptView = (dept: Department) => {
    setDeptForm({ id: dept.id, name: dept.name, description: dept.description || '', managerId: dept.managerId || '' });
    setShowDeptModal(true);
  };

  const handleProjSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHR) return; // Guard
    if (projForm.id) {
       updateProject(projForm.id, { name: projForm.name, description: projForm.description, status: projForm.status as any, tasks: projForm.tasks });
    } else {
       addProject({ name: projForm.name, description: projForm.description, status: projForm.status as any, tasks: projForm.tasks });
    }
    setShowProjModal(false);
    setProjForm({ name: '', description: '', status: 'Active', tasks: [] });
    setNewTaskInput('');
  };

  const openProjView = (proj: Project) => {
    setProjForm({ id: proj.id, name: proj.name, description: proj.description || '', status: proj.status, tasks: proj.tasks || [] });
    setNewTaskInput('');
    setShowProjModal(true);
  };

  const addTaskToProject = () => {
    if (newTaskInput.trim()) {
      setProjForm(prev => ({ ...prev, tasks: [...prev.tasks, newTaskInput.trim()] }));
      setNewTaskInput('');
    }
  };

  const removeTaskFromProject = (index: number) => {
    setProjForm(prev => ({ ...prev, tasks: prev.tasks.filter((_, i) => i !== index) }));
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedTaskIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    if (draggedTaskIndex === null || draggedTaskIndex === index) return;
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedTaskIndex === null) return;

    const newTasks = [...projForm.tasks];
    const [movedTask] = newTasks.splice(draggedTaskIndex, 1);
    newTasks.splice(dropIndex, 0, movedTask);

    setProjForm(prev => ({ ...prev, tasks: newTasks }));
    setDraggedTaskIndex(null);
  };

  const openAllocation = (user: Employee) => {
    setSelectedUser(user);
    setAllocForm({ departmentId: user.departmentId || '', projectIds: user.projectIds || [] });
    setShowAllocModal(true);
  };

  const toggleProjectAlloc = (projId: string) => {
    setAllocForm(prev => {
       if (prev.projectIds?.includes(projId)) {
          return { ...prev, projectIds: prev.projectIds.filter(id => id !== projId) };
       }
       return { ...prev, projectIds: [...(prev.projectIds || []), projId] };
    });
  };

  const confirmAllocation = () => {
    setShowAllocModal(false);
    setShowConfirmAlloc(true);
  };

  const finalizeAllocation = () => {
    if (selectedUser) {
       updateUser(selectedUser.id, { departmentId: allocForm.departmentId, projectIds: allocForm.projectIds });
       
       // Calculate notified users (colleagues in same dept or projects)
       const colleagueIds = new Set<string>();
       
       // Add dept colleagues
       users.forEach(u => {
          if (u.id === selectedUser.id) return;
          if (u.departmentId === allocForm.departmentId) colleagueIds.add(u.id);
          if (u.projectIds?.some(pid => allocForm.projectIds.includes(pid))) colleagueIds.add(u.id);
       });

       const deptName = departments.find(d => d.id === allocForm.departmentId)?.name || 'their department';

       notify(`Assignment updated. Email sent to ${selectedUser.firstName} ${selectedUser.lastName}. System notifications sent to ${colleagueIds.size} colleagues in ${deptName} and related projects.`);
       
       setShowConfirmAlloc(false);
       setSelectedUser(null);
    }
  };
  
  // Helpers for inline edit
  const assignUserToDept = (userId: string) => {
    if(deptForm.id) updateUser(userId, { departmentId: deptForm.id });
  };
  const removeUserFromDept = (userId: string) => {
    updateUser(userId, { departmentId: '' });
  };
  
  const assignUserToProj = (userId: string) => {
     if(!projForm.id) return;
     const u = users.find(u => u.id === userId);
     if(u) updateUser(userId, { projectIds: [...(u.projectIds || []), projForm.id!] });
  };
  const removeUserFromProj = (userId: string) => {
     if(!projForm.id) return;
     const u = users.find(u => u.id === userId);
     if(u) updateUser(userId, { projectIds: (u.projectIds || []).filter(pid => pid !== projForm.id) });
  };

  // Filtered Lists & Pagination Logic
  const filteredProjects = projects.filter(p => projFilter === 'All' || p.status === projFilter);
  const totalProjects = filteredProjects.length;
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalAllocations = users.length;
  const paginatedAllocations = users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalDepartments = departments.length;
  const paginatedDepartments = departments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Derived lists for modals
  const employeesInCurrentDept = users.filter(u => u.departmentId === deptForm.id);
  const availableEmployeesForDept = users.filter(u => u.departmentId !== deptForm.id);
  
  const employeesInCurrentProj = users.filter(u => u.projectIds?.includes(projForm.id!));
  const availableEmployeesForProj = users.filter(u => !u.projectIds?.includes(projForm.id!));

  const PaginationControls = ({ total }: { total: number }) => {
    const totalPages = Math.ceil(total / itemsPerPage);
    if (total === 0) return null;

    return (
      <div className="flex flex-col sm:flex-row justify-between items-center p-4 pt-6 border-t border-gray-200 gap-4 sm:gap-0">
         <div className="flex items-center gap-2 text-xs text-gray-500">
             <span>Show</span>
             <select 
               value={itemsPerPage}
               onChange={(e) => setItemsPerPage(Number(e.target.value))}
               className="border border-gray-300 rounded p-1 outline-none bg-white focus:ring-2 focus:ring-emerald-500"
             >
                <option value={5}>5</option>
                <option value={6}>6</option>
                <option value={9}>9</option>
                <option value={12}>12</option>
                <option value={20}>20</option>
             </select>
             <span>items</span>
             <span className="hidden sm:inline mx-2 text-gray-300">|</span>
             <span className="hidden sm:inline">
                Showing <span className="font-medium text-gray-700">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-gray-700">{Math.min(currentPage * itemsPerPage, total)}</span> of <span className="font-medium text-gray-700">{total}</span> results
             </span>
         </div>
         <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white bg-white text-gray-600 shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium text-gray-600 px-2">
               Page {currentPage} of {totalPages || 1}
            </span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white bg-white text-gray-600 shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
         </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
       {/* CSS for Org Tree */}
       <style>{`
         .org-tree ul {
            padding-top: 20px; 
            position: relative;
            transition: all 0.5s;
            display: flex;
            justify-content: center;
         }
         .org-tree li {
            float: left; text-align: center;
            list-style-type: none;
            position: relative;
            padding: 20px 5px 0 5px;
            transition: all 0.5s;
         }
         /* We will use ::before and ::after to draw the connectors */
         .org-tree li::before, .org-tree li::after {
            content: '';
            position: absolute; top: 0; right: 50%;
            border-top: 1px solid #cbd5e1; /* slate-300 */
            width: 50%; height: 20px;
         }
         .org-tree li::after {
            right: auto; left: 50%;
            border-left: 1px solid #cbd5e1;
         }
         /* Remove left-connector from first child and right-connector from last child */
         .org-tree li:first-child::before {
            border: 0 none;
         }
         .org-tree li:last-child::after {
            border: 0 none;
         }
         /* Adding back the vertical line to the nodes */
         .org-tree li:first-child::after {
            border-radius: 5px 0 0 0;
         }
         .org-tree li:last-child::before {
            border-right: 1px solid #cbd5e1;
            border-radius: 0 5px 0 0;
         }
         /* Single child case */
         .org-tree li:only-child::after, .org-tree li:only-child::before {
            display: none;
         }
         .org-tree li:only-child { 
            padding-top: 0;
         }
         /* Connector from parent to children */
         .org-tree ul ul::before {
            content: '';
            position: absolute; top: 0; left: 50%;
            border-left: 1px solid #cbd5e1;
            width: 0; height: 20px;
         }
       `}</style>

       {/* Confirmation Modal for Allocation */}
       {showConfirmAlloc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
              <div className="flex items-center space-x-3 text-emerald-600 mb-4">
                 <CheckCircle size={28} />
                 <h3 className="text-lg font-bold text-gray-800">Confirm Assignment</h3>
              </div>
              <p className="text-gray-600 mb-6">
                 Are you sure you want to assign <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong> to the selected department and {allocForm.projectIds.length} projects?
                 <br/><span className="text-xs text-gray-500 mt-2 block">All members of the selected project/department will be notified.</span>
              </p>
              <div className="flex justify-end space-x-3">
                 <button onClick={() => setShowConfirmAlloc(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                 <button onClick={finalizeAllocation} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-medium shadow-sm">Confirm & Notify</button>
              </div>
           </div>
        </div>
       )}

       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Organization Settings</h2>
            <p className="text-sm text-gray-500">Manage company departments, projects, and people allocations.</p>
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto w-full xl:w-auto max-w-full no-scrollbar">
             <button 
               onClick={() => setActiveTab('departments')}
               className={`flex-1 xl:flex-none px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${activeTab === 'departments' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
             >
               Departments
             </button>
             <button 
               onClick={() => setActiveTab('projects')}
               className={`flex-1 xl:flex-none px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${activeTab === 'projects' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
             >
               Projects
             </button>
             <button 
               onClick={() => setActiveTab('chart')}
               className={`flex-1 xl:flex-none px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${activeTab === 'chart' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
             >
               Org Chart
             </button>
             <button 
               onClick={() => setActiveTab('allocations')}
               className={`flex-1 xl:flex-none px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${activeTab === 'allocations' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
             >
               Allocations
             </button>
             {showEmployeesTab && (
               <button 
                 onClick={() => setActiveTab('employees')}
                 className={`flex-1 xl:flex-none px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${activeTab === 'employees' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 Employees
               </button>
             )}
          </div>
       </div>

       {/* --- EMPLOYEES TAB --- */}
       {activeTab === 'employees' && (
         <div className="animate-fade-in">
            <EmployeeList 
              employees={employees} 
              onAddEmployee={addEmployee}
              onUpdateEmployee={updateEmployee}
              onDeleteEmployee={deleteEmployee}
            />
         </div>
       )}

       {/* --- ORG CHART TAB --- */}
       {activeTab === 'chart' && (
         <div className="bg-slate-50 rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
               <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Network size={20} className="text-emerald-600"/>
                  Organizational Hierarchy
               </h3>
               <span className="text-xs text-gray-400">Drag to scroll</span>
            </div>
            
            <div className="p-8 overflow-auto cursor-grab active:cursor-grabbing min-h-[600px] flex justify-center bg-slate-50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
               {orgTreeData.length === 0 ? (
                 <div className="flex flex-col items-center justify-center text-slate-400">
                    <Network size={48} className="mb-2 opacity-50" />
                    <p>No organization data available.</p>
                 </div>
               ) : (
                 <div className="org-tree">
                    <ul>
                      {orgTreeData.map(node => (
                        <OrgChartNode key={node.id} node={node} />
                      ))}
                    </ul>
                 </div>
               )}
            </div>
         </div>
       )}

       {/* --- DEPARTMENTS TAB --- */}
       {activeTab === 'departments' && (
         <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                 <Building2 size={20} className="text-emerald-600"/>
                 <span>All Departments</span>
               </h3>
               {isHR && (
                 <button onClick={() => { setDeptForm({ name: '', description: '', managerId: '' }); setShowDeptModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 shadow-sm flex items-center gap-2">
                   <FolderPlus size={16} /> Add Dept
                 </button>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {paginatedDepartments.map(dept => {
                 const employeeCount = users.filter(u => u.departmentId === dept.id).length;
                 const manager = users.find(u => u.id === dept.managerId);
                 
                 return (
                   <div 
                      key={dept.id} 
                      onClick={() => openDeptView(dept)}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition relative group cursor-pointer"
                   >
                      <div className="flex justify-between items-start mb-4">
                         <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                           <Building2 size={20} />
                         </div>
                         <div className="flex space-x-2 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                           {isHR ? (
                             <>
                                <button onClick={(e) => { e.stopPropagation(); openDeptView(dept); }} className="text-gray-400 hover:text-emerald-600">
                                  <Edit2 size={16} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete department?')) deleteDepartment(dept.id); }} className="text-gray-400 hover:text-red-500">
                                  <Trash2 size={16} />
                                </button>
                             </>
                           ) : (
                              <button className="text-gray-400 hover:text-emerald-600">
                                <Eye size={16} />
                              </button>
                           )}
                         </div>
                      </div>
                      <h4 className="text-xl font-bold text-gray-800 mb-1">{dept.name}</h4>
                      <p className="text-sm text-gray-500 mb-4 h-10 line-clamp-2">{dept.description}</p>
                      
                      <div className="space-y-3 pt-3 border-t border-gray-100">
                         {manager ? (
                           <div className="flex items-center space-x-2">
                              <img src={manager.avatar} alt={manager.firstName} className="w-6 h-6 rounded-full" />
                              <div className="text-xs">
                                <span className="block text-gray-500">Manager</span>
                                <span className="font-semibold text-gray-800">{manager.firstName} {manager.lastName}</span>
                              </div>
                           </div>
                         ) : (
                           <div className="text-xs text-gray-400 italic">No manager assigned</div>
                         )}
                         <div className="flex items-center text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                            <Users size={16} className="mr-2" />
                            <span>{employeeCount} Employees</span>
                         </div>
                      </div>
                   </div>
                 );
               })}
            </div>
            
            <PaginationControls total={totalDepartments} />
         </div>
       )}

       {/* --- PROJECTS TAB --- */}
       {activeTab === 'projects' && (
         <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                 <Briefcase size={20} className="text-emerald-600"/>
                 <span>Projects</span>
               </h3>
               
               <div className="flex items-center gap-3 w-full sm:w-auto">
                 {/* Filter */}
                 <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 sm:flex-none">
                    <Filter size={14} className="text-gray-400" />
                    <select 
                      className="text-sm bg-transparent outline-none text-gray-700 w-full"
                      value={projFilter}
                      onChange={(e) => setProjFilter(e.target.value as any)}
                    >
                      <option value="All">All Status</option>
                      <option value="Active">Active</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Completed">Completed</option>
                    </select>
                 </div>

                 {isHR && (
                   <button onClick={() => { setProjForm({ name: '', description: '', status: 'Active', tasks: [] }); setShowProjModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 shadow-sm flex items-center gap-2 whitespace-nowrap">
                     <FolderPlus size={16} /> New Project
                   </button>
                 )}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {paginatedProjects.map(proj => {
                 const membersCount = users.filter(u => u.projectIds?.includes(proj.id)).length;
                 const isAssignedToMe = currentUser?.projectIds?.includes(proj.id);
                 
                 return (
                   <div 
                      key={proj.id} 
                      onClick={() => openProjView(proj)}
                      className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition relative group cursor-pointer ${isAssignedToMe ? 'border-emerald-300 ring-1 ring-emerald-300' : 'border-gray-200'}`}
                   >
                      {isAssignedToMe && (
                        <span className="absolute top-0 right-0 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
                           Assigned to You
                        </span>
                      )}
                      
                      <div className="flex justify-between items-start mb-4 mt-2">
                         <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                           <Briefcase size={20} />
                         </div>
                         <div className="flex items-center gap-2">
                           <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${proj.status === 'Active' ? 'bg-green-100 text-green-700' : proj.status === 'On Hold' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                             {proj.status}
                           </span>
                           <div className="flex space-x-1 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                              {isHR ? (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); openProjView(proj); }} className="text-gray-400 hover:text-emerald-600">
                                     <Edit2 size={16} />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete project?')) deleteProject(proj.id); }} className="text-gray-400 hover:text-red-500">
                                     <Trash2 size={16} />
                                  </button>
                                </>
                              ) : (
                                  <button className="text-gray-400 hover:text-emerald-600">
                                     <Eye size={16} />
                                  </button>
                              )}
                           </div>
                         </div>
                      </div>
                      <h4 className="text-xl font-bold text-gray-800 mb-1">{proj.name}</h4>
                      <p className="text-sm text-gray-500 mb-4 h-10 line-clamp-2">{proj.description}</p>
                      
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex -space-x-2 overflow-hidden">
                           {users.filter(u => u.projectIds?.includes(proj.id)).slice(0, 3).map(u => (
                             <img key={u.id} className="inline-block h-6 w-6 rounded-full ring-2 ring-white" src={u.avatar} alt={u.firstName} title={`${u.firstName} ${u.lastName}`} />
                           ))}
                           {membersCount > 3 && <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 ring-2 ring-white text-[10px] text-gray-500">+{membersCount-3}</span>}
                           {membersCount === 0 && <span className="text-xs text-gray-400 italic">No members</span>}
                        </div>
                        {proj.dueDate && <span className="text-xs text-gray-400">Due: {new Date(proj.dueDate).toLocaleDateString()}</span>}
                      </div>
                   </div>
                 );
               })}
               {paginatedProjects.length === 0 && (
                  <div className="col-span-full text-center py-10 text-gray-500">
                     No projects found matching the filter.
                  </div>
               )}
            </div>
            
            <PaginationControls total={totalProjects} />
         </div>
       )}

       {/* --- ALLOCATIONS TAB --- */}
       {activeTab === 'allocations' && (
         <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
               <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Layers size={20} className="text-emerald-600"/>
                  Employee Allocations
               </h3>
               {!isHR && <span className="text-xs text-gray-400 italic">View Only</span>}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px] md:min-w-0">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Assigned Projects</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                   {paginatedAllocations.map(user => {
                     const userDept = departments.find(d => d.id === user.departmentId);
                     const userProjects = projects.filter(p => user.projectIds?.includes(p.id));
                     const displayName = `${user.firstName} ${user.lastName}`;
                     const displayTitle = user.role;
                     return (
                       <tr key={user.id} className="hover:bg-gray-50/50">
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img src={user.avatar} className="w-8 h-8 rounded-full" />
                              <div>
                                <p className="text-sm font-bold text-gray-800">{displayName}</p>
                                <p className="text-xs text-gray-500">{displayTitle}</p>
                              </div>
                            </div>
                         </td>
                         <td className="px-6 py-4">
                            {userDept ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                 <Building2 size={12} /> {userDept.name}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                         </td>
                         <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                               {userProjects.map(p => (
                                 <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100">
                                    {p.name}
                                 </span>
                               ))}
                               {userProjects.length === 0 && <span className="text-gray-400 text-xs italic">No projects</span>}
                            </div>
                         </td>
                         <td className="px-6 py-4 text-right">
                            {isHR && (
                              <button onClick={() => openAllocation(user)} className="text-emerald-600 hover:text-emerald-800 text-sm font-medium flex items-center justify-end gap-1 w-full">
                                <Edit2 size={14} /> Edit
                              </button>
                            )}
                         </td>
                       </tr>
                     );
                   })}
                </tbody>
              </table>
            </div>
            
            <PaginationControls total={totalAllocations} />
         </div>
       )}

       {/* --- DEPARTMENT MODAL --- */}
       {showDeptModal && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
             <h3 className="text-lg font-bold text-gray-800 mb-4">{isHR ? (deptForm.id ? 'Edit Department' : 'Create Department') : 'Department Details'}</h3>
             <form onSubmit={handleDeptSubmit} className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                 <input disabled={!isHR} required type="text" className={`w-full border rounded-lg p-2 text-sm ${!isHR ? 'bg-gray-50 text-gray-600' : ''}`} value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} />
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                 <textarea disabled={!isHR} className={`w-full border rounded-lg p-2 text-sm ${!isHR ? 'bg-gray-50 text-gray-600' : ''}`} value={deptForm.description} onChange={e => setDeptForm({...deptForm, description: e.target.value})} />
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Department Head (Manager)</label>
                 <select disabled={!isHR} className={`w-full border rounded-lg p-2 text-sm ${!isHR ? 'bg-gray-50 text-gray-600 appearance-none' : ''}`} value={deptForm.managerId} onChange={e => setDeptForm({...deptForm, managerId: e.target.value})}>
                    <option value="">{isHR ? "Select Manager..." : "No Manager Assigned"}</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                    ))}
                 </select>
               </div>
               
               {/* Manage Members (Only when editing existing department) */}
               {deptForm.id && (
                  <div className="pt-2 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Department Members</label>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                       {/* Current Members */}
                       <div className="space-y-2 max-h-40 overflow-y-auto">
                          {employeesInCurrentDept.map(u => (
                             <div key={u.id} className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2">
                                   <img src={u.avatar} className="w-6 h-6 rounded-full"/>
                                   <span className="text-sm text-gray-700">{u.firstName} {u.lastName}</span>
                                </div>
                                {isHR && <button type="button" onClick={() => removeUserFromDept(u.id)} className="text-gray-400 hover:text-red-500 p-1"><X size={14} /></button>}
                             </div>
                          ))}
                          {employeesInCurrentDept.length === 0 && <span className="text-xs text-gray-400 italic">No members assigned</span>}
                       </div>
                       
                       {/* Add Member */}
                       {isHR && (
                         <div className="flex gap-2">
                            <select 
                              className="flex-1 text-sm border rounded-lg p-1.5"
                              onChange={(e) => {
                                 if(e.target.value) { assignUserToDept(e.target.value); e.target.value = ''; }
                              }}
                            >
                               <option value="">+ Add Employee...</option>
                               {availableEmployeesForDept.map(u => (
                                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                               ))}
                            </select>
                         </div>
                       )}
                    </div>
                  </div>
               )}

               <div className="flex justify-end gap-2 pt-2">
                 <button type="button" onClick={() => setShowDeptModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded text-sm">{isHR ? 'Cancel' : 'Close'}</button>
                 {isHR && <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded text-sm">{deptForm.id ? 'Save Changes' : 'Create'}</button>}
               </div>
             </form>
           </div>
         </div>
       )}

       {/* --- PROJECT MODAL --- */}
       {showProjModal && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
             <h3 className="text-lg font-bold text-gray-800 mb-4">{isHR ? (projForm.id ? 'Edit Project' : 'Create Project') : 'Project Details'}</h3>
             <form onSubmit={handleProjSubmit} className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                 <input disabled={!isHR} required type="text" className={`w-full border rounded-lg p-2 text-sm ${!isHR ? 'bg-gray-50 text-gray-600' : ''}`} value={projForm.name} onChange={e => setProjForm({...projForm, name: e.target.value})} />
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                 <textarea disabled={!isHR} className={`w-full border rounded-lg p-2 text-sm ${!isHR ? 'bg-gray-50 text-gray-600' : ''}`} value={projForm.description} onChange={e => setProjForm({...projForm, description: e.target.value})} />
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                 <select disabled={!isHR} className={`w-full border rounded-lg p-2 text-sm ${!isHR ? 'bg-gray-50 text-gray-600 appearance-none' : ''}`} value={projForm.status} onChange={e => setProjForm({...projForm, status: e.target.value})}>
                   <option value="Active">Active</option>
                   <option value="On Hold">On Hold</option>
                   <option value="Completed">Completed</option>
                 </select>
               </div>

               {/* Predefined Tasks Management */}
               <div className="pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Predefined Tasks {isHR && "(Drag to reorder)"}</label>
                  <div className="bg-gray-50 rounded-lg p-3">
                     {isHR && (
                       <div className="flex gap-2 mb-3">
                          <input 
                             type="text" 
                             placeholder="Add task name..." 
                             className="flex-1 border rounded-lg p-2 text-sm"
                             value={newTaskInput}
                             onChange={e => setNewTaskInput(e.target.value)}
                             onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTaskToProject())}
                          />
                          <button type="button" onClick={addTaskToProject} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700">
                             <Plus size={16} />
                          </button>
                       </div>
                     )}
                     <div className="space-y-2 max-h-40 overflow-y-auto">
                        {projForm.tasks.map((task, idx) => (
                           <div 
                              key={idx} 
                              draggable={isHR}
                              onDragStart={(e) => isHR && handleDragStart(e, idx)}
                              onDragOver={(e) => isHR && handleDragOver(e, idx)}
                              onDrop={(e) => isHR && handleDrop(e, idx)}
                              className={`flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100 ${isHR ? 'cursor-grab active:cursor-grabbing' : ''}`}
                           >
                              <div className="flex items-center gap-2">
                                 {isHR && <GripVertical size={14} className="text-gray-300" />}
                                 <ListTodo size={14} className="text-gray-400" />
                                 <span className="text-sm text-gray-700">{task}</span>
                              </div>
                              {isHR && (
                                <button type="button" onClick={() => removeTaskFromProject(idx)} className="text-gray-400 hover:text-red-500 p-1">
                                   <X size={14} />
                                </button>
                              )}
                           </div>
                        ))}
                        {projForm.tasks.length === 0 && <span className="text-xs text-gray-400 italic">No tasks defined.</span>}
                     </div>
                  </div>
               </div>
               
               {/* Manage Team (Only when editing) */}
               {projForm.id && (
                  <div className="pt-2 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Assigned Team</label>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                       {/* Current Team */}
                       <div className="space-y-2 max-h-40 overflow-y-auto">
                          {employeesInCurrentProj.map(u => (
                             <div key={u.id} className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2">
                                   <img src={u.avatar} className="w-6 h-6 rounded-full"/>
                                   <span className="text-sm text-gray-700">{u.firstName} {u.lastName}</span>
                                </div>
                                {isHR && <button type="button" onClick={() => removeUserFromProj(u.id)} className="text-gray-400 hover:text-red-500 p-1"><X size={14} /></button>}
                             </div>
                          ))}
                          {employeesInCurrentProj.length === 0 && <span className="text-xs text-gray-400 italic">No team members assigned</span>}
                       </div>
                       
                       {/* Add Member */}
                       {isHR && (
                         <div className="flex gap-2">
                            <select 
                              className="flex-1 text-sm border rounded-lg p-1.5"
                              onChange={(e) => {
                                 if(e.target.value) { assignUserToProj(e.target.value); e.target.value = ''; }
                              }}
                            >
                               <option value="">+ Add Team Member...</option>
                               {availableEmployeesForProj.map(u => (
                                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                               ))}
                            </select>
                         </div>
                       )}
                    </div>
                  </div>
               )}

               <div className="flex justify-end gap-2 pt-2">
                 <button type="button" onClick={() => setShowProjModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded text-sm">{isHR ? 'Cancel' : 'Close'}</button>
                 {isHR && <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded text-sm">{projForm.id ? 'Save Changes' : 'Create'}</button>}
               </div>
             </form>
           </div>
         </div>
       )}

       {/* --- ALLOCATION MODAL --- */}
       {showAllocModal && selectedUser && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
               <h3 className="text-lg font-bold text-gray-800 mb-2">Edit Allocations</h3>
               <p className="text-sm text-gray-500 mb-4">Assign department and projects for <span className="font-semibold text-gray-800">{selectedUser.firstName} {selectedUser.lastName}</span>.</p>
               
               <div className="space-y-5">
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Department</label>
                     <select 
                        className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        value={allocForm.departmentId}
                        onChange={e => setAllocForm({ ...allocForm, departmentId: e.target.value })}
                     >
                        <option value="">Select Department...</option>
                        {departments.map(d => (
                           <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                     </select>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assigned Projects</label>
                     <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                        {projects.map(proj => (
                           <label key={proj.id} className={`flex items-center space-x-3 p-2 rounded cursor-pointer hover:bg-gray-50 ${allocForm.projectIds?.includes(proj.id) ? 'bg-emerald-50 border border-emerald-100' : ''}`}>
                              <input 
                                 type="checkbox" 
                                 checked={allocForm.projectIds?.includes(proj.id)}
                                 onChange={() => toggleProjectAlloc(proj.id)}
                                 className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <div className="flex-1">
                                 <span className="text-sm font-medium text-gray-700 block">{proj.name}</span>
                                 <span className="text-xs text-gray-400 block">{proj.status}</span>
                              </div>
                           </label>
                        ))}
                     </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                     <button onClick={() => setShowAllocModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                     <button onClick={confirmAllocation} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-medium shadow-sm">Save & Confirm</button>
                  </div>
               </div>
            </div>
         </div>
       )}
    </div>
  );
};

export default Organization;
