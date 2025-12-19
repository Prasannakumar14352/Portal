
import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, User } from '../types';
import { Save, MapPin, User as UserIcon, Mail, Phone, Briefcase, Camera, Calendar, AlertTriangle, Lock, Building2, CheckCircle2, ChevronDown } from 'lucide-react';

declare global {
  interface Window {
    require: any;
  }
}

const WORK_LOCATIONS = [
  'Office HQ India',
  'WFH India',
  'UAE Office',
  'UAE Client Location',
  'USA'
];

const Profile = () => {
  const { currentUser, users, updateUser, departments, projects, roles } = useAppContext();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    departmentId: '', 
    jobTitle: '',
    hireDate: '',
    address: '',
    avatar: '',
    workLocation: '',
    projectIds: [] as string[]
  });
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const mapDiv = useRef<HTMLDivElement>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set Profile User (Defaults to Current User)
  useEffect(() => {
    if (currentUser) {
      setProfileUser(currentUser);
      setFormData({
        name: currentUser.name,
        phone: currentUser.phone || '',
        // Fixed: cast departmentId to string
        departmentId: String(currentUser.departmentId || ''),
        jobTitle: currentUser.jobTitle || '',
        hireDate: currentUser.hireDate || '',
        address: currentUser.location?.address || '',
        avatar: currentUser.avatar,
        workLocation: currentUser.workLocation || '',
        // Fixed: map projectIds to string array
        projectIds: (currentUser.projectIds || []).map(String)
      });
      if (currentUser.location) {
        setLocation({ lat: currentUser.location.latitude, lng: currentUser.location.longitude });
      }
    }
  }, [currentUser]);

  // Permission Logic
  const isHR = currentUser?.role === UserRole.HR;
  const isSuperAdmin = currentUser?.id === 'super1' || currentUser?.email === 'superadmin@empower.com';
  const isSelf = true; // Currently only viewing own profile
  
  // Permission: HR or Admin only can update location
  const canEditLocation = isHR || isSuperAdmin; 
  const canEditAvatar = isHR || isSelf;
  const canEditDetails = isHR; // Name, Phone, Job, Hire
  const canEditAllocations = isHR; // Department, Projects, Work Location

  // Load and Initialize ArcGIS Map
  useEffect(() => {
    if (!profileUser || !mapDiv.current) return;

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
          if (!EsriMap || !MapView) {
            console.error("Esri modules not loaded.");
            return;
          }

          const map = new EsriMap({
            basemap: "topo-vector"
          });

          // Layer for other colleagues
          const colleaguesLayer = new GraphicsLayer();
          // Layer for current user selection
          const userLayer = new GraphicsLayer();
          
          map.add(colleaguesLayer);
          map.add(userLayer);

          // Add all colleagues to map (excluding the currently viewed profile user)
          users.forEach(u => {
             if (u.id !== profileUser.id && u.location) {
                const point = {
                  type: "point",
                  longitude: u.location.longitude,
                  latitude: u.location.latitude
                };
                const markerSymbol = {
                  type: "simple-marker",
                  color: [156, 163, 175], // Gray-400
                  size: "8px",
                  outline: { color: [255, 255, 255], width: 1 }
                };
                const popupTemplate = {
                    title: `${u.firstName} ${u.lastName}`,
                    content: `
                      <div class="py-2">
                        <p><strong>Job:</strong> ${u.jobTitle || u.role}</p>
                        <p><strong>Dept:</strong> ${u.department || 'N/A'}</p>
                        <p class="mt-1 text-xs text-gray-500">${u.location.address || ''}</p>
                      </div>
                    `
                };
                const graphic = new Graphic({
                  geometry: point,
                  symbol: markerSymbol,
                  popupTemplate: popupTemplate
                });
                colleaguesLayer.add(graphic);
             }
          });

          // Center on the profile user or default
          const defaultCenter = location ? [location.lng, location.lat] : [-118.2437, 34.0522];
          
          view = new MapView({
            container: mapDiv.current,
            map: map,
            center: defaultCenter,
            zoom: location ? 12 : 4,
            popup: {
               dockEnabled: true,
               dockOptions: { buttonEnabled: true, breakpoint: false }
            }
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

          // Add existing user pin for the profile being viewed
          if (location) {
            const point = {
              type: "point",
              longitude: location.lng,
              latitude: location.lat
            };
            const markerSymbol = {
              type: "simple-marker",
              color: [5, 150, 105], // Emerald-600
              size: "14px",
              outline: { color: [255, 255, 255], width: 2 }
            };
            const pointGraphic = new Graphic({
              geometry: point,
              symbol: markerSymbol
            });
            userLayer.add(pointGraphic);
          }

          // Handle Click
          view.on("click", async (event: any) => {
            if (!canEditLocation) return; // Guard

            const response = await view.hitTest(event);
            const hitGraphic = response.results.find((r: any) => r.graphic.layer === colleaguesLayer);
            
            if (hitGraphic) return;

            const lat = event.mapPoint.latitude;
            const lng = event.mapPoint.longitude;
            
            setLocation({ lat, lng });

            userLayer.removeAll();
            const point = {
              type: "point",
              longitude: lng,
              latitude: lat
            };
            const markerSymbol = {
              type: "simple-marker",
              color: [220, 38, 38], // Red-600 indicating change
              size: "14px",
              outline: { color: [255, 255, 255], width: 2 }
            };
            const pointGraphic = new Graphic({
              geometry: point,
              symbol: markerSymbol
            });
            userLayer.add(pointGraphic);

            const serviceUrl = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
            locator.locationToAddress(serviceUrl, {
                location: event.mapPoint
            }).then((response: any) => {
                if (response.address) {
                    setFormData(prev => ({ ...prev, address: response.address }));
                }
            }).catch((err: any) => {
                console.warn("Geocoding failed", err);
            });
          });

          view.when(() => {
             if (!cleanup) setIsMapLoaded(true);
          });
        });

      } catch (e) {
        console.error("Error loading ArcGIS map", e);
      }
    };

    initMap();

    return () => {
      cleanup = true;
      if (view) {
        view.destroy();
        view = null;
      }
    };
  }, [profileUser, canEditLocation]); // Re-run if permissions change (though unlikely in session)

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleProject = (projId: string) => {
    if (!canEditAllocations) return;
    setFormData(prev => {
      const exists = prev.projectIds.includes(projId);
      if (exists) return { ...prev, projectIds: prev.projectIds.filter(id => id !== projId) };
      return { ...prev, projectIds: [...prev.projectIds, projId] };
    });
  };

  const triggerSave = () => {
      setShowConfirm(true);
  };

  const confirmSave = () => {
    if (!profileUser) return;
    setIsSaving(true);
    setShowConfirm(false);
    
    const updates: Partial<User> = {};
    
    if (canEditDetails) {
      updates.name = formData.name;
      updates.phone = formData.phone;
      updates.jobTitle = formData.jobTitle;
      updates.hireDate = formData.hireDate;
    }

    if (canEditAllocations) {
      updates.departmentId = formData.departmentId;
      updates.projectIds = formData.projectIds;
      updates.workLocation = formData.workLocation;
    }

    if (canEditAvatar) {
      updates.avatar = formData.avatar;
    }

    if (canEditLocation && location) {
      updates.location = {
        latitude: location.lat,
        longitude: location.lng,
        address: formData.address 
      };
    }

    // Fixed: ensure id is passed correctly to updateUser
    updateUser(profileUser.id, updates);
    setTimeout(() => setIsSaving(false), 800);
  };

  if (!profileUser) return <div>Loading profile...</div>;

  const canSave = canEditDetails || canEditLocation || canEditAvatar || canEditAllocations;

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative animate-fade-in">
       {/* Confirmation Modal */}
       {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-400 mb-4">
                 <AlertTriangle size={24} />
                 <h3 className="text-lg font-bold text-slate-800 dark:text-white">Confirm Changes</h3>
              </div>
              <p className="text-gray-600 dark:text-slate-300 mb-6">Are you sure you want to update this profile? This action will overwrite existing information.</p>
              <div className="flex justify-end space-x-3">
                 <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium">Cancel</button>
                 <button onClick={confirmSave} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-medium shadow-sm">Confirm Update</button>
              </div>
           </div>
        </div>
       )}

       {/* Header */}
       <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                 My Profile
              </h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm">Manage personal information and work location.</p>
            </div>
            {canSave && (
              <button 
                onClick={triggerSave}
                disabled={isSaving}
                className="flex items-center space-x-2 bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm disabled:opacity-70"
              >
                <Save size={18} />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            )}
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: User Details */}
          <div className="lg:col-span-1 space-y-6">
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <div className="flex flex-col items-center text-center mb-6">
                   <div className="relative group">
                     <img src={formData.avatar} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-700 shadow-md mb-3 object-cover" />
                     {canEditAvatar && (
                       <>
                         <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                         <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-2 right-0 bg-white dark:bg-slate-700 p-1.5 rounded-full shadow border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-transform hover:scale-110"
                            title="Change Avatar"
                         >
                           <Camera size={14} />
                         </button>
                       </>
                     )}
                   </div>
                   <h3 className="text-xl font-bold text-gray-800 dark:text-white">{formData.name}</h3>
                   <span className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full text-xs mt-1">{profileUser.role}</span>
                </div>

                <div className="space-y-4">
                   <div className="relative">
                     <label className="block text-sm font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Full Name</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditDetails ? 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600' : 'bg-gray-100 dark:bg-slate-800 border-transparent'}`}>
                        <UserIcon size={16} className="text-gray-400 dark:text-slate-500" />
                        <input 
                          disabled={!canEditDetails}
                          type="text" 
                          className="bg-transparent w-full text-sm outline-none text-gray-700 dark:text-white disabled:text-gray-500 dark:disabled:text-slate-500" 
                          value={formData.name} 
                          onChange={e => setFormData({...formData,name: e.target.value})}
                        />
                     </div>
                     {!canEditDetails && <Lock size={12} className="absolute top-1 right-1 text-gray-400 dark:text-slate-600" />}
                   </div>

                   <div className="relative">
                     <label className="block text-sm font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Job Title</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditDetails ? 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600' : 'bg-gray-100 dark:bg-slate-800 border-transparent'}`}>
                        <Briefcase size={16} className="text-gray-400 dark:text-slate-500" />
                        <div className="relative w-full">
                          <select 
                            disabled={!canEditDetails}
                            className="bg-transparent w-full text-sm outline-none text-gray-700 dark:text-white disabled:text-gray-500 dark:disabled:text-slate-500 appearance-none relative z-10"
                            value={formData.jobTitle} 
                            onChange={e => setFormData({...formData, jobTitle: e.target.value})}
                          >
                             <option value="" className="bg-white dark:bg-slate-800">Select Job Title...</option>
                             {roles.length > 0 ? (
                                roles.map(role => (
                                  <option key={role.id} value={role.name} className="bg-white dark:bg-slate-800">{role.name}</option>
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
                          {canEditDetails && <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 z-0" />}
                        </div>
                     </div>
                   </div>

                   <div className="relative">
                     <label className="block text-sm font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Department</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditAllocations ? 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600' : 'bg-gray-100 dark:bg-slate-800 border-transparent'}`}>
                        <Building2 size={16} className="text-gray-400 dark:text-slate-500" />
                        <div className="relative w-full">
                          <select 
                            disabled={!canEditAllocations}
                            className="bg-transparent w-full text-sm outline-none text-gray-700 dark:text-white disabled:text-gray-500 dark:disabled:text-slate-500 appearance-none relative z-10"
                            value={formData.departmentId}
                            onChange={e => setFormData({...formData, departmentId: e.target.value})}
                          >
                            <option value="" className="bg-white dark:bg-slate-800">Select Department...</option>
                            {departments.map(dept => (
                              <option key={dept.id} value={dept.id} className="bg-white dark:bg-slate-800">{dept.name}</option>
                            ))}
                          </select>
                          {canEditAllocations && <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 z-0" />}
                        </div>
                     </div>
                     {!canEditAllocations && <Lock size={12} className="absolute top-1 right-1 text-gray-400 dark:text-slate-600" />}
                   </div>

                   <div className="relative">
                     <label className="block text-sm font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Work Location</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditAllocations ? 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600' : 'bg-gray-100 dark:bg-slate-800 border-transparent'}`}>
                        <MapPin size={16} className="text-gray-400 dark:text-slate-500" />
                        <div className="relative w-full">
                          <select 
                            disabled={!canEditAllocations}
                            className="bg-transparent w-full text-sm outline-none text-gray-700 dark:text-white disabled:text-gray-500 dark:disabled:text-slate-500 appearance-none relative z-10"
                            value={formData.workLocation}
                            onChange={e => setFormData({...formData, workLocation: e.target.value})}
                          >
                            <option value="" className="bg-white dark:bg-slate-800">Select Location...</option>
                            {WORK_LOCATIONS.map(loc => (
                              <option key={loc} value={loc} className="bg-white dark:bg-slate-800">{loc}</option>
                            ))}
                          </select>
                          {canEditAllocations && <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 z-0" />}
                        </div>
                     </div>
                     {!canEditAllocations && <Lock size={12} className="absolute top-1 right-1 text-gray-400 dark:text-slate-600" />}
                   </div>

                   <div className="relative">
                     <label className="block text-sm font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Assigned Projects</label>
                     <div className={`border border-gray-200 dark:border-slate-600 rounded-lg max-h-40 overflow-y-auto p-2 space-y-2 ${canEditAllocations ? 'bg-gray-50 dark:bg-slate-700' : 'bg-white dark:bg-slate-800'}`}>
                        {projects.map(proj => {
                          const isAssigned = formData.projectIds.includes(String(proj.id));
                          if (!canEditAllocations && !isAssigned) return null; // If not editing, only show assigned
                          
                          return (
                            <label key={proj.id} className={`flex items-center space-x-3 p-2 rounded ${canEditAllocations ? 'cursor-pointer hover:bg-white dark:hover:bg-slate-600 hover:shadow-sm' : 'cursor-default border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50'}`}>
                              {canEditAllocations ? (
                                <input 
                                  type="checkbox" 
                                  checked={isAssigned}
                                  onChange={() => toggleProject(String(proj.id))}
                                  className="rounded text-emerald-600 focus:ring-emerald-500"
                                />
                              ) : (
                                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                              )}
                              <div>
                                <span className={`text-sm block ${canEditAllocations ? 'text-gray-700 dark:text-slate-200' : 'text-gray-800 dark:text-white font-medium'}`}>{proj.name}</span>
                                {!canEditAllocations && <span className="text-[10px] text-gray-400 dark:text-slate-500 block">{proj.status}</span>}
                              </div>
                            </label>
                          );
                        })}
                        {projects.length === 0 && <span className="text-xs text-gray-400 dark:text-slate-500 italic p-1 block">No projects available</span>}
                        {!canEditAllocations && formData.projectIds.length === 0 && <span className="text-xs text-gray-400 dark:text-slate-500 italic p-1 block">No projects assigned</span>}
                     </div>
                     {canEditAllocations && !canEditAllocations && <Lock size={12} className="absolute top-1 right-1 text-gray-400 dark:text-slate-600" />}
                   </div>

                   <div className="relative">
                     <label className="block text-sm font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Hire Date</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditDetails ? 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600' : 'bg-gray-100 dark:bg-slate-800 border-transparent'}`}>
                        <Calendar size={16} className="text-gray-400 dark:text-slate-500" />
                        <input 
                          disabled={!canEditDetails}
                          type="date" 
                          className="bg-transparent w-full text-sm outline-none text-gray-700 dark:text-white disabled:text-gray-500 dark:disabled:text-slate-500" 
                          value={formData.hireDate} 
                          onChange={e => setFormData({...formData, hireDate: e.target.value})}
                        />
                     </div>
                     {!canEditDetails && <Lock size={12} className="absolute top-1 right-1 text-gray-400 dark:text-slate-600" />}
                   </div>
                </div>
             </div>

             {/* Contact Info Card */}
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 space-y-4">
                <h4 className="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide border-b border-gray-100 dark:border-slate-700 pb-2">Contact Information</h4>
                
                <div className="relative">
                   <label className="block text-sm font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Email Address</label>
                   <div className="flex items-center space-x-2 border border-transparent bg-gray-100 dark:bg-slate-800 dark:border-slate-700 rounded-lg px-3 py-2">
                      <Mail size={16} className="text-gray-400 dark:text-slate-500" />
                      <input 
                        disabled
                        type="email" 
                        className="bg-transparent w-full text-sm outline-none text-gray-500 dark:text-slate-400 cursor-not-allowed" 
                        value={profileUser.email} 
                      />
                   </div>
                   <Lock size={12} className="absolute top-1 right-1 text-gray-400 dark:text-slate-600" />
                </div>

                <div className="relative">
                   <label className="block text-sm font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Phone Number</label>
                   <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditDetails ? 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600' : 'bg-gray-100 dark:bg-slate-800 border-transparent'}`}>
                      <Phone size={16} className="text-gray-400 dark:text-slate-500" />
                      <input 
                        disabled={!canEditDetails}
                        type="tel" 
                        className="bg-transparent w-full text-sm outline-none text-gray-700 dark:text-white disabled:text-gray-500 dark:disabled:text-slate-500" 
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        placeholder="+1 (555) 000-0000"
                      />
                   </div>
                   {!canEditDetails && <Lock size={12} className="absolute top-1 right-1 text-gray-400 dark:text-slate-600" />}
                </div>
             </div>
          </div>

          {/* Right Column: Map & Location */}
          <div className="lg:col-span-2 space-y-6">
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                   <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                      <MapPin size={18} className="text-emerald-600 dark:text-emerald-400" />
                      Home Location
                   </h3>
                   {canEditLocation && <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-900 font-medium">Click map to update</span>}
                </div>
                
                <div className="flex-1 relative">
                   <div ref={mapDiv} className="w-full h-full"></div>
                   {!isMapLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 z-10">
                         <div className="flex flex-col items-center">
                            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                            <p className="text-gray-500 dark:text-slate-400 text-sm">Loading ArcGIS Map...</p>
                         </div>
                      </div>
                   )}
                </div>
                
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                   <label className="block text-sm font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Address</label>
                   <div className="flex items-center space-x-2">
                      <MapPin size={16} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <p className="text-sm text-gray-700 dark:text-slate-300 truncate w-full">{formData.address || 'No address set'}</p>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default Profile;
