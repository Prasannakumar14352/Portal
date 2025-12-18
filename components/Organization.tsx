
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, Department, Project, Employee, Role } from '../types';
import { Briefcase, FolderPlus, Trash2, Building2, Users, Edit2, Layers, CheckCircle, Filter, Plus, Minus, X, ChevronLeft, ChevronRight, Network, MapPin, BadgeCheck, Eye, AlertTriangle } from 'lucide-react';
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
  const { currentUser, departments, projects, users, notify, updateUser, addDepartment, updateDepartment, deleteDepartment, roles, addRole, updateRole, deleteRole, employees, addEmployee, updateEmployee, deleteEmployee } = useAppContext();
  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'roles' | 'projects' | 'allocations' | 'chart' | 'locations'>('departments');
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showConfirmAlloc, setShowConfirmAlloc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  const [deptForm, setDeptForm] = useState<any>({ name: '', description: '', managerId: '' });
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [allocForm, setAllocForm] = useState<any>({ departmentId: '', projectIds: [] });
  const isHR = currentUser?.role === UserRole.HR;
  const orgTreeData = useMemo(() => buildOrgTree(users), [users]);

  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  const finalizeAllocation = () => {
    if (selectedUser) {
       updateUser(selectedUser.id, { departmentId: allocForm.departmentId, projectIds: allocForm.projectIds });
       notify(`Assignment updated for ${selectedUser.firstName}.`);
       setShowConfirmAlloc(false);
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
            <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded border border-slate-300 disabled:opacity-50"><ChevronLeft size={16} /></button>
            <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="p-1.5 rounded border border-slate-300 disabled:opacity-50"><ChevronRight size={16} /></button>
         </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
       <style>{`.org-tree ul{padding-top:20px;position:relative;display:flex;justify-content:center}.org-tree li{float:left;text-align:center;list-style-type:none;position:relative;padding:20px 5px 0 5px}.org-tree li::before,.org-tree li::after{content:'';position:absolute;top:0;right:50%;border-top:1px solid #cbd5e1;width:50%;height:20px}.org-tree li::after{right:auto;left:50%;border-left:1px solid #cbd5e1}.org-tree li:first-child::before,.org-tree li:last-child::after{border:0 none}.org-tree li:only-child::after,.org-tree li:only-child::before{display:none}.org-tree li:only-child{padding-top:0}.org-tree ul ul::before{content:'';position:absolute;top:0;left:50%;border-left:1px solid #cbd5e1;width:0;height:20px}`}</style>

       <DraggableModal isOpen={showConfirmAlloc} onClose={() => setShowConfirmAlloc(false)} title="Confirm Assignment">
          <div className="text-center p-4">
              <CheckCircle size={48} className="text-emerald-600 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-300 mb-6">Confirm updates for <b>{selectedUser?.firstName} {selectedUser?.lastName}</b>?</p>
              <div className="flex justify-end gap-3">
                 <button onClick={() => setShowConfirmAlloc(false)} className="px-4 py-2 text-slate-500 rounded text-sm">Cancel</button>
                 <button onClick={finalizeAllocation} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-bold shadow-sm">Save Changes</button>
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
       {activeTab === 'departments' && <div className="space-y-4"><div className="flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Building2 className="text-emerald-600" /> Departments</h3>{isHR && <button onClick={() => { setDeptForm({ name: '', description: '', managerId: '' }); setShowDeptModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2"><Plus size={16} /> Add Dept</button>}</div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{departments.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage).map(dept => (<div key={dept.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition cursor-pointer" onClick={() => { setDeptForm(dept); setShowDeptModal(true); }}><div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4"><Building2 size={20} /></div><h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{dept.name}</h4><p className="text-sm text-slate-500 h-10 line-clamp-2">{dept.description}</p></div>))}</div><PaginationControls total={departments.length} /></div>}
       {activeTab === 'allocations' && <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs uppercase tracking-wider border-b"><tr><th className="px-6 py-4">Employee</th><th className="px-6 py-4">Department</th><th className="px-6 py-4">Projects</th><th className="px-6 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{users.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage).map(user => { const userDept = departments.find(d => d.id === user.departmentId); const userProjects = projects.filter(p => user.projectIds?.includes(p.id)); return (<tr key={user.id} className="hover:bg-slate-50 transition-colors"><td className="px-6 py-4"><div className="flex items-center gap-3"><img src={user.avatar} className="w-8 h-8 rounded-full" /><div><p className="text-sm font-bold text-slate-800 dark:text-white">{user.firstName} {user.lastName}</p><p className="text-xs text-slate-500">{user.role}</p></div></div></td><td className="px-6 py-4"><span className="text-sm text-slate-700 dark:text-slate-300">{userDept?.name || '-'}</span></td><td className="px-6 py-4"><div className="flex flex-wrap gap-1">{userProjects.map(p => (<span key={p.id} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">{p.name}</span>))}</div></td><td className="px-6 py-4 text-right">{isHR && <button onClick={() => { setSelectedUser(user); setAllocForm({ departmentId: user.departmentId || '', projectIds: user.projectIds || [] }); setShowAllocModal(true); }} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">Edit Alloc</button>}</td></tr>); })}</tbody></table></div><PaginationControls total={users.length} /></div>}
    </div>
  );
};

export default Organization;
