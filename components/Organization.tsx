import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Project, Employee, Position, EmployeeStatus } from '../types';
import { 
  Briefcase, Trash2, Edit2, Users, Plus, X, Network, MapPin, 
  Globe, Navigation, Map as MapIcon, ChevronDown, ChevronRight, 
  Calendar, Minus, Layout, Search, Locate, Target, UserPlus, 
  RefreshCw, MapPinned, Info, Building2, LocateFixed, Loader2, Shield
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
        <div className="org-node-card group bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-teal-500/50 transition-all w-36 relative z-10">
           <div className="flex flex-col items-center">
             <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-50 mb-1.5 shadow-sm bg-slate-100">
                <img src={node.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(node.firstName)}+${encodeURIComponent(node.lastName)}`} className="w-full h-full object-cover" alt="" />
             </div>
             <div className="text-center w-full min-w-0">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[11px] truncate px-1">{node.firstName} {node.lastName}</h4>
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider mt-0.5 mb-1 truncate px-1">{node.position || 'Team'}</p>
             </div>
           </div>
        </div>
        {hasChildren && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <div className="w-px h-3 bg-slate-300 dark:bg-slate-600 mb-0.5"></div>
            <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className={`flex items-center justify-center w-4 h-4 rounded-full border bg-white dark:bg-slate-700 shadow-sm ${expanded ? 'border-teal-500 text-teal-600' : 'border-slate-300 text-slate-400'}`}>
              {expanded ? <Minus size={8} strokeWidth={4} /> : <Plus size={8} strokeWidth={4} />}
            </button>
          </div>
        )}
      </div>
      {hasChildren && expanded && (
        <ul className="flex flex-row gap-4">
          {node.children.map(child => <OrgChartNode key={child.id} node={child} />)}
        </ul>
      )}
    </li>
  );
};

const Organization = () => {
  const { currentUser, projects, positions, employees, addProject, updateProject, deleteProject, updatePosition, deletePosition, addEmployee, updateEmployee, deleteEmployee, showToast, syncAzureUsers } = useAppContext();
  const [activeTab, setActiveTab] = useState<'projects' | 'directory' | 'positions' | 'chart'>('directory');
  
  const [mapType, setMapType] = useState<'streets-vector' | 'satellite' | 'topo-vector' | 'dark-gray-vector'>('streets-vector');
  const [directorySearch, setDirectorySearch] = useState('');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const viewInstanceRef = useRef<any>(null);
  const graphicsLayerRef = useRef<any>(null);

  // Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState<any>(null);
  
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
          (e.department || '').toLowerCase().includes(term) ||
          (e.email || '').toLowerCase().includes(term)
      );
  }, [employees, directorySearch]);

  // Map Initialization for combined view
  useEffect(() => {
    if (activeTab !== 'directory' || !mapContainerRef.current) return;

    loadModules([
      "esri/Map", "esri/views/MapView", "esri/Graphic", "esri/layers/GraphicsLayer", 
      "esri/geometry/Point", "esri/geometry/SpatialReference", "esri/symbols/SimpleMarkerSymbol", "esri/widgets/Home"
    ], { css: true }).then(([EsriMap, MapView, Graphic, GraphicsLayer, Point, SpatialReference, SimpleMarkerSymbol, Home]) => {
        if (!mapContainerRef.current) return;

        const map = new EsriMap({ basemap: mapType });
        const view = new MapView({
          container: mapContainerRef.current,
          map: map,
          zoom: 4,
          center: [78.9629, 20.5937],
          ui: { components: ["zoom"] },
          popup: {
            dockEnabled: false,
            dockOptions: { buttonEnabled: false, breakpoint: false },
            visibleElements: { closeButton: true }
          }
        });

        const homeWidget = new Home({ view: view });
        view.ui.add(homeWidget, "top-left");

        const graphicsLayer = new GraphicsLayer({ id: "employeePoints" });
        map.add(graphicsLayer);
        
        viewInstanceRef.current = view;
        graphicsLayerRef.current = graphicsLayer;

        view.when(() => {
            refreshMapMarkers(filteredDirectoryEmployees);
        });
    }).catch(err => console.error("ArcGIS load failed:", err));

    return () => {
        if (viewInstanceRef.current) {
            viewInstanceRef.current.destroy();
            viewInstanceRef.current = null;
            graphicsLayerRef.current = null;
        }
    };
  }, [activeTab, mapType]);

  // Sync Markers
  useEffect(() => {
    if (activeTab === 'directory' && graphicsLayerRef.current) {
        refreshMapMarkers(filteredDirectoryEmployees);
    }
  }, [filteredDirectoryEmployees, activeTab]);

  // Edit Modal Map logic
  useEffect(() => {
    if (!editingEmployee || !editMapRef.current) return;

    loadModules(["esri/Map", "esri/views/MapView", "esri/Graphic", "esri/layers/GraphicsLayer"], { css: true })
      .then(([EsriMap, MapView, Graphic, GraphicsLayer]) => {
        const map = new EsriMap({ basemap: "streets-vector" });
        const view = new MapView({
          container: editMapRef.current!,
          map: map,
          zoom: 5,
          center: [employeeFormData?.location?.longitude || 78, employeeFormData?.location?.latitude || 20],
          ui: { components: ["zoom"] }
        });

        const layer = new GraphicsLayer();
        map.add(layer);
        editMapViewRef.current = view;

        const updateMarker = (lon: number, lat: number) => {
            layer.removeAll();
            const symbol = { type: "simple-marker", color: [13, 148, 136], size: "14px", outline: { color: [255, 255, 255], width: 2 } };
            layer.add(new Graphic({ geometry: { type: "point", longitude: lon, latitude: lat }, symbol }));
        };

        if (employeeFormData?.location?.latitude) {
            updateMarker(employeeFormData.location.longitude, employeeFormData.location.latitude);
        }

        view.on("click", (e: any) => {
            const { longitude, latitude } = e.mapPoint;
            updateMarker(longitude, latitude);
            setEmployeeFormData((prev: any) => ({ ...prev, location: { ...prev.location, latitude, longitude } }));
        });
      });

    return () => editMapViewRef.current?.destroy();
  }, [!!editingEmployee]);

  const refreshMapMarkers = async (list: Employee[]) => {
      if (!graphicsLayerRef.current) return;
      const [Graphic, Point, SimpleMarkerSymbol] = await loadModules(["esri/Graphic", "esri/geometry/Point", "esri/symbols/SimpleMarkerSymbol"]);
      graphicsLayerRef.current.removeAll();
      const wgs84 = { wkid: 4326 };

      list.forEach(emp => {
          const lat = parseFloat(String(emp.location?.latitude));
          const lon = parseFloat(String(emp.location?.longitude));
          if (!isNaN(lat) && !isNaN(lon)) {
              const graphic = new Graphic({
                  geometry: new Point({ longitude: lon, latitude: lat, spatialReference: wgs84 }),
                  symbol: new SimpleMarkerSymbol({ style: "circle", color: [13, 148, 136, 0.9], size: 14, outline: { color: [255, 255, 255, 1], width: 2 } }),
                  attributes: { id: emp.id },
                  popupTemplate: {
                      title: `${emp.firstName} ${emp.lastName}`,
                      content: `<div style="padding:10px"><b>${emp.position}</b><br/>${emp.email}</div>`
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
      await updateEmployee(employeeFormData);
      setIsProcessing(false);
      setEditingEmployee(null);
      showToast("Employee details synchronized.", "success");
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

  return (
    <div className="space-y-6 animate-fade-in relative">
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Organization</h2><p className="text-sm text-slate-500 dark:text-slate-400">Manage workforce directory and global business operations.</p></div>
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto">
               {[
                 { id: 'projects', label: 'Projects', icon: Layout },
                 { id: 'directory', label: 'Employees', icon: Users },
                 { id: 'positions', label: 'Positions', icon: Briefcase },
                 { id: 'chart', label: 'Org Chart', icon: Network }
               ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-md text-sm transition capitalize flex items-center gap-2 ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 shadow text-teal-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>
                    <tab.icon size={14} />
                    <span>{tab.label}</span>
                  </button>
               ))}
            </div>
            {activeTab === 'projects' && isPowerUser && (
                <button onClick={() => setShowProjectModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-bold shadow-lg shadow-teal-500/20"><Plus size={18} /><span>New Project</span></button>
            )}
            {activeTab === 'directory' && isPowerUser && (
                <div className="flex gap-2">
                    <button onClick={handleSync} disabled={isSyncing} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition flex items-center space-x-2 text-sm font-bold shadow-sm">
                        <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                        <span>Sync</span>
                    </button>
                    <button onClick={() => setShowManageModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-bold shadow-lg shadow-teal-500/20"><UserPlus size={18} /><span>Manage Employees</span></button>
                </div>
            )}
          </div>
       </div>

       {activeTab === 'directory' && (
           <div className="space-y-4">
               <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                   <div className="relative flex-1">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input 
                            type="text" 
                            placeholder="Find colleague by name, department or role..." 
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all dark:text-white"
                            value={directorySearch}
                            onChange={e => setDirectorySearch(e.target.value)}
                       />
                   </div>
                   <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-900/30 rounded-xl border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400">
                       <MapPinned size={16}/><span className="text-xs font-black uppercase tracking-widest">{filteredDirectoryEmployees.length} Global Points</span>
                   </div>
               </div>

               <div className="flex flex-col lg:flex-row gap-6 h-[720px]">
                   <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                       <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Building2 size={14}/> Corporate Directory</h3>
                       </div>
                       <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                           {filteredDirectoryEmployees.map(emp => (
                               <div 
                                    key={emp.id} 
                                    onClick={() => focusEmployeeOnMap(emp)}
                                    className="w-full flex items-center text-left p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 group border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all cursor-pointer"
                               >
                                   <div className="flex items-start gap-4 flex-1 min-w-0">
                                       <img src={emp.avatar} className="w-12 h-12 rounded-2xl object-cover shadow-sm border border-white dark:border-slate-800" alt="" />
                                       <div className="min-w-0 flex-1">
                                           <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">{emp.firstName} {emp.lastName}</p>
                                           <p className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-tight mt-0.5">{emp.position || 'Team Member'}</p>
                                           <div className="flex items-center gap-1.5 mt-2 text-slate-400">
                                               <MapPin size={10} /><span className="text-[10px] font-bold truncate">{emp.workLocation || 'Not Set'}</span>
                                           </div>
                                       </div>
                                   </div>
                                   <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                       {isPowerUser && (
                                           <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingEmployee(emp); setEmployeeFormData({...emp}); }} 
                                                className="p-2 text-slate-400 hover:text-teal-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg shadow-sm border border-transparent hover:border-slate-100 transition-all"
                                                title="Edit Employee"
                                           >
                                               <Edit2 size={14} />
                                           </button>
                                       )}
                                       <ChevronRight size={16} className="text-slate-300" />
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>

                   <div className="flex-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-2xl">
                       <div className="absolute top-6 right-6 z-[1000] w-32">
                           <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col gap-2">
                               <h4 className="text-[9px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Base Map</h4>
                               {[
                                   { id: 'streets-vector', icon: Navigation, label: 'Street' },
                                   { id: 'satellite', icon: Globe, label: 'Sat' },
                                   { id: 'dark-gray-vector', icon: MapIcon, label: 'Dark' }
                               ].map(type => (
                                   <button key={type.id} onClick={() => setMapType(type.id as any)} className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${mapType === type.id ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                       <type.icon size={18} /><span className="text-[8px] font-black uppercase tracking-tighter">{type.label}</span>
                                   </button>
                               ))}
                           </div>
                       </div>
                       <div ref={mapContainerRef} className="w-full h-full z-0"></div>
                   </div>
               </div>
           </div>
       )}

       {/* Project/Position tabs logic preserved from combined view */}
       {activeTab === 'projects' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(project => (
                    <div key={project.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 border border-teal-100"><Briefcase size={22} /></div>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${project.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400'}`}>{project.status}</span>
                        </div>
                        <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{project.name}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">{project.description}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-4"><Calendar size={14} /><span>Due: {project.dueDate || 'No date'}</span></div>
                        {isPowerUser && (
                            <div className="flex gap-2 mt-4 pt-4 border-t dark:border-slate-700">
                                <button onClick={() => setEditingProject(project)} className="p-1.5 text-slate-400 hover:text-emerald-600"><Edit2 size={16}/></button>
                                <button onClick={() => deleteProject(project.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </div>
                        )}
                    </div>
                ))}
           </div>
       )}

       {activeTab === 'positions' && (
           <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                        <tr><th className="px-6 py-4">Title</th><th className="px-6 py-4">Description</th><th className="px-6 py-4 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {positions.map(pos => (
                            <tr key={pos.id} className="text-sm">
                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{pos.title}</td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{pos.description}</td>
                                <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => setEditingPosition(pos)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit2 size={16}/></button><button onClick={() => deletePosition(pos.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
           </div>
       )}

       {activeTab === 'chart' && (
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto min-h-[500px]">
            <div className="org-chart"><ul className="flex justify-center">{tree.map(root => <OrgChartNode key={root.id} node={root} />)}</ul></div>
          </div>
       )}

       {/* MODALS */}
       <DraggableModal isOpen={showManageModal} onClose={() => setShowManageModal(false)} title="Workforce Administration" width="max-w-7xl">
           <EmployeeList employees={employees} onAddEmployee={addEmployee} onUpdateEmployee={updateEmployee} onDeleteEmployee={deleteEmployee} />
       </DraggableModal>

       <DraggableModal isOpen={!!editingEmployee} onClose={() => setEditingEmployee(null)} title="Modify Colleague Record" width="max-w-3xl">
           <form onSubmit={handleUpdateEmployee} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">First Name</label><input required type="text" value={employeeFormData?.firstName || ''} onChange={e => setEmployeeFormData({...employeeFormData, firstName: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" /></div>
                   <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Last Name</label><input required type="text" value={employeeFormData?.lastName || ''} onChange={e => setEmployeeFormData({...employeeFormData, lastName: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" /></div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Position</label><select required value={employeeFormData?.position || ''} onChange={e => setEmployeeFormData({...employeeFormData, position: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"><option value="" disabled>Select Position...</option>{positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}</select></div>
                   <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Employment Status</label><select required value={employeeFormData?.status || EmployeeStatus.ACTIVE} onChange={e => setEmployeeFormData({...employeeFormData, status: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"><option value={EmployeeStatus.ACTIVE}>Active</option><option value={EmployeeStatus.ON_LEAVE}>On Leave</option><option value={EmployeeStatus.INACTIVE}>Inactive</option></select></div>
               </div>
               <div>
                   <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><LocateFixed size={12} className="text-teal-600"/> Coordinate Adjustment</label>
                   <div ref={editMapRef} className="h-60 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 shadow-inner overflow-hidden"></div>
                   <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
                       <span>LAT: {employeeFormData?.location?.latitude?.toFixed(4) || 'N/A'}</span>
                       <span>LON: {employeeFormData?.location?.longitude?.toFixed(4) || 'N/A'}</span>
                   </div>
               </div>
               <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                   <button type="button" onClick={() => setEditingEmployee(null)} className="px-6 py-2.5 text-xs font-black text-slate-400 uppercase tracking-widest">Cancel</button>
                   <button type="submit" disabled={isProcessing} className="px-8 py-2.5 bg-teal-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg flex items-center gap-2">{isProcessing ? <Loader2 size={14} className="animate-spin" /> : 'Commit Changes'}</button>
               </div>
           </form>
       </DraggableModal>

       <DraggableModal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title="New Project Creation" width="max-w-md">
           <form onSubmit={handleCreateProject} className="space-y-4">
                <div><label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Project Name</label><input required type="text" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} placeholder="e.g. Apollo Phase II" className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                <div><label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Description</label><textarea rows={3} value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Status</label><select value={projectForm.status} onChange={e => setProjectForm({...projectForm, status: e.target.value as any})} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white"><option>Active</option><option>On Hold</option><option>Completed</option></select></div>
                    <div><label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Due Date</label><input type="date" value={projectForm.dueDate} onChange={e => setProjectForm({...projectForm, dueDate: e.target.value})} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                </div>
                <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={() => setShowProjectModal(false)} className="px-6 py-2 text-xs font-bold text-slate-400 uppercase">Cancel</button><button type="submit" disabled={isProcessing} className="px-8 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase">{isProcessing ? 'Creating...' : 'Create Project'}</button></div>
           </form>
       </DraggableModal>

       <DraggableModal isOpen={!!editingProject} onClose={() => setEditingProject(null)} title="Update Project Effort" width="max-w-md">
           <form onSubmit={handleUpdateProject} className="space-y-4">
                <div><label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Project Name</label><input required type="text" value={editingProject?.name || ''} onChange={e => setEditingProject(p => p ? {...p, name: e.target.value} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                <div><label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Description</label><textarea rows={3} value={editingProject?.description || ''} onChange={e => setEditingProject(p => p ? {...p, description: e.target.value} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Status</label><select value={editingProject?.status || 'Active'} onChange={e => setEditingProject(p => p ? {...p, status: e.target.value as any} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white"><option>Active</option><option>On Hold</option><option>Completed</option></select></div>
                    <div><label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Due Date</label><input type="date" value={editingProject?.dueDate || ''} onChange={e => setEditingProject(p => p ? {...p, dueDate: e.target.value} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                </div>
                <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={() => setEditingProject(null)} className="px-6 py-2 text-xs font-bold text-slate-400 uppercase">Cancel</button><button type="submit" className="px-8 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase shadow-lg">Save Changes</button></div>
           </form>
       </DraggableModal>

       <DraggableModal isOpen={!!editingPosition} onClose={() => setEditingPosition(null)} title="Modify Role Title" width="max-w-md">
           <form onSubmit={handleUpdatePosition} className="space-y-4">
                <div><label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Position Title</label><input required type="text" value={editingPosition?.title || ''} onChange={e => setEditingPosition(p => p ? {...p, title: e.target.value} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white outline-none" /></div>
                <div><label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Role Description</label><textarea rows={3} value={editingPosition?.description || ''} onChange={e => setEditingPosition(p => p ? {...p, description: e.target.value} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white outline-none" /></div>
                <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={() => setEditingPosition(null)} className="px-6 py-2 text-xs font-bold text-slate-400 uppercase">Cancel</button><button type="submit" className="px-8 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase shadow-lg">Update Role</button></div>
           </form>
       </DraggableModal>
    </div>
  );
};
export default Organization;