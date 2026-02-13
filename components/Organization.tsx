
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Project, Employee, Position, EmployeeStatus } from '../types';
import { 
  Briefcase, Trash2, Edit2, Users, Plus, X, Network, MapPin, 
  Layout, Search, UserPlus, 
  RefreshCw, Building2, Loader2,
  Mail, ChevronLeft, List, Grid, CheckCircle2, ChevronDown, ChevronRight,
  Calendar, Minus, ArrowLeft, UserMinus, Save, Layers, LocateFixed
} from 'lucide-react';
import DraggableModal from './DraggableModal';
import { loadModules } from 'esri-loader';

interface TreeNode extends Employee {
  children: TreeNode[];
}

const buildOrgTree = (employees: Employee[]): TreeNode[] => {
  const empMap: Record<string, TreeNode> = {};
  const validEmployees = employees.filter(emp => emp && emp.id);
  validEmployees.forEach(emp => { empMap[String(emp.id)] = { ...emp, children: [] }; });
  const roots: TreeNode[] = [];
  validEmployees.forEach(emp => {
    const node = empMap[String(emp.id)];
    const empManagerIdStr = emp.managerId ? String(emp.managerId) : null;
    if (empManagerIdStr && empMap[empManagerIdStr]) empMap[empManagerIdStr].children.push(node);
    else roots.push(node);
  });
  return roots.filter(root => !validEmployees.some(e => e.managerId && String(e.id) === String(root.id) && empMap[String(e.managerId)]));
};

const getSafeProjectIds = (emp: any): (string | number)[] => {
    if (!emp) return [];
    if (!emp.projectIds) return [];
    if (Array.isArray(emp.projectIds)) return emp.projectIds;
    try {
        const parsed = JSON.parse(emp.projectIds);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [emp.projectIds];
    }
};

const parseLocation = (loc: any) => {
    const defaultLoc = { latitude: 20.5937, longitude: 78.9629, address: '' };
    if (!loc) return defaultLoc;
    let parsed = loc;
    if (typeof loc === 'string') { try { parsed = JSON.parse(loc); } catch (e) { return defaultLoc; } }
    return {
        latitude: parseFloat(parsed.latitude) || defaultLoc.latitude,
        longitude: parseFloat(parsed.longitude) || defaultLoc.longitude,
        address: parsed.address || ''
    };
};

const sanitizeEmployeePayload = (data: any): Partial<Employee> => {
    const allowedKeys = [
        'id', 'employeeId', 'firstName', 'lastName', 'email', 'password',
        'role', 'position', 'department', 'departmentId', 'projectIds',
        'joinDate', 'status', 'salary', 'avatar', 'managerId',
        'location', 'workLocation', 'phone', 'jobTitle', 'settings', 'bio'
    ];
    const cleanData: any = {};
    Object.keys(data).forEach(key => { if (allowedKeys.includes(key)) { cleanData[key] = data[key]; } });
    return cleanData;
};

