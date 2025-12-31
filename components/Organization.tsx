
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Project, Employee, Position } from '../types';
import { Briefcase, Trash2, Edit2, Users, Plus, X, ChevronLeft, ChevronRight, Network, MapPin, AlertTriangle, ListTodo, UserSquare, Search, CheckCircle2, Layout, ZoomIn, ZoomOut, RefreshCw, Maximize2, Calendar, Move, CheckCircle, Minus } from 'lucide-react';
import EmployeeList from './EmployeeList';
import DraggableModal from './DraggableModal';

interface TreeNode extends Employee {
  children: TreeNode[];
}

const buildOrgTree = (employees: Employee[]): TreeNode[] => {
  const empMap: Record<string, TreeNode> = {};
  
  // Defensive: Filter out any invalid employees first
  const validEmployees = employees.filter(emp => emp && emp.id);
  
  validEmployees.forEach(emp => { 
    empMap[String(emp.id)] = { ...emp, children: [] }; 
  });
  
  const roots: TreeNode[] = [];

  validEmployees.forEach(emp => {
    const node = empMap[String(emp.id)];
    const empManagerIdStr = emp.managerId ? String(emp.managerId) : null;
    
    if (empManagerIdStr && empMap[empManagerIdStr]) {
        empMap[empManagerIdStr].children.push(node);
    } else {
        roots.push(node);
    }
  });

  return roots.filter(root => {
      const isActuallyAChild = validEmployees.some(e => 
          e.managerId && String(e.id) === String(root.id) && empMap[String(e.managerId)]
      );
      return !isActuallyAChild;
  });
};

