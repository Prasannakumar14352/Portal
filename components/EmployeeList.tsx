
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, Mail, Filter, ChevronLeft, ChevronRight, Copy, Check, Key, Eye, EyeOff, MapPin, Building2, User as UserIcon, Phone, Briefcase, AlertTriangle, Hash } from 'lucide-react';
import { Employee, DepartmentType, EmployeeStatus, UserRole } from '../types';
import { useAppContext } from '../contexts/AppContext';
import DraggableModal from './DraggableModal';

interface EmployeeListProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string | number) => void;
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

const WORK_LOCATIONS = [
  'Office HQ India',
  'WFH India',
  'UAE Office',
  'UAE Client Location',
  'USA'
];

// Optimized Location Map Component
const LocationMap: React.FC<{ 
  location: { latitude: number; longitude: number; address: string } | undefined, 
  onChange?: (loc: { latitude: number; longitude: number; address: string }) => void, 
  readOnly?: boolean 
}> = ({ location, onChange, readOnly = true }) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const graphicsLayerRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // 1. Initialize Map (Run Once)
  useEffect(() => {
    if (!mapDiv.current) return;
    
    // Prevent re-initialization if view exists
    if (viewRef.current) return;

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
          "esri/widgets/BasemapGallery",
          "esri/widgets/Expand"
        ], (EsriMap: any, MapView: any, Graphic: any, GraphicsLayer: any, BasemapGallery: any, Expand: any) => {
          
          if (cleanup) return;

          const map = new EsriMap({ basemap: "topo-vector" });
          const layer = new GraphicsLayer();
          map.add(layer);
          graphicsLayerRef.current = layer;

          // Default Center
          const center = location && location.longitude ? [location.longitude, location.latitude] : [-118.2437, 34.0522];
          const zoom = location && location.longitude ? 12 : 3;

          const view = new MapView({
            container: mapDiv.current,
            map: map,
            center: center,
            zoom: zoom,
            ui: { components: ["zoom"] }
          });

          const basemapGallery = new BasemapGallery({ view: view });
          const bgExpand = new Expand({ view: view, content: basemapGallery, expandIconClass: "esri-icon-basemap" });
          view.ui.add(bgExpand, "top-right");

          viewRef.current = view;

          view.when(() => { if (!cleanup) setIsMapLoaded(true); });
        });
      } catch (e) { console.error("Map Error", e); }
    };

    initMap();
    return () => { 
        cleanup = true; 
        if (viewRef.current) { viewRef.current.destroy(); viewRef.current = null; }
    };
  }, []); 

  // 2. Update Graphic when location prop changes
  useEffect(() => {
      if (!isMapLoaded || !viewRef.current || !graphicsLayerRef.current) return;
      
      const layer = graphicsLayerRef.current;
      const view = viewRef.current;
      
      layer.removeAll();

      if (location && location.longitude && location.latitude) {
          window.require(["esri/Graphic"], (Graphic: any) => {
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
             // Smoothly pan to new location
             view.goTo({ target: point }, { duration: 600 });
          });
      }
  }, [location, isMapLoaded]);

  // 3. Handle Clicks
  useEffect(() => {
      if (!isMapLoaded || !viewRef.current || readOnly) return;

      const handleMapClick = (event: any) => {
          if (!onChange) return;
          
          const lat = event.mapPoint.latitude;
          const lng = event.mapPoint.longitude;
          
          window.require(["esri/rest/locator"], (locator: any) => {
              const serviceUrl = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
              locator.locationToAddress(serviceUrl, { location: event.mapPoint })
                .then((res: any) => { 
                    onChange({ latitude: lat, longitude: lng, address: res.address || "Pinned Location" }); 
                })
                .catch(() => { 
                    onChange({ latitude: lat, longitude: lng, address: "Pinned Location" }); 
                });
          });
      };

      const handle = viewRef.current.on("click", handleMapClick);
      return () => handle.remove();
  }, [isMapLoaded, readOnly, onChange]);

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
  const { currentUser, showToast, roles, departments } = useAppContext();
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); 
  const [deleteTargetId, setDeleteTargetId] = useState<string | number | null>(null);

  const [generatedCreds, setGeneratedCreds] = useState<{email: string, password: string} | null>(null);
  const [copied, setCopied] = useState(false);

  // Super Admin / HR Password Visibility
  const [showPasswords, setShowPasswords] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  const isHR = currentUser?.role === UserRole.HR;
  /* Standardized comparison for superadmin check by casting ID to string */
  const isSuperAdmin = String(currentUser?.id) === 'super1' || currentUser?.email === 'superadmin@empower.com';
  
  const canViewPasswords = isSuperAdmin || isHR;

  // Form State
  const [formData, setFormData] = useState<Partial<Employee>>({
    firstName: '', lastName: '', email: '', role: '', department: '', employeeId: '',
    status: EmployeeStatus.ACTIVE, salary: 0, phone: '', location: { latitude: 0, longitude: 0, address: '' }, workLocation: ''
  });

  const getPhoneParts = (fullPhone: string | undefined) => {
    if (!fullPhone) return { code: '+91', number: '' };
    // Fixed typo: removed space in 'sortedCodes'
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
      emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      // Robust nextId calculation that handles potential non-numeric string IDs
      const numericIds = employees.map(emp => Number(emp.id)).filter(id => !isNaN(id));
      const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1001;
      
      const newPassword = generatePassword();
      const newEmployee: Employee = {
        id: nextId,
        employeeId: formData.employeeId || `EMP${nextId}`,
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
      firstName: '', lastName: '', email: '', employeeId: '',
      role: roles.length > 0 ? roles[0].name : '', 
      department: departments.length > 0 ? departments[0].name : '',
      status: EmployeeStatus.ACTIVE, salary: 0, phone: '', location: undefined,
      workLocation: WORK_LOCATIONS[0]
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

  const openDeleteConfirm = (id: string | number) => {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (deleteTargetId !== null) {
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
        {/* Filters and Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by ID, name, or role..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-sm bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 text-slate-900 placeholder-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Filter size={16} />
                    <span className="text-sm font-medium hidden sm:inline">Filters:</span>
                </div>
                <select 
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none hover:border-teal-400 transition-colors cursor-pointer shadow-sm w-full sm:w-auto"
                >
                  <option value="All">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none hover:border-teal-400 transition-colors cursor-pointer shadow-sm w-full sm:w-auto"
                >
                  <option value="All">All Status</option>
                  {Object.values(EmployeeStatus).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">ID</th>
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
                  <td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                    {emp.employeeId || emp.id}
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
                      <button onClick={() => openViewModal(emp)} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1">
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
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No employees found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
           <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
             <span>Show</span>
             <select 
               value={itemsPerPage}
               onChange={(e) => setItemsPerPage(Number(e.target.value))}
               className="border border-slate-300 dark:border-slate-600 rounded p-1 bg-white dark:bg-slate-800"
             >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
             </select>
             <span>per page</span>
           </div>
           <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50 hover:bg-white dark:hover:bg-slate-700"><ChevronLeft size={16} /></button>
              <span className="text-xs font-medium px-2">Page {currentPage} of {totalPages || 1}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50 hover:bg-white dark:hover:bg-slate-700"><ChevronRight size={16} /></button>
           </div>
        </div>
      </div>

      {/* VIEW MODAL */}
      <DraggableModal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Employee Details" width="max-w-2xl">
        {viewingEmployee && (
          <div className="px-2 pb-4">
             <div className="relative flex items-center gap-4 mb-6">
                <img src={viewingEmployee.avatar} alt="" className="w-24 h-24 rounded-full border-4 border-slate-100 dark:border-slate-700 shadow-sm object-cover" />
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{viewingEmployee.firstName} {viewingEmployee.lastName}</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">{viewingEmployee.role} • {viewingEmployee.department}</p>
                  <p className="text-xs font-bold text-emerald-600 mt-1 uppercase tracking-widest">ID: {viewingEmployee.employeeId || viewingEmployee.id}</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Contact Info</h4>
                   <div className="flex items-center gap-3 text-sm"><Mail size={16} className="text-slate-400"/> {viewingEmployee.email}</div>
                   <div className="flex items-center gap-3 text-sm"><Phone size={16} className="text-slate-400"/> {viewingEmployee.phone || 'N/A'}</div>
                </div>
                <div className="space-y-4">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Home Location</h4>
                   <div className="h-40 rounded-lg overflow-hidden border">
                      <LocationMap location={viewingEmployee.location} readOnly={true} />
                   </div>
                   <p className="text-xs text-slate-500 flex items-start gap-1"><MapPin size={12} className="mt-0.5 shrink-0"/> {viewingEmployee.location?.address || 'No address set'}</p>
                </div>
             </div>
          </div>
        )}
      </DraggableModal>

      {/* CREATE/EDIT MODAL */}
      <DraggableModal isOpen={showModal} onClose={closeModal} title={editingEmployee ? 'Edit Employee' : 'Add New Employee'} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">First Name</label>
              <input required type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:text-white outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name</label>
              <input required type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:text-white outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Employee ID</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input required type="text" placeholder="e.g. EMP001" value={formData.employeeId} onChange={(e) => setFormData({...formData, employeeId: e.target.value})} className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-slate-700 dark:text-white outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-slate-700 dark:text-white outline-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
              <select required value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:text-white outline-none">
                 <option value="" disabled>Select Role</option>
                 {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
              <select required value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:text-white outline-none">
                <option value="" disabled>Select Department</option>
                {departments.map(dept => <option key={dept.id} value={dept.name}>{dept.name}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-slate-700 dark:text-slate-300">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">Save</button>
          </div>
        </form>
      </DraggableModal>

      {/* Delete Confirmation */}
      <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Deletion" width="max-w-sm">
        <div className="text-center">
          <AlertTriangle size={32} className="text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">Delete Employee?</h3>
          <p className="text-slate-500 text-sm mb-6">Are you sure? This action cannot be undone and will remove all linked data.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
            <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button>
          </div>
        </div>
      </DraggableModal>
    </div>
  );
};

export default EmployeeList;
