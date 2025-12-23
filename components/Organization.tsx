
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Department, Project, Employee, Role, Position } from '../types';
import { Briefcase, FolderPlus, Trash2, Building2, Users, Edit2, Layers, CheckCircle, Filter, Plus, Minus, X, ChevronLeft, ChevronRight, Network, MapPin, BadgeCheck, Eye, AlertTriangle, Save, Shield, ListTodo, UserSquare, Search, CheckCircle2 } from 'lucide-react';
import EmployeeList from './EmployeeList';
import DraggableModal from './DraggableModal';

interface TreeNode extends Employee {
  children: TreeNode[];
}

const buildOrgTree = (employees: Employee[]): TreeNode[] => {
  const empMap: Record<string, TreeNode> = {};
  employees.forEach(emp => { empMap[emp.id] = { ...emp, children: [] }; });
  const roots: TreeNode[] = [];
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

const OrgChartNode: React.FC<{ node: TreeNode }> = ({ node }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div className="flex flex-col items-center relative">
        <div className="org-node-card group bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all w-48 relative z-10">
           <div className="flex flex-col items-center">
             <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-100 dark:border-slate-700 mb-2">
                <img src={node.avatar} alt={node.firstName} className="w-full h-full object-cover" />
             </div>
             <div className="text-center w-full">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{node.firstName} {node.lastName}</h4>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate mb-1">{node.position || node.role}</p>
                {node.department && <span className="inline-block text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full">{node.department}</span>}
             </div>
           </div>
        </div>
        {hasChildren && (
          <button onClick={() => setExpanded(!expanded)} className="absolute -bottom-3 z-20 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-300 hover:text-emerald-600 rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
            {expanded ? <Minus size={12} /> : <Plus size={12} />}
          </button>
        )}
      </div>
      {hasChildren && expanded && <ul className="animate-in fade-in slide-in-from-top-2 duration-300">{node.children.map(child => <OrgChartNode key={child.id} node={child} />)}</ul>}
    </li>
  );
};

const GraphicsLayerMap: React.FC<{ users: Employee[] }> = ({ users }) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let view: any = null;
    let cleanup = false;

    const loadArcGIS = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.require) { resolve(); return; }
        const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://js.arcgis.com/4.29/esri/themes/light/main.css'; document.head.appendChild(link);
        const script = document.createElement('script'); script.src = 'https://js.arcgis.com/4.29/'; script.async = true; script.onload = () => resolve(); script.onerror = (e) => reject(e); document.body.appendChild(script);
      });
    };

    const initMap = async () => {
      try {
        await loadArcGIS();
        if (cleanup || !mapDiv.current) return;
        window.require([
          "esri/Map", "esri/views/MapView", "esri/Graphic", "esri/layers/GraphicsLayer", 
          "esri/widgets/BasemapGallery", "esri/widgets/Expand"
        ], (EsriMap: any, MapView: any, Graphic: any, GraphicsLayer: any, BasemapGallery: any, Expand: any) => {
          if (cleanup) return;
          const map = new EsriMap({ basemap: "topo-vector" });
          const employeeLayer = new GraphicsLayer({ title: "Employees" });
          map.add(employeeLayer);
          users.forEach(u => {
            if (u.location && u.location.latitude && u.location.longitude) {
              const point = { type: "point", longitude: u.location.longitude, latitude: u.location.latitude };
              const markerSymbol = { type: "simple-marker", color: [220, 38, 38, 1], size: "10px", outline: { color: [255, 255, 255], width: 2 } };
              const popupTemplate = {
                title: `${u.firstName} ${u.lastName}`,
                content: `<div class="p-2"><p><b>Position:</b> ${u.position || u.role}</p><p><b>Department:</b> ${u.department}</p><hr class="my-2" /><p class="text-xs text-slate-500">${u.location.address}</p></div>`
              };
              employeeLayer.add(new Graphic({ geometry: point, symbol: markerSymbol, popupTemplate: popupTemplate }));
            }
          });
          view = new MapView({
            container: mapDiv.current, map: map, center: [78.9629, 20.5937], zoom: 4,
            popup: { dockEnabled: true, dockOptions: { buttonEnabled: true, breakpoint: false } }
          });
          const bgExpand = new Expand({ view: view, content: new BasemapGallery({ view: view }), expandIconClass: "esri-icon-basemap" });
          view.ui.add(bgExpand, "top-right");
          view.when(() => { if (!cleanup) setIsMapLoaded(true); }, () => { setMapError("Map initialization failed."); });
        });
      } catch (e) { setMapError("ArcGIS failed to load."); }
    };
    initMap();
    return () => { cleanup = true; if (view) view.destroy(); };
  }, [users]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-[600px] relative">
       {mapError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
              <AlertTriangle size={48} className="text-red-500 mb-4" />
              <h4 className="font-bold text-slate-800 dark:text-white">Connection Error</h4>
              <p className="text-slate-500 text-sm mt-2">{mapError}</p>
          </div>
       ) : (
          <>
            <div ref={mapDiv} className="w-full h-full"></div>
            {!isMapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900 z-10">
                    <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
          </>
       )}
    </div>
  );
};

