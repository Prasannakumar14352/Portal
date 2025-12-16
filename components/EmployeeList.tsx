
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, Mail, Filter, ChevronLeft, ChevronRight, Copy, Check, Key, Eye, EyeOff, MapPin, Building2, User as UserIcon, Phone, Briefcase, AlertTriangle } from 'lucide-react';
import { Employee, DepartmentType, EmployeeStatus, UserRole } from '../types';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';

interface EmployeeListProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}

const COUNTRY_CODES = [
  { code: '+91', country: 'IN' },
  { code: '+1', country: 'US' },
  { code: '+44', country: 'UK' },
  { code: '+971', country: 'UAE' },
  { code: '+61', country: 'AU' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+81', country: 'JP' },
  { code: '+86', country: 'CN' },
  { code: '+65', country: 'SG' },
];

// Inline Map Component for Employee Modals (unchanged)
const LocationMap: React.FC<{ 
  location: { latitude: number; longitude: number; address: string } | undefined, 
  onChange?: (loc: { latitude: number; longitude: number; address: string }) => void, 
  readOnly?: boolean 
}> = ({ location, onChange, readOnly = true }) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapDiv.current) return;

    let view: any = null;
    let cleanup = false;

    const loadArcGIS = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.require) {
          resolve();
          return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://js.arcgis.com/4.29/esri/themes/light/main.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://js.arcgis.com/4.29/';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = (e) => reject(e);
        document.body.appendChild(script);
      });
    };

    const initMap = async () => {
      try {
        await loadArcGIS();
        if (cleanup) return;

        window.require([
          "esri/Map",
          "esri/views/MapView",
          "esri/Graphic",
          "esri/layers/GraphicsLayer",
          "esri/rest/locator",
          "esri/widgets/BasemapGallery",
          "esri/widgets/Expand"
        ], (EsriMap: any, MapView: any, Graphic: any, GraphicsLayer: any, locator: any, BasemapGallery: any, Expand: any) => {
          
          if (cleanup) return;

          const map = new EsriMap({ basemap: "topo-vector" });
          const layer = new GraphicsLayer();
          map.add(layer);

          const center = location && location.longitude ? [location.longitude, location.latitude] : [-118.2437, 34.0522];
          const zoom = location && location.longitude ? 13 : 3;

          if (location && location.longitude) {
             const point = {
                type: "point",
                longitude: location.longitude,
                latitude: location.latitude
             };
             const markerSymbol = {
                type: "simple-marker",
                color: [5, 150, 105],
                size: "14px",
                outline: { color: [255, 255, 255], width: 2 }
             };
             layer.add(new Graphic({ geometry: point, symbol: markerSymbol }));
          }

          view = new MapView({
            container: mapDiv.current,
            map: map,
            center: center,
            zoom: zoom,
            ui: { components: ["zoom"] }
          });

          const basemapGallery = new BasemapGallery({ view: view });
          const bgExpand = new Expand({ view: view, content: basemapGallery, expandIconClass: "esri-icon-basemap" });
          view.ui.add(bgExpand, "top-right");

          if (!readOnly && onChange) {
             view.on("click", (event: any) => {
                const lat = event.mapPoint.latitude;
                const lng = event.mapPoint.longitude;
                layer.removeAll();
                const point = { type: "point", longitude: lng, latitude: lat };
                const markerSymbol = { type: "simple-marker", color: [220, 38, 38], size: "14px", outline: { color: [255, 255, 255], width: 2 } };
                layer.add(new Graphic({ geometry: point, symbol: markerSymbol }));

                const serviceUrl = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
                locator.locationToAddress(serviceUrl, { location: event.mapPoint })
                  .then((res: any) => { onChange({ latitude: lat, longitude: lng, address: res.address || "Pinned Location" }); })
                  .catch(() => { onChange({ latitude: lat, longitude: lng, address: "Pinned Location" }); });
             });
          }

          view.when(() => { if (!cleanup) setIsMapLoaded(true); });
        });
      } catch (e) { console.error("Map Error", e); }
    };

    initMap();
    return () => { cleanup = true; if (view) { view.destroy(); view = null; } };
  }, [location?.latitude, location?.longitude, readOnly]);

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
        <div ref={mapDiv} className="w-full h-full"></div>
        {!isMapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 z-10">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )}
    </div>
  );
};

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
  const { currentUser, showToast, roles } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // Delete popup state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [generatedCreds, setGeneratedCreds] = useState<{email: string, password: string} | null>(null);
  const [copied, setCopied] = useState(false);

  // Super Admin / HR Password Visibility
  const [showPasswords, setShowPasswords] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  const isHR = currentUser?.role === UserRole.HR;
  const isSuperAdmin = currentUser?.id === 'super1' || currentUser?.email === 'superadmin@empower.com';
  
  const canViewPasswords = isSuperAdmin || isHR;

  // Form State
  const [formData, setFormData] = useState<Partial<Employee>>({
    firstName: '', lastName: '', email: '', role: '', department: DepartmentType.IT,
    status: EmployeeStatus.ACTIVE, salary: 0, phone: '', location: { latitude: 0, longitude: 0, address: '' }
  });

  const getPhoneParts = (fullPhone: string | undefined) => {
    if (!fullPhone) return { code: '+91', number: '' };
    const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
    const matched = sortedCodes.find(c => fullPhone.startsWith(c.code));
    if (matched) return { code: matched.code, number: fullPhone.slice(matched.code.length).trim() };
    return { code: '+91', number: fullPhone };
  };

  const handlePhoneChange = (code: string, number: string) => {
      setFormData(prev => ({ ...prev, phone: `${code} ${number}`.trim() }));
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'All' || emp.department === filterDept;
    const matchesStatus = filterStatus === 'All' || emp.status === filterStatus;
    return matchesSearch && matchesDept && matchesStatus;
  });

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterDept, filterStatus, itemsPerPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const generatePassword = () => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
      let password = "";
      for (let i = 0; i < 10; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
      return password;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      const updatedData = { ...editingEmployee, ...formData } as Employee;
      onUpdateEmployee(updatedData);
      closeModal();
    } else {
      const newPassword = generatePassword();
      const newEmployee: Employee = {
        id: Math.random().toString(36).substr(2, 9),
        joinDate: new Date().toISOString().split('T')[0],
        avatar: `https://picsum.photos/seed/${Math.random()}/100`,
        password: newPassword, 
        ...formData
      } as Employee;
      onAddEmployee(newEmployee);
      setGeneratedCreds({ email: newEmployee.email, password: newPassword });
      setShowModal(false);
      setShowSuccessModal(true);
    }
  };

  const copyToClipboard = () => {
      if (generatedCreds) {
          const text = `Email: ${generatedCreds.email}\nPassword: ${generatedCreds.password}`;
          navigator.clipboard.writeText(text);
          setCopied(true);
          showToast("Credentials copied to clipboard", "success");
          setTimeout(() => setCopied(false), 2000);
      }
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      firstName: '', lastName: '', email: '', role: '', department: DepartmentType.IT,
      status: EmployeeStatus.ACTIVE, salary: 0, phone: '', location: undefined
    });
    setShowModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData(emp);
    setShowModal(true);
  };

  const openViewModal = (emp: Employee) => {
    setViewingEmployee(emp);
    setShowViewModal(true);
  };

  const openDeleteConfirm = (id: string) => {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      onDeleteEmployee(deleteTargetId);
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Employee Directory</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage your team members and their account details.</p>
        </div>
        <div className="flex gap-2">
            {canViewPasswords && (
                <button 
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                    {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                    <span>{showPasswords ? 'Hide Passwords' : 'Show Passwords'}</span>
                </button>
            )}
            {isHR && (
            <button 
                onClick={openAddModal}
                className="flex items-center space-x-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
                <Plus size={18} />
                <span>Add Employee</span>
            </button>
            )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Filters ... */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mr-2">
                  <Filter size={16} />
                  <span className="text-sm font-medium">Filters:</span>
              </div>
              <select 
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none hover:border-teal-400 transition-colors cursor-pointer shadow-sm w-full sm:w-auto"
              >
                <option className="bg-white dark:bg-slate-800" value="All">All Departments</option>
                {Object.values(DepartmentType).map(dept => (
                  <option className="bg-white dark:bg-slate-800" key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none hover:border-teal-400 transition-colors cursor-pointer shadow-sm w-full sm:w-auto"
              >
                <option className="bg-white dark:bg-slate-800" value="All">All Status</option>
                {Object.values(EmployeeStatus).map(status => (
                  <option className="bg-white dark:bg-slate-800" key={status} value={status}>{status}</option>
                ))}
              </select>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search employees by name, email or role..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-sm bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 text-slate-900 placeholder-slate-400"
              />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap self-end md:self-auto">
               Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredEmployees.length}</span> employees
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Role & Dept</th>
                {canViewPasswords && showPasswords && <th className="px-6 py-4 text-red-600 dark:text-red-400">Password</th>}
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Join Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img src={emp.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-600" />
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">{emp.firstName} {emp.lastName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-900 dark:text-slate-200 font-medium">{emp.role}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{emp.department}</div>
                  </td>
                  {canViewPasswords && showPasswords && (
                      <td className="px-6 py-4 text-sm font-mono text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/20">
                          {emp.password}
                      </td>
                  )}
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center space-x-1
                      ${emp.status === EmployeeStatus.ACTIVE ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 
                        emp.status === EmployeeStatus.INACTIVE ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full 
                        ${emp.status === EmployeeStatus.ACTIVE ? 'bg-emerald-500' : 
                          emp.status === EmployeeStatus.INACTIVE ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      <span>{emp.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {emp.joinDate}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button onClick={() => openViewModal(emp)} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1" title="View Details">
                        <Eye size={16} />
                      </button>
                      {isHR && (
                        <>
                          <button onClick={() => openEditModal(emp)} className="text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 p-1">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => openDeleteConfirm(emp.id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedEmployees.length === 0 && (
                <tr>
                  <td colSpan={isHR ? (canViewPasswords && showPasswords ? 6 : 5) : 4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No employees found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
        <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
           <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
             <span>Show</span>
             <select 
               value={itemsPerPage}
               onChange={(e) => setItemsPerPage(Number(e.target.value))}
               className="border border-slate-300 dark:border-slate-600 rounded p-1 outline-none bg-white dark:bg-slate-800 focus:ring-2 focus:ring-teal-500"
             >
                <option className="bg-white dark:bg-slate-800" value={5}>5</option>
                <option className="bg-white dark:bg-slate-800" value={10}>10</option>
                <option className="bg-white dark:bg-slate-800" value={20}>20</option>
                <option className="bg-white dark:bg-slate-800" value={50}>50</option>
             </select>
             <span>per page</span>
             <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
             <span>
               Showing <span className="font-medium text-slate-700 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-slate-700 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, filteredEmployees.length)}</span> of <span className="font-medium text-slate-700 dark:text-slate-200">{filteredEmployees.length}</span> results
             </span>
           </div>
           <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm"><ChevronLeft size={16} /></button>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 px-2">Page {currentPage} of {totalPages || 1}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm"><ChevronRight size={16} /></button>
           </div>
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      <DraggableModal 
        isOpen={showViewModal} 
        onClose={() => setShowViewModal(false)} 
        title="Employee Details" 
        width="max-w-2xl"
      >
        {viewingEmployee && (
          <div className="px-2 pb-4">
             <div className="relative flex items-center gap-4 mb-6">
                <img src={viewingEmployee.avatar} alt="" className="w-24 h-24 rounded-full border-4 border-slate-100 dark:border-slate-700 shadow-sm object-cover" />
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{viewingEmployee.firstName} {viewingEmployee.lastName}</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">{viewingEmployee.role} • {viewingEmployee.department}</p>
                  <span className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${viewingEmployee.status === 'Active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>{viewingEmployee.status}</span>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="space-y-4">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 pb-2">Contact Info</h4>
                   <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300"><Mail size={16} className="text-slate-400"/> {viewingEmployee.email}</div>
                   <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300"><Phone size={16} className="text-slate-400"/> {viewingEmployee.phone || 'N/A'}</div>
                   <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300"><Building2 size={16} className="text-slate-400"/> HQ Office</div>
                </div>
                <div className="space-y-4">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 pb-2">Location</h4>
                   <div className="h-40 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 relative">
                      <LocationMap location={viewingEmployee.location} readOnly={true} />
                   </div>
                   <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1"><MapPin size={12} className="mt-0.5 shrink-0"/> {viewingEmployee.location?.address || 'No address set'}</p>
                </div>
             </div>
          </div>
        )}
      </DraggableModal>

      {/* CREATE/EDIT MODAL */}
      <DraggableModal 
        isOpen={showModal} 
        onClose={closeModal} 
        title={editingEmployee ? 'Edit Employee' : 'Add New Employee'} 
        width="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">First Name</label>
              <input required type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name</label>
              <input required type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
            </div>
            {!editingEmployee && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">A secure password will be generated automatically.</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role/Title</label>
              {isSuperAdmin ? (
                   <select 
                      value={formData.role} 
                      onChange={(e) => setFormData({...formData, role: e.target.value})} 
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                   >
                     {roles.length > 0 ? (
                        roles.map(r => (
                            <option className="bg-white dark:bg-slate-800" key={r.id} value={r.name}>{r.name}</option>
                        ))
                     ) : (
                        <>
                            <option className="bg-white dark:bg-slate-800" value="Employee">Employee</option>
                            <option className="bg-white dark:bg-slate-800" value="Team Manager">Team Manager</option>
                            <option className="bg-white dark:bg-slate-800" value="HR Manager">HR Manager</option>
                            <option className="bg-white dark:bg-slate-800" value="Software Engineer">Software Engineer</option>
                        </>
                     )}
                   </select>
              ) : (
                  <input required type="text" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" placeholder="e.g. Software Engineer" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
              <select value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                {Object.values(DepartmentType).map(dept => (<option className="bg-white dark:bg-slate-800" key={dept} value={dept}>{dept}</option>))}
              </select>
            </div>
          </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
               <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as EmployeeStatus})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                {Object.values(EmployeeStatus).map(status => (<option className="bg-white dark:bg-slate-800" key={status} value={status}>{status}</option>))}
              </select>
            </div>
            <div>
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
               <div className="flex">
                   <select 
                      className="px-2 py-2 border border-r-0 border-slate-300 dark:border-slate-600 rounded-l-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500 outline-none min-w-[80px]"
                      value={getPhoneParts(formData.phone).code}
                      onChange={(e) => handlePhoneChange(e.target.value, getPhoneParts(formData.phone).number)}
                   >
                      {COUNTRY_CODES.map(c => (
                          <option className="bg-white dark:bg-slate-800" key={c.code} value={c.code}>{c.code} {c.country}</option>
                      ))}
                   </select>
                   <input 
                      type="text" 
                      value={getPhoneParts(formData.phone).number} 
                      onChange={(e) => handlePhoneChange(getPhoneParts(formData.phone).code, e.target.value)} 
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-r-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
                      placeholder="98765 43210" 
                   />
               </div>
            </div>
           </div>

           <div className="pt-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Work Location (Click map to update)</label>
              <div className="h-48 w-full border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden relative">
                 <LocationMap 
                   location={formData.location} 
                   readOnly={!isHR} 
                   onChange={(loc) => setFormData({...formData, location: loc})}
                 />
              </div>
              <div className="mt-1 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                 <span>{formData.location?.address || 'No location set'}</span>
                 {isHR && <span className="text-emerald-600 dark:text-emerald-400 font-medium">Editable by HR</span>}
              </div>
           </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors">{editingEmployee ? 'Save Changes' : 'Create Employee'}</button>
          </div>
        </form>
      </DraggableModal>

      {/* Delete Confirmation Modal */}
      <DraggableModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Confirm Deletion"
        width="max-w-sm"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Delete Employee?</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Are you sure you want to delete this employee? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
            >
              Cancel
            </button>
            <button 
              onClick={confirmDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm"
            >
              Delete
            </button>
          </div>
        </div>
      </DraggableModal>

      {/* Generated Credentials Modal */}
      <DraggableModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Employee Created"
        width="max-w-md"
      >
        {generatedCreds && (
          <div>
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-400 to-teal-700 rounded-t-lg"></div>
            <div className="flex flex-col items-center text-center mb-6">
               <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mb-4"><Key size={32} className="text-teal-700 dark:text-teal-400" /></div>
               <p className="text-slate-500 dark:text-slate-400 mt-2">A unique password has been generated.</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-6 border border-slate-200 dark:border-slate-600 mb-6 relative">
               <div className="mb-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Username / Email</p>
                  <p className="font-mono text-slate-800 dark:text-white font-medium select-all">{generatedCreds.email}</p>
               </div>
               <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">One-Time Password</p>
                  <p className="font-mono text-xl text-slate-800 dark:text-white font-bold select-all tracking-wide">{generatedCreds.password}</p>
               </div>
            </div>
            <div className="flex flex-col gap-3">
               <button onClick={copyToClipboard} className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-md">
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy Credentials'}</span>
               </button>
               <button onClick={() => setShowSuccessModal(false)} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 py-3 rounded-lg font-medium transition-colors">Close</button>
            </div>
          </div>
        )}
      </DraggableModal>
    </div>
  );
};

export default EmployeeList;
