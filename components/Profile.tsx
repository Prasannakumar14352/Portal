
import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, User } from '../types';
import { Save, MapPin, User as UserIcon, Mail, Phone, Briefcase, Camera, Calendar, AlertTriangle, Lock, Building2, CheckCircle2 } from 'lucide-react';

declare global {
  interface Window {
    require: any;
  }
}

const Profile = () => {
  const { currentUser, users, updateUser, departments, projects } = useAppContext();
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
        departmentId: currentUser.departmentId || '',
        jobTitle: currentUser.jobTitle || '',
        hireDate: currentUser.hireDate || '',
        address: currentUser.location?.address || '',
        avatar: currentUser.avatar,
        projectIds: currentUser.projectIds || []
      });
      if (currentUser.location) {
        setLocation({ lat: currentUser.location.latitude, lng: currentUser.location.longitude });
      }
    }
  }, [currentUser]);

  // Permission Logic
  const isHR = currentUser?.role === UserRole.HR;
  const isSelf = true; // Currently only viewing own profile
  
  // HR ONLY can update location as per request
  const canEditLocation = isHR; 
  const canEditAvatar = isHR || isSelf;
  const canEditDetails = isHR; // Name, Phone, Job, Hire
  const canEditAllocations = isHR; // Department, Projects

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
          "esri/rest/locator"
        ], (EsriMap: any, MapView: any, Graphic: any, GraphicsLayer: any, locator: any) => {
          
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
           <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
              <div className="flex items-center space-x-3 text-amber-600 mb-4">
                 <AlertTriangle size={24} />
                 <h3 className="text-lg font-bold">Confirm Changes</h3>
              </div>
              <p className="text-gray-600 mb-6">Are you sure you want to update this profile? This action will overwrite existing information.</p>
              <div className="flex justify-end space-x-3">
                 <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                 <button onClick={confirmSave} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-medium shadow-sm">Confirm Update</button>
              </div>
           </div>
        </div>
       )}

       {/* Header */}
       <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                 My Profile
              </h2>
              <p className="text-gray-500 text-sm">Manage personal information and work location.</p>
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
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col items-center text-center mb-6">
                   <div className="relative group">
                     <img src={formData.avatar} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-white shadow-md mb-3 object-cover" />
                     {canEditAvatar && (
                       <>
                         <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                         <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-2 right-0 bg-white p-1.5 rounded-full shadow border border-gray-200 text-gray-600 hover:text-emerald-600 cursor-pointer transition-transform hover:scale-110"
                            title="Change Avatar"
                         >
                           <Camera size={14} />
                         </button>
                       </>
                     )}
                   </div>
                   <h3 className="text-xl font-bold text-gray-800">{formData.name}</h3>
                   <span className="text-emerald-600 font-medium bg-emerald-50 px-3 py-1 rounded-full text-xs mt-1">{profileUser.role}</span>
                </div>

                <div className="space-y-4">
                   <div className="relative">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditDetails ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-transparent'}`}>
                        <UserIcon size={16} className="text-gray-400" />
                        <input 
                          disabled={!canEditDetails}
                          type="text" 
                          className="bg-transparent w-full text-sm outline-none text-gray-700 disabled:text-gray-500" 
                          value={formData.name} 
                          onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                     </div>
                     {!canEditDetails && <Lock size={12} className="absolute top-1 right-1 text-gray-400" />}
                   </div>

                   <div className="relative">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Job Title</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditDetails ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-transparent'}`}>
                        <Briefcase size={16} className="text-gray-400" />
                        <input 
                          disabled={!canEditDetails}
                          type="text" 
                          className="bg-transparent w-full text-sm outline-none text-gray-700 disabled:text-gray-500" 
                          value={formData.jobTitle} 
                          onChange={e => setFormData({...formData, jobTitle: e.target.value})}
                          placeholder="e.g. Senior Developer"
                        />
                     </div>
                   </div>

                   <div className="relative">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Department</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditAllocations ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-transparent'}`}>
                        <Building2 size={16} className="text-gray-400" />
                        <select 
                          disabled={!canEditAllocations}
                          className="bg-transparent w-full text-sm outline-none text-gray-700 disabled:text-gray-500 appearance-none"
                          value={formData.departmentId}
                          onChange={e => setFormData({...formData, departmentId: e.target.value})}
                        >
                           <option value="">Select Department...</option>
                           {departments.map(dept => (
                             <option key={dept.id} value={dept.id}>{dept.name}</option>
                           ))}
                        </select>
                     </div>
                     {!canEditAllocations && <Lock size={12} className="absolute top-1 right-1 text-gray-400" />}
                   </div>

                   <div className="relative">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assigned Projects</label>
                     <div className={`border border-gray-200 rounded-lg max-h-40 overflow-y-auto p-2 space-y-2 ${canEditAllocations ? 'bg-gray-50' : 'bg-white'}`}>
                        {projects.map(proj => {
                          const isAssigned = formData.projectIds.includes(proj.id);
                          if (!canEditAllocations && !isAssigned) return null; // If not editing, only show assigned
                          
                          return (
                            <label key={proj.id} className={`flex items-center space-x-3 p-2 rounded ${canEditAllocations ? 'cursor-pointer hover:bg-white hover:shadow-sm' : 'cursor-default border border-gray-100 bg-gray-50'}`}>
                              {canEditAllocations ? (
                                <input 
                                  type="checkbox" 
                                  checked={isAssigned}
                                  onChange={() => toggleProject(proj.id)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500"
                                />
                              ) : (
                                <CheckCircle2 size={16} className="text-emerald-600" />
                              )}
                              <div>
                                <span className={`text-sm block ${canEditAllocations ? 'text-gray-700' : 'text-gray-800 font-medium'}`}>{proj.name}</span>
                                {!canEditAllocations && <span className="text-[10px] text-gray-400 block">{proj.status}</span>}
                              </div>
                            </label>
                          );
                        })}
                        {projects.length === 0 && <span className="text-xs text-gray-400 italic p-1 block">No projects available</span>}
                        {!canEditAllocations && formData.projectIds.length === 0 && <span className="text-xs text-gray-400 italic p-1 block">No projects assigned</span>}
                     </div>
                     {canEditAllocations && !canEditAllocations && <Lock size={12} className="absolute top-1 right-1 text-gray-400" />}
                   </div>

                   <div className="relative">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hire Date</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditDetails ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-transparent'}`}>
                        <Calendar size={16} className="text-gray-400" />
                        <input 
                          disabled={!canEditDetails}
                          type="date" 
                          className="bg-transparent w-full text-sm outline-none text-gray-700 disabled:text-gray-500" 
                          value={formData.hireDate} 
                          onChange={e => setFormData({...formData, hireDate: e.target.value})}
                        />
                     </div>
                   </div>

                   <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                     <div className="flex items-center space-x-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 opacity-70 cursor-not-allowed">
                        <Mail size={16} className="text-gray-400" />
                        <input type="text" disabled className="bg-transparent w-full text-sm outline-none text-gray-500" value={profileUser.email} />
                     </div>
                   </div>

                   <div className="relative">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditDetails ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-transparent'}`}>
                        <Phone size={16} className="text-gray-400" />
                        <input 
                          disabled={!canEditDetails}
                          type="text" 
                          className="bg-transparent w-full text-sm outline-none text-gray-700 disabled:text-gray-500" 
                          value={formData.phone} 
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                          placeholder="+1 ..."
                        />
                     </div>
                   </div>

                </div>
             </div>
          </div>

          {/* Right Column: Location Map */}
          <div className="lg:col-span-2">
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                   <h3 className="font-bold text-gray-700 flex items-center gap-2">
                     <MapPin size={18} className="text-emerald-600"/>
                     Work Location
                   </h3>
                   <div className="flex items-center space-x-3 text-xs">
                     <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        <span className="text-gray-600">This User</span>
                     </div>
                     <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        <span className="text-gray-600">Colleagues</span>
                     </div>
                     {canEditLocation && <span className="text-green-600 font-medium border-l pl-3 ml-1">Editable: Click to update (HR Only)</span>}
                   </div>
                </div>
                
                {/* Address Input */}
                <div className="p-4 border-b border-gray-100">
                   <input 
                     disabled={!canEditLocation}
                     type="text" 
                     className={`w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none ${canEditLocation ? 'border-gray-300' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                     placeholder={canEditLocation ? "Enter address manually or click on map..." : "Location set by HR"} 
                     value={formData.address}
                     onChange={e => setFormData({...formData, address: e.target.value})}
                   />
                </div>

                {/* Map Container */}
                <div className="flex-1 min-h-[400px] relative bg-gray-100">
                   <div ref={mapDiv} className="w-full h-full absolute inset-0 outline-none"></div>
                   {!isMapLoaded && (
                     <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                        <div className="flex flex-col items-center">
                           <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                           <p className="text-gray-500 text-sm">Loading Map...</p>
                        </div>
                     </div>
                   )}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default Profile;
