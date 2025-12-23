
import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { UserRole, User } from '../types';
import { Save, MapPin, User as UserIcon, Mail, Phone, Briefcase, Camera, Calendar, AlertTriangle, Lock, Building2, CheckCircle2, ChevronDown, UserSquare } from 'lucide-react';

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
    projectIds: [] as string[],
    position: '' // Added position
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
        departmentId: String(currentUser.departmentId || ''),
        jobTitle: currentUser.jobTitle || '',
        hireDate: currentUser.hireDate || '',
        address: currentUser.location?.address || '',
        avatar: currentUser.avatar,
        workLocation: currentUser.workLocation || '',
        projectIds: (currentUser.projectIds || []).map(String),
        position: currentUser.position || '' // Added position
      });
      if (currentUser.location) {
        setLocation({ lat: currentUser.location.latitude, lng: currentUser.location.longitude });
      }
    }
  }, [currentUser]);

  // Permission Logic
  const isHR = currentUser?.role === UserRole.HR;
  const isSuperAdmin = currentUser?.id === 'super1' || currentUser?.email === 'superadmin@empower.com';
  const isSelf = true; 
  
  const canEditLocation = isHR || isSuperAdmin; 
  const canEditAvatar = isHR || isSelf;
  const canEditDetails = isHR; 
  const canEditAllocations = isHR; 

  // Load and Initialize ArcGIS Map omitted for brevity, same as previous

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
      updates.position = formData.position; // Added position
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

    updateUser(profileUser.id, updates);
    setTimeout(() => setIsSaving(false), 800);
  };

  if (!profileUser) return <div>Loading profile...</div>;

  const canSave = canEditDetails || canEditLocation || canEditAvatar || canEditAllocations;

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative animate-fade-in">
       {/* Confirmation Modal omitted */}

       {/* Header */}
       <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">My Profile</h2>
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
                   <h3 className="text-xl font-bold text-gray-800 dark:text-white leading-tight">{formData.name}</h3>
                   <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{formData.position || 'No Position Set'}</p>
                   <span className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider mt-2">{profileUser.role}</span>
                </div>

                <div className="space-y-4">
                   <div className="relative">
                     <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Full Name</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditDetails ? 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600' : 'bg-gray-100 dark:bg-slate-800 border-transparent'}`}>
                        <UserIcon size={16} className="text-gray-400 dark:text-slate-500" />
                        <input 
                          disabled={!canEditDetails}
                          type="text" 
                          className="bg-transparent w-full text-sm outline-none text-gray-700 dark:text-white" 
                          value={formData.name} 
                          onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                     </div>
                   </div>

                   <div className="relative">
                     <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Position</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditDetails ? 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600' : 'bg-gray-100 dark:bg-slate-800 border-transparent'}`}>
                        <UserSquare size={16} className="text-gray-400 dark:text-slate-500" />
                        <input 
                          disabled={!canEditDetails}
                          type="text" 
                          className="bg-transparent w-full text-sm outline-none text-gray-700 dark:text-white" 
                          placeholder="e.g. Lead Developer"
                          value={formData.position} 
                          onChange={e => setFormData({...formData, position: e.target.value})}
                        />
                     </div>
                   </div>

                   <div className="relative">
                     <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">System Role</label>
                     <div className={`flex items-center space-x-2 border rounded-lg px-3 py-2 ${canEditDetails ? 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600' : 'bg-gray-100 dark:bg-slate-800 border-transparent'}`}>
                        <Briefcase size={16} className="text-gray-400 dark:text-slate-500" />
                        <div className="relative w-full">
                          <select 
                            disabled={!canEditDetails}
                            className="bg-transparent w-full text-sm outline-none text-gray-700 dark:text-white appearance-none"
                            value={formData.jobTitle} 
                            onChange={e => setFormData({...formData, jobTitle: e.target.value})}
                          >
                             {roles.map(role => (
                               <option key={role.id} value={role.name}>{role.name}</option>
                             ))}
                          </select>
                        </div>
                     </div>
                   </div>
                   
                   {/* Rest of the fields omitted for brevity, same as previous */}
                </div>
             </div>
             {/* Contact Info Card omitted */}
          </div>
          {/* Map Section omitted */}
       </div>
    </div>
  );
};

export default Profile;
