
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Project, Employee, Position, EmployeeStatus } from '../types';
import { 
  Briefcase, Trash2, Edit2, Users, Plus, X, Network, MapPin, 
  Globe, Navigation, Map as MapIcon, ChevronDown, ChevronRight, 
  Calendar, Minus, Layout, Search, Locate, Target, UserPlus, 
  RefreshCw, MapPinned, Info, Building2, LocateFixed, Loader2, Shield, UserSquare, Layers,
  Mail, ChevronLeft, List, Grid
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
    <li className="flex flex-col items-center">
      <div className="flex flex-col items-center relative pb-6">
        <div className="org-node-card group bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-teal-500/50 transition-all w-40 relative z-10">
           <div className="flex flex-col items-center">
             <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-50 dark:border-slate-700 mb-2 shadow-sm bg-slate-100">
                <img src={node.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(node.firstName)}+${encodeURIComponent(node.lastName)}`} className="w-full h-full object-cover" alt="" />
             </div>
             <div className="text-center w-full min-w-0">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate px-1">{node.firstName} {node.lastName}</h4>
                <p className="text-[9px] text-teal-600 dark:text-teal-400 font-black uppercase tracking-wider mt-0.5 mb-1 truncate px-1">{node.position || node.jobTitle || 'Team Member'}</p>
             </div>
           </div>
        </div>
        {hasChildren && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <div className="w-px h-3 bg-slate-300 dark:bg-slate-600 mb-0.5"></div>
            <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className={`flex items-center justify-center w-5 h-5 rounded-full border bg-white dark:bg-slate-700 shadow-sm transition-colors ${expanded ? 'border-teal-500 text-teal-600' : 'border-slate-300 text-slate-400'}`}>
              {expanded ? <Minus size={10} strokeWidth={4} /> : <Plus size={10} strokeWidth={4} />}
            </button>
          </div>
        )}
      </div>
      {hasChildren && expanded && (
        <ul className="flex flex-row gap-6 pt-2">
          {node.children.map(child => <OrgChartNode key={child.id} node={child} />)}
        </ul>
      )}
    </li>
  );
};

const Organization = () => {
  const { theme, currentUser, projects, positions, employees, addProject, updateProject, deleteProject, updatePosition, deletePosition, addEmployee, updateEmployee, deleteEmployee, showToast, syncAzureUsers } = useAppContext();
  const [activeTab, setActiveTab] = useState<'projects' | 'directory' | 'positions' | 'chart'>('directory');
  
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryView, setDirectoryView] = useState<'map' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [isImagery, setIsImagery] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const viewInstanceRef = useRef<any>(null);
  const graphicsLayerRef = useRef<any>(null);

  // Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showAddModalQuick, setShowAddModalQuick] = useState(false); // Quick add from sidebar
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

  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;
  const tree = useMemo(() => buildOrgTree(employees), [employees]);

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

  const totalPages = Math.ceil(filteredDirectoryEmployees.length / itemsPerPage);

  // Handle Main Basemap Updates with defensive checks
  useEffect(() => {
    const view = viewInstanceRef.current;
    if (!view || !view.map) return;
    
    if (isImagery) {
      view.map.basemap = "satellite";
    } else {
      view.map.basemap = theme === 'light' ? 'topo-vector' : 'dark-gray-vector';
    }
  }, [theme, isImagery]);

  // Handle Edit Modal Basemap Updates with defensive checks
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
            view.ui.add(new Home({ view: view }), "top-left");
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
            view.ui.add(new Home({ view: view }), "top-left");
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
      e.preventDefault();
      setIsProcessing(true);
      await addProject({ ...projectForm, id: Math.random().toString(36).substr(2, 9) });
      setShowProjectModal(false);
      setProjectForm({ name: '', description: '', status: 'Active', dueDate: '', tasks: [] });
      showToast("New project created.", "success");
      setIsProcessing(false);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingProject) return;
      setIsProcessing(true);
      await updateProject(editingProject.id, editingProject);
      setIsProcessing(false);
      setEditingProject(null);
      showToast("Project updated.", "success");
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!employeeFormData) return;
      setIsProcessing(true);
      if (editingEmployee) {
          await updateEmployee(employeeFormData);
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

  const handleUpdatePosition = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingPosition) return;
      setIsProcessing(true);
      await updatePosition(editingPosition.id, editingPosition);
      setIsProcessing(false);
      setEditingPosition(null);
      showToast("Position updated.", "success");
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
          location: { latitude: 20.5937, longitude: 78.9629, address: '' }
      });
      setShowAddModalQuick(true);
  };

  const getInitials = (fname: string, lname: string) => {
      return `${fname.charAt(0)}${lname.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="space-y-6 animate-fade-in relative text-slate-800 dark:text-slate-200">
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
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap flex items-center gap-2.5 font-bold ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 shadow-md text-teal-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <tab.icon size={16} />
                    <span>{tab.label}</span>
                  </button>
               ))}
            </div>
            {activeTab === 'projects' && isPowerUser && (
                <button onClick={() => setShowProjectModal(true)} className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-black shadow-lg shadow-teal-500/20"><Plus size={18} /><span>NEW PROJECT</span></button>
            )}
            {activeTab === 'directory' && isPowerUser && (
                <div className="flex gap-2">
                    <button onClick={handleSync} disabled={isSyncing} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition flex items-center space-x-2 text-sm font-bold shadow-sm">
                        <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                        <span>SYNC</span>
                    </button>
                    <button onClick={() => setShowManageModal(true)} className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-black shadow-lg shadow-teal-500/20"><UserPlus size={18} /><span>MANAGE</span></button>
                </div>
            )}
          </div>
       </div>

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
                                   <div className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2 font-medium w-full sm:w-auto justify-start sm:justify-end">
                                       <Mail size={16} className="text-slate-400" />
                                       {emp.email}
                                   </div>
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
                   /* Existing Map/Split View */
                   <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[740px]">
                       <div className="lg:col-span-4 flex flex-col gap-4 h-full">
                           <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
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

                           <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                               <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
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
                                                        onClick={(e) => { e.stopPropagation(); setEditingEmployee(emp); setEmployeeFormData({...emp}); }} 
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
                                   {filteredDirectoryEmployees.length === 0 && (
                                       <div className="p-8 text-center text-slate-400">
                                           <Users size={32} className="mx-auto mb-2 opacity-20" />
                                           <p className="text-xs font-medium italic">No colleagues match your criteria.</p>
                                       </div>
                                   )}
                               </div>
                           </div>
                       </div>

                       <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-2xl shadow-slate-200/50 dark:shadow-black/50">
                           <div ref={mapContainerRef} className="w-full h-full z-0 grayscale-[0.2] contrast-[1.1]"></div>
                           
                           {/* Custom Basemap Toggle Overlay - Moved slightly further from edge */}
                           <div className="absolute top-4 left-16 z-10">
                                <button 
                                    onClick={() => setIsImagery(!isImagery)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-xl transition-all duration-300 backdrop-blur-md font-black text-[10px] uppercase tracking-widest ${
                                        isImagery 
                                        ? 'bg-teal-600 border-teal-500 text-white' 
                                        : 'bg-white/80 dark:bg-slate-900/80 border-white/50 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900'
                                    }`}
                                >
                                    <Layers size={14} />
                                    <span>{isImagery ? 'Map View' : 'Imagery'}</span>
                                </button>
                           </div>

                           {/* Floating UI Overlays - Moved to Bottom Right to clear User Dropdown */}
                           <div className="absolute bottom-6 right-6 z-10 hidden sm:flex flex-col gap-3 pointer-events-none">
                               <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/50 dark:border-slate-700 shadow-xl pointer-events-auto">
                                   <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2"><Globe size={12}/> Regional Sync</h4>
                                   <div className="flex items-center gap-3">
                                       <div className="flex -space-x-2">
                                           {employees.slice(0, 3).map((e, idx) => (
                                               <img key={idx} src={e.avatar} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" alt="" />
                                           ))}
                                       </div>
                                       <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Active Map View</span>
                                   </div>
                               </div>
                           </div>

                           <div className="absolute bottom-6 left-6 z-10 flex items-center gap-2 pointer-events-none">
                               <div className="bg-teal-600 text-white px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-teal-500/40 flex items-center gap-2 pointer-events-auto">
                                   <Target size={14}/> <span>{employees.filter(e => e.location).length} Calibrated Points</span>
                               </div>
                           </div>
                       </div>
                   </div>
               )}
           </div>
       )}

       {activeTab === 'projects' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(project => (
                    <div key={project.id} className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 p-8 group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 border border-teal-100 dark:border-teal-800 group-hover:scale-110 transition-transform">
                                <Briefcase size={28} />
                            </div>
                            <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${project.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 dark:bg-slate-700 dark:text-slate-400 border-slate-200'}`}>{project.status}</span>
                        </div>
                        <h4 className="text-2xl font-black text-slate-800 dark:text-white mb-2 leading-tight">{project.name}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-6 font-medium leading-relaxed">{project.description}</p>
                        <div className="flex items-center gap-2.5 text-[11px] text-slate-400 font-black uppercase tracking-widest mb-6">
                            <Calendar size={16} className="text-teal-600" />
                            <span>Deadline: {project.dueDate || 'Unscheduled'}</span>
                        </div>
                        {isPowerUser && (
                            <div className="flex gap-2 mt-2 pt-6 border-t border-slate-100 dark:border-slate-700/50">
                                <button onClick={() => setEditingProject(project)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-teal-600 hover:text-white transition-all font-bold text-xs"><Edit2 size={14}/> EDIT</button>
                                <button onClick={() => deleteProject(project.id)} className="p-2.5 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={18}/></button>
                            </div>
                        )}
                    </div>
                ))}
                {isPowerUser && projects.length === 0 && (
                    <button onClick={() => setShowProjectModal(true)} className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2rem] p-12 flex flex-col items-center justify-center text-slate-400 hover:border-teal-400 hover:text-teal-600 transition-all group">
                        <Plus size={40} className="mb-4 group-hover:scale-125 transition-transform" />
                        <span className="font-black text-xs uppercase tracking-[0.2em]">Initiate First Project</span>
                    </button>
                )}
           </div>
       )}

       {activeTab === 'positions' && (
           <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 dark:border-slate-700">
                        <tr>
                            <th className="px-8 py-6">ROLE TITLE</th>
                            <th className="px-8 py-6">CORE RESPONSIBILITIES</th>
                            {isPowerUser && <th className="px-8 py-6 text-right w-32">ACTIONS</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {positions.map(pos => (
                            <tr key={pos.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600"><UserSquare size={18}/></div>
                                        <span className="font-black text-slate-800 dark:text-slate-100 text-sm">{pos.title}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{pos.description}</td>
                                {isPowerUser && (
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingPosition(pos)} className="p-2 text-slate-300 hover:text-teal-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg shadow-sm border border-transparent transition-all"><Edit2 size={16}/></button>
                                            <button onClick={() => deletePosition(pos.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-all"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
           </div>
       )}

       {activeTab === 'chart' && (
          <div className="bg-white dark:bg-slate-800 p-12 rounded-[3rem] shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto min-h-[600px] flex items-start justify-center">
            <div className="org-chart"><ul className="flex justify-center">{tree.map(root => <OrgChartNode key={root.id} node={root} />)}</ul></div>
          </div>
       )}

       {/* MODALS PRESERVED AND STYLE-ALIGNED */}
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
    </div>
  );
};
export default Organization;
