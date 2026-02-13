
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, User } from '../types';
import { Save, MapPin, User as UserIcon, Mail, Phone, Briefcase, Camera, Calendar, AlertTriangle, UserSquare, Hash, AlignLeft, Globe, BadgeCheck, Clock, Edit3, X, Layers, Home } from 'lucide-react';
import DraggableModal from './DraggableModal';
import { loadModules } from 'esri-loader';

const WORK_LOCATIONS = [
  'Office HQ India',
  'WFH India',
  'UAE Office',
  'UAE Client Location',
  'USA Office',
  'Remote'
];

const Profile = () => {
  const { currentUser, updateUser, showToast, employees } = useAppContext();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    jobTitle: '',
    hireDate: '',
    address: '',
    avatar: '',
    workLocation: '',
    position: '',
    bio: ''
  });
  
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  
  // Track initial state for dirty checking
  const [initialData, setInitialData] = useState<{formData: any, location: any} | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const mapDiv = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  
  // Ref to access current isEditMode inside map callbacks without re-binding
  const isEditModeRef = useRef(isEditMode);

  useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);

  const isPowerUser = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR;

  const initializeFormData = (user: User) => {
    const employeeRecord = employees.find(e => String(e.id) === String(user.id));
    const nameParts = (user.name || '').split(' ');
    const fallbackFirst = nameParts[0] || '';
    const fallbackLast = nameParts.slice(1).join(' ') || '';

    const newFormData = {
      firstName: employeeRecord ? employeeRecord.firstName : fallbackFirst,
      lastName: employeeRecord ? employeeRecord.lastName : fallbackLast,
      email: user.email || '',
      phone: user.phone || '',
      jobTitle: user.jobTitle || '',
      hireDate: user.hireDate || '',
      address: user.location?.address || '',
      avatar: user.avatar || '',
      workLocation: user.workLocation || '',
      position: user.position || '',
      bio: (user as any).bio || 'Experienced professional at EmpowerCorp.'
    };

    let newLocation = null;
    if (user.location) {
      newLocation = { lat: user.location.latitude, lng: user.location.longitude };
    } else {
      newLocation = { lat: 20.5937, lng: 78.9629 };
    }

    setFormData(newFormData);
    setLocation(newLocation);
    setInitialData({ formData: newFormData, location: newLocation });
  };

  useEffect(() => {
    if (currentUser) {
      setProfileUser(currentUser);
      initializeFormData(currentUser);
    }
  }, [currentUser, employees]);

  // Determine if data has changed
  const isDirty = useMemo(() => {
    if (!initialData) return false;
    const formChanged = JSON.stringify(formData) !== JSON.stringify(initialData.formData);
    const locationChanged = JSON.stringify(location) !== JSON.stringify(initialData.location);
    return formChanged || locationChanged;
  }, [formData, location, initialData]);

  // Initialize Map
  useEffect(() => {
    if (!mapDiv.current) return;

    let view: any;

    loadModules(["esri/Map", "esri/views/MapView", "esri/Graphic", "esri/layers/GraphicsLayer"], { css: true })
      .then(([EsriMap, MapView, Graphic, GraphicsLayer]) => {
        const map = new EsriMap({
          basemap: "topo-vector" 
        });

        view = new MapView({
          container: mapDiv.current,
          map: map,
          center: [location?.lng || 78.9629, location?.lat || 20.5937],
          zoom: 4,
          ui: { components: ["zoom"] } 
        });

        const graphicsLayer = new GraphicsLayer();
        map.add(graphicsLayer);
        markerRef.current = graphicsLayer;
        viewRef.current = view;

        if (location) {
             const point = { type: "point", longitude: location.lng, latitude: location.lat };
             const markerSymbol = { type: "simple-marker", color: [0, 173, 239], outline: { color: [255, 255, 255], width: 2 } };
             const pointGraphic = new Graphic({ geometry: point, symbol: markerSymbol });
             graphicsLayer.add(pointGraphic);
             view.goTo({ target: point, zoom: 12 });
        }

        view.on("click", (event: any) => {
            if (!isEditModeRef.current) return; 
            
            const lat = event.mapPoint.latitude;
            const lng = event.mapPoint.longitude;
            
            setLocation({ lat, lng });
            
            graphicsLayer.removeAll();
            const point = { type: "point", longitude: lng, latitude: lat };
            const markerSymbol = { type: "simple-marker", color: [0, 173, 239], outline: { color: [255, 255, 255], width: 2 } };
            const pointGraphic = new Graphic({ geometry: point, symbol: markerSymbol });
            graphicsLayer.add(pointGraphic);
        });
      })
      .catch(err => console.error("ArcGIS Map Load Error:", err));

    return () => {
      if (view) view.destroy();
    };
  }, []); 

  useEffect(() => {
      if (viewRef.current && markerRef.current && location) {
          loadModules(["esri/Graphic"]).then(([Graphic]) => {
              markerRef.current.removeAll();
              const point = { type: "point", longitude: location.lng, latitude: location.lat };
              const markerSymbol = { type: "simple-marker", color: [0, 173, 239], outline: { color: [255, 255, 255], width: 2 } };
              const pointGraphic = new Graphic({ geometry: point, symbol: markerSymbol });
              markerRef.current.add(pointGraphic);
              viewRef.current.goTo({ target: point }, { duration: 1000 });
          });
      }
  }, [location]); 

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, avatar: reader.result as string }));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCancel = () => {
      if (initialData) {
          setFormData(initialData.formData);
          setLocation(initialData.location);
      }
      setIsEditMode(false);
  };

  const confirmSave = async () => {
    if (!profileUser) return;
    setIsSaving(true);
    try {
        const updates: Partial<User> = {
            ...profileUser,
            name: `${formData.firstName} ${formData.lastName}`,
            phone: formData.phone,
            jobTitle: formData.jobTitle,
            position: formData.position,
            avatar: formData.avatar,
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
        setInitialData({ formData: { ...formData }, location: { ...location } });
        showToast("Profile updated successfully", "success");
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
      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1 tracking-widest">{label}</label>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${disabled ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary-500/20 shadow-sm'}`}>
        <Icon size={18} className={disabled ? 'text-slate-300' : 'text-slate-400'} />
        <input type={type} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full bg-transparent outline-none text-sm font-medium ${disabled ? 'text-slate-500' : 'text-slate-700 dark:text-slate-200'}`} />
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase">My Profile</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Manage your personal and professional identity.</p>
        </div>
        <div className="flex gap-3">
          {!isEditMode ? (
            <button onClick={() => setIsEditMode(true)} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-2xl font-bold text-sm shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-700">
                <Edit3 size={18} /><span>Edit Profile</span>
            </button>
          ) : (
            <>
                <button onClick={handleCancel} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                    Cancel
                </button>
                {isDirty && (
                    <button onClick={() => setShowConfirm(true)} disabled={isSaving} className="flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-primary-500/20 hover:bg-primary-700 transition-all animate-in fade-in zoom-in duration-300">
                        {isSaving ? <Clock className="animate-spin" size={18} /> : <Save size={18} />}<span>Save Changes</span>
                    </button>
                )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-primary-600"></div>
            <div className="relative mb-6">
                <div className={`w-32 h-32 rounded-full border-4 ${isEditMode ? 'border-primary-500/50 scale-105' : 'border-white dark:border-slate-900'} shadow-2xl overflow-hidden bg-slate-100 dark:bg-slate-700 transition-all`}>
                    <img src={formData.avatar} alt="" className="w-full h-full object-cover" />
                </div>
                {/* Employee only allowed to change location and phone number. Avatar restriction enforced. */}
                {isEditMode && isPowerUser && (
                    <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 bg-primary-600 text-white p-2.5 rounded-full shadow-lg transition-transform z-10 hover:scale-110">
                        <Camera size={18} />
                    </button>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight mb-1">{formData.firstName} {formData.lastName}</h3>
            <p className="text-primary-600 dark:text-primary-400 font-bold text-xs uppercase tracking-widest mb-6">{formData.position || 'Team Member'}</p>
            
            <div className="w-full space-y-4 pt-6 border-t border-slate-100 dark:border-slate-700 text-left">
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                    <Mail size={16} className="shrink-0" /><span className="text-sm font-medium truncate">{formData.email}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                    <Hash size={16} className="shrink-0" /><span className="text-sm font-medium">EMP ID: {profileUser?.employeeId}</span>
                </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600"><UserIcon size={20} /></div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">General Information</h3>
                </div>
                {!isPowerUser && isEditMode && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 p-3 rounded-xl flex items-start gap-3">
                        <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Certain fields are restricted to HR/Admin updates only. You may update your phone and location.</p>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField label="First Name" icon={UserIcon} value={formData.firstName} onChange={(v: string) => setFormData({...formData, firstName: v})} disabled={!isEditMode || !isPowerUser} />
                  <InputField label="Last Name" icon={UserIcon} value={formData.lastName} onChange={(v: string) => setFormData({...formData, lastName: v})} disabled={!isEditMode || !isPowerUser} />
                  <InputField label="Phone Number" icon={Phone} value={formData.phone} onChange={(v: string) => setFormData({...formData, phone: v})} disabled={!isEditMode} />
                  <InputField label="Corporate Email" icon={Mail} value={formData.email} onChange={() => {}} disabled={true} />
                </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600"><Briefcase size={20} /></div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Employment Record</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label="Designation" icon={UserSquare} value={formData.position} onChange={(v: string) => setFormData({...formData, position: v})} disabled={!isEditMode || !isPowerUser} />
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Working Model</label>
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${(!isEditMode || !isPowerUser) ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100' : 'bg-white dark:bg-slate-800 border-slate-200 focus-within:ring-2 focus-within:ring-primary-500/20'}`}>
                            <Clock size={18} className="text-slate-400" />
                            <select 
                                disabled={!isEditMode || !isPowerUser} 
                                value={formData.workLocation} 
                                onChange={e => setFormData({...formData, workLocation: e.target.value})} 
                                className="w-full bg-transparent outline-none text-sm font-medium dark:text-slate-200 appearance-none disabled:text-slate-500"
                            >
                                {WORK_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                        </div>
                    </div>
                    <InputField label="Hire Date" icon={Calendar} type="date" value={formData.hireDate} onChange={(v: string) => setFormData({...formData, hireDate: v})} disabled={!isEditMode || !isPowerUser} />
                </div>
                <div className="space-y-1.5 pt-2">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1 tracking-widest">Professional Bio</label>
                    <textarea 
                      disabled={!isEditMode || !isPowerUser}
                      value={formData.bio}
                      onChange={e => setFormData({...formData, bio: e.target.value})}
                      rows={4}
                      className={`w-full p-4 rounded-xl border transition-all outline-none text-sm leading-relaxed ${(!isEditMode || !isPowerUser) ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 text-slate-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500/20 dark:text-slate-200'}`}
                      placeholder="Share your professional summary..."
                    />
                </div>
            </div>

            {/* Geographic Location Map */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600"><MapPin size={20} /></div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Primary Work Location</h3>
                    </div>
                    {isEditMode && <span className="text-[10px] font-bold text-primary-500 uppercase tracking-widest animate-pulse flex items-center gap-1"><MapPin size={12}/> Click map to update</span>}
                </div>
                
                <div className="h-80 w-full rounded-2xl overflow-hidden relative border border-slate-200 dark:border-slate-700 shadow-inner bg-slate-50 dark:bg-slate-900">
                    <div ref={mapDiv} className="w-full h-full" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <InputField label="Address Details" icon={Home} value={formData.address} onChange={(v: string) => setFormData({...formData, address: v})} disabled={!isEditMode} placeholder="Street, Building, City..." />
                    <div className="flex flex-col justify-end space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Coordinates</label>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span>LAT: <span className="font-bold text-slate-700 dark:text-slate-300">{location?.lat.toFixed(6)}</span></span>
                            <span className="w-px h-4 bg-slate-200 dark:bg-slate-700"></span>
                            <span>LNG: <span className="font-bold text-slate-700 dark:text-slate-300">{location?.lng.toFixed(6)}</span></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <DraggableModal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Confirm Profile Sync" width="max-w-md">
          <div className="text-center py-4">
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-primary-100 dark:border-primary-800">
                  <BadgeCheck className="text-primary-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Update Employee File?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm px-4">This will synchronize your changes with the central database.</p>
          </div>
          <div className="flex gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-700 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest">Discard</button>
              <button onClick={confirmSave} className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:bg-primary-700 active:scale-95 transition-all">Save Records</button>
          </div>
      </DraggableModal>
    </div>
  );
};

export default Profile;
