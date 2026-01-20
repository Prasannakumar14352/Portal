import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Project, Employee, Position, EmployeeStatus } from '../types';
import { 
  Briefcase, Trash2, Edit2, Users, Plus, X, Network, MapPin, 
  Globe, Navigation, Map as MapIcon, ChevronDown, ChevronRight, 
  Calendar, Minus, Layout, Search, Locate, Target, UserPlus, 
  RefreshCw, MapPinned, Info, Building2, LocateFixed, Loader2, Shield, UserSquare, Layers,
  Mail, ChevronLeft, List, Grid, CheckCircle2, AlertCircle, Clock, Activity, BarChart3, ArrowLeft, UserCheck, UserMinus
} from 'lucide-react';
import EmployeeList from './EmployeeList';
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

const OrgChartNode: React.FC<{ node: TreeNode }> = ({ node }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  return (
    <li className="flex flex-col items-center px-4">
      <div className="flex flex-col items-center relative pb-8">
        <div className="org-node-card group bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-teal-500/50 transition-all w-48 relative z-10 cursor-pointer">
           <div className="flex flex-col items-center gap-2">
             <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-50 dark:border-slate-700 shadow-sm bg-slate-100">
                <img src={node.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(node.firstName)}+${encodeURIComponent(node.lastName)}`} className="w-full h-full object-cover" alt="" />
             </div>
             <div className="text-center w-full min-w-0">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{node.firstName} {node.lastName}</h4>
                <p className="text-[10px] text-teal-600 dark:text-teal-400 font-black uppercase tracking-wider mt-0.5 truncate">{node.position || node.jobTitle || 'Team Member'}</p>
                {node.department && <p className="text-[10px] text-slate-400 mt-1 truncate">{node.department}</p>}
             </div>
           </div>
        </div>
        {/* Connector Line Vertical */}
        {hasChildren && (
          <>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-8 bg-slate-300 dark:bg-slate-600"></div>
            <button 
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} 
                className={`absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center w-6 h-6 rounded-full border bg-white dark:bg-slate-700 shadow-md transition-colors ${expanded ? 'border-teal-500 text-teal-600' : 'border-slate-300 text-slate-400'}`}
            >
              {expanded ? <Minus size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
            </button>
          </>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="relative pt-4">
            {/* Horizontal Connector Line */}
            {node.children.length > 1 && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] h-px bg-slate-300 dark:bg-slate-600"></div>
            )}
            <ul className="flex flex-row justify-center gap-4">
            {node.children.map((child, idx) => (
                <div key={child.id} className="relative flex flex-col items-center">
                    {/* Vertical connector from horizontal line to child */}
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

// --- MultiSelect Component for Projects ---
const MultiSelectProject = ({ 
  options, 
  selectedIds, 
  onChange 
}: { 
  options: Project[], 
  selectedIds: (string | number)[], 
  onChange: (ids: (string | number)[]) => void
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string | number) => {
    const idStr = String(id);
    if (selectedIds.map(String).includes(idStr)) {
      onChange(selectedIds.filter(sid => String(sid) !== idStr));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Assigned Projects</label>
      <div 
        className="w-full min-h-[46px] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 shadow-inner transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedIds.length === 0 && <span className="text-slate-400 text-sm ml-1">No projects assigned...</span>}
        <div className="flex flex-wrap gap-1.5 flex-1">
          {selectedIds.map(id => {
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
        <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-[60] p-2">
            {options.length === 0 && <p className="text-xs text-slate-400 p-2 text-center">No projects available</p>}
            {options.map(proj => (
              <div key={proj.id} onClick={() => handleSelect(proj.id)} className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedIds.map(String).includes(String(proj.id)) ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}>
                <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedIds.map(String).includes(String(proj.id)) ? 'bg-teal-600 border-teal-600' : 'border-slate-300 dark:border-slate-600'}`}>
                        {selectedIds.map(String).includes(String(proj.id)) && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-white">{proj.name}</span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${proj.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{proj.status}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

const Organization = () => {
  const { theme, currentUser, projects, positions, employees, timeEntries, addProject, updateProject, deleteProject, addPosition, updatePosition, deletePosition, addEmployee, updateEmployee, deleteEmployee, showToast, syncAzureUsers, notify, sendProjectAssignmentEmail } = useAppContext();
  const [activeTab, setActiveTab] = useState<'projects' | 'directory' | 'positions' | 'chart'>('directory');
  
  // Directory State
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryView, setDirectoryView] = useState<'map' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Projects State
  const [projectView, setProjectView] = useState<'card' | 'list'>('card');
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectDetailTab, setProjectDetailTab] = useState<'tasks' | 'team' | 'logs'>('tasks');

  // Project Member Add State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState<string[]>([]);

  const [isImagery, setIsImagery] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const viewInstanceRef = useRef<any>(null);
  const graphicsLayerRef = useRef<any>(null);

  // Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [showAddModalQuick, setShowAddModalQuick] = useState(false); 
  
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState<any>(null);
  const [isEditImagery, setIsEditImagery] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const editMapRef = useRef<HTMLDivElement>(null);
  const editMapViewRef = useRef<any>(null);

  const [projectForm, setProjectForm] = useState({
      name: '', description: '', status: 'Active' as const, dueDate: '', tasks: [] as string[]
  });

  const [positionForm, setPositionForm] = useState({ title: '', description: '' });

  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;
  const tree = useMemo(() => buildOrgTree(employees), [employees]);

  const potentialManagers = useMemo(() => {
      return employees.filter(e => 
          (!editingEmployee || String(e.id) !== String(editingEmployee.id))
      );
  }, [employees, editingEmployee]);

  const filteredDirectoryEmployees = useMemo(() => {
      const term = directorySearch.toLowerCase();
      return employees.filter(e => 
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(term) ||
          (e.position || '').toLowerCase().includes(term) ||
          (e.jobTitle || '').toLowerCase().includes(term) ||
          (e.department || '').toLowerCase().includes(term) ||
          (e.email || '').toLowerCase().includes(term)
      );
  }, [employees, directorySearch]);

  const paginatedEmployees = useMemo(() => {
      return filteredDirectoryEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredDirectoryEmployees, currentPage, itemsPerPage]);

  const filteredProjects = useMemo(() => {
      const term = projectSearch.toLowerCase();
      return projects.filter(p => 
          p.name.toLowerCase().includes(term) ||
          (p.description || '').toLowerCase().includes(term) ||
          p.status.toLowerCase().includes(term)
      );
  }, [projects, projectSearch]);

  const totalPages = Math.ceil(filteredDirectoryEmployees.length / itemsPerPage);

  // Derived Data for Selected Project Details
  const projectDetails = useMemo(() => {
      if (!selectedProject) return null;

      // Filter Logs
      const logs = timeEntries.filter(t => String(t.projectId) === String(selectedProject.id));
      
      // Calculate Task Hours
      const taskHours: Record<string, number> = {};
      const definedTasks = Array.isArray(selectedProject.tasks) ? selectedProject.tasks : [];
      // Initialize defined tasks
      definedTasks.forEach(t => taskHours[t] = 0);
      
      logs.forEach(log => {
          const mins = log.durationMinutes + (log.extraMinutes || 0);
          taskHours[log.task] = (taskHours[log.task] || 0) + mins;
      });

      // Calculate Team Members (Strictly Assigned)
      const teamIds = new Set<string>();
      
      // Add explicitly assigned
      employees.forEach(emp => {
          if (emp.projectIds?.some(pid => String(pid) === String(selectedProject.id))) {
              teamIds.add(String(emp.id));
          }
      });
      // NOTE: Removed adding active loggers to team list to allow proper removal visibility
      // If needed, we can have a separate "Contributors" list for people with logs but no assignment.

      const team = employees.filter(e => teamIds.has(String(e.id)));

      return {
          logs: logs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          taskStats: Object.entries(taskHours).map(([name, mins]) => ({ name, hours: parseFloat((mins/60).toFixed(2)) })),
          team,
          totalHours: parseFloat((logs.reduce((sum, l) => sum + l.durationMinutes + (l.extraMinutes || 0), 0) / 60).toFixed(2))
      };
  }, [selectedProject, timeEntries, employees]);

  // List of employees NOT in the current project
  const availableEmployeesForProject = useMemo(() => {
      if (!projectDetails) return [];
      const currentMemberIds = projectDetails.team.map(m => String(m.id));
      return employees.filter(e => !currentMemberIds.includes(String(e.id)));
  }, [employees, projectDetails]);

  // Handle Main Basemap Updates
  useEffect(() => {
    const view = viewInstanceRef.current;
    if (!view || !view.map) return;
    
    if (isImagery) {
      view.map.basemap = "satellite";
    } else {
      view.map.basemap = theme === 'light' ? 'topo-vector' : 'dark-gray-vector';
    }
  }, [theme, isImagery]);

  // Handle Edit Modal Basemap Updates
  useEffect(() => {
    const view = editMapViewRef.current;
    if (!view || !view.map) return;
    
    if (isEditImagery) {
      view.map.basemap = "satellite";
    } else {
      view.map.basemap = theme === 'light' ? 'topo-vector' : 'dark-gray-vector';
    }
  }, [theme, isEditImagery]);

  // Main Map Hook
  useEffect(() => {
    if (activeTab !== 'directory' || directoryView !== 'map' || !mapContainerRef.current) return;

    loadModules([
      "esri/Map", "esri/views/MapView", "esri/Graphic", "esri/layers/GraphicsLayer", 
      "esri/widgets/Home"
    ], { css: true }).then(([EsriMap, MapView, Graphic, GraphicsLayer, Home]) => {
        if (!mapContainerRef.current) return;

        const initialBasemap = isImagery ? "satellite" : (theme === 'light' ? 'topo-vector' : 'dark-gray-vector');
        
        const map = new EsriMap({ basemap: initialBasemap });
        const view = new MapView({
          container: mapContainerRef.current,
          map: map,
          zoom: 4,
          center: [78.9629, 20.5937],
          ui: { components: ["zoom"] },
          popup: {
            dockEnabled: false,
            visibleElements: { closeButton: true }
          }
        });

        const graphicsLayer = new GraphicsLayer({ id: "employeePoints" });
        map.add(graphicsLayer);
        
        viewInstanceRef.current = view;
        graphicsLayerRef.current = graphicsLayer;

        view.when(() => {
            (view.ui as any).add(new Home({ view: view }));
            refreshMapMarkers(filteredDirectoryEmployees);
        }).catch((err: any) => console.error("Map initialization failed", err));
    }).catch(err => console.error("ArcGIS load failed:", err));

    return () => {
        if (viewInstanceRef.current) {
            viewInstanceRef.current.destroy();
            viewInstanceRef.current = null;
            graphicsLayerRef.current = null;
        }
    };
  }, [activeTab, directoryView]);

  // Sync Markers effect
  useEffect(() => {
    if (activeTab === 'directory' && directoryView === 'map' && graphicsLayerRef.current) {
        refreshMapMarkers(filteredDirectoryEmployees);
    }
  }, [filteredDirectoryEmployees, activeTab, directoryView]);

  // Edit Modal Map Hook
  useEffect(() => {
    if ((!editingEmployee && !showAddModalQuick) || !editMapRef.current) return;

    loadModules([
      "esri/Map", "esri/views/MapView", "esri/Graphic", "esri/layers/GraphicsLayer",
      "esri/widgets/Home"
    ], { css: true })
      .then(([EsriMap, MapView, Graphic, GraphicsLayer, Home]) => {
        const initialBasemap = isEditImagery ? "satellite" : (theme === 'light' ? 'topo-vector' : 'dark-gray-vector');
        const map = new EsriMap({ basemap: initialBasemap });
        const view = new MapView({
          container: editMapRef.current!,
          map: map,
          zoom: 5,
          center: [employeeFormData?.location?.longitude || 78.9, employeeFormData?.location?.latitude || 20.5],
          ui: { components: ["zoom"] }
        });

        view.when(() => {
            (view.ui as any).add(new Home({ view: view }));
        });

        const layer = new GraphicsLayer();
        map.add(layer);
        editMapViewRef.current = view;

        const updateMarker = (lon: number, lat: number) => {
            layer.removeAll();
            layer.add(new Graphic({ 
              geometry: { type: "point", longitude: lon, latitude: lat, spatialReference: { wkid: 4326 } }, 
              symbol: { 
                  type: "simple-marker", 
                  style: "circle", 
                  color: [13, 148, 136, 0.9], 
                  size: "14px", 
                  outline: { color: [255, 255, 255], width: 2 } 
              }
            }));
        };

        if (employeeFormData?.location?.latitude) {
            updateMarker(employeeFormData.location.longitude, employeeFormData.location.latitude);
        }

        view.on("click", (e: any) => {
            const { longitude, latitude } = e.mapPoint;
            updateMarker(longitude, latitude);
            setEmployeeFormData((prev: any) => {
                const currentLocation = prev?.location && typeof prev.location === 'object' ? prev.location : {};
                return { ...prev, location: { ...currentLocation, latitude, longitude } };
            });
        });
      });

    return () => editMapViewRef.current?.destroy();
  }, [!!editingEmployee, showAddModalQuick]);

  const refreshMapMarkers = async (list: Employee[]) => {
      // ... (keep existing implementation)
      if (!graphicsLayerRef.current) return;
      const [Graphic] = await loadModules(["esri/Graphic"]);
      graphicsLayerRef.current.removeAll();
      
      list.forEach(emp => {
          const lat = parseFloat(String(emp.location?.latitude));
          const lon = parseFloat(String(emp.location?.longitude));
          
          if (!isNaN(lat) && !isNaN(lon)) {
              const avatarUrl = emp.avatar && emp.avatar.startsWith('http') 
                        ? emp.avatar 
                        : `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.firstName)}+${encodeURIComponent(emp.lastName)}&background=0D9488&color=fff`;

              const graphic = new Graphic({
                  geometry: { type: "point", longitude: lon, latitude: lat, spatialReference: { wkid: 4326 } },
                  symbol: { 
                      type: "simple-marker", 
                      style: "circle", 
                      color: [13, 148, 136, 0.9], 
                      size: 16, 
                      outline: { color: [255, 255, 255], width: 3 } 
                  },
                  attributes: { 
                      id: emp.id, 
                      name: `${emp.firstName} ${emp.lastName}`,
                      position: emp.position || emp.jobTitle || 'Team Member',
                      email: emp.email || 'N/A',
                      workLocation: emp.workLocation || 'Office',
                      avatar: avatarUrl
                  },
                  popupTemplate: {
                      title: "{name}",
                      content: `
                        <div style="font-family: 'Inter', sans-serif; min-width: 250px; border-radius: 16px; overflow: hidden; background: white;">
                            <div style="background:#0d9488; height: 60px; position:relative;">
                                <img src="{avatar}" style="width: 50px; height: 50px; border-radius: 14px; border: 3px solid white; position: absolute; bottom: -20px; left: 20px; object-fit: cover; background: #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);" />
                            </div>
                            <div style="padding: 25px 20px 20px 20px;">
                                <h4 style="margin: 0; font-weight: 800; font-size: 16px; color: #1e293b;">{name}</h4>
                                <p style="margin: 2px 0; color: #0d9488; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">{position}</p>
                                <div style="margin-top: 15px; border-top: 1px solid #f1f5f9; padding-top: 12px; font-size: 12px; color: #64748b;">
                                    <p style="margin: 5px 0; display: flex; align-items: center; gap: 8px;">📍 {workLocation}</p>
                                    <p style="margin: 5px 0; display: flex; align-items: center; gap: 8px;">📧 {email}</p>
                                </div>
                            </div>
                        </div>
                      `
                  }
              });
              graphicsLayerRef.current.add(graphic);
          }
      });
  };

  const focusEmployeeOnMap = (emp: Employee) => {
      // ... (keep existing implementation)
      if (!viewInstanceRef.current || !emp.location) {
          showToast(`No location set for ${emp.firstName}.`, "warning");
          return;
      }
      viewInstanceRef.current.goTo({ target: [emp.location.longitude, emp.location.latitude], zoom: 12 }, { duration: 1500, easing: "ease-in-out" })
        .then(() => {
            const matchingGraphic = graphicsLayerRef.current?.graphics?.find((g: any) => String(g.attributes.id) === String(emp.id));
            if (matchingGraphic) viewInstanceRef.current.popup.open({ features: [matchingGraphic], location: matchingGraphic.geometry });
        });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
      // ... (keep existing implementation)
      e.preventDefault();
      setIsProcessing(true);
      await addProject({ ...projectForm, id: Math.random().toString(36).substr(2, 9) });
      setShowProjectModal(false);
      setProjectForm({ name: '', description: '', status: 'Active', dueDate: '', tasks: [] });
      showToast("New project created.", "success");
      setIsProcessing(false);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
      // ... (keep existing implementation)
      e.preventDefault();
      if (!editingProject) return;
      setIsProcessing(true);
      await updateProject(editingProject.id, editingProject);
      setIsProcessing(false);
      setEditingProject(null);
      showToast("Project updated.", "success");
  };

  // Add members to project logic
  const handleAddMembersToProject = async () => {
      if (!selectedProject || membersToAdd.length === 0) return;
      setIsProcessing(true);
      
      try {
          let count = 0;
          for (const empId of membersToAdd) {
              const emp = employees.find(e => String(e.id) === String(empId));
              if (emp) {
                  const currentProjects = emp.projectIds || [];
                  if (!currentProjects.map(String).includes(String(selectedProject.id))) {
                      const updatedProjects = [...currentProjects, selectedProject.id];
                      await updateEmployee({ ...emp, projectIds: updatedProjects });
                      count++;

                      // Notification Logic
                      const message = `You have been assigned to project: ${selectedProject.name}`;
                      const userSettings = emp.settings || {};
                      const notifications = userSettings.notifications || {};

                      if (notifications.pushWeb !== false) {
                          await notify(message, emp.id);
                      }
                      
                      if (notifications.systemAlerts !== false) {
                          await sendProjectAssignmentEmail({
                              email: emp.email,
                              name: emp.firstName,
                              projectName: selectedProject.name,
                              managerName: currentUser?.name || 'HR Management'
                          });
                      }
                  }
              }
          }
          if (count > 0) {
              showToast(`${count} members added to project.`, "success");
          } else {
              showToast("Selected members are already in the project.", "info");
          }
          setShowAddMemberModal(false);
          setMembersToAdd([]);
      } catch (error) {
          showToast("Failed to add members.", "error");
      } finally {
          setIsProcessing(false);
      }
  };

  // Remove members from project logic
  const handleRemoveMemberFromProject = async (empId: string | number) => {
      if (!selectedProject) return;
      if (!window.confirm(`Are you sure you want to remove this member from ${selectedProject.name}?`)) return;

      setIsProcessing(true);
      try {
          const emp = employees.find(e => String(e.id) === String(empId));
          if (emp) {
              const currentProjects = emp.projectIds || [];
              const updatedProjects = currentProjects.filter(pid => String(pid) !== String(selectedProject.id));
              
              await updateEmployee({ ...emp, projectIds: updatedProjects });
              
              // Notify
              const message = `You have been removed from project: ${selectedProject.name}`;
              const userSettings = emp.settings || {};
              const notifications = userSettings.notifications || {};
              
              if (notifications.pushWeb !== false) {
                  await notify(message, emp.id);
              }
              
              showToast("Member removed from project.", "success");
          }
      } catch (error) {
          showToast("Failed to remove member.", "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!employeeFormData) return;
      setIsProcessing(true);
      
      if (editingEmployee) {
          // Detect added projects for notification
          const oldProjectIds = editingEmployee.projectIds || [];
          const newProjectIds = employeeFormData.projectIds || [];
          const addedIds = newProjectIds.filter((id: string|number) => !oldProjectIds.includes(id));

          await updateEmployee(employeeFormData);
          
          // Send Notifications
          if (addedIds.length > 0) {
              addedIds.forEach(async (pid: string|number) => {
                  const project = projects.find(p => String(p.id) === String(pid));
                  if (project) {
                      const message = `You have been assigned to project: ${project.name}`;
                      const userSettings = employeeFormData.settings || {};
                      const notifications = userSettings.notifications || {};
                      
                      if (notifications.pushWeb !== false) {
                          await notify(message, employeeFormData.id);
                      }
                      if (notifications.systemAlerts !== false) {
                          await sendProjectAssignmentEmail({
                              email: employeeFormData.email,
                              name: employeeFormData.firstName,
                              projectName: project.name,
                              managerName: currentUser?.name || 'HR Management'
                          });
                      }
                  }
              });
          }

          setEditingEmployee(null);
      } else {
          // It's a new employee from the quick add
          const { provisionInAzure, ...empData } = employeeFormData;
          await useAppContext().inviteEmployee(empData);
          setShowAddModalQuick(false);
      }
      setIsProcessing(false);
      showToast("Records synchronized.", "success");
  };

  const handlePositionSubmit = async (e: React.FormEvent) => {
      // ... (keep existing implementation)
      e.preventDefault();
      setIsProcessing(true);
      try {
        if (editingPosition) {
            await updatePosition(editingPosition.id, { ...editingPosition, ...positionForm });
            setEditingPosition(null);
            showToast("Position updated.", "success");
        } else {
            await addPosition({ ...positionForm, id: Math.random().toString(36).substr(2, 9) });
            showToast("Position created.", "success");
        }
        setShowPositionModal(false);
        setPositionForm({ title: '', description: '' });
      } catch(err) {
        showToast("Operation failed.", "error");
      } finally {
        setIsProcessing(false);
      }
  };

  const handleSync = async () => {
      setIsSyncing(true);
      await syncAzureUsers();
      setIsSyncing(false);
  };

  const openQuickAdd = () => {
      setEditingEmployee(null);
      setEmployeeFormData({
          firstName: '', lastName: '', email: '', role: UserRole.EMPLOYEE,
          salary: 0, position: '', provisionInAzure: false, managerId: '',
          projectIds: [],
          location: { latitude: 20.5937, longitude: 78.9629, address: '' }
      });
      setShowAddModalQuick(true);
  };

  const getInitials = (fname: string, lname: string) => {
      return `${fname.charAt(0)}${lname.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="space-y-6 animate-fade-in relative text-slate-800 dark:text-slate-200 pb-16">
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Organization</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Manage workforce directory and global business operations.</p>
          </div>
          {/* ... (keep tabs) */}
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl overflow-x-auto shadow-inner">
               {[
                 { id: 'projects', label: 'Projects', icon: Layout },
                 { id: 'directory', label: 'Employees', icon: Users },
                 { id: 'positions', label: 'Positions', icon: Briefcase },
                 { id: 'chart', label: 'Org Chart', icon: Network }
               ].map(tab => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setSelectedProject(null); }} className={`px-5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap flex items-center gap-2.5 font-bold ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 shadow-md text-teal-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <tab.icon size={16} />
                    <span>{tab.label}</span>
                  </button>
               ))}
            </div>
            {/* ... (keep buttons) */}
            {activeTab === 'projects' && isPowerUser && !selectedProject && (
                <button onClick={() => setShowProjectModal(true)} className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-black shadow-lg shadow-teal-500/20"><Plus size={18} /><span>NEW PROJECT</span></button>
            )}
            {activeTab === 'positions' && isPowerUser && (
                <button onClick={() => { setEditingPosition(null); setPositionForm({ title: '', description: '' }); setShowPositionModal(true); }} className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-black shadow-lg shadow-teal-500/20"><Plus size={18} /><span>NEW POSITION</span></button>
            )}
            {activeTab === 'directory' && isPowerUser && (
                <div className="flex gap-2">
                    <button onClick={() => setShowManageModal(true)} className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-black shadow-lg shadow-teal-500/20"><UserPlus size={18} /><span>MANAGE</span></button>
                </div>
            )}
          </div>
       </div>

       {/* ... (keep existing Tabs content for Directory, Projects, Positions, Chart) */}
       {activeTab === 'directory' && (
           // ... (directory content remains same)
           <div className="space-y-4">
                <div className="flex justify-end mb-2">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button 
                            onClick={() => setDirectoryView('list')} 
                            className={`p-2 rounded-lg transition-all ${directoryView === 'list' ? 'bg-white dark:bg-slate-700 shadow text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
                            title="List View"
                        >
                            <List size={18} />
                        </button>
                        <button 
                            onClick={() => setDirectoryView('map')} 
                            className={`p-2 rounded-lg transition-all ${directoryView === 'map' ? 'bg-white dark:bg-slate-700 shadow text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Map View"
                        >
                            <Grid size={18} />
                        </button>
                    </div>
                </div>

               {directoryView === 'list' ? (
                   <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                       <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                           <h3 className="font-bold text-lg text-slate-800 dark:text-white">Team Members</h3>
                           <div className="relative w-full sm:w-64">
                               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                               <input 
                                    type="text" 
                                    placeholder="Search users..." 
                                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium"
                                    value={directorySearch}
                                    onChange={e => setDirectorySearch(e.target.value)}
                               />
                           </div>
                       </div>
                       
                       <div className="divide-y divide-slate-100 dark:divide-slate-700">
                           {paginatedEmployees.map(emp => (
                               <div key={emp.id} className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors group">
                                   <div className="flex items-center gap-4 w-full sm:w-auto">
                                       <div className="w-10 h-10 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm">
                                           {getInitials(emp.firstName, emp.lastName)}
                                       </div>
                                       <div>
                                           <h4 className="font-bold text-slate-800 dark:text-white">{emp.firstName} {emp.lastName}</h4>
                                           <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{emp.position || emp.jobTitle || 'Team Member'}</p>
                                       </div>
                                   </div>
                                   <a 
                                        href={`mailto:${emp.email}`}
                                        className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2 font-medium w-full sm:w-auto justify-start sm:justify-end hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                   >
                                       <Mail size={16} className="text-slate-400 group-hover:text-teal-500 transition-colors" />
                                       {emp.email}
                                   </a>
                               </div>
                           ))}
                           {paginatedEmployees.length === 0 && (
                               <div className="p-12 text-center text-slate-400 italic">No employees found.</div>
                           )}
                       </div>

                       <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center text-sm text-slate-500 dark:text-slate-400 gap-4">
                           <span>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredDirectoryEmployees.length)} of {filteredDirectoryEmployees.length} members</span>
                           <div className="flex items-center gap-1">
                               <button 
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                               >
                                   <ChevronLeft size={16} /> Previous
                               </button>
                               <div className="flex gap-1 px-2">
                                   {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                    .map((p, i, arr) => (
                                       <React.Fragment key={p}>
                                           {i > 0 && arr[i-1] !== p - 1 && <span className="px-1 self-end pb-1">...</span>}
                                           <button 
                                                onClick={() => setCurrentPage(p)}
                                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${currentPage === p ? 'bg-teal-600 text-white shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600'}`}
                                           >
                                               {p}
                                           </button>
                                       </React.Fragment>
                                   ))}
                               </div>
                               <button 
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                               >
                                   Next <ChevronRight size={16} />
                               </button>
                           </div>
                       </div>
                   </div>
               ) : (
                   /* Map View - Responsive Grid with auto height handling on mobile to prevent overlap */
                   <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[740px]">
                       {/* ... (keep map view) */}
                       <div className="lg:col-span-4 flex flex-col gap-4 h-[500px] lg:h-full">
                           <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                               <div className="relative">
                                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                   <input 
                                        type="text" 
                                        placeholder="Search directory..." 
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all dark:text-white font-medium shadow-inner"
                                        value={directorySearch}
                                        onChange={e => setDirectorySearch(e.target.value)}
                                   />
                               </div>
                           </div>

                           <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm min-h-0">
                               <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Building2 size={14} className="text-teal-600"/> Corporate Directory</h3>
                                   <div className="flex items-center gap-2">
                                        {isPowerUser && (
                                            <button 
                                                onClick={openQuickAdd}
                                                className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition shadow-sm"
                                                title="Quick Add Employee"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        )}
                                        <div className="bg-teal-50 dark:bg-teal-900/40 px-2.5 py-1 rounded-lg border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400 text-[10px] font-black uppercase">
                                            {filteredDirectoryEmployees.length} Total
                                        </div>
                                   </div>
                               </div>
                               <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                                   {filteredDirectoryEmployees.map(emp => (
                                       <div 
                                            key={emp.id} 
                                            onClick={() => focusEmployeeOnMap(emp)}
                                            className="w-full flex items-center text-left p-4 rounded-2xl hover:bg-teal-50/50 dark:hover:bg-teal-900/20 group border border-transparent hover:border-teal-100 dark:hover:border-teal-800 transition-all cursor-pointer"
                                       >
                                           <div className="flex items-center gap-4 flex-1 min-w-0">
                                               <div className="relative">
                                                   <img src={emp.avatar} className="w-12 h-12 rounded-xl object-cover shadow-sm border border-white dark:border-slate-700 bg-slate-100" alt="" />
                                                   <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${emp.status === EmployeeStatus.ACTIVE ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
                                               </div>
                                               <div className="min-w-0 flex-1">
                                                   <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm leading-tight">{emp.firstName} {emp.lastName}</p>
                                                   <p className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-tighter mt-1">{emp.position || emp.jobTitle || 'Team Member'}</p>
                                                   <div className="flex items-center gap-1.5 mt-1.5 text-slate-400">
                                                       <MapPin size={10} className="shrink-0" /><span className="text-[10px] font-bold truncate leading-none">{emp.workLocation || 'Not Set'}</span>
                                                   </div>
                                               </div>
                                           </div>
                                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                               {isPowerUser && (
                                                   <button 
                                                        onClick={(e) => { e.stopPropagation(); setEditingEmployee(emp); setEmployeeFormData({...emp, projectIds: emp.projectIds || []}); }} 
                                                        className="p-2 text-slate-400 hover:text-teal-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-600 transition-all"
                                                        title="Edit Record"
                                                   >
                                                       <Edit2 size={14} />
                                                   </button>
                                               )}
                                               <ChevronRight size={18} className="text-slate-300" />
                                           </div>
                                       </div>
                                   ))}
                               </div>
                           </div>
                       </div>

                       <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-2xl shadow-slate-200/50 dark:shadow-black/50 h-[500px] lg:h-full">
                           <div ref={mapContainerRef} className="w-full h-full z-0 grayscale-[0.2] contrast-[1.1]"></div>
                           {/* ... (Map overlays) */}
                       </div>
                   </div>
               )}
           </div>
       )}

       {/* ... (Projects Tab Content - unchanged) */}
       {/* ... (Positions Tab Content - unchanged) */}
       {/* ... (Chart Tab Content - unchanged) */}
       {activeTab === 'projects' && !selectedProject && (
           <div className="space-y-6">
               {/* Controls Header */}
               <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-72">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input 
                           type="text" 
                           placeholder="Search projects..." 
                           value={projectSearch}
                           onChange={(e) => setProjectSearch(e.target.value)}
                           className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all font-medium dark:text-white"
                       />
                   </div>
                   <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                       <button 
                           onClick={() => setProjectView('card')} 
                           className={`p-2 rounded-lg transition-all ${projectView === 'card' ? 'bg-white dark:bg-slate-700 shadow text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
                           title="Card View"
                       >
                           <Grid size={18} />
                       </button>
                       <button 
                           onClick={() => setProjectView('list')} 
                           className={`p-2 rounded-lg transition-all ${projectView === 'list' ? 'bg-white dark:bg-slate-700 shadow text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
                           title="List View"
                       >
                           <List size={18} />
                       </button>
                   </div>
               </div>

               {projectView === 'card' ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {filteredProjects.map(proj => (
                           <div key={proj.id} onClick={() => setSelectedProject(proj)} className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all hover:border-teal-500/50 flex flex-col h-full cursor-pointer">
                               {/* ... (Project Card Content) */}
                               <div className="flex justify-between items-start mb-4">
                                   <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                                       <Layout size={24} />
                                   </div>
                                   <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${proj.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                       {proj.status}
                                   </span>
                               </div>
                               <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 line-clamp-1">{proj.name}</h3>
                               <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 flex-1 line-clamp-3 leading-relaxed">{proj.description}</p>
                               
                               <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700">
                                   <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                       <Clock size={14} />
                                       <span>{proj.dueDate || 'No Deadline'}</span>
                                   </div>
                                   {isPowerUser && (
                                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <button onClick={(e) => { e.stopPropagation(); setEditingProject(proj); setProjectForm(proj as any); setShowProjectModal(true); }} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-blue-50 transition-colors"><Edit2 size={14} /></button>
                                           <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete project?')) deleteProject(proj.id); }} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                                       </div>
                                   )}
                               </div>
                           </div>
                       ))}
                       {isPowerUser && (
                           <button onClick={() => setShowProjectModal(true)} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 hover:text-teal-600 hover:border-teal-200 hover:bg-teal-50/30 transition-all group min-h-[250px]">
                               <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full mb-3 group-hover:bg-white shadow-sm transition-colors">
                                   <Plus size={32} />
                               </div>
                               <span className="font-bold text-sm">Launch New Project</span>
                           </button>
                       )}
                   </div>
               ) : (
                   <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                       <div className="overflow-x-auto">
                           <table className="w-full text-left">
                               <thead>
                                   <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b dark:border-slate-700">
                                       <th className="px-6 py-4">Project Name</th>
                                       <th className="px-6 py-4">Status</th>
                                       <th className="px-6 py-4">Tasks</th>
                                       <th className="px-6 py-4">Due Date</th>
                                       <th className="px-6 py-4">Description</th>
                                       {isPowerUser && <th className="px-6 py-4 text-right">Actions</th>}
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                   {filteredProjects.map(proj => (
                                       <tr key={proj.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors text-sm cursor-pointer" onClick={() => setSelectedProject(proj)}>
                                           {/* ... (Project List Rows) */}
                                           <td className="px-6 py-4 font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                               <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                                   <Layout size={16} />
                                               </div>
                                               {proj.name}
                                           </td>
                                           <td className="px-6 py-4">
                                               <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${proj.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                   {proj.status}
                                               </span>
                                           </td>
                                           <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium text-xs">
                                               {Array.isArray(proj.tasks) ? proj.tasks.length : 0} defined
                                           </td>
                                           <td className="px-6 py-4 font-mono text-xs text-slate-500">{proj.dueDate || 'N/A'}</td>
                                           <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={proj.description}>{proj.description}</td>
                                           {isPowerUser && (
                                               <td className="px-6 py-4 text-right">
                                                   <div className="flex justify-end gap-2">
                                                       <button onClick={(e) => { e.stopPropagation(); setEditingProject(proj); setProjectForm(proj as any); setShowProjectModal(true); }} className="p-2 text-slate-400 hover:text-blue-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-200 transition-all"><Edit2 size={14} /></button>
                                                       <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete project?')) deleteProject(proj.id); }} className="p-2 text-slate-400 hover:text-red-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-red-200 transition-all"><Trash2 size={14} /></button>
                                                   </div>
                                               </td>
                                           )}
                                       </tr>
                                   ))}
                                   {filteredProjects.length === 0 && (
                                       <tr>
                                           <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No projects found.</td>
                                       </tr>
                                   )}
                               </tbody>
                           </table>
                       </div>
                   </div>
               )}
           </div>
       )}

       {/* Detailed Project View (Drill-Down) */}
       {activeTab === 'projects' && selectedProject && projectDetails && (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
               {/* ... (Detailed View Content - unchanged) */}
               {/* Breadcrumb Navigation */}
               <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                   <button onClick={() => setSelectedProject(null)} className="hover:text-teal-600 hover:underline">Projects</button>
                   <ChevronRight size={14} />
                   <span className="font-bold text-slate-800 dark:text-white truncate">{selectedProject.name}</span>
               </div>

               {/* Project Header Card */}
               <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 dark:bg-teal-900/10 rounded-bl-full -mr-8 -mt-8"></div>
                   
                   <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                       <div className="space-y-2">
                           <div className="flex items-center gap-3">
                               <div className="p-3 bg-teal-50 dark:bg-teal-900/30 rounded-xl text-teal-600 dark:text-teal-400">
                                   <Layout size={28} />
                               </div>
                               <div>
                                   <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{selectedProject.name}</h2>
                                   <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${selectedProject.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                                       {selectedProject.status}
                                   </span>
                               </div>
                           </div>
                           <p className="text-slate-500 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
                               {selectedProject.description || 'No specific description provided for this project.'}
                           </p>
                           <div className="flex items-center gap-4 pt-2">
                               <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                   <Clock size={14} />
                                   <span>Due: {selectedProject.dueDate || 'No Deadline'}</span>
                               </div>
                           </div>
                       </div>

                       <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-right min-w-[140px]">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Effort</p>
                           <p className="text-3xl font-black text-slate-800 dark:text-white">{projectDetails.totalHours} <span className="text-sm font-bold text-slate-400">hrs</span></p>
                       </div>
                   </div>
               </div>

               {/* Tabs Navigation */}
               <div className="flex border-b border-slate-200 dark:border-slate-700">
                   {['tasks', 'team', 'logs'].map(tab => (
                       <button
                           key={tab}
                           onClick={() => setProjectDetailTab(tab as any)}
                           className={`px-6 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${projectDetailTab === tab ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                       >
                           {tab === 'logs' ? 'Activity Log' : tab === 'team' ? 'Project Team' : 'Tasks Overview'}
                       </button>
                   ))}
               </div>

               {/* Tab Content - (Keep existing content for tasks, team, logs) */}
               <div className="min-h-[400px]">
                   {projectDetailTab === 'tasks' && (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {projectDetails.taskStats.length > 0 ? (
                               projectDetails.taskStats.map((stat, idx) => (
                                   <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                       <div className="flex items-start justify-between mb-4">
                                           <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                               <Activity size={20} />
                                           </div>
                                           <span className="font-mono text-xl font-bold text-slate-800 dark:text-white">{stat.hours}h</span>
                                       </div>
                                       <div>
                                           <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-1">{stat.name}</h4>
                                           <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                               <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (stat.hours / projectDetails.totalHours) * 100)}%` }}></div>
                                           </div>
                                       </div>
                                   </div>
                               ))
                           ) : (
                               <div className="col-span-full py-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                   <p className="text-slate-400 italic">No tasks tracked yet.</p>
                               </div>
                           )}
                       </div>
                   )}

                   {projectDetailTab === 'team' && (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {/* Add Team Member Card for HR/Admin */}
                           {isPowerUser && (
                               <button 
                                   onClick={() => { setMembersToAdd([]); setShowAddMemberModal(true); }}
                                   className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-teal-600 hover:border-teal-200 hover:bg-teal-50/30 transition-all group min-h-[120px]"
                               >
                                   <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full mb-2 group-hover:bg-white shadow-sm transition-colors">
                                       <UserPlus size={24} />
                                   </div>
                                   <span className="font-bold text-xs uppercase tracking-wide">Add Team Member</span>
                               </button>
                           )}

                           {projectDetails.team.map(member => (
                               <div key={member.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:border-teal-200 dark:hover:border-teal-800 transition-colors relative group">
                                   <img src={member.avatar} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700" />
                                   <div>
                                       <h4 className="font-bold text-slate-800 dark:text-white">{member.firstName} {member.lastName}</h4>
                                       <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-tight mb-0.5">{member.position || member.role}</p>
                                       <p className="text-[10px] text-slate-400">{member.email}</p>
                                   </div>
                                   {isPowerUser && (
                                       <button 
                                            onClick={(e) => { e.stopPropagation(); handleRemoveMemberFromProject(member.id); }}
                                            className="absolute top-2 right-2 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="Remove from Project"
                                       >
                                           <UserMinus size={16} />
                                       </button>
                                   )}
                               </div>
                           ))}
                           
                           {projectDetails.team.length === 0 && !isPowerUser && (
                               <div className="col-span-full py-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                   <Users size={40} className="mx-auto text-slate-300 mb-3" />
                                   <p className="text-slate-500 dark:text-slate-400">No active team members assigned.</p>
                               </div>
                           )}
                       </div>
                   )}

                   {projectDetailTab === 'logs' && (
                       <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                           <table className="w-full text-left text-sm">
                               <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-700">
                                   <tr>
                                       <th className="px-6 py-4">Date</th>
                                       <th className="px-6 py-4">Employee</th>
                                       <th className="px-6 py-4">Task</th>
                                       <th className="px-6 py-4">Description</th>
                                       <th className="px-6 py-4 text-right">Duration</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                   {projectDetails.logs.map(log => {
                                       const user = employees.find(u => String(u.id) === String(log.userId));
                                       return (
                                           <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                               <td className="px-6 py-4 font-mono text-xs text-slate-500">{log.date}</td>
                                               <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200 text-xs">
                                                   {user ? `${user.firstName} ${user.lastName}` : 'Unknown'}
                                               </td>
                                               <td className="px-6 py-4">
                                                   <span className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide">
                                                       {log.task}
                                                   </span>
                                               </td>
                                               <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={log.description}>{log.description}</td>
                                               <td className="px-6 py-4 text-right font-mono font-bold text-slate-800 dark:text-white">
                                                   {Math.floor((log.durationMinutes + (log.extraMinutes || 0)) / 60)}h {(log.durationMinutes + (log.extraMinutes || 0)) % 60}m
                                               </td>
                                           </tr>
                                       );
                                   })}
                                   {projectDetails.logs.length === 0 && (
                                       <tr><td colSpan={5} className="text-center py-12 text-slate-400 italic">No activity logs recorded yet.</td></tr>
                                   )}
                               </tbody>
                           </table>
                       </div>
                   )}
               </div>
           </div>
       )}

       {/* ... (Positions and Chart tabs - unchanged) */}
       {activeTab === 'positions' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {positions.map(pos => (
                   <div key={pos.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col relative group">
                       <div className="flex items-center gap-3 mb-4">
                           <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                               <Briefcase size={20} />
                           </div>
                           <h3 className="font-bold text-slate-800 dark:text-white">{pos.title}</h3>
                       </div>
                       <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4 flex-1">{pos.description}</p>
                       <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                           <span>Role ID: {pos.id}</span>
                       </div>
                       {isPowerUser && (
                           <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
                               <button onClick={() => { setEditingPosition(pos); setPositionForm(pos); setShowPositionModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 size={14} /></button>
                               <button onClick={() => deletePosition(pos.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                           </div>
                       )}
                   </div>
               ))}
           </div>
       )}

       {activeTab === 'chart' && (
            <div className="overflow-x-auto pb-12 pt-8 cursor-grab active:cursor-grabbing bg-slate-50 dark:bg-slate-900/30 rounded-3xl border border-slate-200 dark:border-slate-700 min-h-[600px] flex justify-center items-start shadow-inner">
                <ul className="flex flex-row gap-12 pt-4 min-w-max px-8">
                    {tree.map(node => <OrgChartNode key={node.id} node={node} />)}
                </ul>
            </div>
       )}

       {/* MODALS */}
       <DraggableModal isOpen={showManageModal} onClose={() => setShowManageModal(false)} title="Workforce Administration" width="max-w-7xl">
           <EmployeeList employees={employees} onAddEmployee={addEmployee} onUpdateEmployee={updateEmployee} onDeleteEmployee={deleteEmployee} />
       </DraggableModal>

       <DraggableModal isOpen={!!editingEmployee || showAddModalQuick} onClose={() => { setEditingEmployee(null); setShowAddModalQuick(false); }} title={editingEmployee ? "Modify Employee Profile" : "Add New Employee"} width="max-w-3xl">
           <form onSubmit={handleUpdateEmployee} className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">First Name</label><input required type="text" value={employeeFormData?.firstName || ''} onChange={e => setEmployeeFormData({...employeeFormData, firstName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-teal-500 shadow-inner" /></div>
                   <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Last Name</label><input required type="text" value={employeeFormData?.lastName || ''} onChange={e => setEmployeeFormData({...employeeFormData, lastName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-teal-500 shadow-inner" /></div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Designation</label><select required value={employeeFormData?.position || ''} onChange={e => setEmployeeFormData({...employeeFormData, position: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-teal-500"><option value="" disabled>Select Position...</option>{positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}</select></div>
                   <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Employment State</label><select required value={employeeFormData?.status || EmployeeStatus.ACTIVE} onChange={e => setEmployeeFormData({...employeeFormData, status: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-teal-500"><option value={EmployeeStatus.ACTIVE}>Active</option><option value={EmployeeStatus.ON_LEAVE}>On Leave</option><option value={EmployeeStatus.INACTIVE}>Inactive</option></select></div>
               </div>

               <div>
                   <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Reporting Manager</label>
                   <select 
                       value={employeeFormData?.managerId || ''} 
                       onChange={(e) => setEmployeeFormData({...employeeFormData, managerId: e.target.value})} 
                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                   >
                      <option value="">No Manager (Top Level)</option>
                      {potentialManagers.map(mgr => (
                          <option key={mgr.id} value={String(mgr.id)}>
                              {mgr.firstName} {mgr.lastName} ({mgr.position || mgr.role})
                          </option>
                      ))}
                   </select>
               </div>

               {/* New Project Assignment Section */}
               <MultiSelectProject
                  options={projects}
                  selectedIds={employeeFormData?.projectIds || []}
                  onChange={(ids) => setEmployeeFormData({...employeeFormData, projectIds: ids})}
               />
               
               {showAddModalQuick && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                    <input 
                        type="checkbox" 
                        id="provisionAzureQuick" 
                        checked={employeeFormData?.provisionInAzure || false} 
                        onChange={e => setEmployeeFormData({...employeeFormData, provisionInAzure: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <label htmlFor="provisionAzureQuick" className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-tight">Provision in Azure AD (Microsoft 365)</label>
                </div>
               )}

               <div>
                   <div className="flex items-center justify-between mb-2 px-1">
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><LocateFixed size={12} className="text-teal-600"/> GLOBAL POSITIONING</label>
                       <div className="flex items-center gap-2">
                           <button 
                                type="button"
                                onClick={() => setIsEditImagery(!isEditImagery)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase transition-all ${isEditImagery ? 'bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-500/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}
                           >
                               <Layers size={10} />
                               {isEditImagery ? 'Map' : 'Imagery'}
                           </button>
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Click map to calibrate</span>
                       </div>
                   </div>
                   <div ref={editMapRef} className="h-64 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-2xl overflow-hidden grayscale-[0.2] contrast-[1.1]"></div>
                   <div className="flex justify-between mt-3 px-4 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-[10px] font-black font-mono text-slate-400">
                       <span>LATITUDE: {employeeFormData?.location?.latitude?.toFixed(5) || 'PENDING'}</span>
                       <span>LONGITUDE: {employeeFormData?.location?.longitude?.toFixed(5) || 'PENDING'}</span>
                   </div>
               </div>
               <div className="flex justify-end gap-3 pt-8 border-t dark:border-slate-700">
                   <button type="button" onClick={() => { setEditingEmployee(null); setShowAddModalQuick(false); }} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">ABORT CHANGES</button>
                   <button type="submit" disabled={isProcessing} className="px-10 py-3.5 bg-teal-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-teal-500/30 hover:bg-teal-700 transition flex items-center gap-2 active:scale-95">{isProcessing ? <Loader2 size={16} className="animate-spin" /> : editingEmployee ? 'COMMIT UPDATES' : 'CREATE RECORD'}</button>
               </div>
           </form>
       </DraggableModal>

       {/* New Modal: Add Members to Project */}
       <DraggableModal isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)} title={`Add Members to ${selectedProject?.name}`} width="max-w-xl">
           <div className="space-y-4">
               <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 max-h-80 overflow-y-auto custom-scrollbar">
                   {availableEmployeesForProject.length === 0 ? (
                       <p className="text-center text-slate-400 text-sm py-4">All available employees are already in this project.</p>
                   ) : (
                       availableEmployeesForProject.map(emp => (
                           <div 
                               key={emp.id} 
                               onClick={() => {
                                   if (membersToAdd.includes(String(emp.id))) {
                                       setMembersToAdd(membersToAdd.filter(id => id !== String(emp.id)));
                                   } else {
                                       setMembersToAdd([...membersToAdd, String(emp.id)]);
                                   }
                               }}
                               className={`flex items-center gap-3 p-3 rounded-xl border mb-2 cursor-pointer transition-all ${membersToAdd.includes(String(emp.id)) ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-teal-100'}`}
                           >
                               <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${membersToAdd.includes(String(emp.id)) ? 'border-teal-600 bg-teal-600' : 'border-slate-300'}`}>
                                   {membersToAdd.includes(String(emp.id)) && <CheckCircle2 size={12} className="text-white" />}
                               </div>
                               <img src={emp.avatar} className="w-8 h-8 rounded-full bg-slate-200 object-cover" alt="" />
                               <div>
                                   <p className="text-sm font-bold text-slate-800 dark:text-white">{emp.firstName} {emp.lastName}</p>
                                   <p className="text-[10px] text-slate-500 uppercase">{emp.position}</p>
                               </div>
                           </div>
                       ))
                   )}
               </div>
               <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                   <button onClick={() => setShowAddMemberModal(false)} className="px-4 py-2 text-slate-500 font-bold text-xs uppercase">Cancel</button>
                   <button 
                        onClick={handleAddMembersToProject}
                        disabled={membersToAdd.length === 0 || isProcessing}
                        className="px-6 py-2 bg-teal-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-teal-500/20 hover:bg-teal-700 transition disabled:opacity-50 flex items-center gap-2"
                   >
                       {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                       <span>Add {membersToAdd.length > 0 ? `${membersToAdd.length} Members` : 'Members'}</span>
                   </button>
               </div>
           </div>
       </DraggableModal>

       {/* ... (Keep Project & Position Modals) */}
       <DraggableModal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title="Create New Project" width="max-w-lg">
           <form onSubmit={handleCreateProject} className="space-y-6">
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Project Name</label>
                    <input required type="text" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-teal-500 shadow-inner" placeholder="e.g. Website Redesign" />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Description</label>
                    <textarea required rows={3} value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-teal-500 shadow-inner" placeholder="Brief objectives..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Status</label>
                        <select value={projectForm.status} onChange={e => setProjectForm({...projectForm, status: e.target.value as any})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-teal-500">
                            <option value="Active">Active</option>
                            <option value="On Hold">On Hold</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Due Date</label>
                        <input type="date" value={projectForm.dueDate} onChange={e => setProjectForm({...projectForm, dueDate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-teal-500 shadow-inner" />
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                    <button type="button" onClick={() => setShowProjectModal(false)} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Cancel</button>
                    <button type="submit" disabled={isProcessing} className="px-10 py-3.5 bg-teal-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-teal-500/30 hover:bg-teal-700 transition active:scale-95">{isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Launch Project'}</button>
                </div>
           </form>
       </DraggableModal>

       <DraggableModal isOpen={showPositionModal} onClose={() => { setShowPositionModal(false); setEditingPosition(null); }} title={editingPosition ? "Edit Position" : "Add New Position"} width="max-w-lg">
           <form onSubmit={handlePositionSubmit} className="space-y-6">
               <div className="space-y-1.5">
                   <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Role Title</label>
                   <input required type="text" value={positionForm.title} onChange={e => setPositionForm({...positionForm, title: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-teal-500 shadow-inner" placeholder="e.g. Senior Developer" />
               </div>
               <div className="space-y-1.5">
                   <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Core Responsibilities</label>
                   <textarea required rows={4} value={positionForm.description} onChange={e => setPositionForm({...positionForm, description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-teal-500 shadow-inner" placeholder="Describe the key duties..." />
               </div>
               <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                   <button type="button" onClick={() => { setShowPositionModal(false); setEditingPosition(null); }} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Cancel</button>
                   <button type="submit" disabled={isProcessing} className="px-10 py-3.5 bg-teal-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-teal-500/30 hover:bg-teal-700 transition flex items-center gap-2 active:scale-95">{isProcessing ? <Loader2 size={16} className="animate-spin" /> : editingPosition ? 'Update Role' : 'Create Role'}</button>
               </div>
           </form>
       </DraggableModal>
    </div>
  );
};
export default Organization;