const OrgChartNode: React.FC<{ node: TreeNode }> = ({ node }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  return (
    <li className="flex flex-col items-center px-4">
      <div className="flex flex-col items-center relative pb-8">
        <div className="org-node-card group bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-primary-500/50 transition-all w-48 relative z-10 cursor-pointer">
           <div className="flex flex-col items-center gap-2">
             <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-50 dark:border-slate-700 shadow-sm bg-slate-100">
                <img src={node.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(node.firstName)}+${encodeURIComponent(node.lastName)}`} className="w-full h-full object-cover" alt="" />
             </div>
             <div className="text-center w-full min-w-0">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{node.firstName} {node.lastName}</h4>
                <p className="text-[10px] text-primary-600 dark:text-primary-400 font-black uppercase tracking-wider mt-0.5 truncate">{node.position || node.jobTitle || 'Team Member'}</p>
                {node.department && <p className="text-[10px] text-slate-400 mt-1 truncate">{node.department}</p>}
             </div>
           </div>
        </div>
        {hasChildren && (
          <>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-8 bg-slate-300 dark:bg-slate-600"></div>
            <button 
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} 
                className={`absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center w-6 h-6 rounded-full border bg-white dark:bg-slate-700 shadow-md transition-colors ${expanded ? 'border-primary-500 text-primary-600' : 'border-slate-300 text-slate-400'}`}
            >
              {expanded ? <Minus size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
            </button>
          </>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="relative pt-4">
            {node.children.length > 1 && ( <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] h-px bg-slate-300 dark:bg-slate-600"></div> )}
            <ul className="flex flex-row justify-center gap-4">
            {node.children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 absolute -top-4 left-1/2 -translate-x-1/2"></div>
                    <OrgChartNode node={child} />
                </div>
            ))}
            </ul>
        </div>
      )}
    </li>
  );
};

const MultiSelectProject = ({ options, selectedIds, onChange }: { options: Project[], selectedIds: (string | number)[], onChange: (ids: (string | number)[]) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleSelect = (id: string | number) => {
    const idStr = String(id);
    if (safeSelectedIds.map(String).includes(idStr)) { onChange(safeSelectedIds.filter(sid => String(sid) !== idStr)); } else { onChange([...safeSelectedIds, id]); }
  };
  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Assigned Projects</label>
      <div className="w-full min-h-[46px] border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-700 shadow-inner" onClick={() => setIsOpen(!isOpen)}>
        {safeSelectedIds.length === 0 && <span className="text-slate-400 text-sm ml-1">No projects assigned...</span>}
        <div className="flex flex-wrap gap-1.5 flex-1">
          {safeSelectedIds.map(id => {
            const proj = options.find(p => String(p.id) === String(id));
            if (!proj) return null;
            return (
              <span key={String(id)} className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase px-2 py-1 rounded flex items-center gap-1.5 border border-slate-200 dark:border-slate-600 shadow-sm">
                {proj.name}
                <X size={10} className="cursor-pointer hover:text-red-500" onClick={(e) => { e.stopPropagation(); handleSelect(id); }} />
              </span>
            );
          })}
        </div>
        <ChevronDown size={14} className="ml-auto text-slate-400" />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-[60] p-2">
            {options.map(proj => (
              <div key={proj.id} onClick={() => handleSelect(proj.id)} className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${safeSelectedIds.map(String).includes(String(proj.id)) ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${safeSelectedIds.map(String).includes(String(proj.id)) ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-slate-600'}`}>
                        {safeSelectedIds.map(String).includes(String(proj.id)) && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-white">{proj.name}</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

const Organization = () => {
  const { theme, currentUser, projects, positions, employees, timeEntries, addProject, updateProject, deleteProject, addPosition, updatePosition, deletePosition, updateEmployee, showToast, inviteEmployee } = useAppContext();
  const [activeTab, setActiveTab] = useState<'projects' | 'directory' | 'positions' | 'chart'>('projects');
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryView, setDirectoryView] = useState<'map' | 'list'>('list');
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('All');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectDetailTab, setProjectDetailTab] = useState<'tasks' | 'team' | 'logs'>('tasks');
  const [newTaskName, setNewTaskName] = useState('');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const viewInstanceRef = useRef<any>(null);
  const graphicsLayerRef = useRef<any>(null);
  const GraphicClassRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isImagery, setIsImagery] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState<any>(null);
  const [projectForm, setProjectForm] = useState<Partial<Project>>({ name: '', description: '', status: 'Active', tasks: [], dueDate: '' });
  const [positionForm, setPositionForm] = useState({ title: '', description: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const editMapRef = useRef<HTMLDivElement>(null);
  const [isEditImagery, setIsEditImagery] = useState(false);
  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;
  const canManageProject = isPowerUser || currentUser?.role === UserRole.MANAGER;
  
  const tree = useMemo(() => buildOrgTree(employees), [employees]);
  const projectTasks = useMemo(() => {
      if (!selectedProject?.tasks) return [];
      if (Array.isArray(selectedProject.tasks)) return selectedProject.tasks;
      if (typeof selectedProject.tasks === 'string') { try { const parsed = JSON.parse(selectedProject.tasks); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
      return [];
  }, [selectedProject]);

  const filteredDirectoryEmployees = useMemo(() => {
      const term = directorySearch.toLowerCase();
      return employees.filter(e => `${e.firstName} ${e.lastName}`.toLowerCase().includes(term) || (e.position || '').toLowerCase().includes(term) || (e.jobTitle || '').toLowerCase().includes(term) || (e.department || '').toLowerCase().includes(term) || (e.email || '').toLowerCase().includes(term));
  }, [employees, directorySearch]);

  const filteredProjects = useMemo(() => {
      return projects.filter(p => {
          const matchSearch = p.name.toLowerCase().includes(projectSearch.toLowerCase()) || (p.description || '').toLowerCase().includes(projectSearch.toLowerCase());
          const matchStatus = projectStatusFilter === 'All' || p.status === projectStatusFilter;
          return matchSearch && matchStatus;
      });
  }, [projects, projectSearch, projectStatusFilter]);

  const projectDetails = useMemo(() => {
      if (!selectedProject) return null;
      const team = employees.filter(e => getSafeProjectIds(e).map(String).includes(String(selectedProject.id)));
      const logs = timeEntries.filter(t => String(t.projectId) === String(selectedProject.id));
      const totalHours = logs.reduce((sum, l) => sum + l.durationMinutes + (l.extraMinutes || 0), 0) / 60;
      const taskStats: {name: string, hours: number}[] = [];
      logs.forEach(l => {
          const existing = taskStats.find(t => t.name === l.task);
          const h = (l.durationMinutes + (l.extraMinutes || 0)) / 60;
          if (existing) existing.hours += h; else taskStats.push({ name: l.task, hours: h });
      });
      return { team, logs, totalHours: totalHours.toFixed(1), taskStats };
  }, [selectedProject, employees, timeEntries]);

  useEffect(() => {
    if (activeTab !== 'directory' || directoryView !== 'map' || !mapContainerRef.current) return;
    setIsMapReady(false);
    loadModules(["esri/Map", "esri/views/MapView", "esri/Graphic", "esri/layers/GraphicsLayer", "esri/widgets/Home"], { css: true })
      .then(([EsriMap, MapView, Graphic, GraphicsLayer, Home]) => {
        if (!mapContainerRef.current) return;
        GraphicClassRef.current = Graphic;
        const map = new EsriMap({ basemap: isImagery ? "satellite" : "topo-vector" });
        const view = new MapView({ container: mapContainerRef.current, map: map, zoom: 3, center: [78.9629, 20.5937], ui: { components: ["zoom"] } });
        view.ui.add(new Home({ view }), "top-left");
        const layer = new GraphicsLayer();
        map.add(layer);
        viewInstanceRef.current = view;
        graphicsLayerRef.current = layer;
        view.when(() => { setIsMapReady(true); });
      });
    return () => { if (viewInstanceRef.current) { viewInstanceRef.current.destroy(); viewInstanceRef.current = null; setIsMapReady(false); } };
  }, [activeTab, directoryView, isImagery]);

  // Handle markers update on map
  useEffect(() => {
      if (isMapReady && graphicsLayerRef.current && GraphicClassRef.current) {
          graphicsLayerRef.current.removeAll();
          filteredDirectoryEmployees.forEach(emp => {
              const loc = parseLocation(emp.location);
              if (loc.latitude && loc.longitude) {
                  // Use brand blue (#00adef) for map markers
                  const graphic = new GraphicClassRef.current({
                      geometry: { type: "point", longitude: loc.longitude, latitude: loc.latitude },
                      symbol: { type: "simple-marker", color: [0, 173, 239], outline: { color: [255, 255, 255], width: 1.5 } }, 
                      popupTemplate: { title: `${emp.firstName} ${emp.lastName}`, content: emp.position || 'Team Member' },
                      attributes: emp
                  });
                  graphicsLayerRef.current.add(graphic);
              }
          });
      }
  }, [isMapReady, filteredDirectoryEmployees]);

  const handleCreateProject = async (e: React.FormEvent) => {
      e.preventDefault(); setIsProcessing(true);
      await addProject({ ...projectForm, id: Math.random().toString(36).substr(2, 9) } as Project);
      setIsProcessing(false); setShowProjectModal(false); showToast("Project created", "success");
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
      e.preventDefault(); if (!editingProject) return; setIsProcessing(true);
      await updateProject(editingProject.id, projectForm);
      setIsProcessing(false); setShowProjectModal(false); showToast("Project updated", "success");
  };

  const handleAddTask = async () => {
      if (!selectedProject || !newTaskName.trim()) return;
      let currentTasks = selectedProject.tasks || [];
      if (typeof currentTasks === 'string') { try { currentTasks = JSON.parse(currentTasks); } catch { currentTasks = []; } }
      if (currentTasks.includes(newTaskName.trim())) { showToast("Task already exists", "warning"); return; }
      const updatedTasks = [...currentTasks, newTaskName.trim()];
      setSelectedProject({ ...selectedProject, tasks: updatedTasks });
      setNewTaskName('');
      await updateProject(selectedProject.id, { tasks: updatedTasks });
      showToast("Task added", "success");
  };

  const handleDeleteTask = async (taskName: string) => {
      if (!selectedProject) return;
      if (!window.confirm(`Delete task "${taskName}"?`)) return;
      let currentTasks = selectedProject.tasks || [];
      if (typeof currentTasks === 'string') { try { currentTasks = JSON.parse(currentTasks); } catch { currentTasks = []; } }
      const updatedTasks = currentTasks.filter(t => t !== taskName);
      setSelectedProject({ ...selectedProject, tasks: updatedTasks });
      await updateProject(selectedProject.id, { tasks: updatedTasks });
      showToast("Task removed", "info");
  };

  const handleAddMember = async (empId: string | number) => {
      if (!selectedProject) return;
      const emp = employees.find(e => String(e.id) === String(empId));
      if (emp) {
          const currentIds = getSafeProjectIds(emp);
          if (!currentIds.map(String).includes(String(selectedProject.id))) {
              await updateEmployee({ ...emp, projectIds: [...currentIds, selectedProject.id] });
              showToast("Member added", "success");
          }
      }
  };

  const handleRemoveMember = async (empId: string | number) => {
      if (!selectedProject) return;
      const emp = employees.find(e => String(e.id) === String(empId));
      if (emp) {
          const currentIds = getSafeProjectIds(emp);
          await updateEmployee({ ...emp, projectIds: currentIds.filter(pid => String(pid) !== String(selectedProject.id)) });
          showToast("Member removed", "info");
      }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
      e.preventDefault(); if (!employeeFormData) return; setIsProcessing(true);
      try {
          const sanitized = sanitizeEmployeePayload(employeeFormData);
          if (editingEmployee) { await updateEmployee(sanitized); showToast("Employee updated", "success"); } else { await inviteEmployee(sanitized); showToast("Employee added/invited", "success"); }
          setShowEmployeeModal(false);
      } catch (e) { console.error(e); showToast("Failed to save employee", "error"); } finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Organization</h2><p className="text-slate-500 dark:text-slate-400 text-sm">Manage workforce, projects, and hierarchy.</p></div>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl overflow-x-auto shadow-inner">
               {[ { id: 'projects', label: 'Projects', icon: Layout }, { id: 'directory', label: 'Employees', icon: Users }, { id: 'positions', label: 'Positions', icon: Briefcase }, { id: 'chart', label: 'Org Chart', icon: Network } ].map(tab => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setSelectedProject(null); }} className={`px-5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap flex items-center gap-2.5 font-bold ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 shadow-md text-primary-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <tab.icon size={16} /><span>{tab.label}</span>
                  </button>
               ))}
            </div>
        </div>

        {activeTab === 'projects' && (
            <div className="space-y-6">
                {!selectedProject ? (
                    <>
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                           <div className="relative w-full md:w-96"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Search projects..." className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" value={projectSearch} onChange={e => setProjectSearch(e.target.value)} /></div>
                           <div className="flex gap-3">
                               <select className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm" value={projectStatusFilter} onChange={e => setProjectStatusFilter(e.target.value)}><option value="All">All Status</option><option value="Active">Active</option><option value="On Hold">On Hold</option><option value="Completed">Completed</option></select>
                               {isPowerUser && <button onClick={() => { setEditingProject(null); setProjectForm({name:'', description:'', status:'Active', tasks:[], dueDate:''}); setShowProjectModal(true); }} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-primary-700"><Plus size={16} /> New Project</button>}
                           </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredProjects.map(project => {
                                const teamCount = employees.filter(e => getSafeProjectIds(e).map(String).includes(String(project.id))).length;
                                return (
                                    <div key={project.id} onClick={() => setSelectedProject(project)} className="group bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all cursor-pointer relative overflow-hidden">
                                        <div className={`absolute top-0 left-0 w-1.5 h-full ${project.status === 'Active' ? 'bg-primary-500' : project.status === 'Completed' ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
                                        <div className="flex justify-between items-start mb-4 pl-3"><div><h3 className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-primary-600">{project.name}</h3><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{project.status}</span></div>{isPowerUser && <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); setEditingProject(project); setProjectForm(project as any); setShowProjectModal(true); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400"><Edit2 size={16}/></button><button onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-600"><Trash2 size={16}/></button></div>}</div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 pl-3 mb-4 min-h-[40px]">{project.description}</p>
                                        <div className="pl-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-4"><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Users size={14} /> <span>{teamCount} Members</span></div>{project.dueDate && <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Calendar size={14} /> <span>{new Date(project.dueDate).toLocaleDateString()}</span></div>}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-right-10 duration-300">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"><button onClick={() => setSelectedProject(null)} className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-primary-600"><ArrowLeft size={16} /> Back to Projects</button><div className="flex justify-between items-end"><div><h2 className="text-3xl font-black text-slate-800 dark:text-white">{selectedProject.name}</h2><p className="text-slate-500 max-w-2xl mt-2">{selectedProject.description}</p></div><div className="text-right"><p className="text-[10px] font-black uppercase text-slate-400">Total Hours</p><p className="text-2xl font-black text-primary-600">{projectDetails?.totalHours}</p></div></div></div>
                        <div className="flex border-b border-slate-200 dark:border-slate-700 px-6">{['tasks', 'team', 'logs'].map(tab => (<button key={tab} onClick={() => setProjectDetailTab(tab as any)} className={`py-4 px-6 text-sm font-bold border-b-2 capitalize ${projectDetailTab === tab ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500'}`}>{tab}</button>))}</div>
                        <div className="p-6">
                            {projectDetailTab === 'tasks' && ( <div className="space-y-4">{canManageProject && ( <div className="flex gap-2 mb-4"><input type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="Enter new task name..." className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" onKeyDown={(e) => e.key === 'Enter' && handleAddTask()} /><button onClick={handleAddTask} disabled={!newTaskName.trim()} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors">Add</button></div> )}<div className="space-y-3">{projectTasks && projectTasks.length > 0 ? ( projectTasks.map((task, i) => ( <div key={i} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800 group"><span className="font-bold text-slate-700 dark:text-slate-200">{task}</span><div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-400">{projectDetails?.taskStats.find(t => t.name === task)?.hours.toFixed(1) || 0} hrs</span>{canManageProject && ( <button onClick={() => handleDeleteTask(task)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1" title="Remove Task"><Trash2 size={16} /></button> )}</div></div> )) ) : <p className="text-slate-400 italic">No tasks defined.</p>}</div></div> )}
                            {projectDetailTab === 'team' && ( <div className="space-y-4"><div className="flex justify-between"><h4 className="font-bold text-slate-700 dark:text-white">Assigned Members</h4>{isPowerUser && <button onClick={() => setShowAddMemberModal(true)} className="text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg font-bold hover:bg-primary-100">+ Add Member</button>}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{projectDetails?.team.map(m => ( <div key={m.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-700"><img src={m.avatar} className="w-10 h-10 rounded-full" alt=""/><div className="flex-1"><p className="font-bold text-slate-800 dark:text-white">{m.firstName} {m.lastName}</p><p className="text-xs text-slate-500">{m.position}</p></div>{isPowerUser && <button onClick={() => handleRemoveMember(m.id)} className="text-slate-300 hover:text-red-500"><UserMinus size={16}/></button>}</div> ))}</div></div> )}
                            {projectDetailTab === 'logs' && ( <div className="space-y-2">{projectDetails?.logs.map(log => ( <div key={log.id} className="flex justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 border border-transparent hover:border-slate-100 text-sm"><div className="flex items-center gap-4"><span className="font-bold text-slate-700 dark:text-slate-200">{log.task}</span><span className="text-xs text-slate-500">{log.date}</span></div><span className="font-mono font-bold text-primary-600">{((log.durationMinutes + (log.extraMinutes || 0)) / 60).toFixed(2)}h</span></div> ))}</div> )}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Directory Tab */}
        {activeTab === 'directory' && (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                   <div className="relative w-full md:w-96"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Search employees..." className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" value={directorySearch} onChange={e => setDirectorySearch(e.target.value)} /></div>
                   <div className="flex gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                       <button onClick={() => setDirectoryView('list')} className={`p-2 rounded-md transition-all ${directoryView === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600' : 'text-slate-500'}`}><List size={18}/></button>
                       <button onClick={() => setDirectoryView('map')} className={`p-2 rounded-md transition-all ${directoryView === 'map' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600' : 'text-slate-500'}`}><MapPin size={18}/></button>
                   </div>
                </div>
                {directoryView === 'map' ? (
                   <div className="h-[60vh] bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-200 dark:border-slate-700 shadow-inner"><div ref={mapContainerRef} className="w-full h-full" /><div className="absolute top-4 right-4 z-10 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2"><button onClick={() => setIsImagery(!isImagery)} className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${isImagery ? 'text-primary-600' : 'text-slate-500'}`} title="Toggle Imagery"><Layers size={20}/></button></div></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredDirectoryEmployees.map(emp => ( <div key={emp.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group flex flex-col"><div className="flex items-center gap-4 mb-4"><img src={emp.avatar} className="w-14 h-14 rounded-full" alt=""/><div className="flex-1 overflow-hidden"><h4 className="font-bold text-slate-800 dark:text-white truncate">{emp.firstName} {emp.lastName}</h4><p className="text-xs text-primary-600 dark:text-primary-400 font-bold uppercase truncate">{emp.position}</p></div></div><div className="space-y-2 mb-6"><div className="flex items-center gap-3 text-xs text-slate-500"><Mail size={14}/> {emp.email}</div><div className="flex items-center gap-3 text-xs text-slate-500"><Building2 size={14}/> {emp.department}</div></div>{isPowerUser && <button onClick={() => { setEditingEmployee(emp); setEmployeeFormData({...emp, projectIds: getSafeProjectIds(emp)}); setShowEmployeeModal(true); }} className="mt-auto w-full py-2 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors uppercase tracking-widest border border-transparent hover:border-primary-100">Edit Profile</button>}</div> ))}</div>
                )}
            </div>
        )}

        {activeTab === 'chart' && ( <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-auto shadow-inner"><div className="org-tree-container min-w-max flex justify-center"><ul className="flex flex-row justify-center">{tree.map(root => <OrgChartNode key={root.id} node={root} />)}</ul></div></div> )}

        {activeTab === 'positions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {positions.map(pos => (
                    <div key={pos.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm group">
                        <div className="flex justify-between items-start mb-4"><div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-xl text-primary-600"><Briefcase size={24}/></div>{isPowerUser && <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingPosition(pos); setPositionForm({title: pos.title, description: pos.description}); setShowPositionModal(true); }} className="p-2 text-slate-400 hover:text-primary-600"><Edit2 size={16}/></button><button onClick={() => deletePosition(pos.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button></div>}</div>
                        <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{pos.title}</h4>
                        <p className="text-sm text-slate-500 line-clamp-3">{pos.description}</p>
                    </div>
                ))}
                {isPowerUser && <button onClick={() => { setEditingPosition(null); setPositionForm({title:'', description:''}); setShowPositionModal(true); }} className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-primary-600 hover:border-primary-200 transition-all"><Plus size={32}/><span className="font-bold">Add Position</span></button>}
            </div>
        )}

        <DraggableModal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title={editingProject ? 'Edit Project' : 'New Project'} width="max-w-lg">
            <form onSubmit={editingProject ? handleUpdateProject : handleCreateProject} className="space-y-4">
                <div><label className="block text-xs font-bold uppercase mb-1">Name</label><input required className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name:e.target.value})} /></div>
                <div><label className="block text-xs font-bold uppercase mb-1">Description</label><textarea className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description:e.target.value})} /></div>
                <div><label className="block text-xs font-bold uppercase mb-1">Status</label><select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={projectForm.status} onChange={e => setProjectForm({...projectForm, status:e.target.value as any})}><option>Active</option><option>On Hold</option><option>Completed</option></select></div>
                <div className="flex justify-end pt-4"><button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded font-bold hover:bg-primary-700 transition-colors">{isProcessing ? 'Saving...' : 'Save Project'}</button></div>
            </form>
        </DraggableModal>

        <DraggableModal isOpen={showPositionModal} onClose={() => setShowPositionModal(false)} title="Manage Position" width="max-w-sm">
            <form onSubmit={async (e) => { e.preventDefault(); if(editingPosition) await updatePosition(editingPosition.id, positionForm); else await addPosition({ ...positionForm, id: Math.random() } as Position); setShowPositionModal(false); }} className="space-y-4">
                <div><label className="block text-xs font-bold uppercase mb-1">Title</label><input required className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={positionForm.title} onChange={e => setPositionForm({...positionForm, title:e.target.value})} /></div>
                <div><label className="block text-xs font-bold uppercase mb-1">Description</label><textarea className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={positionForm.description} onChange={e => setPositionForm({...positionForm, description:e.target.value})} /></div>
                <div className="flex justify-end pt-4"><button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded font-bold hover:bg-primary-700 transition-colors">Save</button></div>
            </form>
        </DraggableModal>

        <DraggableModal isOpen={showEmployeeModal} onClose={() => setShowEmployeeModal(false)} title={editingEmployee ? 'Edit Employee Profile' : 'Add Employee'} width="max-w-2xl">
            <form onSubmit={handleUpdateEmployee} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold uppercase mb-1">First Name</label><input required className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={employeeFormData?.firstName || ''} onChange={e => setEmployeeFormData({...employeeFormData, firstName: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold uppercase mb-1">Last Name</label><input required className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={employeeFormData?.lastName || ''} onChange={e => setEmployeeFormData({...employeeFormData, lastName: e.target.value})} /></div>
                </div>
                <div><label className="block text-xs font-bold uppercase mb-1">Email</label><input required type="email" className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={employeeFormData?.email || ''} onChange={e => setEmployeeFormData({...employeeFormData, email: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold uppercase mb-1">Position</label><select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={employeeFormData?.position || ''} onChange={e => setEmployeeFormData({...employeeFormData, position: e.target.value})}>{positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}</select></div>
                    <div><label className="block text-xs font-bold uppercase mb-1">Role</label><select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={employeeFormData?.role || ''} onChange={e => setEmployeeFormData({...employeeFormData, role: e.target.value})}><option value="Employee">Employee</option><option value="Team Manager">Team Manager</option><option value="HR Manager">HR Manager</option><option value="Admin">Admin</option></select></div>
                </div>
                <MultiSelectProject options={projects} selectedIds={employeeFormData?.projectIds || []} onChange={(ids) => setEmployeeFormData({...employeeFormData, projectIds: ids})} />
                <div className="flex justify-end pt-4"><button type="submit" disabled={isProcessing} className="bg-primary-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50">{isProcessing ? 'Saving...' : 'Save Profile'}</button></div>
            </form>
        </DraggableModal>

        <DraggableModal isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)} title="Assign Team Member" width="max-w-md">
            <div className="space-y-4">
                <p className="text-sm text-slate-500">Select an employee to assign to <strong>{selectedProject?.name}</strong>.</p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                    {employees.filter(e => !getSafeProjectIds(e).map(String).includes(String(selectedProject?.id))).map(emp => (
                        <button key={emp.id} onClick={() => { handleAddMember(emp.id); setShowAddMemberModal(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                            <img src={emp.avatar} className="w-8 h-8 rounded-full" alt="" />
                            <div className="text-left"><p className="text-sm font-bold">{emp.firstName} {emp.lastName}</p><p className="text-[10px] text-slate-400 uppercase">{emp.position}</p></div>
                        </button>
                    ))}
                </div>
            </div>
        </DraggableModal>
    </div>
  );
};

export default Organization;
