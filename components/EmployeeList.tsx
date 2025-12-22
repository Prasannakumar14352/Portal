
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Mail, Filter, ChevronLeft, ChevronRight, Copy, Check, Key, Eye, EyeOff, MapPin, Building2, User as UserIcon, Phone, Briefcase, AlertTriangle, Hash, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
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

type SortKey = 'name' | 'joinDate' | 'status' | 'id';

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
  const { currentUser, showToast, roles, departments } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

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
  const isSuperAdmin = String(currentUser?.id) === 'super1' || currentUser?.email === 'superadmin@empower.com';
  
  const canViewPasswords = isSuperAdmin || isHR;

  // Form State
  const [formData, setFormData] = useState<Partial<Employee>>({
    firstName: '', lastName: '', email: '', role: '', department: '', employeeId: '',
    status: EmployeeStatus.ACTIVE, salary: 0, phone: '', location: { latitude: 0, longitude: 0, address: '' }, workLocation: ''
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

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredEmployees = useMemo(() => {
    let result = employees.filter(emp => {
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

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        switch (sortConfig.key) {
          case 'name':
            valA = `${a.firstName} ${a.lastName}`.toLowerCase();
            valB = `${b.firstName} ${b.lastName}`.toLowerCase();
            break;
          case 'joinDate':
            valA = new Date(a.joinDate).getTime();
            valB = new Date(b.joinDate).getTime();
            break;
          case 'status':
            valA = a.status.toLowerCase();
            valB = b.status.toLowerCase();
            break;
          case 'id':
            valA = Number(a.id);
            valB = Number(b.id);
            break;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [employees, searchTerm, filterDept, filterStatus, sortConfig]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterDept, filterStatus, itemsPerPage, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredEmployees.length / itemsPerPage);
  const paginatedEmployees = sortedAndFilteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
      const numericIds = employees.map(emp => Number(emp.id)).filter(id => !isNaN(id));
      const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1001;
      
      const newPassword = generatePassword();
      const newEmployee: Employee = {
        id: nextId,
        employeeId: formData.employeeId || `EMP${nextId}`,
        joinDate: new Date().toISOString().split('T')[0],
        // Updated: Standard placeholder instead of random image
        avatar: formData.avatar || `https://ui-avatars.com/api/?name=${formData.firstName}+${formData.lastName}&background=0D9488&color=fff`,
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

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (!sortConfig || sortConfig.key !== column) return <ArrowUpDown size={14} className="text-slate-300 ml-1" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-teal-500 ml-1" /> : <ChevronDown size={14} className="text-teal-500 ml-1" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Employee Directory</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Manage your team members and their account details.</p>
        </div>
        <div className="flex gap-2">
            {canViewPasswords && (
                <button 
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors shadow-sm text-sm"
                >
                    {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                    <span>{showPasswords ? 'Hide Passwords' : 'Show Passwords'}</span>
                </button>
            )}
            {isHR && (
            <button 
                onClick={openAddModal}
                className="flex items-center space-x-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg transition-colors shadow-sm text-sm"
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
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-sm bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 text-slate-900 placeholder-slate-400 text-sm"
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
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none hover:border-teal-400 transition-colors cursor-pointer shadow-sm w-full sm:w-auto"
                >
                  <option value="All">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none hover:border-teal-400 transition-colors cursor-pointer shadow-sm w-full sm:w-auto"
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
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="px-6 py-4 cursor-pointer hover:text-teal-600 transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center">Employee <SortIcon column="name" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-teal-600 transition-colors" onClick={() => handleSort('id')}>
                  <div className="flex items-center">ID <SortIcon column="id" /></div>
                </th>
                <th className="px-6 py-4">Role & Dept</th>
                {canViewPasswords && showPasswords && <th className="px-6 py-4 text-red-600 dark:text-red-400">Password</th>}
                <th className="px-6 py-4 cursor-pointer hover:text-teal-600 transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center">Status <SortIcon column="status" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-teal-600 transition-colors" onClick={() => handleSort('joinDate')}>
                  <div className="flex items-center">Join Date <SortIcon column="joinDate" /></div>
                </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img src={emp.avatar} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-600 shadow-sm" />
                      <div>
                        <div className="font-bold text-slate-800 dark:text-white text-sm">{emp.firstName} {emp.lastName}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    {emp.employeeId || emp.id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-900 dark:text-slate-200 font-bold">{emp.role}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-tight">{emp.department}</div>
                  </td>
                  {canViewPasswords && showPasswords && (
                      <td className="px-6 py-4 text-xs font-mono text-red-600 dark:text-red-400 bg-red-50/30 dark:bg-red-900/10">
                          {emp.password}
                      </td>
                  )}
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide inline-flex items-center space-x-1 border
                      ${emp.status === EmployeeStatus.ACTIVE ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 
                        emp.status === EmployeeStatus.INACTIVE ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'}`}>
                      <span className={`w-1 h-1 rounded-full 
                        ${emp.status === EmployeeStatus.ACTIVE ? 'bg-emerald-500' : 
                          emp.status === EmployeeStatus.INACTIVE ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      <span>{emp.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {emp.joinDate}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button onClick={() => openViewModal(emp)} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="View Profile">
                        <Eye size={16} />
                      </button>
                      {isHR && (
                        <>
                          <button onClick={() => openEditModal(emp)} className="text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 p-1.5 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors" title="Edit Employee">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => openDeleteConfirm(emp.id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete Record">
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
                  <td colSpan={canViewPasswords && showPasswords ? 8 : 7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 italic">
                    <div className="flex flex-col items-center">
                      <Search size={32} className="mb-2 opacity-20" />
                      <p>No employees found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
           <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
             <span>Show</span>
             <select 
               value={itemsPerPage}
               onChange={(e) => setItemsPerPage(Number(e.target.value))}
               className="border border-slate-300 dark:border-slate-600 rounded p-1 bg-white dark:bg-slate-800 outline-none"
             >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
             </select>
             <span className="hidden sm:inline">per page</span>
           </div>
           <div className="flex items-center gap-3">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-sm"><ChevronLeft size={16} /></button>
              <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">Page {currentPage} of {totalPages || 1}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-sm"><ChevronRight size={16} /></button>
           </div>
        </div>
      </div>

      {/* VIEW MODAL */}
      <DraggableModal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Employee Details" width="max-w-2xl">
        {viewingEmployee && (
          <div className="px-2 pb-4">
             <div className="relative flex items-center gap-6 mb-8">
                <img src={viewingEmployee.avatar} alt="" className="w-24 h-24 rounded-full border-4 border-slate-100 dark:border-slate-700 shadow-lg object-cover" />
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{viewingEmployee.firstName} {viewingEmployee.lastName}</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs mt-1">{viewingEmployee.role} • {viewingEmployee.department}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-black bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 px-2 py-0.5 rounded border border-teal-100 dark:border-teal-800 tracking-widest uppercase">ID: {viewingEmployee.employeeId || viewingEmployee.id}</span>
                    <span className="text-[10px] font-black bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 tracking-widest uppercase">Joined {viewingEmployee.joinDate}</span>
                  </div>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2 dark:border-slate-700">Contact Interface</h4>
                   <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50"><Mail size={16} className="text-teal-600"/></div>
                      <span>{viewingEmployee.email}</span>
                   </div>
                   <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50"><Phone size={16} className="text-teal-600"/></div>
                      <span>{viewingEmployee.phone || 'Communication Line Undefined'}</span>
                   </div>
                   <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50"><Briefcase size={16} className="text-teal-600"/></div>
                      <span>{viewingEmployee.workLocation || 'Standard Office Base'}</span>
                   </div>
                </div>
                <div className="space-y-5">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2 dark:border-slate-700">Geospatial Marker</h4>
                   <div className="h-40 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                      <LocationMap location={viewingEmployee.location} readOnly={true} />
                   </div>
                   <p className="text-[11px] text-slate-500 font-medium flex items-start gap-2 leading-relaxed">
                      <MapPin size={12} className="mt-0.5 shrink-0 text-red-500"/> 
                      {viewingEmployee.location?.address || 'Geolocation data unavailable for this node.'}
                   </p>
                </div>
             </div>
          </div>
        )}
      </DraggableModal>

      {/* CREATE/EDIT MODAL */}
      <DraggableModal isOpen={showModal} onClose={closeModal} title={editingEmployee ? 'Edit Employee' : 'Add Employee'} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">First Name</label>
              <input required type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all" placeholder="e.g. John" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Last Name</label>
              <input required type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all" placeholder="e.g. Doe" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Employee ID</label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input required type="text" placeholder="EMP_XXXX" value={formData.employeeId} onChange={(e) => setFormData({...formData, employeeId: e.target.value})} className="w-full pl-11 pr-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Email ID</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full pl-11 pr-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all" placeholder="name@nexus.corp" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Role</label>
              <select required value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all">
                 <option value="" disabled>Select Role...</option>
                 {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Project</label>
              <select required value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 bg-slate-50 border-slate-200 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all">
                <option value="" disabled>Select Department...</option>
                {departments.map(dept => <option key={dept.id} value={dept.name}>{dept.name}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-6 flex justify-end space-x-3 border-t dark:border-slate-700">
            <button type="button" onClick={closeModal} className="px-6 py-2.5 text-xs font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors uppercase tracking-widest">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all font-bold text-xs shadow-lg shadow-teal-500/20 uppercase tracking-widest">{editingEmployee ? 'Update Employee' : 'Create Employee'}</button>
          </div>
        </form>
      </DraggableModal>

      {/* Delete Confirmation */}
      <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="De-provisioning Protocol" width="max-w-sm">
        <div className="text-center p-2">
          <div className="bg-red-50 dark:bg-red-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-100 dark:border-red-800">
            <AlertTriangle size={32} className="text-red-600" />
          </div>
          <h3 className="text-xl font-black mb-2 text-slate-800 dark:text-white">Purge Record?</h3>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">Warning: This operation will permanently erase the node and all associated telemetry from the central database. This cannot be reversed.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowDeleteConfirm(false)} className="px-6 py-2.5 text-xs font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">Cancel</button>
            <button onClick={confirmDelete} className="px-8 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold text-xs shadow-lg shadow-red-500/20 uppercase tracking-widest">Confirm Purge</button>
          </div>
        </div>
      </DraggableModal>
    </div>
  );
};

export default EmployeeList;
