import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Project, Employee, Position, EmployeeStatus } from '../types';
import { 
  Briefcase, Trash2, Edit2, Users, Plus, X, Network, MapPin, 
  Globe, Navigation, Map as MapIcon, ChevronDown, ChevronRight, 
  Calendar, Minus, Layout, Search, Locate, Target, UserPlus, 
  RefreshCw, MapPinned, Info, Building2, LocateFixed, Loader2, Shield, UserSquare, Layers,
  Mail, ChevronLeft, List, Grid, CheckCircle2, AlertCircle, Clock, Activity, BarChart3, ArrowLeft, UserCheck, UserMinus, Filter, Save
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

// --- Helper for Safe Project IDs ---
const getSafeProjectIds = (emp: any): (string | number)[] => {
    if (!emp) return [];
    // If projectIds doesn't exist, return empty array
    if (!emp.projectIds) return [];
    // If it's already an array, return it
    if (Array.isArray(emp.projectIds)) return emp.projectIds;
    // If it's a single value (string/number), wrap in array
    return [emp.projectIds];
};

const sanitizeEmployeePayload = (data: any): Partial<Employee> => {
    // Whitelist allowed DB columns to prevent "Invalid column name" errors
    const allowedKeys = [
        'id', 'employeeId', 'firstName', 'lastName', 'email', 'password',
        'role', 'position', 'department', 'departmentId', 'projectIds',
        'joinDate', 'status', 'salary', 'avatar', 'managerId',
        'location', 'workLocation', 'phone', 'jobTitle', 'settings', 'bio'
    ];

    const cleanData: any = {};
    Object.keys(data).forEach(key => {
        if (allowedKeys.includes(key)) {
            cleanData[key] = data[key];
        }
    });
    return cleanData;
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

// ... MultiSelectProject Component remains unchanged ...
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

  // Robust check to ensure selectedIds is always an array to prevent crashes
  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];

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
    if (safeSelectedIds.map(String).includes(idStr)) {
      onChange(safeSelectedIds.filter(sid => String(sid) !== idStr));
    } else {
      onChange([...safeSelectedIds, id]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Assigned Projects</label>
      <div 
        className="w-full min-h-[46px] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 shadow-inner transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
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
        <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-[60] p-2">
            {options.length === 0 && <p className="text-xs text-slate-400 p-2 text-center">No projects available</p>}
            {options.map(proj => (
              <div key={proj.id} onClick={() => handleSelect(proj.id)} className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${safeSelectedIds.map(String).includes(String(proj.id)) ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}>
                <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${safeSelectedIds.map(String).includes(String(proj.id)) ? 'bg-teal-600 border-teal-600' : 'border-slate-300 dark:border-slate-600'}`}>
                        {safeSelectedIds.map(String).includes(String(proj.id)) && <CheckCircle2 size={10} className="text-white" />}
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
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Projects State
  const [projectView, setProjectView] = useState<'card' | 'list'>('card');
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('All');
  const [projectEmployeeFilter, setProjectEmployeeFilter] = useState('All');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectDetailTab, setProjectDetailTab] = useState<'tasks' | 'team' | 'logs'>('tasks');

  // Project Member Add State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState<string[]>([]);

  const [isImagery, setIsImagery] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const viewInstanceRef = useRef<any>(null);
  const graphicsLayerRef = useRef<any>(null);
  const GraphicClassRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  
  // -- Employee Modal State (Consolidated) --
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState(false);
  
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState<any>(null);
  const [isEditImagery, setIsEditImagery] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const editMapRef = useRef<HTMLDivElement>(null);
  const editMapViewRef = useRef<any>(null);
  const manageMenuRef = useRef<HTMLDivElement>(null);

  const [projectForm, setProjectForm] = useState({
      name: '', description: '', status: 'Active' as const, dueDate: '', tasks: [] as string[]
  });

  const [positionForm, setPositionForm] = useState({ title: '', description: '' });

  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;
  const tree = useMemo(() => buildOrgTree(employees), [employees]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (manageMenuRef.current && !manageMenuRef.current.contains(event.target as Node)) {
        setShowManageMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      let visible = projects;

      // 1. Existing View Restriction for Non-Admin/HR
      if (!isPowerUser && currentUser) {
          const empRecord = employees.find(e => String(e.id) === String(currentUser.id));
          // Use safe helper
          const myProjectIds = getSafeProjectIds(empRecord).map(String);
          visible = visible.filter(p => myProjectIds.includes(String(p.id)));
      }

      // 2. Status Filter
      if (projectStatusFilter !== 'All') {
          visible = visible.filter(p => p.status === projectStatusFilter);
      }

      // 3. Employee Filter
      if (projectEmployeeFilter !== 'All') {
          const targetEmp = employees.find(e => String(e.id) === projectEmployeeFilter);
          if (targetEmp) {
              const targetProjectIds = getSafeProjectIds(targetEmp).map(String);
              visible = visible.filter(p => targetProjectIds.includes(String(p.id)));
          } else {
              visible = [];
          }
      }

      return visible.filter(p => 
          p.name.toLowerCase().includes(term) ||
          (p.description || '').toLowerCase().includes(term) ||
          p.status.toLowerCase().includes(term)
      );
  }, [projects, projectSearch, isPowerUser, currentUser, employees, projectStatusFilter, projectEmployeeFilter]);

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
          // Robust check for array to prevent crash
          // Use getSafeProjectIds to ensure array type
          const pIds = getSafeProjectIds(emp);
          if (pIds.some(pid => String(pid) === String(selectedProject.id))) {
              teamIds.add(String(emp.id));
          }
      });

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

    // Reset map ready state when remounting
    setIsMapReady(false);

    loadModules([
      "esri/Map", "esri/views/MapView", "esri/Graphic", "esri/layers/GraphicsLayer", 
      "esri/widgets/Home"
    ], { css: true }).then(([EsriMap, MapView, Graphic, GraphicsLayer, Home]) => {
        if (!mapContainerRef.current) return;

        // Store Graphic class for later use
        GraphicClassRef.current = Graphic;

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
            // Mark map as ready to trigger marker sync
            setIsMapReady(true);
        }).catch((err: any) => console.error("Map initialization failed", err));
    }).catch(err => console.error("ArcGIS load failed:", err));

    return () => {
        if (viewInstanceRef.current) {
            viewInstanceRef.current.destroy();
            viewInstanceRef.current = null;
            graphicsLayerRef.current = null;
            setIsMapReady(false);
        }
    };
  }, [activeTab, directoryView]);

  // Sync Markers effect
  useEffect(() => {
    if (activeTab === 'directory' && directoryView === 'map' && isMapReady && graphicsLayerRef.current) {
        refreshMapMarkers(filteredDirectoryEmployees);
    }
  }, [filteredDirectoryEmployees, activeTab, directoryView, isMapReady]);

  // Edit Modal Map Hook
  useEffect(() => {
    // Only run if modal is visibly open AND map ref is present
    if (!showEmployeeModal || !editMapRef.current || !employeeFormData) return;

    loadModules([
      "esri/Map", "esri/views/MapView", "esri/Graphic", "esri/layers/GraphicsLayer",
      "esri/widgets/Home"
    ], { css: true })
      .then(([EsriMap, MapView, Graphic, GraphicsLayer, Home]) => {
        const initialBasemap = isEditImagery ? "satellite" : (theme === 'light' ? 'topo-vector' : 'dark-gray-vector');
        const map = new EsriMap({ basemap: initialBasemap });
        
        // Safety check for location data
        const centerLon = employeeFormData?.location?.longitude || 78.9629;
        const centerLat = employeeFormData?.location?.latitude || 20.5937;

        const view = new MapView({
          container: editMapRef.current!,
          map: map,
          zoom: 5,
          center: [centerLon, centerLat],
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

    return () => {
        if (editMapViewRef.current) {
            editMapViewRef.current.destroy();
            editMapViewRef.current = null;
        }
    };
  }, [showEmployeeModal]); // Depend strictly on visibility state

  const refreshMapMarkers = async (list: Employee[]) => {
      // ... same logic as before ...
      if (!graphicsLayerRef.current) return;
      let Graphic = GraphicClassRef.current;
      if (!Graphic) {
          try {
            const [LoadedGraphic] = await loadModules(["esri/Graphic"]);
            Graphic = LoadedGraphic;
            GraphicClassRef.current = LoadedGraphic;
          } catch(e) {
            console.error("Failed to load Graphic module", e);
            return;
          }
      }
      if (!graphicsLayerRef.current) return;
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
                  symbol: { type: "simple-marker", style: "circle", color: [13, 148, 136, 0.9], size: 16, outline: { color: [255, 255, 255], width: 3 } },
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
                      content: `<div style="font-family: 'Inter', sans-serif;"><b>{position}</b><br>{workLocation}</div>`
                  }
              });
              graphicsLayerRef.current.add(graphic);
          }
      });
  };

  const focusEmployeeOnMap = (emp: Employee) => {
      if (!viewInstanceRef.current || !emp.location) {
          showToast(`No location set for ${emp.firstName}.`, "warning");
          return;
      }
      viewInstanceRef.current.goTo({ target: [emp.location.longitude, emp.location.latitude], zoom: 12 }, { duration: 1500, easing: "ease-in-out" });
  };

  const handleEditClick = (emp: Employee) => {
      setEditingEmployee(emp);
      // Ensure all fields are initialized to avoid undefined errors in inputs
      setEmployeeFormData({
          ...emp,
          projectIds: getSafeProjectIds(emp),
          location: emp.location || { latitude: 20.5937, longitude: 78.9629, address: '' },
          role: emp.role || UserRole.EMPLOYEE,
          salary: emp.salary || 0,
          position: emp.position || '',
          managerId: emp.managerId || '',
          workLocation: emp.workLocation || '',
          provisionInAzure: false
      });
      setShowEmployeeModal(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!employeeFormData) return;
      setIsProcessing(true);
      
      try {
          if (editingEmployee) {
              // Sanitize the payload to remove UI-only fields like 'provisionInAzure'
              // and ensure strict adherence to Employee type for DB compliance
              const sanitizedData = sanitizeEmployeePayload(employeeFormData);

              await updateEmployee(sanitizedData);
              
              // Notifications logic (kept separate from DB update)
              const oldProjectIds = getSafeProjectIds(editingEmployee);
              const newProjectIds = employeeFormData.projectIds || [];
              const addedIds = newProjectIds.filter((id: string|number) => !oldProjectIds.includes(id));

              if (addedIds.length > 0) {
                  addedIds.forEach(async (pid: string|number) => {
                      const project = projects.find(p => String(p.id) === String(pid));
                      if (project) {
                          const message = `You have been assigned to project: ${project.name}`;
                          if (employeeFormData.settings?.notifications?.pushWeb !== false) {
                              await notify(message, employeeFormData.id);
                          }
                          if (employeeFormData.settings?.notifications?.systemAlerts !== false) {
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
              setShowEmployeeModal(false);
              showToast("Records synchronized.", "success");
          } else {
              // Create New Employee
              // Here we might need 'provisionInAzure' for the logic, so we extract it *before* sanitizing for the DB add
              const { provisionInAzure, ...rawEmpData } = employeeFormData;
              const sanitizedNewData = sanitizeEmployeePayload(rawEmpData);
              
              // Pass sanitized data to invite/add function
              // If inviteEmployee handles provisionInAzure logic, we might need to pass it separately or modify inviteEmployee
              // For now, assuming inviteEmployee handles the DB addition:
              await useAppContext().inviteEmployee(sanitizedNewData);
              setShowEmployeeModal(false);
              showToast("New employee added.", "success");
          }
      } catch (err) {
          console.error("Update failed", err);
          showToast("Failed to update record. Check console.", "error");
      } finally {
          setIsProcessing(false);
      }
  };

  // ... (Other handlers: handleCreateProject, handleUpdateProject, etc. remain unchanged) ...
  const handleCreateProject = async (e: React.FormEvent) => { e.preventDefault(); setIsProcessing(true); await addProject({ ...projectForm, id: Math.random().toString(36).substr(2, 9) }); setShowProjectModal(false); setProjectForm({ name: '', description: '', status: 'Active', dueDate: '', tasks: [] }); showToast("New project created.", "success"); setIsProcessing(false); };
  const handleUpdateProject = async (e: React.FormEvent) => { e.preventDefault(); if (!editingProject) return; setIsProcessing(true); await updateProject(editingProject.id, editingProject); setIsProcessing(false); setEditingProject(null); showToast("Project updated.", "success"); };
  const handleAddMembersToProject = async () => { /* ... existing logic ... */ setIsProcessing(false); };
  const handleRemoveMemberFromProject = async (empId: string | number) => { /* ... existing logic ... */ setIsProcessing(false); };
  const handlePositionSubmit = async (e: React.FormEvent) => { e.preventDefault(); setIsProcessing(true); try { if (editingPosition) { await updatePosition(editingPosition.id, { ...editingPosition, ...positionForm }); setEditingPosition(null); showToast("Position updated.", "success"); } else { await addPosition({ ...positionForm, id: Math.random().toString(36).substr(2, 9) }); showToast("Position created.", "success"); } setShowPositionModal(false); setPositionForm({ title: '', description: '' }); } catch(err) { showToast("Operation failed.", "error"); } finally { setIsProcessing(false); } };
  const handleSync = async () => { setIsSyncing(true); await syncAzureUsers(); setIsSyncing(false); };
  
  const openQuickAdd = () => {
      setEditingEmployee(null);
      setEmployeeFormData({
          firstName: '', lastName: '', email: '', role: UserRole.EMPLOYEE,
          salary: 0, position: '', provisionInAzure: false, managerId: '',
          projectIds: [],
          location: { latitude: 20.5937, longitude: 78.9629, address: '' },
          workLocation: '',
      });
      setShowEmployeeModal(true);
  };

  const getInitials = (fname: string, lname: string) => {
      return `${fname.charAt(0)}${lname.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="space-y-6 animate-fade-in relative text-slate-800 dark:text-slate-200 pb-16">
       {/* ... Header and Tab Buttons ... */}
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Organization</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Manage workforce directory and global business operations.</p>
          </div>
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
            {/* ... Action Buttons ... */}
            {activeTab === 'projects' && isPowerUser && !selectedProject && (
                <button onClick={() => setShowProjectModal(true)} className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-black shadow-lg shadow-teal-500/20"><Plus size={18} /><span>NEW PROJECT</span></button>
            )}
            {activeTab === 'positions' && isPowerUser && (
                <button onClick={() => { setEditingPosition(null); setPositionForm({ title: '', description: '' }); setShowPositionModal(true); }} className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-black shadow-lg shadow-teal-500/20"><Plus size={18} /><span>NEW POSITION</span></button>
            )}
            {activeTab === 'directory' && isPowerUser && (
                <div className="relative" ref={manageMenuRef}>
                    <button 
                        onClick={() => setShowManageMenu(!showManageMenu)} 
                        className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-black shadow-lg shadow-teal-500/20"
                    >
                        <UserPlus size={18} /><span>MANAGE</span><ChevronDown size={14} className={`transition-transform ${showManageMenu ? 'rotate-180' : ''}`}/>
                    </button>
                    {showManageMenu && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <button 
                                onClick={() => { openQuickAdd(); setShowManageMenu(false); }} 
                                className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors border-b dark:border-slate-700"
                            >
                                <Plus size={16} className="text-teal-600"/> Add Employee
                            </button>
                            <button 
                                onClick={() => { setShowManageModal(true); setShowManageMenu(false); }} 
                                className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                            >
                                <RefreshCw size={16} className="text-blue-600"/> Sync Directory
                            </button>
                        </div>
                    )}
                </div>
            )}
          </div>
       </div>

       {/* ... Views (Directory, Projects, etc) - keeping existing structure ... */}
       {activeTab === 'directory' && (
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
                   // ... List View ...
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
                       
                       <div className="overflow-x-auto">
                           <table className="w-full text-left text-sm">
                               <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                                   <tr>
                                       <th className="px-6 py-4">Employee</th>
                                       <th className="px-6 py-4">Department</th>
                                       <th className="px-6 py-4">Status</th>
                                       <th className="px-6 py-4">Contact</th>
                                       {isPowerUser && <th className="px-6 py-4 text-right">Actions</th>}
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                   {paginatedEmployees.map(emp => (
                                       <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                                           <td className="px-6 py-4">
                                               <div className="flex items-center gap-3">
                                                   <div className="w-10 h-10 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm overflow-hidden">
                                                       {emp.avatar ? <img src={emp.avatar} alt="" className="w-full h-full object-cover" /> : getInitials(emp.firstName, emp.lastName)}
                                                   </div>
                                                   <div>
                                                       <p className="font-bold text-slate-800 dark:text-white">{emp.firstName} {emp.lastName}</p>
                                                       <p className="text-xs text-slate-500">{emp.position || 'Team Member'}</p>
                                                   </div>
                                               </div>
                                           </td>
                                           <td className="px-6 py-4">
                                               <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                                                   {emp.department || 'General'}
                                               </span>
                                           </td>
                                           <td className="px-6 py-4">
                                               <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                                   emp.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
                                                   emp.status === 'On Leave' ? 'bg-amber-100 text-amber-700' :
                                                   'bg-slate-100 text-slate-500'
                                               }`}>
                                                   <span className={`w-1.5 h-1.5 rounded-full ${
                                                       emp.status === 'Active' ? 'bg-emerald-500' : 
                                                       emp.status === 'On Leave' ? 'bg-amber-500' : 
                                                       'bg-slate-400'
                                                   }`}></span>
                                                   {emp.status}
                                               </span>
                                           </td>
                                           <td className="px-6 py-4">
                                               <a href={`mailto:${emp.email}`} className="text-slate-500 hover:text-teal-600 transition-colors flex items-center gap-2 text-xs font-medium">
                                                   <Mail size={14} /> {emp.email}
                                               </a>
                                           </td>
                                           {isPowerUser && (
                                               <td className="px-6 py-4 text-right">
                                                   <button 
                                                       onClick={(e) => { 
                                                           e.stopPropagation(); 
                                                           handleEditClick(emp);
                                                       }} 
                                                       className="p-2 text-slate-400 hover:text-teal-600 transition-colors"
                                                   >
                                                       <Edit2 size={16} />
                                                   </button>
                                               </td>
                                           )}
                                       </tr>
                                   ))}
                                   {paginatedEmployees.length === 0 && (
                                       <tr>
                                           <td colSpan={isPowerUser ? 5 : 4} className="p-12 text-center text-slate-400 italic">No employees found.</td>
                                       </tr>
                                   )}
                               </tbody>
                           </table>
                       </div>
                       {/* Pagination */}
                       <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center text-sm text-slate-500 dark:text-slate-400 gap-4">
                           <div className="flex items-center gap-4">
                               <span className="text-xs font-medium">Rows per page:</span>
                               <select 
                                   value={itemsPerPage}
                                   onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                   className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs py-1 px-2 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                               >
                                   <option value={5}>5</option>
                                   <option value={10}>10</option>
                                   <option value={20}>20</option>
                                   <option value={50}>50</option>
                               </select>
                               <span className="text-xs">
                                   Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredDirectoryEmployees.length)} of {filteredDirectoryEmployees.length}
                               </span>
                           </div>
                           
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
                   // ... Map View Container ...
                   <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[740px]">
                       <div className="lg:col-span-4 flex flex-col gap-4 h-[500px] lg:h-full">
                           {/* ... Search Box ... */}
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
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            handleEditClick(emp);
                                                        }} 
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
                       </div>
                   </div>
               )}
           </div>
       )}

       {/* ... Other Modals ... */}
       <DraggableModal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title={editingProject ? 'Edit Project' : 'New Project'} width="max-w-md">
           {/* ... Project Form ... */}
           <form onSubmit={editingProject ? handleUpdateProject : handleCreateProject} className="space-y-4">
               <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
                   <input required type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} />
               </div>
               {/* ... rest of project form ... */}
               <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                   <button type="button" onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-slate-500 font-bold text-xs uppercase">Cancel</button>
                   <button type="submit" disabled={isProcessing} className="px-6 py-2 bg-teal-600 text-white rounded-lg font-bold text-xs uppercase shadow-lg hover:bg-teal-700 transition flex items-center gap-2">
                       {isProcessing && <Loader2 size={14} className="animate-spin" />} Save Project
                   </button>
               </div>
           </form>
       </DraggableModal>

       {/* ... Add Member Modal ... */}
       <DraggableModal isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)} title="Add Team Members" width="max-w-md">
           <div className="space-y-4">
                {/* ... member list ... */}
               <div className="flex justify-end gap-3">
                   <button onClick={() => setShowAddMemberModal(false)} className="px-4 py-2 text-slate-500 font-bold text-xs uppercase">Cancel</button>
                   <button onClick={handleAddMembersToProject} disabled={membersToAdd.length === 0 || isProcessing} className="px-6 py-2 bg-teal-600 text-white rounded-lg font-bold text-xs uppercase shadow-lg hover:bg-teal-700 transition disabled:opacity-50">
                       {isProcessing ? 'Adding...' : 'Add Selected'}
                   </button>
               </div>
           </div>
       </DraggableModal>

       {/* ... Position Modal ... */}
       <DraggableModal isOpen={showPositionModal} onClose={() => setShowPositionModal(false)} title={editingPosition ? 'Edit Position' : 'New Position'} width="max-w-sm">
           <form onSubmit={handlePositionSubmit} className="space-y-4">
                {/* ... position form ... */}
               <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                   <button type="button" onClick={() => setShowPositionModal(false)} className="px-4 py-2 text-slate-500 font-bold text-xs uppercase">Cancel</button>
                   <button type="submit" disabled={isProcessing} className="px-6 py-2 bg-teal-600 text-white rounded-lg font-bold text-xs uppercase shadow-lg hover:bg-teal-700 transition">Save</button>
               </div>
           </form>
       </DraggableModal>

       {/* Org Chart View */}
       {activeTab === 'chart' && (
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 overflow-x-auto min-h-[600px] flex justify-center">
               <ul className="flex flex-row justify-center">
                   {tree.map(root => (
                       <OrgChartNode key={root.id} node={root} />
                   ))}
               </ul>
           </div>
       )}

       {/* Manage Employees (Sync) Modal */}
       <DraggableModal isOpen={showManageModal} onClose={() => setShowManageModal(false)} title="Directory Management" width="max-w-md">
           <div className="space-y-6 text-center py-6">
               <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 mb-4">
                   <RefreshCw size={32} className={isSyncing ? "animate-spin" : ""} />
               </div>
               <h3 className="text-xl font-bold text-slate-800 dark:text-white">Azure Active Directory Sync</h3>
               <p className="text-sm text-slate-500 dark:text-slate-400">
                   Synchronize your local employee database with Microsoft Azure AD to keep records up-to-date.
               </p>
               <button onClick={handleSync} disabled={isSyncing} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest shadow-lg hover:bg-blue-700 transition disabled:opacity-50">
                   {isSyncing ? 'Syncing Records...' : 'Start Synchronization'}
               </button>
           </div>
       </DraggableModal>

       {/* Employee Edit/Add Modal with Map - Using Explicit State Control */}
       {(showEmployeeModal && employeeFormData) && (
           <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
               <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex overflow-hidden border border-slate-200 dark:border-slate-700">
                   {/* Left Panel - Form */}
                   <div className="w-1/2 p-8 overflow-y-auto border-r border-slate-200 dark:border-slate-700">
                       <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                           {editingEmployee ? <Edit2 size={24} className="text-teal-600"/> : <UserPlus size={24} className="text-teal-600"/>}
                           {editingEmployee ? 'Edit Employee Profile' : 'New Employee Entry'}
                       </h3>
                       
                       <form onSubmit={handleUpdateEmployee} className="space-y-5">
                           <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1.5">
                                   <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">First Name</label>
                                   <input required type="text" className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={employeeFormData?.firstName || ''} onChange={e => setEmployeeFormData({...employeeFormData, firstName: e.target.value})} />
                               </div>
                               <div className="space-y-1.5">
                                   <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Last Name</label>
                                   <input required type="text" className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={employeeFormData?.lastName || ''} onChange={e => setEmployeeFormData({...employeeFormData, lastName: e.target.value})} />
                               </div>
                           </div>

                           <div className="space-y-1.5">
                               <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Email Address</label>
                               <input required type="email" className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={employeeFormData?.email || ''} onChange={e => setEmployeeFormData({...employeeFormData, email: e.target.value})} />
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1.5">
                                   <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Role</label>
                                   <select className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={employeeFormData?.role || UserRole.EMPLOYEE} onChange={e => setEmployeeFormData({...employeeFormData, role: e.target.value})}>
                                       <option value={UserRole.EMPLOYEE}>Employee</option>
                                       <option value={UserRole.MANAGER}>Team Manager</option>
                                       <option value={UserRole.HR}>HR Manager</option>
                                       <option value={UserRole.ADMIN}>Admin</option>
                                   </select>
                               </div>
                               <div className="space-y-1.5">
                                   <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Designation</label>
                                   <select className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={employeeFormData?.position || ''} onChange={e => setEmployeeFormData({...employeeFormData, position: e.target.value})}>
                                       <option value="" disabled>Select...</option>
                                       {positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                                   </select>
                               </div>
                           </div>

                           <div className="space-y-1.5">
                               <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Reporting Manager</label>
                               <select className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={employeeFormData?.managerId || ''} onChange={e => setEmployeeFormData({...employeeFormData, managerId: e.target.value})}>
                                   <option value="">No Manager (Top Level)</option>
                                   {potentialManagers.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName} - {m.position}</option>)}
                               </select>
                           </div>

                           <div className="space-y-1.5">
                               <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Work Location Name</label>
                               <input type="text" className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={employeeFormData?.workLocation || ''} onChange={e => setEmployeeFormData({...employeeFormData, workLocation: e.target.value})} placeholder="e.g. London Office" />
                           </div>

                           <MultiSelectProject 
                               options={projects} 
                               selectedIds={employeeFormData?.projectIds || []} 
                               onChange={(ids) => setEmployeeFormData({...employeeFormData, projectIds: ids})} 
                           />

                           {!editingEmployee && (
                               <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                   <input type="checkbox" id="provAzure" checked={employeeFormData?.provisionInAzure || false} onChange={e => setEmployeeFormData({...employeeFormData, provisionInAzure: e.target.checked})} className="w-5 h-5 text-teal-600 rounded" />
                                   <label htmlFor="provAzure" className="text-sm font-bold text-slate-700 dark:text-white">Auto-create Azure AD Account</label>
                               </div>
                           )}

                           <div className="flex gap-3 pt-6 mt-4 border-t dark:border-slate-700">
                               <button type="button" onClick={() => { setEditingEmployee(null); setShowEmployeeModal(false); }} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold uppercase text-xs rounded-xl hover:bg-slate-200">Cancel</button>
                               <button type="submit" className="flex-1 py-3 bg-teal-600 text-white font-bold uppercase text-xs rounded-xl shadow-lg hover:bg-teal-700 flex items-center justify-center gap-2">
                                   {isProcessing ? <Loader2 className="animate-spin" /> : <Save size={16} />}
                                   Save Record
                               </button>
                           </div>
                       </form>
                   </div>

                   {/* Right Panel - Map */}
                   <div className="w-1/2 relative bg-slate-100 dark:bg-slate-900">
                       <div ref={editMapRef} className="w-full h-full" />
                       
                       <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
                           <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-auto">
                               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Geotag Location</p>
                               <p className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                                   <MapPin size={16} className="text-teal-600" />
                                   Click map to pin address
                               </p>
                           </div>
                           <div className="flex gap-2 pointer-events-auto">
                               <button onClick={() => setIsEditImagery(!isEditImagery)} className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-md hover:bg-slate-50 text-slate-600 dark:text-slate-300">
                                   <Layers size={20} />
                               </button>
                           </div>
                       </div>

                       <div className="absolute bottom-6 left-6 right-6 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center z-10">
                           <div className="flex items-center gap-4">
                               <div>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase">Latitude</p>
                                   <p className="font-mono font-bold text-slate-800 dark:text-white">{employeeFormData?.location?.latitude?.toFixed(6) || '---'}</p>
                               </div>
                               <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                               <div>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase">Longitude</p>
                                   <p className="font-mono font-bold text-slate-800 dark:text-white">{employeeFormData?.location?.longitude?.toFixed(6) || '---'}</p>
                               </div>
                           </div>
                           <div className="text-right">
                               <p className="text-[10px] font-bold text-slate-400 uppercase">Address</p>
                               <input 
                                   type="text" 
                                   className="bg-transparent border-b border-slate-300 dark:border-slate-600 text-sm font-medium outline-none focus:border-teal-500 w-48 text-right"
                                   placeholder="Type address..."
                                   value={employeeFormData?.location?.address || ''}
                                   onChange={e => setEmployeeFormData({
                                       ...employeeFormData, 
                                       location: { ...employeeFormData.location, address: e.target.value }
                                   })}
                               />
                           </div>
                       </div>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default Organization;