const OrgChartNode: React.FC<{ node: TreeNode }> = ({ node }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  
  return (
    <li>
      <div className="flex flex-col items-center relative pb-6">
        <div className="org-node-card group bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-teal-500/50 transition-all w-36 relative z-10">
           <div className="flex flex-col items-center">
             <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-50 dark:border-slate-700 mb-1.5 shadow-sm group-hover:scale-110 transition-transform bg-slate-100">
                <img src={node.avatar || `https://ui-avatars.com/api/?name=${node.firstName}+${node.lastName}`} alt={node.firstName} className="w-full h-full object-cover" />
             </div>
             <div className="text-center w-full min-w-0">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[11px] tracking-tight leading-tight truncate px-1" title={`${node.firstName} ${node.lastName}`}>
                    {node.firstName} {node.lastName}
                </h4>
                <p className="text-[8px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider mt-0.5 mb-1 truncate px-1">
                    {node.position || 'Team Member'}
                </p>
             </div>
           </div>
        </div>

        {hasChildren && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <div className="w-px h-3 bg-slate-300 dark:bg-slate-600 mb-0.5"></div>
            <button 
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} 
              className={`flex items-center justify-center w-4 h-4 rounded-full border bg-white dark:bg-slate-700 shadow-sm transition-all hover:scale-110 ${expanded ? 'border-teal-500 text-teal-600' : 'border-slate-300 text-slate-400'}`}
            >
              {expanded ? <Minus size={8} strokeWidth={4} /> : <Plus size={8} strokeWidth={4} />}
            </button>
          </div>
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

const GraphicsLayerMap: React.FC<{ users: Employee[] }> = ({ users }) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let view: any = null;
    let cleanup = false;
    const loadArcGIS = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).require) { resolve(); return; }
        const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://js.arcgis.com/4.29/esri/themes/light/main.css'; document.head.appendChild(link);
        const script = document.createElement('script'); script.src = 'https://js.arcgis.com/4.29/'; script.async = true; script.onload = () => resolve(); script.onerror = (e) => reject(e); document.body.appendChild(script);
      });
    };
    const initMap = async () => {
      try {
        await loadArcGIS();
        if (cleanup || !mapDiv.current) return;
        if (!(window as any).require) return;

        (window as any).require(["esri/Map", "esri/views/MapView", "esri/Graphic", "esri/layers/GraphicsLayer"], (EsriMap: any, MapView: any, Graphic: any, GraphicsLayer: any) => {
          if (cleanup) return;
          const map = new EsriMap({ basemap: "topo-vector" });
          const employeeLayer = new GraphicsLayer({ title: "Employees" });
          map.add(employeeLayer);
          users.forEach(u => {
            if (u.location?.latitude && u.location?.longitude) {
              const point = { type: "point", longitude: u.location.longitude, latitude: u.location.latitude };
              const markerSymbol = { type: "simple-marker", color: [13, 148, 136, 1], size: "12px", outline: { color: [255, 255, 255], width: 2 } };
              employeeLayer.add(new Graphic({ 
                  geometry: point, 
                  symbol: markerSymbol,
                  attributes: { name: `${u.firstName} ${u.lastName}`, pos: u.position },
                  popupTemplate: { title: "{name}", content: "{pos}" }
              }));
            }
          });
          view = new MapView({ container: mapDiv.current, map: map, center: [78.9629, 20.5937], zoom: 4 });
          view.when(() => { if (!cleanup) setIsMapLoaded(true); });
        });
      } catch (e) { setMapError("ArcGIS failed to load."); }
    };
    initMap();
    return () => { cleanup = true; if (view) view.destroy(); };
  }, [users]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden h-[600px] relative">
      {mapError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center text-slate-400">
           <AlertTriangle size={48} className="text-amber-500 mb-4" />
           <p className="font-bold">Map Service Unavailable</p>
           <p className="text-xs mt-1">Please check your internet connection.</p>
        </div>
      ) : (
        <>
          <div ref={mapDiv} className="w-full h-full"></div>
          {!isMapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900 z-10">
               <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Map...</p>
               </div>
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
  const filtered = useMemo(() => allEmployees.filter(e => 
      e && (
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
        (e.position || '').toLowerCase().includes(query.toLowerCase()) ||
        String(e.employeeId).toLowerCase().includes(query.toLowerCase())
      )
  ), [allEmployees, query]);

  return (
    <div className="space-y-3">
       <div className="relative">
           <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
           <input type="text" placeholder="Search team..." className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500" value={query} onChange={e => setQuery(e.target.value)} />
       </div>
       <div className="max-h-60 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-700 rounded-xl divide-y divide-slate-50 dark:divide-slate-700/50">
          {filtered.map(emp => {
            const isSelected = selectedIds.some(sid => String(sid) === String(emp.id));
            return (
              <div key={emp.id} onClick={() => onToggle(emp.id)} className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="flex items-center gap-3">
                  <img src={emp.avatar} className="w-8 h-8 rounded-full border border-slate-200" alt="" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{emp.firstName} {emp.lastName}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase">{emp.position || emp.role}</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
                    {isSelected && <CheckCircle2 size={12} className="text-white" />}
                </div>
              </div>
            );
          })}
       </div>
    </div>
  );
};

const Organization = () => {
  const { currentUser, projects, notify, bulkUpdateEmployees, positions, addPosition, updatePosition, deletePosition, employees, addEmployee, updateEmployee, deleteEmployee, addProject, updateProject, deleteProject, sendProjectAssignmentEmail, showToast, refreshData } = useAppContext();

  const [activeTab, setActiveTab] = useState<'employees' | 'positions' | 'projects' | 'chart' | 'locations'>('projects');
  const [chartZoom, setChartZoom] = useState<number>(0.85);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  
  const [showPosModal, setShowPosModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string | number, type: 'project' } | null>(null);
  
  const [posForm, setPosForm] = useState<any>({ id: '', title: '', description: '' });
  const [projectForm, setProjectForm] = useState<any>({ id: '', name: '', description: '', status: 'Active', tasks: [], dueDate: '', employeeIds: [] });
  const [newTaskInput, setNewTaskInput] = useState('');
  
  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;
  const treeContainerRef = useRef<HTMLDivElement>(null);

  const orgTreeData = useMemo(() => buildOrgTree(employees || []), [employees]);

  useEffect(() => {
    if (activeTab === 'employees') {
        refreshData();
    }
  }, [activeTab]);

  const handlePosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (posForm.id) await updatePosition(posForm.id, { title: posForm.title, description: posForm.description });
    else await addPosition({ title: posForm.title, description: posForm.description });
    setShowPosModal(false);
  };

  const addTask = () => {
    if (newTaskInput.trim()) {
      setProjectForm({ ...projectForm, tasks: [...projectForm.tasks, newTaskInput.trim()] });
      setNewTaskInput('');
    }
  };

  const removeTask = (index: number) => {
    setProjectForm({ ...projectForm, tasks: projectForm.tasks.filter((_: any, i: number) => i !== index) });
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Processing project assignments...", "info");
    let targetProjId: string = String(projectForm.id);
    
    if (projectForm.id) {
        await updateProject(projectForm.id, { ...projectForm });
    } else {
        targetProjId = Math.random().toString(36).substr(2, 9);
        await addProject({ ...projectForm, id: targetProjId });
    }

    const updates: any[] = [];
    const notificationRequests: any[] = [];
    
    for (const emp of employees) {
        const isSelected = (projectForm.employeeIds || []).some(sid => String(sid) === String(emp.id));
        const currentProjects = (emp.projectIds || []).map(String);
        const hasProject = currentProjects.includes(String(targetProjId));

        if (isSelected && !hasProject) {
            updates.push({ id: emp.id, data: { projectIds: [...currentProjects, targetProjId] } });
            notificationRequests.push({ email: emp.email, name: emp.firstName, empId: emp.id });
        } else if (!isSelected && hasProject) {
            updates.push({ id: emp.id, data: { projectIds: currentProjects.filter(p => String(p) !== String(targetProjId)) } });
        }
    }

    if (updates.length > 0) await bulkUpdateEmployees(updates);
    
    if (notificationRequests.length > 0) {
        for (const req of notificationRequests) {
            try {
                await notify(`Assigned to project: ${projectForm.name}`, req.empId);
                await sendProjectAssignmentEmail({
                    email: req.email,
                    firstName: req.name,
                    projectName: projectForm.name,
                    projectDescription: projectForm.description
                });
            } catch (err) {}
        }
        showToast(`Project saved. Notifications sent.`, "success");
    } else {
        showToast("Project records updated.", "success");
    }
    setShowProjectModal(false);
  };

  const executeDelete = async () => {
    if (deleteTarget) {
        const affectedEmployees = employees.filter(e => (e.projectIds || []).some(p => String(p) === String(deleteTarget.id)));
        if (affectedEmployees.length > 0) {
            const updates = affectedEmployees.map(e => ({
                id: e.id,
                data: { projectIds: (e.projectIds || []).filter(p => String(p) !== String(deleteTarget.id)) }
            }));
            await bulkUpdateEmployees(updates);
        }
        await deleteProject(deleteTarget.id);
        setDeleteTarget(null);
        setShowDeleteConfirm(false);
        showToast("Project deleted.", "info");
    }
  };

  const openProjectEdit = (project: Project) => {
      const projMembers = employees.filter(e => {
          const pIds = Array.isArray(e.projectIds) ? e.projectIds : [];
          return pIds.some(p => String(p) === String(project.id));
      }).map(e => e.id);
      
      const sanitizedTasks = Array.isArray(project.tasks) ? project.tasks : [];
      setProjectForm({ ...project, tasks: sanitizedTasks, employeeIds: projMembers });
      setShowProjectModal(true);
  };

  const handleWheel = (e: React.WheelEvent) => setChartZoom(Math.min(1.5, Math.max(0.3, chartZoom + e.deltaY * -0.001)));
  const handleMouseDown = (e: React.MouseEvent) => { if (e.button !== 0) return; setIsPanning(true); panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }; };
  const handleMouseMove = (e: React.MouseEvent) => { if (!isPanning) return; setPanOffset({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y }); };
  const handleMouseUp = () => setIsPanning(false);

  return (
    <div className="space-y-6 animate-fade-in relative">
       <style>{`
          .org-tree ul { padding-top: 15px; position: relative; display: flex; justify-content: center; }
          .org-tree li { text-align: center; list-style-type: none; position: relative; padding: 15px 4px 0 4px; }
          .org-tree li::before, .org-tree li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 1.5px solid #cbd5e1; width: 50%; height: 15px; }
          .org-tree li::after { right: auto; left: 50%; border-left: 1.5px solid #cbd5e1; }
          .org-tree li:only-child::after, .org-tree li:only-child::before { display: none; }
          .org-tree li:only-child { padding-top: 0; }
          .org-tree li:first-child::before, .org-tree li:last-child::after { border: 0 none; }
          .org-tree li:last-child::after { border-left: 1.5px solid #cbd5e1; border-radius: 4px 0 0 0; }
          .org-tree li:first-child::before { border-radius: 0 4px 0 0; }
          .org-tree ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 1.5px solid #cbd5e1; width: 0; height: 15px; }
          .dark .org-tree li::before, .dark .org-tree li::after, .dark .org-tree ul ul::before { border-color: #475569; }
       `}</style>

       <DraggableModal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title={projectForm.id ? "Edit Project" : "Create Project"} width="max-w-4xl">
           <form onSubmit={handleProjectSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-7 space-y-5">
                      <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Project Identity</label><input required type="text" className="w-full px-4 py-3 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} /></div>
                      <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Strategic Overview</label><textarea required rows={3} className="w-full px-4 py-3 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm dark:text-white" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})} /></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Status</label><select className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 font-medium dark:text-white" value={projectForm.status} onChange={e => setProjectForm({...projectForm, status: e.target.value as any})}><option>Active</option><option>On Hold</option><option>Completed</option></select></div>
                          <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Due Date</label><input type="date" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white font-medium" value={projectForm.dueDate} onChange={e => setProjectForm({...projectForm, dueDate: e.target.value})} /></div>
                      </div>
                      <div className="space-y-3">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2"><ListTodo size={14} className="text-emerald-600"/> Associated Deliverables</label>
                          <div className="flex gap-2"><input type="text" placeholder="Add task..." className="flex-1 px-4 py-2 border rounded-xl dark:bg-slate-900 bg-white border-slate-200 outline-none focus:ring-1 focus:ring-emerald-500 text-sm" value={newTaskInput} onChange={e => setNewTaskInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTask())}/><button type="button" onClick={addTask} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs">Add</button></div>
                          <div className="flex flex-wrap gap-2 pt-1">
                              {(projectForm.tasks || []).map((task: string, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold">
                                      <span>{task}</span><button type="button" onClick={() => removeTask(idx)} className="text-emerald-400 hover:text-emerald-600"><X size={14}/></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 ml-1">Team Allocation</label><EmployeePicker selectedIds={projectForm.employeeIds || []} onToggle={(id) => setProjectForm((prev: any) => { const cur = prev.employeeIds || []; return { ...prev, employeeIds: cur.some((sid:any) => String(sid) === String(id)) ? cur.filter((i:any)=>String(i)!==String(id)) : [...cur, id] }; })} allEmployees={employees} /></div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700"><button type="button" onClick={() => setShowProjectModal(false)} className="px-6 py-2.5 text-slate-400 font-bold uppercase text-xs tracking-widest">Discard</button><button type="submit" className="bg-emerald-600 text-white px-10 py-3 rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95">Save Project</button></div>
           </form>
       </DraggableModal>

       <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Deletion" width="max-w-md">
           <div className="text-center py-4"><div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100 dark:border-red-800"><AlertTriangle className="text-red-600 dark:text-red-400" size={32} /></div><h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Are you sure?</h3><p className="text-slate-500 dark:text-slate-400 text-sm px-4">Removing this project will clear all team associations.</p></div>
           <div className="flex gap-3 mt-6 pt-6 border-t dark:border-slate-700"><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-xl font-bold text-xs uppercase">Cancel</button><button onClick={executeDelete} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase">Confirm Delete</button></div>
       </DraggableModal>

       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Organization</h2><p className="text-sm text-slate-500 dark:text-slate-400">Manage structure, projects and locations.</p></div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto">
             {['projects', 'chart', 'locations', 'positions', 'employees'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap capitalize ${activeTab === tab ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>{tab === 'chart' ? 'Hierarchy' : tab === 'locations' ? 'Map' : tab}</button>
             ))}
          </div>
       </div>

       {activeTab === 'projects' && (
           <div className="space-y-4">
                <div className="flex justify-between items-center"><h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Layout className="text-emerald-600" /> Managed Projects</h3>{isPowerUser && <button onClick={() => { setProjectForm({ id: '', name: '', description: '', status: 'Active', tasks: [], dueDate: '', employeeIds: [] }); setShowProjectModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2 shadow-sm font-bold"><Plus size={16} /> Add Project</button>}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <div key={project.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition relative group">
                            {isPowerUser && (
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => openProjectEdit(project)} className="p-1.5 text-slate-400 hover:text-emerald-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm transition-all"><Edit2 size={14}/></button><button onClick={() => { setDeleteTarget({ id: project.id, type: 'project' }); setShowDeleteConfirm(true); }} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm transition-all"><Trash2 size={14}/></button></div>
                            )}
                            <div className="flex justify-between items-start mb-4"><div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 border border-teal-100"><Briefcase size={22} /></div><span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${project.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{project.status}</span></div>
                            <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{project.name}</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 h-10 line-clamp-2 leading-relaxed mb-4">{project.description}</p>
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center"><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Users size={12}/> {employees.filter(e => (e.projectIds || []).some(pid => String(pid) === String(project.id))).length} Assigned</div>{project.dueDate && <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md"><Calendar size={10} /> {new Date(project.dueDate).toLocaleDateString()}</div>}</div>
                        </div>
                    ))}
                </div>
           </div>
       )}

       {activeTab === 'chart' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm"><div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold"><Move size={14} className="text-teal-600" /><span>Scroll to Zoom • Drag to Pan</span></div><div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700"><button onClick={() => setChartZoom(prev => Math.max(0.3, prev - 0.1))} className="p-1 text-slate-500 hover:text-teal-600"><ZoomOut size={16}/></button><span className="text-[10px] font-black text-slate-400 w-12 text-center">{Math.round(chartZoom * 100)}%</span><button onClick={() => setChartZoom(prev => Math.min(1.5, prev + 0.1))} className="p-1 text-slate-500 hover:text-teal-600"><ZoomIn size={16}/></button><div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div><button onClick={() => { setChartZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="p-1 text-slate-500 hover:text-teal-600" title="Reset View"><RefreshCw size={14}/></button></div></div>
            <div ref={treeContainerRef} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative h-[650px] ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}><div className="absolute inset-0 p-4 md:p-8 flex justify-center bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] dark:bg-[radial-gradient(#334155_1.5px,transparent_1.5px)] [background-size:32px_32px]"><div className="org-tree origin-top inline-block" style={{ transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${chartZoom})` }}><ul className="pointer-events-auto">{orgTreeData.map(node => <OrgChartNode key={node.id} node={node} />)}</ul></div></div></div>
          </div>
       )}

       {activeTab === 'locations' && <div className="space-y-4"><h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><MapPin className="text-emerald-600" /> Map Overview</h3><GraphicsLayerMap users={employees} /></div>}
       {activeTab === 'employees' && <EmployeeList employees={employees} onAddEmployee={addEmployee} onUpdateEmployee={updateEmployee} onDeleteEmployee={deleteEmployee} />}
       {activeTab === 'positions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><UserSquare className="text-emerald-600" /> Designations</h3>{isPowerUser && <button onClick={() => { setPosForm({ id: '', title: '', description: '' }); setShowPosModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2 font-bold shadow-sm"><Plus size={16} /> Add Position</button>}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{positions.map(p => (<div key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition relative group">{isPowerUser && (<div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setPosForm(p); setShowPosModal(true); }} className="p-1.5 text-slate-400 hover:text-emerald-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm transition-all"><Edit2 size={14}/></button><button onClick={() => { if(window.confirm('Delete this position?')) deletePosition(p.id); }} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm"><Trash2 size={14}/></button></div>)}<h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{p.title}</h4><p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{p.description}</p></div>))}</div>
          </div>
       )}
    </div>
  );
};
export default Organization;
