
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Department, Project, Employee, Role, Position } from '../types';
import { Briefcase, FolderPlus, Trash2, Building2, Users, Edit2, Layers, CheckCircle, Filter, Plus, Minus, X, ChevronLeft, ChevronRight, Network, MapPin, BadgeCheck, Eye, AlertTriangle, Save, Shield, ListTodo, UserSquare, Search, CheckCircle2, Layout, ZoomIn, ZoomOut, RefreshCw, Maximize2, Calendar, MoreVertical, ListChecks, Move } from 'lucide-react';
import EmployeeList from './EmployeeList';
import DraggableModal from './DraggableModal';

interface TreeNode extends Employee {
  children: TreeNode[];
}

const buildOrgTree = (employees: Employee[], deptHeadId?: string | number): TreeNode[] => {
  const empMap: Record<string, TreeNode> = {};
  employees.forEach(emp => { empMap[emp.id] = { ...emp, children: [] }; });
  const roots: TreeNode[] = [];
  const headIdStr = deptHeadId ? String(deptHeadId) : null;

  employees.forEach(emp => {
    const node = empMap[emp.id];
    const empManagerIdStr = emp.managerId ? String(emp.managerId) : null;
    
    if (headIdStr && String(emp.id) === headIdStr) {
        roots.push(node);
    } else if (empManagerIdStr && empMap[empManagerIdStr]) {
        empMap[empManagerIdStr].children.push(node);
    } else {
        if (!headIdStr || String(emp.id) !== headIdStr) {
            roots.push(node);
        }
    }
  });

  return roots.filter(root => {
      const isActuallyAChild = employees.some(e => 
          e.managerId && 
          String(e.id) === String(root.id) && 
          empMap[String(e.managerId)]
      );
      return !isActuallyAChild;
  });
};

