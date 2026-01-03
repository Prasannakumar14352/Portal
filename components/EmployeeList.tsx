import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, Edit2, Eye, Mail, RefreshCw, Copy, CheckCircle, Clock, XCircle, Cloud, Hash, Calendar, Phone, MapPin, Briefcase, UserCheck, UserSquare, ChevronDown, ChevronLeft, ChevronRight, Loader2, Shield, LocateFixed, UserPlus } from 'lucide-react';
import { Employee, EmployeeStatus, UserRole, Invitation } from '../types';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';
import { loadModules } from 'esri-loader';

interface EmployeeListProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee, syncToAzure?: boolean) => void;
  onUpdateEmployee: (emp: Employee) => Promise<void> | void;
  onDeleteEmployee: (id: string | number) => void;
}

const SYSTEM_ROLES = [
    UserRole.HR,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
    UserRole.ADMIN
];

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, onUpdateEmployee }) => {
  const { currentUser, showToast, positions, syncAzureUsers, invitations, inviteEmployee, acceptInvitation, revokeInvitation } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  
  const [provisionInAzure, setProvisionInAzure] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  const [formData, setFormData] = useState<any>({
    firstName: '', lastName: '', email: '', role: UserRole.EMPLOYEE,
    salary: 0, position: '', provisionInAzure: false, managerId: '',
    location: { latitude: 20.5937, longitude: 78.9629, address: '' }
  });

  const mapDivRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);

  // Strict check for HR or Admin roles
  const isPowerUser = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;

  useEffect(() => {
    if (!showModal || !mapDivRef.current) return;

    loadModules([
      "esri/Map",
      "esri/views/MapView",
      "esri/Graphic",
      "esri/layers/GraphicsLayer"
    ], { css: true }).then(([EsriMap, MapView, Graphic, GraphicsLayer]) => {
        if (!mapDivRef.current) return;

        const map = new EsriMap({ basemap: "streets-vector" });
        const view = new MapView({
          container: mapDivRef.current,
          map: map,
          zoom: 4,
          center: [formData.location?.longitude || 78, formData.location?.latitude || 20],
          ui: { components: ["zoom"] }
        });

        const graphicsLayer = new GraphicsLayer();
        map.add(graphicsLayer);
        viewRef.current = view;

        const updateMarker = (lon: number, lat: number) => {
            graphicsLayer.removeAll();
            const point = { type: "point", longitude: lon, latitude: lat };
            const symbol = {
                type: "simple-marker",
                style: "circle",
                color: [13, 148, 136], // Teal
                size: "14px",
                outline: { color: [255, 255, 255], width: 2 }
            };
            const graphic = new Graphic({ geometry: point, symbol: symbol });
            graphicsLayer.add(graphic);
        };

        if (formData.location?.latitude) {
            updateMarker(formData.location.longitude, formData.location.latitude);
        }

        view.on("click", (event: any) => {
            const { longitude, latitude } = event.mapPoint;
            updateMarker(longitude, latitude);
            setFormData((prev: any) => ({
                ...prev,
                location: { ...prev.location, latitude, longitude }
            }));
        });
    }).catch(err => {
      console.error("ArcGIS module load failed in modal:", err);
    });

    return () => {
        if (viewRef.current) {
            viewRef.current.destroy();
            viewRef.current = null;
        }
    };
  }, [showModal, !!editingEmployee]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const term = searchTerm.toLowerCase();
      return emp.firstName.toLowerCase().includes(term) ||
             emp.lastName.toLowerCase().includes(term) ||
             emp.email.toLowerCase().includes(term) ||
             String(emp.employeeId).toLowerCase().includes(term) ||
             (emp.position || '').toLowerCase().includes(term) ||
             (emp.role || '').toLowerCase().includes(term);
    });
  }, [employees, searchTerm]);

  const paginatedItems = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  const handleAddNew = () => {
    setEditingEmployee(null);
    setFormData({
      firstName: '', lastName: '', email: '', role: UserRole.EMPLOYEE,
      salary: 0, position: '', provisionInAzure: false, managerId: '',
      location: { latitude: 20.5937, longitude: 78.9629, address: '' }
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        if (editingEmployee) {
          await onUpdateEmployee({ ...editingEmployee, ...formData });
          setShowModal(false);
        } else {
          await inviteEmployee({ ...formData, provisionInAzure: provisionInAzure });
          setShowModal(false);
        }
    } catch (err) {
        showToast("Operation failed.", "error");
    } finally {
        setIsSaving(false);
    }
  };

  const openViewModal = (emp: Employee) => {
    setViewingEmployee(emp);
    setShowViewModal(true);
  };

  const DetailRow = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) => (
    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-teal-600 dark:text-teal-400">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{value || 'N/A'}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Directory Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">View employees and manage organizational access.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            {isPowerUser && (
                <>
                  <button 
                    onClick={handleAddNew}
                    className="flex items-center space-x-2 bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-teal-500/20 text-sm font-bold hover:bg-teal-700 transition"
                  >
                      <Plus size={18} />
                      <span>Add Employee</span>
                  </button>
                  <button 
                    onClick={async () => { setIsSyncing(true); await syncAzureUsers(); setIsSyncing(false); }} 
                    disabled={isSyncing} 
                    className="flex items-center space-x-2 bg-white border border-slate-300 dark:bg-slate-700 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg shadow-sm text-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition disabled:opacity-50"
                  >
                      <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                      <span>Sync FROM Azure</span>
                  </button>
                </>
            )}
        </div>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-700">
          <div className="px-6 py-3 text-sm font-black uppercase tracking-widest text-teal-600 relative">
            Active Directory ({employees.length})
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600"></div>
          </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Search team members..." className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Position</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedItems.map((emp: any) => (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.firstName + ' ' + emp.lastName)}&background=0D9488&color=fff`} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm" />
                      <div>
                        <div className="font-bold text-slate-800 dark:text-white text-sm">{emp.firstName} {emp.lastName}</div>
                        <div className="text-[11px] text-slate-400 font-medium">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-slate-500">{emp.employeeId}</td>
                  <td className="px-6 py-4 text-xs text-slate-900 dark:text-slate-200 font-bold">{emp.position || 'Consultant'}</td>
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <Shield size={12} className="text-blue-500" /> {emp.role}
                     </div>
                  </td>
                  <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${emp.status === EmployeeStatus.ACTIVE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{emp.status}</span></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                          <button onClick={() => openViewModal(emp)} className="text-slate-400 hover:text-blue-600 p-2" title="View Profile"><Eye size={16} /></button>
                          {isPowerUser && (
                            <button onClick={() => { setEditingEmployee(emp); setFormData({ ...emp, managerId: emp.managerId || '' }); setShowModal(true); }} className="text-slate-400 hover:text-teal-600 p-2" title="Edit Employee"><Edit2 size={16} /></button>
                          )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm italic">
                    No records found in this directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center px-2">
          <p className="text-xs text-slate-400 font-medium">Page {currentPage} of {totalPages}</p>
          <div className="flex gap-1">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition"><ChevronLeft size={16}/></button>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition"><ChevronRight size={16}/></button>
          </div>
        </div>
      )}

      <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title={editingEmployee ? 'Edit & Sync Employee' : 'Add New Employee'} width="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">First Name</label><input required type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm dark:text-white outline-none focus:ring-2 focus:ring-teal-500" /></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Last Name</label><input required type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm dark:text-white outline-none focus:ring-2 focus:ring-teal-500" /></div>
          </div>

          <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Email ID</label><input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm dark:text-white outline-none focus:ring-2 focus:ring-teal-500" /></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Position</label>
              <select required value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-teal-500 text-sm dark:text-white">
                 <option value="" disabled>Select Position...</option>
                 {positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">System Role</label>
              <select required value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:text-white">
                 {SYSTEM_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
          </div>

          {!editingEmployee && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
               <input 
                 type="checkbox" 
                 id="provisionInAzure" 
                 checked={provisionInAzure} 
                 onChange={e => setProvisionInAzure(e.target.checked)}
                 className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
               />
               <label htmlFor="provisionInAzure" className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-tight">Provision in Azure AD (Microsoft 365)</label>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Location Adjustment</label>
                <div className="flex items-center gap-2 text-[10px] text-teal-600 font-bold">
                    <LocateFixed size={12}/> Click map to update coordinates
                </div>
            </div>
            <div ref={mapDivRef} className="h-60 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner bg-slate-50"></div>
            <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Lat: <span className="text-slate-800 dark:text-slate-200">{formData.location?.latitude?.toFixed(4) || 'N/A'}</span></div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight text-right">Lon: <span className="text-slate-800 dark:text-slate-200">{formData.location?.longitude?.toFixed(4) || 'N/A'}</span></div>
            </div>
          </div>

          <div className="pt-6 flex justify-end space-x-3 border-t dark:border-slate-700">
            <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-xs font-black text-slate-400 uppercase tracking-widest">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-8 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-bold text-xs shadow-lg uppercase tracking-widest flex items-center gap-2">
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : editingEmployee ? 'Update Records' : 'Create Record'}
            </button>
          </div>
        </form>
      </DraggableModal>

      <DraggableModal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Employee Profile" width="max-w-xl">
        {viewingEmployee && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
               <img src={viewingEmployee.avatar} className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 shadow-xl mb-4 object-cover" alt="" />
               <h3 className="text-xl font-black text-slate-800 dark:text-white">{viewingEmployee.firstName} {viewingEmployee.lastName}</h3>
               <p className="text-teal-600 dark:text-teal-400 font-bold uppercase tracking-widest text-xs mt-1">{viewingEmployee.position || 'Consultant'}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailRow icon={Hash} label="Employee ID" value={viewingEmployee.employeeId} />
                <DetailRow icon={Mail} label="Email Address" value={viewingEmployee.email} />
                <DetailRow icon={Phone} label="Contact Number" value={viewingEmployee.phone || 'Not Provided'} />
                <DetailRow icon={Calendar} label="Join Date" value={viewingEmployee.joinDate} />
            </div>
            <div className="pt-6 border-t dark:border-slate-700 flex justify-end">
               <button onClick={() => setShowViewModal(false)} className="px-8 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest">Close Profile</button>
            </div>
          </div>
        )}
      </DraggableModal>
    </div>
  );
};

export default EmployeeList;