const EmployeePicker: React.FC<{ 
  selectedIds: (string | number)[], 
  onToggle: (id: string | number) => void,
  allEmployees: Employee[]
}> = ({ selectedIds, onToggle, allEmployees }) => {
  const [query, setQuery] = useState('');
  
  const filtered = useMemo(() => {
    return allEmployees.filter(e => 
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
      (e.position || '').toLowerCase().includes(query.toLowerCase())
    );
  }, [allEmployees, query]);

  return (
    <div className="space-y-3">
       <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search employees to assign..." 
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
       </div>
       <div className="max-h-60 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-700 rounded-xl divide-y divide-slate-50 dark:divide-slate-700/50">
          {filtered.map(emp => {
            const isSelected = selectedIds.includes(emp.id);
            return (
              <div 
                key={emp.id} 
                onClick={() => onToggle(emp.id)}
                className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              >
                <div className="flex items-center gap-3">
                  <img src={emp.avatar} className="w-8 h-8 rounded-full border border-slate-100 dark:border-slate-600 shadow-sm" alt="" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-none mb-1">{emp.firstName} {emp.lastName}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-tight">{emp.position || emp.role}</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-600 border-emerald-600 scale-110' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
                  {isSelected && <CheckCircle2 size={12} className="text-white" />}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs italic">No matching employees found.</div>
          )}
       </div>
       <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedIds.length} Selected</span>
          {selectedIds.length > 0 && (
            <button onClick={(e) => { e.preventDefault(); selectedIds.forEach(id => onToggle(id)); }} className="text-[10px] font-bold text-red-500 hover:underline uppercase tracking-widest">Clear All</button>
          )}
       </div>
    </div>
  );
};

const Organization = () => {
  const { 
    currentUser, departments, projects, users, notify, updateUser, 
    addDepartment, updateDepartment, deleteDepartment, 
    positions, addPosition, updatePosition, deletePosition,
    employees, addEmployee, updateEmployee, deleteEmployee,
    addProject, updateProject, deleteProject
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'positions' | 'projects' | 'allocations' | 'chart' | 'locations'>('departments');
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showPosModal, setShowPosModal] = useState(false);
  const [showProjModal, setShowProjModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showConfirmAlloc, setShowConfirmAlloc] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  
  const [deptForm, setDeptForm] = useState<any>({ id: '', name: '', description: '', managerId: '', employeeIds: [] });
  const [posForm, setPosForm] = useState<any>({ id: '', title: '', description: '' });
  const [projForm, setProjForm] = useState<any>({ id: '', name: '', description: '', status: 'Active', tasksString: '', employeeIds: [] });
  
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [allocForm, setAllocForm] = useState<any>({ departmentId: '', projectIds: [] });
  
  const orgTreeData = useMemo(() => buildOrgTree(employees), [employees]);
  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;

  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  // --- Submission Handlers with assignment logic ---

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetDeptId = deptForm.id;
    
    // 1. Create or Update Department
    if (deptForm.id) {
      await updateDepartment(deptForm.id, { name: deptForm.name, description: deptForm.description, managerId: deptForm.managerId });
    } else {
      const newId = Math.random().toString(36).substr(2, 9);
      await addDepartment({ id: newId, name: deptForm.name, description: deptForm.description, managerId: deptForm.managerId } as any);
      targetDeptId = newId;
    }

    // 2. Batch Update Employee Assignments
    // We update employees concurrently where possible
    const updates = employees.map(emp => {
      const isSelected = deptForm.employeeIds.includes(emp.id);
      const currentlyInDept = String(emp.departmentId) === String(targetDeptId);
      
      if (isSelected && !currentlyInDept) {
        return updateUser(emp.id, { departmentId: targetDeptId, department: deptForm.name });
      } else if (!isSelected && currentlyInDept) {
        return updateUser(emp.id, { departmentId: '', department: 'General' });
      }
      return null;
    }).filter(p => p !== null);

    await Promise.all(updates);
    
    notify(`Department ${deptForm.name} saved and ${deptForm.employeeIds.length} members assigned.`);
    setShowDeptModal(false);
  };

  const handlePosSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (posForm.id) {
      updatePosition(posForm.id, { title: posForm.title, description: posForm.description });
    } else {
      addPosition({ title: posForm.title, description: posForm.description });
    }
    setShowPosModal(false);
  };

  const handleProjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tasks = projForm.tasksString.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
    let targetProjId = projForm.id;

    if (projForm.id) {
      await updateProject(projForm.id, { name: projForm.name, description: projForm.description, status: projForm.status, tasks });
    } else {
      const newId = Math.random().toString(36).substr(2, 9);
      await addProject({ id: newId, name: projForm.name, description: projForm.description, status: projForm.status, tasks } as any);
      targetProjId = newId;
    }

    // 2. Batch Update Employee Project Assignments
    const updates = employees.map(emp => {
      const isSelected = projForm.employeeIds.includes(emp.id);
      const currentProjects = emp.projectIds || [];
      const hasProject = currentProjects.includes(targetProjId);

      if (isSelected && !hasProject) {
        return updateUser(emp.id, { projectIds: [...currentProjects, targetProjId] });
      } else if (!isSelected && hasProject) {
        return updateUser(emp.id, { projectIds: currentProjects.filter(id => String(id) !== String(targetProjId)) });
      }
      return null;
    }).filter(p => p !== null);

    await Promise.all(updates);
    
    notify(`Project ${projForm.name} updated. ${projForm.employeeIds.length} members assigned.`);
    setShowProjModal(false);
  };

  // Fix: Added openPosEdit helper function
  const openPosEdit = (pos: Position) => {
    setPosForm({ id: pos.id, title: pos.title, description: pos.description });
    setShowPosModal(true);
  };

  // Fix: Added openProjEdit helper function
  const openProjEdit = (proj: Project & { employeeIds: (string | number)[] }) => {
    setProjForm({
      id: proj.id,
      name: proj.name,
      description: proj.description || '',
      status: proj.status,
      tasksString: (proj.tasks || []).join(', '),
      employeeIds: proj.employeeIds || []
    });
    setShowProjModal(true);
  };

  const toggleEmpInForm = (formType: 'dept' | 'proj', empId: string | number) => {
    const setter = formType === 'dept' ? setDeptForm : setProjForm;
    setter((prev: any) => {
      const current = prev.employeeIds || [];
      const exists = current.includes(empId);
      if (exists) return { ...prev, employeeIds: current.filter((id: any) => id !== empId) };
      return { ...prev, employeeIds: [...current, empId] };
    });
  };

  const finalizeAllocation = () => {
    if (selectedUser) {
       updateUser(selectedUser.id, { departmentId: allocForm.departmentId, projectIds: allocForm.projectIds });
       notify(`Assignment updated for ${selectedUser.firstName}.`);
       setShowConfirmAlloc(false);
       setShowAllocModal(false);
       setSelectedUser(null);
    }
  };

  const PaginationControls = ({ total }: { total: number }) => {
    const totalPages = Math.ceil(total / itemsPerPage);
    if (total === 0) return null;
    return (
      <div className="flex justify-between items-center p-4 pt-6 border-t border-slate-200 dark:border-slate-700">
         <span className="text-xs text-slate-500">Showing {Math.min(total, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(total, currentPage * itemsPerPage)} of {total}</span>
         <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><ChevronLeft size={16} /></button>
            <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><ChevronRight size={16} /></button>
         </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
       <style>{`.org-tree ul{padding-top:20px;position:relative;display:flex;justify-content:center}.org-tree li{float:left;text-align:center;list-style-type:none;position:relative;padding:20px 5px 0 5px}.org-tree li::before,.org-tree li::after{content:'';position:absolute;top:0;right:50%;border-top:1px solid #cbd5e1;width:50%;height:20px}.org-tree li::after{right:auto;left:50%;border-left:1px solid #cbd5e1}.org-tree li:first-child::before,.org-tree li:last-child::after{border:0 none}.org-tree li:only-child::after,.org-tree li:only-child::before{display:none}.org-tree li:only-child{padding-top:0}.org-tree ul ul::before{content:'';position:absolute;top:0;left:50%;border-left:1px solid #cbd5e1;width:0;height:20px}`}</style>

       {/* Department Modal */}
       <DraggableModal isOpen={showDeptModal} onClose={() => setShowDeptModal(false)} title={deptForm.id ? "Edit Department" : "Add Department"} width="max-w-2xl">
          <form onSubmit={handleDeptSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Dept Name</label>
                      <input required type="text" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" placeholder="e.g. GIS Development" value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                      <textarea required className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" rows={3} placeholder="Department goals..." value={deptForm.description} onChange={e => setDeptForm({...deptForm, description: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Manager</label>
                      <select required className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" value={deptForm.managerId} onChange={e => setDeptForm({...deptForm, managerId: e.target.value})}>
                        <option value="" disabled>Select Head...</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Assign Members</label>
                    <EmployeePicker 
                      selectedIds={deptForm.employeeIds} 
                      onToggle={(id) => toggleEmpInForm('dept', id)} 
                      allEmployees={employees}
                    />
                  </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                <button type="button" onClick={() => setShowDeptModal(false)} className="px-6 py-2.5 text-slate-400 font-bold uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" className="bg-emerald-600 text-white px-8 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">Save Department</button>
              </div>
          </form>
       </DraggableModal>

       {/* Position Modal */}
       <DraggableModal isOpen={showPosModal} onClose={() => setShowPosModal(false)} title={posForm.id ? "Edit Position" : "Add Position"} width="max-w-md">
          <form onSubmit={handlePosSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Position Title</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" placeholder="e.g. Senior Developer" value={posForm.title} onChange={e => setPosForm({...posForm, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                <textarea required className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" rows={3} placeholder="Define key responsibilities..." value={posForm.description} onChange={e => setPosForm({...posForm, description: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                <button type="button" onClick={() => setShowPosModal(false)} className="px-4 py-2 text-slate-400 font-bold uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold uppercase tracking-widest">Save Position</button>
              </div>
          </form>
       </DraggableModal>

       {/* Project Modal */}
       <DraggableModal isOpen={showProjModal} onClose={() => setShowProjModal(false)} title={projForm.id ? "Edit Project" : "Add Project"} width="max-w-2xl">
          <form onSubmit={handleProjSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Project Name</label>
                      <input required type="text" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" value={projForm.name} onChange={e => setProjForm({...projForm, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                      <textarea className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" rows={2} value={projForm.description} onChange={e => setProjForm({...projForm, description: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Status</label>
                      <select className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" value={projForm.status} onChange={e => setProjForm({...projForm, status: e.target.value as any})}>
                        <option value="Active">Active</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tasks (Comma Separated)</label>
                      <input type="text" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Analysis, Design, Implementation..." value={projForm.tasksString} onChange={e => setProjForm({...projForm, tasksString: e.target.value})} />
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Project Team Members</label>
                    <EmployeePicker 
                      selectedIds={projForm.employeeIds} 
                      onToggle={(id) => toggleEmpInForm('proj', id)} 
                      allEmployees={employees}
                    />
                  </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                <button type="button" onClick={() => setShowProjModal(false)} className="px-4 py-2 text-slate-400 font-bold uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" className="bg-emerald-600 text-white px-8 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">Save Project</button>
              </div>
          </form>
       </DraggableModal>

       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Organization</h2><p className="text-sm text-slate-500 dark:text-slate-400">Manage structure, hierarchy and job roles.</p></div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto">
             {['departments', 'positions', 'projects', 'chart', 'allocations', 'locations', 'employees'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap capitalize ${activeTab === tab ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>{tab === 'chart' ? 'Org Chart' : tab === 'locations' ? 'Map View' : tab}</button>
             ))}
          </div>
       </div>

       {activeTab === 'employees' && <EmployeeList employees={employees} onAddEmployee={addEmployee} onUpdateEmployee={updateEmployee} onDeleteEmployee={deleteEmployee} />}
       
       {activeTab === 'locations' && <div className="space-y-4"><GraphicsLayerMap users={users} /></div>}
       
       {activeTab === 'chart' && <div className="bg-slate-50 dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"><div className="p-8 overflow-auto min-h-[500px] flex justify-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">{orgTreeData.length === 0 ? <p className="text-slate-400">No data.</p> : <div className="org-tree"><ul>{orgTreeData.map(node => <OrgChartNode key={node.id} node={node} />)}</ul></div>}</div></div>}
       
       {activeTab === 'departments' && <div className="space-y-4"><div className="flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Building2 className="text-emerald-600" /> Departments</h3>{isPowerUser && <button onClick={() => { setDeptForm({ id: '', name: '', description: '', managerId: '', employeeIds: [] }); setShowDeptModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2"><Plus size={16} /> Add Dept</button>}</div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{departments.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage).map(dept => (<div key={dept.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition cursor-pointer" onClick={() => { const deptMembers = employees.filter(e => String(e.departmentId) === String(dept.id)).map(e => e.id); setDeptForm({ ...dept, employeeIds: deptMembers }); setShowDeptModal(true); }}><div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4"><Building2 size={20} /></div><h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{dept.name}</h4><p className="text-sm text-slate-500 h-10 line-clamp-2">{dept.description}</p></div>))}</div><PaginationControls total={departments.length} /></div>}
       
       {activeTab === 'positions' && (
         <div className="space-y-4">
           <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <UserSquare className="text-emerald-600" size={20} /> Job Positions
              </h3>
              {isPowerUser && (
                <button 
                  onClick={() => { setPosForm({ id: '', title: '', description: '' }); setShowPosModal(true); }} 
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all"
                >
                  <Plus size={16} /> Add Position
                </button>
              )}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {positions.map(pos => (
               <div key={pos.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition flex flex-col justify-between group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 dark:bg-emerald-900/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 relative z-10">
                        <UserSquare size={20} />
                      </div>
                      {isPowerUser && (
                        <div className="flex gap-1 relative z-10">
                           <button onClick={() => openPosEdit(pos)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded bg-white dark:bg-slate-700 shadow-sm border">
                              <Edit2 size={14} />
                           </button>
                           <button onClick={() => deletePosition(pos.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-white dark:bg-slate-700 shadow-sm border">
                              <Trash2 size={14} />
                           </button>
                        </div>
                      )}
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1 relative z-10">{pos.title}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-3 relative z-10">{pos.description}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-50 dark:border-slate-700 text-[10px] text-slate-400 font-bold uppercase tracking-widest relative z-10">
                     Active Designation
                  </div>
               </div>
             ))}
             {positions.length === 0 && (
                <div className="col-span-full py-16 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <UserSquare size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">No positions defined in the registry.</p>
                    {isPowerUser && <button onClick={() => setShowPosModal(true)} className="mt-4 text-emerald-600 font-bold hover:underline">Create first position</button>}
                </div>
             )}
           </div>
         </div>
       )}

       {activeTab === 'projects' && (
         <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Briefcase className="text-emerald-600" size={20} /> Active Projects
              </h3>
              {isPowerUser && (
                <button 
                  onClick={() => { setProjForm({ id: '', name: '', description: '', status: 'Active', tasksString: '', employeeIds: [] }); setShowProjModal(true); }} 
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2"
                >
                  <Plus size={16} /> Add Project
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(project => (
                <div key={project.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition cursor-pointer" onClick={() => { const projMembers = employees.filter(e => e.projectIds?.includes(project.id)).map(e => e.id); openProjEdit({ ...project, employeeIds: projMembers } as any); }}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Briefcase size={20} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${
                        project.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 
                        project.status === 'On Hold' ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' : 
                        'bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                      }`}>
                        {project.status}
                      </span>
                      {isPowerUser && (
                        <button onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }} className="p-1 text-slate-300 hover:text-red-500">
                          <Trash2 size={12}/>
                        </button>
                      )}
                    </div>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{project.name}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 h-10 line-clamp-2 mb-4">{project.description}</p>
                  <div className="pt-3 border-t border-slate-50 dark:border-slate-700/50 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{employees.filter(e => e.projectIds?.includes(project.id)).length} Members</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">Edit Project &raquo;</span>
                  </div>
                </div>
              ))}
            </div>
         </div>
       )}

       {activeTab === 'allocations' && <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700"><tr><th className="px-6 py-4">Employee</th><th className="px-6 py-4">Department</th><th className="px-6 py-4">Projects</th><th className="px-6 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{users.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage).map(user => { const userDept = departments.find(d => d.id === user.departmentId); const userProjects = projects.filter(p => user.projectIds?.includes(p.id)); return (<tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"><td className="px-6 py-4"><div className="flex items-center gap-3"><img src={user.avatar} className="w-8 h-8 rounded-full border border-slate-100 dark:border-slate-600" /><div><p className="text-sm font-bold text-slate-800 dark:text-white">{user.firstName} {user.lastName}</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{user.position || user.role}</p></div></div></td><td className="px-6 py-4"><span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full uppercase tracking-widest">{userDept?.name || '-'}</span></td><td className="px-6 py-4"><div className="flex flex-wrap gap-1">{userProjects.map(p => (<span key={p.id} className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase tracking-tight border border-blue-100 dark:border-blue-800">{p.name}</span>))}</div></td><td className="px-6 py-4 text-right">{isPowerUser && <button onClick={() => { setSelectedUser(user as unknown as Employee); setAllocForm({ departmentId: user.departmentId || '', projectIds: user.projectIds || [] }); setShowAllocModal(true); }} className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 text-xs font-bold flex items-center gap-1 justify-end ml-auto"><Edit2 size={12}/> <span>Edit Alloc</span></button>}</td></tr>); })}</tbody></table></div><PaginationControls total={users.length} /></div>}
    </div>
  );
};

export default Organization;
