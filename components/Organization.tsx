
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
    // Check if manager is also in this filtered list
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
      <div className="flex flex-col items-center relative pb-8">
        <div className="org-node-card group bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:border-teal-500/50 transition-all w-52 relative z-10">
           <div className="flex flex-col items-center">
             <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-slate-50 dark:border-slate-700 mb-3 shadow-sm group-hover:scale-110 transition-transform">
                <img src={node.avatar} alt={node.firstName} className="w-full h-full object-cover" />
             </div>
             <div className="text-center w-full">
                <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm tracking-tight leading-tight">{node.firstName} {node.lastName}</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1 mb-2 truncate">
                    {node.position || 'Consultant'}
                </p>
                {node.department && (
                  <div className="inline-flex items-center gap-1 text-[9px] bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-black uppercase">
                    <Building2 size={10} /> {node.department}
                  </div>
                )}
             </div>
           </div>
        </div>

        {hasChildren && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <div className="w-0.5 h-4 bg-slate-300 dark:bg-slate-600 mb-0.5"></div>
            <button 
              onClick={() => setExpanded(!expanded)} 
              className={`flex items-center justify-center w-6 h-6 rounded-full border-2 bg-white dark:bg-slate-700 shadow-lg transition-all hover:scale-110 ${expanded ? 'border-teal-500 text-teal-600' : 'border-slate-300 text-slate-400'}`}
            >
              {expanded ? <Minus size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
            </button>
          </div>
        )}
      </div>
      
      {hasChildren && expanded && (
        <ul className="animate-in fade-in slide-in-from-top-4 duration-500">
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
            if (u.location?.latitude) {
              const point = { type: "point", longitude: u.location.longitude, latitude: u.location.latitude };
              const markerSymbol = { type: "simple-marker", color: [220, 38, 38, 1], size: "10px", outline: { color: [255, 255, 255], width: 2 } };
              employeeLayer.add(new Graphic({ geometry: point, symbol: markerSymbol }));
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
  return <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-[600px] relative">{mapError ? <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center"><AlertTriangle size={48} className="text-red-500 mb-4" /><p>{mapError}</p></div> : <><div ref={mapDiv} className="w-full h-full"></div>{!isMapLoaded && <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900 z-10"><div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div></div>}</>}</div >;
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
             placeholder="Search name or position..." 
             className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
             value={query} 
             onChange={e => setQuery(e.target.value)} 
           />
       </div>
       <div className="max-h-60 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-700 rounded-xl divide-y divide-slate-50 dark:divide-slate-700/50">
          {filtered.map(emp => {
            const isSelected = selectedIds.includes(emp.id);
            return (
              <div key={emp.id} onClick={() => onToggle(emp.id)} className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="flex items-center gap-3">
                  <img src={emp.avatar} className="w-8 h-8 rounded-full border border-slate-200" alt="" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{emp.firstName} {emp.lastName}</p>
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
    addProject, updateProject, deleteProject
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'positions' | 'projects' | 'allocations' | 'chart' | 'locations'>('departments');
  const [chartDeptFilter, setChartDeptFilter] = useState<string>('all');
  
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showPosModal, setShowPosModal] = useState(false);
  const [showProjModal, setShowProjModal] = useState(false);
  
  const [deptForm, setDeptForm] = useState<any>({ id: '', name: '', description: '', managerId: '', employeeIds: [] });
  const [posForm, setPosForm] = useState<any>({ id: '', title: '', description: '' });
  const [projForm, setProjForm] = useState<any>({ id: '', name: '', description: '', status: 'Active', tasksString: '', employeeIds: [] });
  
  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;

  const orgTreeData = useMemo(() => {
      const filteredEmps = chartDeptFilter === 'all' 
        ? employees 
        : employees.filter(e => String(e.departmentId) === String(chartDeptFilter));
      return buildOrgTree(filteredEmps);
  }, [employees, chartDeptFilter]);

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetDeptId = deptForm.id;
    
    if (deptForm.id) {
      await updateDepartment(deptForm.id, { name: deptForm.name, description: deptForm.description, managerId: deptForm.managerId });
    } else {
      const newId = Math.random().toString(36).substr(2, 9);
      await addDepartment({ id: newId, name: deptForm.name, description: deptForm.description, managerId: deptForm.managerId } as any);
      targetDeptId = newId;
    }

    const updates: { id: string | number, data: Partial<Employee> }[] = [];
    employees.forEach(emp => {
      const isSelected = deptForm.employeeIds.includes(emp.id);
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

  const handleConfirmDeleteDept = async (id: string | number) => {
      const dept = departments.find(d => String(d.id) === String(id));
      if (!dept) return;
      if (window.confirm(`Are you sure you want to delete the "${dept.name}" department? All associated employees will be reset to the General department.`)) {
          await deleteDepartment(id);
          notify(`Department "${dept.name}" deleted successfully.`);
      }
  };

  const openDeptEdit = (dept: Department) => {
      const deptMembers = employees.filter(e => String(e.departmentId) === String(dept.id)).map(e => e.id);
      setDeptForm({ ...dept, employeeIds: deptMembers });
      setShowDeptModal(true);
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
    if (projForm.id) {
      await updateProject(projForm.id, { name: projForm.name, description: projForm.description, status: projForm.status, tasks });
    } else {
      await addProject({ name: projForm.name, description: projForm.description, status: projForm.status, tasks });
    }
    setShowProjModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
       <style>{`
          .org-tree ul { padding-top: 20px; position: relative; display: flex; justify-content: center; }
          .org-tree li { text-align: center; list-style-type: none; position: relative; padding: 20px 5px 0 5px; }
          .org-tree li::before, .org-tree li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 2px solid #cbd5e1; width: 50%; height: 20px; }
          .org-tree li::after { right: auto; left: 50%; border-left: 2px solid #cbd5e1; }
          .org-tree li:only-child::after, .org-tree li:only-child::before { display: none; }
          .org-tree li:only-child { padding-top: 0; }
          .org-tree li:first-child::before, .org-tree li:last-child::after { border: 0 none; }
          .org-tree li:last-child::after { border-left: 2px solid #cbd5e1; border-radius: 5px 0 0 0; }
          .org-tree li:first-child::before { border-radius: 0 5px 0 0; }
          .org-tree ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 2px solid #cbd5e1; width: 0; height: 20px; }
          .dark .org-tree li::before, .dark .org-tree li::after, .dark .org-tree ul ul::before { border-color: #475569; }
       `}</style>

       {/* Department Modal */}
       <DraggableModal isOpen={showDeptModal} onClose={() => setShowDeptModal(false)} title={deptForm.id ? "Edit Department" : "Add Department"} width="max-w-2xl">
          <form onSubmit={handleDeptSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Department Name</label><input required type="text" className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} /></div>
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Description</label><textarea required className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" rows={3} value={deptForm.description} onChange={e => setDeptForm({...deptForm, description: e.target.value})} /></div>
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Department Head (Manager)</label><select required className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" value={deptForm.managerId} onChange={e => setDeptForm({...deptForm, managerId: e.target.value})}><option value="" disabled>Select Head...</option>{employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select></div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Department Members</label>
                    <EmployeePicker 
                      selectedIds={deptForm.employeeIds || []} 
                      onToggle={(id) => setDeptForm((prev: any) => { 
                        const cur = prev.employeeIds || []; 
                        return { ...prev, employeeIds: cur.includes(id) ? cur.filter((i:any)=>i!==id) : [...cur, id] }; 
                      })} 
                      allEmployees={employees} 
                    />
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                <button type="button" onClick={() => setShowDeptModal(false)} className="px-6 py-2.5 text-slate-400 font-bold uppercase text-xs">Cancel</button>
                <button type="submit" className="bg-emerald-600 text-white px-8 py-2.5 rounded-xl text-sm font-bold uppercase shadow-lg active:scale-95 transition-all">Save Dept</button>
              </div>
          </form>
       </DraggableModal>

       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Organization</h2><p className="text-sm text-slate-500 dark:text-slate-400">Manage structure, hierarchy and roles.</p></div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto">
             {['departments', 'positions', 'projects', 'chart', 'locations', 'employees'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap capitalize ${activeTab === tab ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>{tab === 'chart' ? 'Org Chart' : tab === 'locations' ? 'Map View' : tab}</button>
             ))}
          </div>
       </div>

       {activeTab === 'departments' && (
           <div className="space-y-4">
               <div className="flex justify-between items-center"><h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Building2 className="text-emerald-600" /> Departments</h3>{isPowerUser && <button onClick={() => { setDeptForm({ id: '', name: '', description: '', managerId: '', employeeIds: [] }); setShowDeptModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2"><Plus size={16} /> Add Dept</button>}</div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {departments.map(dept => (
                      <div key={dept.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition relative group">
                          {isPowerUser && (
                              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openDeptEdit(dept)} className="p-1.5 text-slate-400 hover:text-teal-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm transition-colors"><Edit2 size={14}/></button>
                                  <button onClick={() => handleConfirmDeleteDept(dept.id)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 dark:bg-slate-700 rounded shadow-sm transition-colors"><Trash2 size={14}/></button>
                              </div>
                          )}
                          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 dark:bg-emerald-900/20"><Building2 size={20} /></div>
                          <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{dept.name}</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400 h-10 line-clamp-2">{dept.description}</p>
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={12}/> {employees.filter(e => String(e.departmentId) === String(dept.id)).length} Active Members</div>
                      </div>
                  ))}
               </div>
           </div>
       )}

       {activeTab === 'chart' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar">
                    <button onClick={() => setChartDeptFilter('all')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${chartDeptFilter === 'all' ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>All Company</button>
                    {departments.map(d => (
                        <button key={d.id} onClick={() => setChartDeptFilter(String(d.id))} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${chartDeptFilter === String(d.id) ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{d.name}</button>
                    ))}
                </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                <div className="p-12 overflow-auto min-h-[700px] flex justify-center bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px]">
                {orgTreeData.length === 0 ? <div className="flex flex-col items-center justify-center text-slate-400"><Network size={48} className="mb-4 opacity-20" /><p className="font-bold text-xs uppercase tracking-widest">No matching hierarchy found</p></div> : <div className="org-tree"><ul>{orgTreeData.map(node => <OrgChartNode key={node.id} node={node} />)}</ul></div>}
                </div>
            </div>
          </div>
       )}

       {activeTab === 'employees' && <EmployeeList employees={employees} onAddEmployee={addEmployee} onUpdateEmployee={updateEmployee} onDeleteEmployee={deleteEmployee} />}
       {activeTab === 'locations' && <div className="space-y-4"><GraphicsLayerMap users={users} /></div>}
       {activeTab === 'positions' && (
         <div className="space-y-4">
           <div className="flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><UserSquare className="text-emerald-600" /> Job Positions</h3>{isPowerUser && <button onClick={() => { setPosForm({ id: '', title: '', description: '' }); setShowPosModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2"><Plus size={16} /> Add Position</button>}</div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{positions.map(p => (<div key={p.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition relative group"><h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{p.title}</h4><p className="text-sm text-slate-500 dark:text-slate-400">{p.description}</p></div>))}</div>
         </div>
       )}
    </div>
  );
};
export default Organization;
