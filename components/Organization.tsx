import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Project, Employee, Position } from '../types';
import { Briefcase, Trash2, Edit2, Users, Plus, X, Network, MapPin, ListTodo, UserSquare, Globe, Navigation, Layers, Map as MapIcon, ChevronDown, CheckCircle2, AlertCircle, Calendar, Minus, Layout } from 'lucide-react';
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
  const { currentUser, projects, positions, employees, addProject, updateProject, deleteProject, updatePosition, deletePosition, addEmployee, updateEmployee, deleteEmployee, showToast } = useAppContext();
  const [activeTab, setActiveTab] = useState<'employees' | 'positions' | 'projects' | 'chart' | 'map'>('projects');
  
  const [mapType, setMapType] = useState<'streets-vector' | 'satellite' | 'topo-vector' | 'dark-gray-vector'>('streets-vector');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const viewInstanceRef = useRef<any>(null);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [projectForm, setProjectForm] = useState({
      name: '',
      description: '',
      status: 'Active' as const,
      dueDate: '',
      tasks: [] as string[]
  });

  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;
  const tree = useMemo(() => buildOrgTree(employees), [employees]);

  useEffect(() => {
    if (activeTab !== 'map' || !mapContainerRef.current) return;

    loadModules([
      "esri/Map",
      "esri/views/MapView",
      "esri/Graphic",
      "esri/layers/GraphicsLayer"
    ], { css: true }).then(([EsriMap, MapView, Graphic, GraphicsLayer]) => {
        if (!mapContainerRef.current) return;

        const map = new EsriMap({ basemap: mapType });
        const view = new MapView({
          container: mapContainerRef.current,
          map: map,
          zoom: 3,
          center: [0, 20],
          ui: { components: ["zoom"] },
          popup: {
            dockEnabled: false,
            dockOptions: { buttonEnabled: false, breakpoint: false },
            visibleElements: {
              closeButton: true
            }
          }
        });

        const graphicsLayer = new GraphicsLayer();
        map.add(graphicsLayer);
        viewInstanceRef.current = view;

        view.when(() => {
            const graphics: any[] = [];
            
            employees.forEach(emp => {
              const lat = parseFloat(String(emp.location?.latitude));
              const lon = parseFloat(String(emp.location?.longitude));

              if (!isNaN(lat) && !isNaN(lon)) {
                // Autocast Point and Symbol - often more robust for WebGL template store issues
                const point = {
                    type: "point",
                    longitude: lon,
                    latitude: lat,
                    spatialReference: { wkid: 4326 }
                };
                
                // Construct validated Avatar URL
                const avatarUrl = emp.avatar && emp.avatar.startsWith('http') 
                    ? emp.avatar 
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.firstName)}+${encodeURIComponent(emp.lastName)}&background=0D9488&color=fff`;

                const symbol = {
                  type: "picture-marker",
                  url: avatarUrl,
                  width: 32, // Strictly numeric
                  height: 32,
                  outline: {
                      color: [255, 255, 255, 0.8],
                      width: 2
                  }
                };

                const popupTemplate = {
                  title: `${emp.firstName} ${emp.lastName}`,
                  content: `
                    <div style="font-family: 'Inter', sans-serif; min-width: 280px;">
                      <div style="background:#0d9488; height: 80px; position:relative; border-radius: 12px 12px 0 0; overflow: hidden;">
                        <div style="position:absolute; top:0; right:0; bottom:0; left:0; background: linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.3));"></div>
                        <img src="${avatarUrl}" style="width: 70px; height: 70px; border-radius: 50%; border: 4px solid white; position: absolute; bottom: -20px; left: 24px; object-fit: cover; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 1;" onerror="this.src='https://ui-avatars.com/api/?name=User&background=0D9488&color=fff'"/>
                      </div>
                      <div style="padding: 36px 24px 24px 24px; background: white;">
                        <h4 style="margin: 0; font-weight: 800; font-size: 20px; color: #1e293b;">${emp.firstName} ${emp.lastName}</h4>
                        <p style="margin: 4px 0; color: #0d9488; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px;">${emp.position || 'Empower Team'}</p>
                        <div style="margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 13px; color: #64748b;">
                            <p style="margin: 8px 0; display: flex; align-items: center; gap: 10px;">
                              <span style="font-size: 16px;">📍</span> ${emp.workLocation || 'Office Location'}
                            </p>
                            <p style="margin: 8px 0; display: flex; align-items: center; gap: 10px;">
                              <span style="font-size: 16px;">📧</span> ${emp.email}
                            </p>
                        </div>
                      </div>
                    </div>
                  `
                };

                const graphic = new Graphic({ 
                    geometry: point, 
                    symbol: symbol as any, 
                    popupTemplate: popupTemplate 
                });
                
                graphics.push(graphic);
                graphicsLayer.add(graphic);
              }
            });
            
            if (graphics.length > 0) {
                view.goTo(graphics).catch(() => {});
            }
        });
    }).catch(err => {
      console.error("ArcGIS module load failed:", err);
    });

    return () => {
        if (viewInstanceRef.current) {
            viewInstanceRef.current.destroy();
            viewInstanceRef.current = null;
        }
    };
  }, [activeTab, employees, mapType]);

  const handleCreateProject = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      try {
          await addProject({
              ...projectForm,
              id: Math.random().toString(36).substr(2, 9)
          });
          setShowProjectModal(false);
          setProjectForm({ name: '', description: '', status: 'Active', dueDate: '', tasks: [] });
          showToast("New project created successfully.", "success");
      } catch (err) {
          showToast("Failed to create project.", "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingProject) return;
      setIsProcessing(true);
      await updateProject(editingProject.id, editingProject);
      setIsProcessing(false);
      setEditingProject(null);
      showToast("Project updated successfully.", "success");
  };

  const handleDeleteProject = async (id: string | number) => {
      if (!window.confirm("Are you sure you want to delete this project?")) return;
      await deleteProject(id);
      showToast("Project removed.", "info");
  };

  const handleUpdatePosition = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingPosition) return;
      setIsProcessing(true);
      await updatePosition(editingPosition.id, editingPosition);
      setIsProcessing(false);
      setEditingPosition(null);
      showToast("Position updated successfully.", "success");
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Organization</h2><p className="text-sm text-slate-500 dark:text-slate-400">Manage structure, assets, and global presence.</p></div>
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto">
               {[
                 { id: 'projects', label: 'Projects', icon: Layout },
                 { id: 'employees', label: 'Employees', icon: Users },
                 { id: 'positions', label: 'Positions', icon: Briefcase },
                 { id: 'chart', label: 'Org Chart', icon: Network },
                 { id: 'map', label: 'Employees Location', icon: MapPin }
               ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-md text-sm transition capitalize flex items-center gap-2 ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 shadow text-teal-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>
                    <tab.icon size={14} />
                    <span>{tab.label}</span>
                  </button>
               ))}
            </div>
            {activeTab === 'projects' && isPowerUser && (
                <button onClick={() => setShowProjectModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center space-x-2 text-sm font-bold shadow-lg shadow-teal-500/20">
                    <Plus size={18} />
                    <span>New Project</span>
                </button>
            )}
          </div>
       </div>

       {activeTab === 'employees' && <EmployeeList employees={employees} onAddEmployee={addEmployee} onUpdateEmployee={updateEmployee} onDeleteEmployee={deleteEmployee} />}
       
       {activeTab === 'projects' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(project => (
                    <div key={project.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 relative group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 border border-teal-100"><Briefcase size={22} /></div>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${project.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400'}`}>{project.status}</span>
                        </div>
                        <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{project.name}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">{project.description}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-4">
                          <Calendar size={14} />
                          <span>Due: {project.dueDate || 'No date'}</span>
                        </div>
                        {isPowerUser && (
                            <div className="flex gap-2 mt-4 pt-4 border-t dark:border-slate-700">
                                <button onClick={() => setEditingProject(project)} className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"><Edit2 size={16}/></button>
                                <button onClick={() => handleDeleteProject(project.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                            </div>
                        )}
                    </div>
                ))}
           </div>
       )}

       {activeTab === 'map' && (
           <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden h-[700px] relative shadow-2xl">
               <div className="absolute top-6 right-6 z-[1000] w-32">
                   <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col gap-2 ring-1 ring-black/5">
                       <h4 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Map Design</h4>
                       {[
                           { id: 'streets-vector', icon: Navigation, label: 'Street' },
                           { id: 'satellite', icon: Globe, label: 'Satellite' },
                           { id: 'dark-gray-vector', icon: MapIcon, label: 'Dark' }
                       ].map(type => (
                           <button key={type.id} onClick={() => setMapType(type.id as any)} className={`p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all ${mapType === type.id ? 'bg-teal-600 text-white shadow-lg scale-105' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                             <type.icon size={20} />
                             <span className="text-[9px] font-black uppercase tracking-tight">{type.label}</span>
                           </button>
                       ))}
                   </div>
               </div>
               <div ref={mapContainerRef} className="w-full h-full z-0"></div>
           </div>
       )}

       {activeTab === 'positions' && (
           <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-4">Title</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {positions.map(pos => (
                            <tr key={pos.id} className="text-sm">
                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{pos.title}</td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{pos.description}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setEditingPosition(pos)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit2 size={16}/></button>
                                        <button onClick={() => deletePosition(pos.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
           </div>
       )}

       {activeTab === 'chart' && (
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto min-h-[500px]">
            <div className="org-chart">
              <ul className="flex justify-center">
                {tree.map(root => <OrgChartNode key={root.id} node={root} />)}
              </ul>
            </div>
          </div>
       )}

       <DraggableModal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title="New Project Creation" width="max-w-md">
           <form onSubmit={handleCreateProject} className="space-y-4">
                <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Project Name</label><input required type="text" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} placeholder="e.g. Apollo Phase II" className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Description</label><textarea rows={3} value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})} placeholder="Strategic goals and overview..." className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Status</label><select value={projectForm.status} onChange={e => setProjectForm({...projectForm, status: e.target.value as any})} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white"><option>Active</option><option>On Hold</option><option>Completed</option></select></div>
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Due Date</label><input type="date" value={projectForm.dueDate} onChange={e => setProjectForm({...projectForm, dueDate: e.target.value})} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                </div>
                <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={() => setShowProjectModal(false)} className="px-6 py-2 text-xs font-bold text-slate-400 uppercase">Cancel</button><button type="submit" disabled={isProcessing} className="px-8 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase shadow-lg">{isProcessing ? 'Creating...' : 'Create Project'}</button></div>
           </form>
       </DraggableModal>

       <DraggableModal isOpen={!!editingProject} onClose={() => setEditingProject(null)} title="Update Project Effort" width="max-w-md">
           <form onSubmit={handleUpdateProject} className="space-y-4">
                <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Project Name</label><input required type="text" value={editingProject?.name || ''} onChange={e => setEditingProject(p => p ? {...p, name: e.target.value} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Description</label><textarea rows={3} value={editingProject?.description || ''} onChange={e => setEditingProject(p => p ? {...p, description: e.target.value} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Status</label><select value={editingProject?.status || 'Active'} onChange={e => setEditingProject(p => p ? {...p, status: e.target.value as any} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white"><option>Active</option><option>On Hold</option><option>Completed</option></select></div>
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Due Date</label><input type="date" value={editingProject?.dueDate || ''} onChange={e => setEditingProject(p => p ? {...p, dueDate: e.target.value} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                </div>
                <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={() => setEditingProject(null)} className="px-6 py-2 text-xs font-bold text-slate-400 uppercase">Cancel</button><button type="submit" className="px-8 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase shadow-lg">Save Changes</button></div>
           </form>
       </DraggableModal>

       <DraggableModal isOpen={!!editingPosition} onClose={() => setEditingPosition(null)} title="Modify Role Title" width="max-w-md">
           <form onSubmit={handleUpdatePosition} className="space-y-4">
                <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Position Title</label><input required type="text" value={editingPosition?.title || ''} onChange={e => setEditingPosition(p => p ? {...p, title: e.target.value} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Role Description</label><textarea rows={3} value={editingPosition?.description || ''} onChange={e => setEditingPosition(p => p ? {...p, description: e.target.value} : null)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:text-white" /></div>
                <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={() => setEditingPosition(null)} className="px-6 py-2 text-xs font-bold text-slate-400 uppercase">Cancel</button><button type="submit" className="px-8 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase shadow-lg">Update Role</button></div>
           </form>
       </DraggableModal>
    </div>
  );
};
export default Organization;