const OrgChartNode: React.FC<{ node: TreeNode }> = ({ node }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  
  return (
    <li>
      <div className="flex flex-col items-center relative pb-6">
        <div className="org-node-card group bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-teal-500/50 transition-all w-36 relative z-10">
           <div className="flex flex-col items-center">
             <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-50 dark:border-slate-700 mb-1.5 shadow-sm group-hover:scale-110 transition-transform bg-slate-100">
                <img src={node.avatar} alt={node.firstName} className="w-full h-full object-cover" />
             </div>
             <div className="text-center w-full min-w-0">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[11px] tracking-tight leading-tight truncate px-1" title={`${node.firstName} ${node.lastName}`}>
                    {node.firstName} {node.lastName}
                </h4>
                <p className="text-[8px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider mt-0.5 mb-1 truncate px-1">
                    {node.position || 'Team Member'}
                </p>
                {node.department && (
                  <div className="inline-flex items-center gap-1 text-[7px] bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300 px-1.5 py-0.5 rounded-full font-black uppercase max-w-full">
                    <Building2 size={7} className="shrink-0" /> <span className="truncate">{node.department}</span>
                  </div>
                )}
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
        if (window.require) { resolve(); return; }
        const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://js.arcgis.com/4.29/esri/themes/light/main.css'; document.head.appendChild(link);
        const script = document.createElement('script'); script.src = 'https://js.arcgis.com/4.29/'; script.async = true; script.onload = () => resolve(); script.onerror = (e) => reject(e); document.body.appendChild(script);
      });
    };
    const initMap = async () => {
      try {
        await loadArcGIS();
        if (cleanup || !mapDiv.current) return;
        window.require(["esri/Map", "esri/views/MapView", "esri/Graphic", "esri/layers/GraphicsLayer"], (EsriMap: any, MapView: any, Graphic: any, GraphicsLayer: any) => {
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
  
  const filtered = useMemo(() => {
    return allEmployees.filter(e => 
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
        (e.position || '').toLowerCase().includes(query.toLowerCase()) ||
        String(e.employeeId).toLowerCase().includes(query.toLowerCase())
    );
  }, [allEmployees, query]);

  return (
    <div className="space-y-3">
       <div className="relative">
           <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
           <input 
             type="text" 
             placeholder="Search name, position, or ID..." 
             className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
             value={query} 
             onChange={e => setQuery(e.target.value)} 
           />
       </div>
       <div className="max-h-60 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-700 rounded-xl divide-y divide-slate-50 dark:divide-slate-700/50">
          {filtered.map(emp => {
            const isSelected = selectedIds.some(sid => String(sid) === String(emp.id));
            return (
              <div key={emp.id} onClick={() => onToggle(emp.id)} className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="flex items-center gap-3">
                  <img src={emp.avatar} className="w-8 h-8 rounded-full border border-slate-200" alt="" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{emp.firstName} {emp.lastName} <span className="text-[9px] text-slate-400">#{emp.employeeId}</span></p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{emp.position || emp.role}</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
                    {isSelected && <CheckCircle2 size={12} className="text-white" />}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-[10px] uppercase font-bold italic">No matching employees.</div>
          )}
       </div>
    </div>
  );
};

const Organization = () => {
  const { 
    currentUser, departments, projects, users, notify, updateUser, bulkUpdateEmployees,
    addDepartment, updateDepartment, deleteDepartment, 
    positions, addPosition, updatePosition, deletePosition,
    employees, addEmployee, updateEmployee, deleteEmployee,
    addProject, updateProject, deleteProject, sendProjectAssignmentEmail, showToast
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'positions' | 'projects' | 'allocations' | 'chart' | 'locations'>('departments');
  const [chartDeptFilter, setChartDeptFilter] = useState<string>('all');
  const [chartZoom, setChartZoom] = useState<number>(0.85);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showPosModal, setShowPosModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string | number, type: 'department' | 'project' } | null>(null);
  
  const [deptForm, setDeptForm] = useState<any>({ id: '', name: '', description: '', managerId: '', employeeIds: [] });
  const [posForm, setPosForm] = useState<any>({ id: '', title: '', description: '' });
  
  const [projectForm, setProjectForm] = useState<any>({ 
    id: '', 
    name: '', 
    description: '', 
    status: 'Active', 
    tasks: [] as string[], 
    dueDate: '', 
    employeeIds: [] as (string | number)[] 
  });
  const [newTaskInput, setNewTaskInput] = useState('');
  
  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;
  const treeContainerRef = useRef<HTMLDivElement>(null);

  const orgTreeData = useMemo(() => {
      let deptHeadId: string | number | undefined = undefined;
      if (chartDeptFilter !== 'all') {
          const activeDept = departments.find(d => String(d.id) === chartDeptFilter);
          if (activeDept) deptHeadId = activeDept.managerId;
      }
      const filteredEmps = chartDeptFilter === 'all' 
        ? employees 
        : employees.filter(e => String(e.departmentId) === String(chartDeptFilter));
      return buildOrgTree(filteredEmps, deptHeadId);
  }, [employees, chartDeptFilter, departments]);

  const availableEmployeesForDeptPicker = useMemo(() => {
    const validDeptIds = new Set(departments.map(d => String(d.id)));
    return employees.filter(emp => {
      const isInCurrentEditingDept = deptForm.id && String(emp.departmentId) === String(deptForm.id);
      const isUnassigned = !emp.departmentId || emp.departmentId === '' || emp.department === 'General' || !validDeptIds.has(String(emp.departmentId));
      return isInCurrentEditingDept || isUnassigned;
    });
  }, [employees, departments, deptForm.id]);

  const eligibleManagers = useMemo(() => {
    return employees.filter(emp => 
        emp.role === UserRole.MANAGER || 
        emp.role === UserRole.HR || 
        emp.role === UserRole.ADMIN
    );
  }, [employees]);

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetDeptId = deptForm.id;
    if (deptForm.id) {
      await updateDepartment(deptForm.id, { name: deptForm.name, description: deptForm.description, managerId: deptForm.managerId });
    } else {
      const newId = Math.random().toString(36).substr(2, 9);
      await addDepartment({ id: newId, name: deptForm.name, description: deptForm.description, managerId: deptForm.managerId });
      targetDeptId = newId;
    }
    const updates: { id: string | number, data: Partial<Employee> }[] = [];
    employees.forEach(emp => {
      const selectedIds = [...(deptForm.employeeIds || [])];
      if (deptForm.managerId && !selectedIds.some(sid => String(sid) === String(deptForm.managerId))) {
          selectedIds.push(deptForm.managerId);
      }
      const isSelected = selectedIds.some(sid => String(sid) === String(emp.id));
      const currentlyInDept = String(emp.departmentId) === String(targetDeptId);
      if (isSelected && !currentlyInDept) {
        updates.push({ id: emp.id, data: { departmentId: targetDeptId, department: deptForm.name } });
      } else if (!isSelected && currentlyInDept) {
        updates.push({ id: emp.id, data: { departmentId: '', department: 'General' } });
      }
    });
    if (updates.length > 0) await bulkUpdateEmployees(updates);
    notify(`Department ${deptForm.name} saved.`);
    setShowDeptModal(false);
  };

  const handlePosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (posForm.id) {
      await updatePosition(posForm.id, { title: posForm.title, description: posForm.description });
      notify(`Position "${posForm.title}" updated.`);
    } else {
      await addPosition({ title: posForm.title, description: posForm.description });
      notify(`Position "${posForm.title}" created.`);
    }
    setShowPosModal(false);
  };

  const addTask = () => {
    if (newTaskInput.trim()) {
      setProjectForm({ ...projectForm, tasks: [...projectForm.tasks, newTaskInput.trim()] });
      setNewTaskInput('');
    }
  };

  const removeTask = (index: number) => {
    setProjectForm({
      ...projectForm,
      tasks: projectForm.tasks.filter((_: any, i: number) => i !== index)
    });
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Processing project assignments...", "info");
    
    let targetProjId: string = String(projectForm.id);
    
    console.group(`[Project Submission] ${projectForm.name}`);
    
    if (projectForm.id) {
        console.log("Updating existing project...");
        await updateProject(projectForm.id, { 
          name: projectForm.name,
          description: projectForm.description,
          status: projectForm.status,
          tasks: projectForm.tasks,
          dueDate: projectForm.dueDate
        });
    } else {
        console.log("Creating new project bundle...");
        targetProjId = Math.random().toString(36).substr(2, 9);
        await addProject({ 
          id: targetProjId,
          name: projectForm.name,
          description: projectForm.description,
          status: projectForm.status,
          tasks: projectForm.tasks,
          dueDate: projectForm.dueDate
        });
    }

    const updates: { id: string | number, data: Partial<Employee> }[] = [];
    const notificationRequests: { email: string, name: string, empId: string | number }[] = [];
    
    for (const emp of employees) {
        const isSelected = (projectForm.employeeIds || []).some(sid => String(sid) === String(emp.id));
        const currentProjects = (emp.projectIds || []).map(String);
        const hasProject = currentProjects.includes(String(targetProjId));

        if (isSelected && !hasProject) {
            console.log(`+ Adding NEW member: ${emp.firstName} ${emp.lastName}`);
            updates.push({ id: emp.id, data: { projectIds: [...currentProjects, targetProjId] } });
            notificationRequests.push({ email: emp.email, name: emp.firstName, empId: emp.id });
        } else if (!isSelected && hasProject) {
            console.log(`- Removing member: ${emp.firstName} ${emp.lastName}`);
            updates.push({ id: emp.id, data: { projectIds: currentProjects.filter(p => String(p) !== String(targetProjId)) } });
        }
    }

    if (updates.length > 0) {
        await bulkUpdateEmployees(updates);
        console.log(`✅ Synced project assignments for ${updates.length} employees`);
    }
    
    // Process Notifications
    if (notificationRequests.length > 0) {
        console.log(`📧 Dispatching ${notificationRequests.length} email notifications...`);
        for (const req of notificationRequests) {
            try {
                // Trigger in-app alert
                await notify(`Assigned to project: ${projectForm.name}`, req.empId);
                
                // Trigger SMTP email
                await sendProjectAssignmentEmail({
                    email: req.email,
                    firstName: req.name,
                    projectName: projectForm.name,
                    projectDescription: projectForm.description
                });
                console.log(`✅ Notification SENT to ${req.email}`);
            } catch (err) {
                console.error(`❌ Notification FAILED for ${req.email}:`, err);
                showToast(`Failed to notify ${req.name}`, "error");
            }
        }
        showToast(`Project saved. ${notificationRequests.length} notifications sent.`, "success");
    } else {
        showToast("Project configuration updated.", "success");
    }

    console.groupEnd();
    setShowProjectModal(false);
  };

  const handleConfirmDelete = (id: string | number, type: 'department' | 'project') => {
      setDeleteTarget({ id, type });
      setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (deleteTarget) {
        if (deleteTarget.type === 'department') {
            await deleteDepartment(deleteTarget.id);
            notify(`Department deleted.`);
        } else {
            const affectedEmployees = employees.filter(e => (e.projectIds || []).some(p => String(p) === String(deleteTarget.id)));
            if (affectedEmployees.length > 0) {
                const updates = affectedEmployees.map(e => ({
                    id: e.id,
                    data: { projectIds: (e.projectIds || []).filter(p => String(p) !== String(deleteTarget.id)) }
                }));
                await bulkUpdateEmployees(updates);
            }
            await deleteProject(deleteTarget.id);
            notify(`Project deleted.`);
        }
        setDeleteTarget(null);
        setShowDeleteConfirm(false);
    }
  };

  const openDeptEdit = (dept: Department) => {
      const deptMembers = employees.filter(e => String(e.departmentId) === String(dept.id)).map(e => e.id);
      setDeptForm({ ...dept, employeeIds: deptMembers });
      setShowDeptModal(true);
  };

  const openProjectEdit = (project: Project) => {
      const projMembers = employees.filter(e => (e.projectIds || []).some(p => String(p) === String(project.id))).map(e => e.id);
      setProjectForm({ 
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        tasks: [...project.tasks],
        dueDate: project.dueDate,
        employeeIds: projMembers
      });
      setShowProjectModal(true);
  };

  const handleAutoFit = () => {
      if (treeContainerRef.current) {
          const containerWidth = treeContainerRef.current.clientWidth;
          const treeEl = treeContainerRef.current.querySelector('.org-tree') as HTMLElement;
          if (treeEl) {
              const treeWidth = treeEl.scrollWidth;
              const optimalZoom = Math.min(1.2, Math.max(0.3, (containerWidth - 40) / treeWidth));
              setChartZoom(optimalZoom);
              setPanOffset({ x: 0, y: 0 }); // Center on fit
          }
      }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY * -0.001;
    const newZoom = Math.min(1.5, Math.max(0.3, chartZoom + delta));
    setChartZoom(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; 
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y
    });
  };

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
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Project Identity</label>
                        <input required type="text" placeholder="Project name..." className="w-full px-4 py-3 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Strategic Overview</label>
                        <textarea required rows={3} placeholder="Define goals and scope..." className="w-full px-4 py-3 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm dark:text-white" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Progress Status</label><select className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 font-medium dark:text-white" value={projectForm.status} onChange={e => setProjectForm({...projectForm, status: e.target.value as any})}><option>Active</option><option>On Hold</option><option>Completed</option></select></div>
                          <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Target Milestone</label><input type="date" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white font-medium" value={projectForm.dueDate} onChange={e => setProjectForm({...projectForm, dueDate: e.target.value})} /></div>
                      </div>
                      
                      <div className="space-y-3">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2"><ListTodo size={14} className="text-emerald-600"/> Associated Deliverables</label>
                          <div className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder="Add a specific task..." 
                                className="flex-1 px-4 py-2 border rounded-xl dark:bg-slate-900 bg-white border-slate-200 outline-none focus:ring-1 focus:ring-emerald-500 text-sm" 
                                value={newTaskInput} 
                                onChange={e => setNewTaskInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTask())}
                              />
                              <button type="button" onClick={addTask} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-900 transition-colors">Add</button>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1 min-h-[40px]">
                              {projectForm.tasks.map((task: string, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm animate-in zoom-in-90">
                                      <span>{task}</span>
                                      <button type="button" onClick={() => removeTask(idx)} className="text-emerald-400 hover:text-emerald-600 transition-colors"><X size={14}/></button>
                                  </div>
                              ))}
                              {projectForm.tasks.length === 0 && <p className="text-xs text-slate-400 italic py-2 ml-1">No tasks defined yet.</p>}
                          </div>
                      </div>
                  </div>
                  
                  <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 ml-1">Resource Allocation (Team)</label>
                      <EmployeePicker selectedIds={projectForm.employeeIds || []} onToggle={(id) => setProjectForm((prev: any) => { const cur = prev.employeeIds || []; return { ...prev, employeeIds: cur.some((sid:any) => String(sid) === String(id)) ? cur.filter((i:any)=>String(i)!==String(id)) : [...cur, id] }; })} allEmployees={employees} />
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                <button type="button" onClick={() => setShowProjectModal(false)} className="px-6 py-2.5 text-slate-400 font-bold uppercase text-xs tracking-widest">Discard</button>
                <button type="submit" className="bg-emerald-600 text-white px-10 py-3 rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95">Save Project Bundle</button>
              </div>
           </form>
       </DraggableModal>

       <DraggableModal isOpen={showDeptModal} onClose={() => setShowDeptModal(false)} title={deptForm.id ? "Edit Department" : "Add Department"} width="max-w-2xl">
          <form onSubmit={handleDeptSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Department Name</label><input required type="text" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white" value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} /></div>
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Description</label><textarea required className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white" rows={3} value={deptForm.description} onChange={e => setDeptForm({...deptForm, description: e.target.value})} /></div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Department Head</label>
                      <select required className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white" value={deptForm.managerId} onChange={e => setDeptForm({...deptForm, managerId: e.target.value})}>
                        <option value="" disabled>Select Head...</option>
                        {eligibleManagers.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.jobTitle || e.role})</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Department Members</label>
                    <EmployeePicker selectedIds={deptForm.employeeIds || []} onToggle={(id) => setDeptForm((prev: any) => { const cur = prev.employeeIds || []; return { ...prev, employeeIds: cur.some((sid:any)=>String(sid)===String(id)) ? cur.filter((i:any)=>String(i)!==String(id)) : [...cur, id] }; })} allEmployees={availableEmployeesForDeptPicker} />
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                <button type="button" onClick={() => setShowDeptModal(false)} className="px-6 py-2.5 text-slate-400 font-bold uppercase text-xs">Cancel</button>
                <button type="submit" className="bg-emerald-600 text-white px-8 py-2.5 rounded-xl text-sm font-bold uppercase shadow-lg active:scale-95 transition-all">Save Dept</button>
              </div>
          </form>
       </DraggableModal>

       <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Deletion" width="max-w-md">
           <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100 dark:border-red-800">
                  <AlertTriangle className="text-red-600 dark:text-red-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Are you sure?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm px-4">
                  Deleting this {deleteTarget?.type} will remove it from the system. Associated assignments will be cleared.
              </p>
           </div>
           <div className="flex gap-3 mt-6 pt-6 border-t dark:border-slate-700">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200">Cancel</button>
              <button onClick={executeDelete} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-red-700">Confirm Delete</button>
           </div>
       </DraggableModal>

       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Organization</h2><p className="text-sm text-slate-500 dark:text-slate-400">Manage company structure, projects and locations.</p></div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto custom-scrollbar">
             {['departments', 'positions', 'projects', 'chart', 'locations', 'employees'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap capitalize ${activeTab === tab ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>{tab === 'chart' ? 'Org Chart' : tab === 'locations' ? 'Map' : tab}</button>
             ))}
          </div>
       </div>

       {activeTab === 'projects' && (
           <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Layout className="text-emerald-600" /> Managed Projects</h3>
                    {isPowerUser && (
                        <button onClick={() => { setProjectForm({ id: '', name: '', description: '', status: 'Active', tasks: [], dueDate: '', employeeIds: [] }); setShowProjectModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2 shadow-sm font-bold">
                            <Plus size={16} /> Add Project
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => {
                        const projectMemberCount = employees.filter(e => (e.projectIds || []).some(pid => String(pid) === String(project.id))).length;
                        return (
                            <div key={project.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition relative group">
                                {isPowerUser && (
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openProjectEdit(project)} className="p-1.5 text-slate-400 hover:text-emerald-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm transition-all"><Edit2 size={14}/></button>
                                        <button onClick={() => handleConfirmDelete(project.id, 'project')} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm transition-all"><Trash2 size={14}/></button>
                                    </div>
                                )}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 shadow-sm border border-teal-100 dark:border-teal-800">
                                        <Briefcase size={22} />
                                    </div>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${project.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : project.status === 'On Hold' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                        {project.status}
                                    </span>
                                </div>
                                <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1 tracking-tight">{project.name}</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 h-10 line-clamp-2 leading-relaxed mb-4">{project.description}</p>
                                
                                <div className="space-y-2 mb-5">
                                    <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1 border-slate-50 dark:border-slate-700">
                                        <span>Milestones</span>
                                        <span>{project.tasks.length} Total</span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        {project.tasks.slice(0, 3).map((t, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                                                <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                                                <span className="truncate">{t}</span>
                                            </div>
                                        ))}
                                        {project.tasks.length > 3 && (
                                            <p className="text-[10px] text-slate-400 font-bold italic pl-5">+ {project.tasks.length - 3} more deliverables</p>
                                        )}
                                        {project.tasks.length === 0 && <p className="text-[10px] text-slate-400 italic">No tasks assigned.</p>}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Users size={12}/> {projectMemberCount} Assigned
                                    </div>
                                    {project.dueDate && (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md">
                                            <Calendar size={10} /> {new Date(project.dueDate).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {projects.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                             <Briefcase className="mx-auto text-slate-200 dark:text-slate-700 mb-3" size={48} />
                             <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No projects created yet</p>
                        </div>
                    )}
                </div>
           </div>
       )}

       {activeTab === 'departments' && (
           <div className="space-y-4">
               <div className="flex justify-between items-center"><h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Building2 className="text-emerald-600" /> Departments</h3>{isPowerUser && <button onClick={() => { setDeptForm({ id: '', name: '', description: '', managerId: '', employeeIds: [] }); setShowDeptModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2 font-bold shadow-sm"><Plus size={16} /> Add Dept</button>}</div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {departments.map(dept => {
                      const activeMembersCount = employees.filter(e => String(e.departmentId) === String(dept.id)).length;
                      return (
                        <div key={dept.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition relative group">
                            {isPowerUser && (
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openDeptEdit(dept)} className="p-1.5 text-slate-400 hover:text-teal-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm"><Edit2 size={14}/></button>
                                    <button onClick={() => handleConfirmDelete(dept.id, 'department')} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm"><Trash2 size={14}/></button>
                                </div>
                            )}
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 mb-4"><Building2 size={22} /></div>
                            <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{dept.name}</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 h-10 line-clamp-2 leading-relaxed">{dept.description}</p>
                            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Users size={12}/> {activeMembersCount} Members</div>
                        </div>
                      );
                  })}
               </div>
           </div>
       )}

       {activeTab === 'chart' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold">
                    <Move size={14} className="text-teal-600" />
                    <span>Scroll to Zoom • Drag to Pan</span>
                </div>
                <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button onClick={() => setChartZoom(prev => Math.max(0.3, prev - 0.1))} className="p-1 text-slate-500 hover:text-teal-600 transition-colors"><ZoomOut size={16}/></button>
                    <span className="text-[10px] font-black text-slate-400 w-12 text-center">{Math.round(chartZoom * 100)}%</span>
                    <button onClick={() => setChartZoom(prev => Math.min(1.5, prev + 0.1))} className="p-1 text-slate-500 hover:text-teal-600 transition-colors"><ZoomIn size={16}/></button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                    <button onClick={handleAutoFit} className="p-1 text-slate-500 hover:text-teal-600 transition-colors" title="Fit to Screen"><Maximize2 size={15}/></button>
                    <button onClick={() => { setChartZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="p-1 text-slate-500 hover:text-teal-600 transition-colors" title="Reset View"><RefreshCw size={14}/></button>
                </div>
            </div>
            <div 
              ref={treeContainerRef} 
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`bg-white dark:bg-slate-800 rounded-2xl shadow-inner border border-slate-200 dark:border-slate-700 overflow-hidden relative group h-[650px] ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
                <div className="absolute inset-0 p-4 md:p-8 flex justify-center bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] dark:bg-[radial-gradient(#334155_1.5px,transparent_1.5px)] [background-size:32px_32px]">
                    {orgTreeData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-slate-400 pt-20">
                            <Network size={48} className="mb-4 opacity-20" />
                            <p className="font-bold text-xs uppercase tracking-widest">No matching records</p>
                        </div>
                    ) : (
                        <div 
                          className="org-tree transition-transform duration-75 ease-out origin-top inline-block" 
                          style={{ transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${chartZoom})` }}
                        >
                            <ul className="pointer-events-auto">{orgTreeData.map(node => <OrgChartNode key={node.id} node={node} />)}</ul>
                        </div>
                    )}
                </div>
            </div>
          </div>
       )}

       {activeTab === 'locations' && <div className="space-y-4"><h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><MapPin className="text-emerald-600" /> Employee Global Map</h3><GraphicsLayerMap users={employees} /></div>}
       
       {activeTab === 'employees' && <EmployeeList employees={employees} onAddEmployee={addEmployee} onUpdateEmployee={updateEmployee} onDeleteEmployee={deleteEmployee} />}
       
       {activeTab === 'positions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><UserSquare className="text-emerald-600" /> Job Roles & Positions</h3>{isPowerUser && <button onClick={() => { setPosForm({ id: '', title: '', description: '' }); setShowPosModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2 font-bold shadow-sm"><Plus size={16} /> Add Position</button>}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {positions.map(p => (
                    <div key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition relative group">
                        {isPowerUser && (
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setPosForm(p); setShowPosModal(true); }} className="p-1.5 text-slate-400 hover:text-emerald-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm"><Edit2 size={14}/></button>
                                <button onClick={() => { if(window.confirm('Delete this position?')) deletePosition(p.id); }} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm"><Trash2 size={14}/></button>
                            </div>
                        )}
                        <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{p.title}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{p.description}</p>
                    </div>
                ))}
            </div>
          </div>
       )}
    </div>
  );
};
export default Organization;
