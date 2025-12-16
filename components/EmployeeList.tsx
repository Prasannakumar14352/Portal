
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, Mail, Filter, ChevronLeft, ChevronRight, Copy, Check, Key, Eye, EyeOff, MapPin, Building2, User as UserIcon, Phone, Briefcase } from 'lucide-react';
import { Employee, DepartmentType, EmployeeStatus, UserRole } from '../types';
import { useAppContext } from '../contexts/AppContext';

interface EmployeeListProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}

// Inline Map Component for Employee Modals
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

          // Default center or user location
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
                color: [5, 150, 105], // Emerald
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
            ui: { components: ["zoom"] } // Minimal UI
          });

          // Add Basemap Gallery inside Expand widget
          const basemapGallery = new BasemapGallery({
            view: view
          });
          const bgExpand = new Expand({
            view: view,
            content: basemapGallery,
            expandIconClass: "esri-icon-basemap"
          });
          view.ui.add(bgExpand, "top-right");

          if (!readOnly && onChange) {
             view.on("click", (event: any) => {
                const lat = event.mapPoint.latitude;
                const lng = event.mapPoint.longitude;
                
                layer.removeAll();
                const point = { type: "point", longitude: lng, latitude: lat };
                const markerSymbol = {
                   type: "simple-marker",
                   color: [220, 38, 38], // Red for new selection
                   size: "14px",
                   outline: { color: [255, 255, 255], width: 2 }
                };
                layer.add(new Graphic({ geometry: point, symbol: markerSymbol }));

                // Reverse Geocode
                const serviceUrl = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
                locator.locationToAddress(serviceUrl, { location: event.mapPoint })
                  .then((res: any) => {
                      onChange({ latitude: lat, longitude: lng, address: res.address || "Pinned Location" });
                  })
                  .catch(() => {
                      onChange({ latitude: lat, longitude: lng, address: "Pinned Location" });
                  });
             });
          }

          view.when(() => { if (!cleanup) setIsMapLoaded(true); });
        });
      } catch (e) { console.error("Map Error", e); }
    };

    initMap();
    return () => { cleanup = true; if (view) { view.destroy(); view = null; } };
  }, [location?.latitude, location?.longitude, readOnly]); // Dependency mostly on mount or mode change

  return (
    <div className="relative w-full h-full bg-slate-100 rounded-lg overflow-hidden">
        <div ref={mapDiv} className="w-full h-full"></div>
        {!isMapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )}
    </div>
  );
};

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
  const { currentUser, showToast } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<{email: string, password: string} | null>(null);
  const [copied, setCopied] = useState(false);

  // Super Admin Password Visibility
  const [showPasswords, setShowPasswords] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  const isHR = currentUser?.role === UserRole.HR;
  const isSuperAdmin = currentUser?.id === 'super1' || currentUser?.email === 'superadmin@empower.com';

  // Form State
  const [formData, setFormData] = useState<Partial<Employee>>({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    department: DepartmentType.IT,
    status: EmployeeStatus.ACTIVE,
    salary: 0,
    phone: '',
    location: { latitude: 0, longitude: 0, address: '' }
  });

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

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDept, filterStatus, itemsPerPage]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const generatePassword = () => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
      let password = "";
      for (let i = 0; i < 10; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
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
      firstName: '',
      lastName: '',
      email: '',
      role: '',
      department: DepartmentType.IT,
      status: EmployeeStatus.ACTIVE,
      salary: 0,
      phone: '',
      location: undefined
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

  const closeModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Employee Directory</h2>
          <p className="text-slate-500">Manage your team members and their account details.</p>
        </div>
        <div className="flex gap-2">
            {isSuperAdmin && (
                <button 
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Filters ... (Keep existing layout) */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-slate-500 mr-2">
                  <Filter size={16} />
                  <span className="text-sm font-medium">Filters:</span>
              </div>
              <select 
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none hover:border-teal-400 transition-colors cursor-pointer shadow-sm w-full sm:w-auto"
              >
                <option value="All">All Departments</option>
                {Object.values(DepartmentType).map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none hover:border-teal-400 transition-colors cursor-pointer shadow-sm w-full sm:w-auto"
              >
                <option value="All">All Status</option>
                {Object.values(EmployeeStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
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
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-sm"
              />
            </div>
            <div className="text-xs text-slate-500 whitespace-nowrap self-end md:self-auto">
               Showing <span className="font-semibold text-slate-700">{filteredEmployees.length}</span> employees
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Role & Dept</th>
                {isSuperAdmin && showPasswords && <th className="px-6 py-4 text-red-600">Password</th>}
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Join Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img src={emp.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      <div>
                        <div className="font-medium text-slate-900">{emp.firstName} {emp.lastName}</div>
                        <div className="text-xs text-slate-500">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-900 font-medium">{emp.role}</div>
                    <div className="text-xs text-slate-500">{emp.department}</div>
                  </td>
                  {isSuperAdmin && showPasswords && (
                      <td className="px-6 py-4 text-sm font-mono text-red-600 bg-red-50/50">
                          {emp.password}
                      </td>
                  )}
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center space-x-1
                      ${emp.status === EmployeeStatus.ACTIVE ? 'bg-emerald-100 text-emerald-700' : 
                        emp.status === EmployeeStatus.INACTIVE ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full 
                        ${emp.status === EmployeeStatus.ACTIVE ? 'bg-emerald-500' : 
                          emp.status === EmployeeStatus.INACTIVE ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      <span>{emp.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {emp.joinDate}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button onClick={() => openViewModal(emp)} className="text-slate-400 hover:text-blue-600 p-1" title="View Details">
                        <Eye size={16} />
                      </button>
                      {isHR && (
                        <>
                          <button onClick={() => openEditModal(emp)} className="text-slate-400 hover:text-teal-600 p-1">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => onDeleteEmployee(emp.id)} className="text-slate-400 hover:text-red-600 p-1">
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
                  <td colSpan={isHR ? (isSuperAdmin && showPasswords ? 6 : 5) : 4} className="px-6 py-8 text-center text-slate-500">
                    No employees found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center p-4 border-t border-slate-200 bg-slate-50/50">
           <div className="flex items-center gap-2 text-xs text-slate-500">
             <span>Show</span>
             <select 
               value={itemsPerPage}
               onChange={(e) => setItemsPerPage(Number(e.target.value))}
               className="border border-slate-300 rounded p-1 outline-none bg-white focus:ring-2 focus:ring-teal-500"
             >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
             </select>
             <span>per page</span>
             <span className="mx-2 text-slate-300">|</span>
             <span>
               Showing <span className="font-medium text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-slate-700">{Math.min(currentPage * itemsPerPage, filteredEmployees.length)}</span> of <span className="font-medium text-slate-700">{filteredEmployees.length}</span> results
             </span>
           </div>
           <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white bg-white text-slate-600 shadow-sm"><ChevronLeft size={16} /></button>
              <span className="text-xs font-medium text-slate-600 px-2">Page {currentPage} of {totalPages || 1}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white bg-white text-slate-600 shadow-sm"><ChevronRight size={16} /></button>
           </div>
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      {showViewModal && viewingEmployee && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in duration-200">
              <div className="relative h-24 bg-gradient-to-r from-teal-600 to-emerald-600">
                 <button onClick={() => setShowViewModal(false)} className="absolute top-4 right-4 text-white/80 hover:text-white"><span className="text-2xl">&times;</span></button>
              </div>
              <div className="px-8 pb-8">
                 <div className="relative -top-10 mb-[-20px] flex items-end justify-between">
                    <img src={viewingEmployee.avatar} alt="" className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-white object-cover" />
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${viewingEmployee.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>{viewingEmployee.status}</span>
                 </div>
                 
                 <div className="mt-4">
                    <h3 className="text-2xl font-bold text-slate-800">{viewingEmployee.firstName} {viewingEmployee.lastName}</h3>
                    <p className="text-slate-500 font-medium">{viewingEmployee.role} • {viewingEmployee.department}</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="space-y-4">
                       <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Contact Info</h4>
                       <div className="flex items-center gap-3 text-sm text-slate-700"><Mail size={16} className="text-slate-400"/> {viewingEmployee.email}</div>
                       <div className="flex items-center gap-3 text-sm text-slate-700"><Phone size={16} className="text-slate-400"/> {viewingEmployee.phone || 'N/A'}</div>
                       <div className="flex items-center gap-3 text-sm text-slate-700"><Building2 size={16} className="text-slate-400"/> HQ Office</div>
                    </div>
                    <div className="space-y-4">
                       <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Location</h4>
                       <div className="h-40 rounded-lg overflow-hidden border border-slate-200 relative">
                          <LocationMap location={viewingEmployee.location} readOnly={true} />
                       </div>
                       <p className="text-xs text-slate-500 flex items-start gap-1"><MapPin size={12} className="mt-0.5 shrink-0"/> {viewingEmployee.location?.address || 'No address set'}</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><span className="text-2xl">&times;</span></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input required type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input required type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                  <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                {!editingEmployee && <p className="text-xs text-slate-500 mt-1">A secure password will be generated automatically.</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role/Title</label>
                  {isSuperAdmin ? (
                       <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                         <option value="Employee">Employee</option>
                         <option value="Team Manager">Team Manager</option>
                         <option value="HR Manager">HR Manager</option>
                         <option value="Software Engineer">Software Engineer</option>
                         <option value="Sales Manager">Sales Manager</option>
                         <option value="Marketing Lead">Marketing Lead</option>
                       </select>
                  ) : (
                      <input required type="text" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. Software Engineer" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <select value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                    {Object.values(DepartmentType).map(dept => (<option key={dept} value={dept}>{dept}</option>))}
                  </select>
                </div>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                   <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as EmployeeStatus})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                    {Object.values(EmployeeStatus).map(status => (<option key={status} value={status}>{status}</option>))}
                  </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                   <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" placeholder="+1..." />
                </div>
               </div>

               {/* Map for HR Location Editing */}
               <div className="pt-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Work Location (Click map to update)</label>
                  <div className="h-48 w-full border border-slate-300 rounded-lg overflow-hidden relative">
                     <LocationMap 
                       location={formData.location} 
                       readOnly={!isHR} 
                       onChange={(loc) => setFormData({...formData, location: loc})}
                     />
                  </div>
                  <div className="mt-1 flex justify-between items-center text-xs text-slate-500">
                     <span>{formData.location?.address || 'No location set'}</span>
                     {isHR && <span className="text-emerald-600 font-medium">Editable by HR</span>}
                  </div>
               </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors">{editingEmployee ? 'Save Changes' : 'Create Employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Credentials Modal (Keep as is) */}
      {showSuccessModal && generatedCreds && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-300 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-400 to-teal-700"></div>
              <div className="flex flex-col items-center text-center mb-6">
                 <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mb-4"><Key size={32} className="text-teal-700" /></div>
                 <h3 className="text-2xl font-bold text-slate-800">Employee Created</h3>
                 <p className="text-slate-500 mt-2">A unique password has been generated.</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-6 relative">
                 <div className="mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Username / Email</p>
                    <p className="font-mono text-slate-800 font-medium select-all">{generatedCreds.email}</p>
                 </div>
                 <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">One-Time Password</p>
                    <p className="font-mono text-xl text-slate-800 font-bold select-all tracking-wide">{generatedCreds.password}</p>
                 </div>
              </div>
              <div className="flex flex-col gap-3">
                 <button onClick={copyToClipboard} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-md">
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    <span>{copied ? 'Copied to Clipboard' : 'Copy Credentials'}</span>
                 </button>
                 <button onClick={() => setShowSuccessModal(false)} className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 py-3 rounded-lg font-medium transition-colors">Close</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
