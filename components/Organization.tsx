
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Department, Project, Employee, Role } from '../types';
import { Briefcase, FolderPlus, Trash2, Building2, Users, Edit2, Layers, CheckCircle, Filter, Plus, Minus, X, ChevronLeft, ChevronRight, Network, MapPin, BadgeCheck, Eye, AlertTriangle, Save, Shield, ListTodo } from 'lucide-react';
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
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate mb-1">{node.jobTitle || node.role}</p>
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
                content: `<div class="p-2"><p><b>Role:</b> ${u.jobTitle || u.role}</p><p><b>Department:</b> ${u.department}</p><hr class="my-2" /><p class="text-xs text-slate-500">${u.location.address}</p></div>`
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

const Organization = () => {
  const { 
    currentUser, departments, projects, users, notify, updateUser, 
    addDepartment, updateDepartment, deleteDepartment, 
    roles, addRole, updateRole, deleteRole, 
    employees, addEmployee, updateEmployee, deleteEmployee,
    addProject, updateProject, deleteProject
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'roles' | 'projects' | 'allocations' | 'chart' | 'locations'>('departments');
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showProjModal, setShowProjModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showConfirmAlloc, setShowConfirmAlloc] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  
  const [deptForm, setDeptForm] = useState<any>({ name: '', description: '', managerId: '' });
  const [roleForm, setRoleForm] = useState<any>({ id: '', name: '', description: '' });
  const [projForm, setProjForm] = useState<any>({ id: '', name: '', description: '', status: 'Active', tasksString: '' });
  
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [allocForm, setAllocForm] = useState<any>({ departmentId: '', projectIds: [] });
  
  const orgTreeData = useMemo(() => buildOrgTree(employees), [employees]);
  const isHR = currentUser?.role === UserRole.HR;
  const canEditAllocations = true; 

  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  // --- Handlers for Projects ---
  const handleProjSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tasks = projForm.tasksString.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
    const data = { name: projForm.name, description: projForm.description, status: projForm.status, tasks };
    
    if (projForm.id) {
      updateProject(projForm.id, data);
    } else {
      addProject(data as any);
    }
    setShowProjModal(false);
  };

  const openProjEdit = (p: Project) => {
    setProjForm({
      id: p.id,
      name: p.name,
      description: p.description || '',
      status: p.status,
      tasksString: (p.tasks || []).join(', ')
    });
    setShowProjModal(true);
  };

  // --- Handlers for Roles ---
  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roleForm.id) {
      updateRole(roleForm.id, { name: roleForm.name, description: roleForm.description });
    } else {
      addRole({ name: roleForm.name, description: roleForm.description });
    }
    setShowRoleModal(false);
  };

  const openRoleEdit = (r: Role) => {
    setRoleForm(r);
    setShowRoleModal(true);
  };

  const toggleProjectInAlloc = (projId: string | number) => {
    setAllocForm((prev: any) => {
      const current = prev.projectIds || [];
      const exists = current.includes(projId);
      if (exists) return { ...prev, projectIds: current.filter((id: any) => id !== projId) };
      return { ...prev, projectIds: [...current, projId] };
    });
  };

  const handleAllocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmAlloc(true);
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

       {/* Project Modal */}
       <DraggableModal isOpen={showProjModal} onClose={() => setShowProjModal(false)} title={projForm.id ? "Edit Project" : "Add Project"} width="max-w-md">
          <form onSubmit={handleProjSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Project Name</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" value={projForm.name} onChange={e => setProjForm({...projForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                <textarea className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" rows={2} value={projForm.description} onChange={e => setProjForm({...projForm, description: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Status</label>
                <select className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" value={projForm.status} onChange={e => setProjForm({...projForm, status: e.target.value as any})}>
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tasks (Comma Separated)</label>
                <input type="text" className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" placeholder="Analysis, Design, Implementation..." value={projForm.tasksString} onChange={e => setProjForm({...projForm, tasksString: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                <button type="button" onClick={() => setShowProjModal(false)} className="px-4 py-2 text-slate-400 font-bold uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold uppercase tracking-widest">Save Project</button>
              </div>
          </form>
       </DraggableModal>

       {/* Role Modal */}
       <DraggableModal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} title={roleForm.id ? "Edit Role" : "Add Role"} width="max-w-md">
          <form onSubmit={handleRoleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Role Name</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" value={roleForm.name} onChange={e => setRoleForm({...roleForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                <textarea required className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" rows={3} value={roleForm.description} onChange={e => setRoleForm({...roleForm, description: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                <button type="button" onClick={() => setShowRoleModal(false)} className="px-4 py-2 text-slate-400 font-bold uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold uppercase tracking-widest">Save Role</button>
              </div>
          </form>
       </DraggableModal>

       {/* Edit Allocations Modal */}
       <DraggableModal isOpen={showAllocModal} onClose={() => setShowAllocModal(false)} title="Update Assignment" width="max-w-md">
          <form onSubmit={handleAllocSubmit} className="space-y-6">
              {selectedUser && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 mb-4">
                  <img src={selectedUser.avatar} className="w-10 h-10 rounded-full" alt="" />
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{selectedUser.firstName} {selectedUser.lastName}</p>
                    <p className="text-xs text-slate-500">{selectedUser.role}</p>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Target Department</label>
                <select 
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-700 bg-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  value={allocForm.departmentId}
                  onChange={e => setAllocForm({...allocForm, departmentId: e.target.value})}
                  required
                >
                  <option value="" disabled>Choose Department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Project Assignments</label>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
                  {projects.map(p => (
                    <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-800 rounded transition-colors cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        checked={allocForm.projectIds.includes(p.id)}
                        onChange={() => toggleProjectInAlloc(p.id)}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">{p.status}</p>
                      </div>
                    </label>
                  ))}
                  {projects.length === 0 && <p className="text-xs text-slate-400 italic p-2 text-center">No projects available to assign.</p>}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                <button type="button" onClick={() => setShowAllocModal(false)} className="px-4 py-2 text-slate-500 text-sm font-bold uppercase tracking-widest">Cancel</button>
                <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition flex items-center gap-2 uppercase tracking-widest">
                  <Save size={16} /> Save Changes
                </button>
              </div>
          </form>
       </DraggableModal>

       <DraggableModal isOpen={showConfirmAlloc} onClose={() => setShowConfirmAlloc(false)} title="Confirm Assignment" width="max-w-sm">
          <div className="text-center p-2">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-100 dark:border-emerald-800">
                <CheckCircle size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-widest">Execute Update?</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">This will overwrite current department and project links for <b>{selectedUser?.firstName}</b>.</p>
              <div className="flex justify-end gap-3">
                 <button onClick={() => setShowConfirmAlloc(false)} className="px-4 py-2 text-slate-400 font-bold uppercase tracking-widest text-xs">Abort</button>
                 <button onClick={finalizeAllocation} className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all uppercase tracking-widest">Confirm & Save</button>
              </div>
           </div>
       </DraggableModal>

       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Organization</h2><p className="text-sm text-slate-500 dark:text-slate-400">Manage structure, hierarchy and geographical presence.</p></div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto">
             {['departments', 'roles', 'projects', 'chart', 'allocations', 'locations', 'employees'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap capitalize ${activeTab === tab ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>{tab === 'chart' ? 'Org Chart' : tab === 'locations' ? 'Map View' : tab}</button>
             ))}
          </div>
       </div>

       {activeTab === 'employees' && <EmployeeList employees={employees} onAddEmployee={addEmployee} onUpdateEmployee={updateEmployee} onDeleteEmployee={deleteEmployee} />}
       
       {activeTab === 'locations' && <div className="space-y-4"><h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><MapPin className="text-emerald-600" /> Employee Geographical View</h3><GraphicsLayerMap users={users} /></div>}
       
       {activeTab === 'chart' && <div className="bg-slate-50 dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"><div className="p-8 overflow-auto min-h-[500px] flex justify-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">{orgTreeData.length === 0 ? <p className="text-slate-400">No data.</p> : <div className="org-tree"><ul>{orgTreeData.map(node => <OrgChartNode key={node.id} node={node} />)}</ul></div>}</div></div>}
       
       {activeTab === 'departments' && <div className="space-y-4"><div className="flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Building2 className="text-emerald-600" /> Departments</h3>{(currentUser?.role === UserRole.HR) && <button onClick={() => { setDeptForm({ name: '', description: '', managerId: '' }); setShowDeptModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2"><Plus size={16} /> Add Dept</button>}</div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{departments.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage).map(dept => (<div key={dept.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition cursor-pointer" onClick={() => { setDeptForm(dept); setShowDeptModal(true); }}><div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4"><Building2 size={20} /></div><h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{dept.name}</h4><p className="text-sm text-slate-500 h-10 line-clamp-2">{dept.description}</p></div>))}</div><PaginationControls total={departments.length} /></div>}
       
       {activeTab === 'roles' && (
         <div className="space-y-4">
           <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Shield className="text-emerald-600" size={20} /> Company Roles
              </h3>
              {isHR && (
                <button 
                  onClick={() => { setRoleForm({ id: '', name: '', description: '' }); setShowRoleModal(true); }} 
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2"
                >
                  <Plus size={16} /> Add Role
                </button>
              )}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {roles.map(role => (
               <div key={role.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition flex flex-col justify-between group">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <Users size={20} />
                      </div>
                      {isHR && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => openRoleEdit(role)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded">
                              <Edit2 size={14} />
                           </button>
                           <button onClick={() => deleteRole(role.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded">
                              <Trash2 size={14} />
                           </button>
                        </div>
                      )}
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{role.name}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{role.description}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-50 dark:border-slate-700 text-[10px] text-slate-400 font-bold uppercase">
                     Security Level: Standard
                  </div>
               </div>
             ))}
           </div>
         </div>
       )}

       {activeTab === 'projects' && (
         <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Briefcase className="text-emerald-600" size={20} /> Active Projects
              </h3>
              {isHR && (
                <button 
                  onClick={() => { setProjForm({ id: '', name: '', description: '', status: 'Active', tasksString: '' }); setShowProjModal(true); }} 
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2"
                >
                  <Plus size={16} /> Add Project
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(project => (
                <div key={project.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
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
                      {isHR && (
                        <button onClick={() => deleteProject(project.id)} className="p-1 text-slate-300 hover:text-red-500">
                          <Trash2 size={12}/>
                        </button>
                      )}
                    </div>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{project.name}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 h-10 line-clamp-2 mb-4">{project.description}</p>
                  <div className="flex justify-between items-center pt-4 border-t border-slate-50 dark:border-slate-700">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                      <ListTodo size={10}/> Tasks: {project.tasks?.length || 0}
                    </div>
                    {isHR && (
                      <button 
                        onClick={() => openProjEdit(project)}
                        className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 text-xs font-bold flex items-center gap-1"
                      >
                        <Edit2 size={12}/> <span>Edit Project</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {projects.length === 0 && (
              <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <Briefcase size={40} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-400">No project nodes found in registry.</p>
              </div>
            )}
         </div>
       )}

       {activeTab === 'allocations' && <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700"><tr><th className="px-6 py-4">Employee</th><th className="px-6 py-4">Department</th><th className="px-6 py-4">Projects</th><th className="px-6 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{users.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage).map(user => { const userDept = departments.find(d => d.id === user.departmentId); const userProjects = projects.filter(p => user.projectIds?.includes(p.id)); return (<tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"><td className="px-6 py-4"><div className="flex items-center gap-3"><img src={user.avatar} className="w-8 h-8 rounded-full border border-slate-100 dark:border-slate-600" /><div><p className="text-sm font-bold text-slate-800 dark:text-white">{user.firstName} {user.lastName}</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{user.role}</p></div></div></td><td className="px-6 py-4"><span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full uppercase tracking-widest">{userDept?.name || '-'}</span></td><td className="px-6 py-4"><div className="flex flex-wrap gap-1">{userProjects.map(p => (<span key={p.id} className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase tracking-tight border border-blue-100 dark:border-blue-800">{p.name}</span>))}</div></td><td className="px-6 py-4 text-right">{canEditAllocations && <button onClick={() => { setSelectedUser(user as unknown as Employee); setAllocForm({ departmentId: user.departmentId || '', projectIds: user.projectIds || [] }); setShowAllocModal(true); }} className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 text-xs font-bold flex items-center gap-1 justify-end ml-auto"><Edit2 size={12}/> <span>Edit Alloc</span></button>}</td></tr>); })}</tbody></table></div><PaginationControls total={users.length} /></div>}
    </div>
  );
};

export default Organization;
