
import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, User } from '../types';
import { Save, MapPin, User as UserIcon, Mail, Phone, Briefcase, Camera, Calendar, AlertTriangle, Building2, UserSquare, Hash, AlignLeft, Globe, BadgeCheck, Clock, Edit3, X } from 'lucide-react';
import DraggableModal from './DraggableModal';

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
  'USA Office',
  'Remote'
];

const Profile = () => {
  const { currentUser, updateUser, departments, showToast } = useAppContext();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    departmentId: '', 
    jobTitle: '',
    hireDate: '',
    address: '',
    avatar: '',
    workLocation: '',
    projectIds: [] as string[],
    position: '',
    bio: ''
  });
  
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const mapDiv = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Initialize data
  const initializeFormData = (user: User) => {
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      departmentId: String(user.departmentId || ''),
      jobTitle: user.jobTitle || '',
      hireDate: user.hireDate || '',
      address: user.location?.address || '',
      avatar: user.avatar || '',
      workLocation: user.workLocation || '',
      projectIds: (user.projectIds || []).map(String),
      position: user.position || '',
      bio: (user as any).bio || 'Experienced professional at EmpowerCorp.'
    });
    if (user.location) {
      setLocation({ lat: user.location.latitude, lng: user.location.longitude });
    } else {
        // Default to a central location if none exists
        setLocation({ lat: 20.5937, lng: 78.9629 });
    }
  };

  useEffect(() => {
    if (currentUser) {
      setProfileUser(currentUser);
      initializeFormData(currentUser);
    }
  }, [currentUser]);

  // Permission logic
  const isHR = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;
  const canEditAdminFields = isEditMode && isHR;
  const canEditPersonalFields = isEditMode;

  const handleCancel = () => {
    if (currentUser) {
      initializeFormData(currentUser);
    }
    setIsEditMode(false);
  };

  // ArcGIS Map Logic
  useEffect(() => {
    let cleanup = false;

    const loadArcGIS = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.require) { resolve(); return; }
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
      if (!location) return;
      try {
        await loadArcGIS();
        if (cleanup || !mapDiv.current) return;

        window.require([
          "esri/Map", 
          "esri/views/MapView", 
          "esri/Graphic", 
          "esri/layers/GraphicsLayer",
          "esri/rest/locator"
        ], (EsriMap: any, MapView: any, Graphic: any, GraphicsLayer: any, locator: any) => {
          if (cleanup) return;
          
          const map = new EsriMap({ basemap: "topo-vector" });
          const view = new MapView({
            container: mapDiv.current,
            map: map,
            center: [location.lng, location.lat],
            zoom: 12
          });
          viewRef.current = view;

          const layer = new GraphicsLayer();
          map.add(layer);

          const marker = new Graphic({
            geometry: { type: "point", longitude: location.lng, latitude: location.lat },
            symbol: { 
                type: "simple-marker", 
                color: [13, 148, 136], 
                size: "14px", 
                outline: { color: [255, 255, 255], width: 3 } 
            }
          });
          markerRef.current = marker;
          layer.add(marker);

          // Interactive Selection
          view.on("click", async (event: any) => {
            // Use current local state ref to check editing status
            if (!mapDiv.current?.classList.contains('map-editing')) return;

            const lat = event.mapPoint.latitude;
            const lng = event.mapPoint.longitude;

            // Visual Update
            markerRef.current.geometry = event.mapPoint;
            setLocation({ lat, lng });

            // Reverse Geocode
            try {
              const response = await locator.locationToAddress("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer", {
                location: event.mapPoint
              });
              if (response && response.address) {
                setFormData(prev => ({ ...prev, address: response.address }));
              }
            } catch (err) {
              console.warn("Geocoding failed", err);
            }
          });

          view.when(() => setIsMapLoaded(true));
        });
      } catch (e) { console.error("ArcGIS Error", e); }
    };

    if (!viewRef.current) initMap();
    
    return () => { cleanup = true; };
  }, [location === null]); // Only run on first location set

  // Sync marker position when location changes (including initial load)
  useEffect(() => {
    if (markerRef.current && location && viewRef.current) {
      markerRef.current.geometry = { type: "point", longitude: location.lng, latitude: location.lat };
    }
  }, [location]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, avatar: reader.result as string }));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const confirmSave = async () => {
    if (!profileUser) return;
    setIsSaving(true);
    try {
        const updates: Partial<User> = {
            ...profileUser,
            name: formData.name,
            phone: formData.phone,
            jobTitle: formData.jobTitle,
            position: formData.position,
            avatar: formData.avatar,
            departmentId: formData.departmentId,
            workLocation: formData.workLocation,
            hireDate: formData.hireDate,
            bio: formData.bio
        } as any;
        
        if (location) {
            updates.location = { 
                latitude: location.lat, 
                longitude: location.lng, 
                address: formData.address 
            };
        }
        
        await updateUser(profileUser.id, updates);
        showToast("Profile records synchronized", "success");
        setIsEditMode(false);
    } catch (err) {
        showToast("Error updating profile", "error");
    } finally {
        setIsSaving(false);
        setShowConfirm(false);
    }
  };

  const InputField = ({ label, icon: Icon, value, onChange, disabled, type = "text", placeholder = "" }: any) => (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${disabled ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 shadow-sm'}`}>
        <Icon size={18} className={disabled ? 'text-slate-300' : 'text-slate-400'} />
        <input 
          type={type}
          disabled={disabled}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-transparent outline-none text-sm font-medium ${disabled ? 'text-slate-500' : 'text-slate-700 dark:text-slate-200'} placeholder-slate-400`}
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">My Profile</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Manage your personal and professional identity.</p>
        </div>
        <div className="flex gap-3">
          {!isEditMode ? (
            <button 
              onClick={() => setIsEditMode(true)}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-2xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all active:scale-95"
            >
              <Edit3 size={18} />
              <span>Modify Details</span>
            </button>
          ) : (
            <>
              <button 
                onClick={handleCancel}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
              >
                <X size={18} />
                <span>Cancel</span>
              </button>
              <button 
                onClick={() => setShowConfirm(true)}
                disabled={isSaving}
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <Clock className="animate-spin" size={18} /> : <Save size={18} />}
                <span>Confirm & Save</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center text-center">
            <div className="relative group mb-6">
                <div className={`w-32 h-32 rounded-full border-4 ${isEditMode ? 'border-teal-500/50 scale-105' : 'border-white dark:border-slate-900'} shadow-2xl overflow-hidden bg-slate-100 dark:bg-slate-700 transition-all`}>
                    <img src={formData.avatar} alt="" className="w-full h-full object-cover" />
                </div>
                {isEditMode && (
                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-1 right-1 bg-teal-600 text-white p-2.5 rounded-full shadow-lg hover:bg-teal-700 transition-transform hover:scale-110 active:scale-95 z-10"
                  >
                      <Camera size={18} />
                  </button>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </div>

            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight mb-1">{formData.name}</h3>
            <p className="text-teal-600 dark:text-teal-400 font-bold text-xs uppercase tracking-widest mb-4">{formData.position || 'Team Member'}</p>
            
            <div className="flex flex-wrap justify-center gap-2 mb-6">
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-[10px] font-black uppercase tracking-tighter border border-slate-200 dark:border-slate-600">{profileUser.role}</span>
                <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-tighter border border-emerald-100 dark:border-emerald-800">Verified</span>
            </div>

            <div className="w-full space-y-4 pt-6 border-t border-slate-100 dark:border-slate-700 text-left">
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400"><Mail size={16} /><span className="text-sm font-medium truncate">{formData.email}</span></div>
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400"><Hash size={16} /><span className="text-sm font-medium">EMP ID: {profileUser.employeeId}</span></div>
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400"><Calendar size={16} /><span className="text-sm font-medium">Joined {new Date(formData.hireDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span></div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><Globe size={16} className="text-teal-600" /> Work Location</h4>
                {isEditMode && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse uppercase tracking-widest border border-emerald-100">Interactive Selection Active</span>}
            </div>
            <div 
              ref={mapDiv} 
              className={`h-48 relative bg-slate-50 dark:bg-slate-900 transition-all ${isEditMode ? 'map-editing cursor-crosshair ring-2 ring-inset ring-teal-500/20' : ''}`}
            >
                {!isMapLoaded && <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-slate-800 z-20"><span className="text-[10px] font-bold text-slate-400 animate-pulse">Initializing Maps...</span></div>}
            </div>
            <div className="p-5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Registered Address</p>
                <div className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <MapPin size={16} className="shrink-0 mt-0.5 text-teal-600" />
                    <p className="leading-relaxed font-medium text-xs">{formData.address || 'No address provided'}</p>
                </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400"><UserIcon size={20} /></div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Profile Context</h3>
                    {!isEditMode && <span className="ml-auto text-[9px] font-black text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full uppercase tracking-widest">Locked Profile</span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label="Official Name" icon={UserIcon} value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} disabled={!canEditAdminFields} />
                    <InputField label="Direct Contact" icon={Phone} value={formData.phone} onChange={(v: string) => setFormData({...formData, phone: v})} placeholder="+1 (555) 000-0000" disabled={!canEditPersonalFields} />
                    <div className="md:col-span-2 space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Professional Bio</label>
                        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${!isEditMode ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-teal-500/20 shadow-sm'}`}>
                            <AlignLeft size={18} className="text-slate-400 mt-0.5" />
                            <textarea 
                                rows={3}
                                disabled={!canEditPersonalFields}
                                value={formData.bio}
                                onChange={e => setFormData({...formData, bio: e.target.value})}
                                placeholder="Describe your expertise and current focus..."
                                className="w-full bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 resize-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400"><Briefcase size={20} /></div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Organization & Role</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label="Job Title" icon={UserSquare} value={formData.position} onChange={(v: string) => setFormData({...formData, position: v})} disabled={!canEditAdminFields} />
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Department</label>
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${!canEditAdminFields ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-teal-500/20 shadow-sm'}`}>
                            <Building2 size={18} className={!canEditAdminFields ? 'text-slate-300' : 'text-slate-400'} />
                            <select 
                                disabled={!canEditAdminFields}
                                value={formData.departmentId}
                                onChange={e => setFormData({...formData, departmentId: e.target.value})}
                                className="w-full bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 appearance-none"
                            >
                                <option value="">General Allocation</option>
                                {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Working Model</label>
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${!isEditMode ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-teal-500/20 shadow-sm'}`}>
                            <Clock size={18} className="text-slate-400" />
                            <select 
                                disabled={!isEditMode}
                                value={formData.workLocation}
                                onChange={e => setFormData({...formData, workLocation: e.target.value})}
                                className="w-full bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 appearance-none"
                            >
                                {WORK_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                        </div>
                    </div>
                    <InputField label="Corporate Join Date" icon={Calendar} type="date" value={formData.hireDate} onChange={(v: string) => setFormData({...formData, hireDate: v})} disabled={!canEditAdminFields} />
                </div>
            </div>
        </div>
      </div>

      <DraggableModal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Validate Record Updates" width="max-w-md">
          <div className="text-center py-4">
              <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-teal-100 dark:border-teal-800 shadow-sm"><BadgeCheck className="text-teal-600" size={32} /></div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Sync Profile Records</h3>
              <p className="text-slate-500 text-sm px-4 leading-relaxed font-medium">Saving these changes will update your official employment record and synchronize your location coordinates for internal tracking.</p>
          </div>
          <div className="flex gap-3 mt-6 pt-6 border-t dark:border-slate-700">
              <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors">Discard</button>
              <button onClick={confirmSave} className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-teal-500/20 active:scale-95 transition-all">Save Changes</button>
          </div>
      </DraggableModal>
    </div>
  );
};

export default Profile;
