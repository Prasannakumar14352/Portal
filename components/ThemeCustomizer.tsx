
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Palette, Check, RefreshCw, Save } from 'lucide-react';

const ThemeCustomizer = () => {
  const { currentUser, updateUser, showToast } = useAppContext();
  const [primaryColor, setPrimaryColor] = useState('#7c3aed'); // Default Violet-600
  const [isSaving, setIsSaving] = useState(false);

  // Load existing preference
  useEffect(() => {
    if (currentUser?.settings?.branding?.primaryColor) {
      setPrimaryColor(currentUser.settings.branding.primaryColor);
    }
  }, [currentUser]);

  // Handle color change - preview instantly
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setPrimaryColor(color);
    // Apply immediately to root for preview
    applyTheme(color);
  };

  const resetToDefault = () => {
    const defaultColor = '#7c3aed';
    setPrimaryColor(defaultColor);
    applyTheme(defaultColor);
  };

  const saveTheme = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...currentUser.settings,
        notifications: currentUser.settings?.notifications || {
            emailLeaves: true, emailAttendance: false, pushWeb: true, pushMobile: false, systemAlerts: true
        },
        appConfig: currentUser.settings?.appConfig || {
            aiAssistant: true, azureSync: false, strictSso: false
        },
        branding: {
          primaryColor
        }
      };
      
      // Update User in DB
      await updateUser(currentUser.id, { settings: updatedSettings });
      
      // Force update of current user state (though updateUser context might handle it)
      showToast("Theme branding updated and saved.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to save theme settings.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Logic to generate Tailwind palette variables from a hex color
  // Simple algorithm to tint/shade relative to the picked color being the "600" shade (standard interactive)
  const applyTheme = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return;

    const root = document.documentElement;
    
    // We treat the picked color as primary-600.
    // Lighter shades (50-500) move towards white.
    // Darker shades (700-950) move towards black.
    
    root.style.setProperty('--primary-50', mix(rgb, {r:255,g:255,b:255}, 0.95));
    root.style.setProperty('--primary-100', mix(rgb, {r:255,g:255,b:255}, 0.9));
    root.style.setProperty('--primary-200', mix(rgb, {r:255,g:255,b:255}, 0.75));
    root.style.setProperty('--primary-300', mix(rgb, {r:255,g:255,b:255}, 0.6));
    root.style.setProperty('--primary-400', mix(rgb, {r:255,g:255,b:255}, 0.3));
    root.style.setProperty('--primary-500', mix(rgb, {r:255,g:255,b:255}, 0.1)); // Slightly lighter than base
    
    root.style.setProperty('--primary-600', `${rgb.r} ${rgb.g} ${rgb.b}`); // Base
    
    root.style.setProperty('--primary-700', mix(rgb, {r:0,g:0,b:0}, 0.1));
    root.style.setProperty('--primary-800', mix(rgb, {r:0,g:0,b:0}, 0.25));
    root.style.setProperty('--primary-900', mix(rgb, {r:0,g:0,b:0}, 0.45));
    root.style.setProperty('--primary-950', mix(rgb, {r:0,g:0,b:0}, 0.65));
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // Weight 0 = full color1, 1 = full color2
  const mix = (c1: any, c2: any, weight: number) => {
    const r = Math.round(c1.r * (1 - weight) + c2.r * weight);
    const g = Math.round(c1.g * (1 - weight) + c2.g * weight);
    const b = Math.round(c1.b * (1 - weight) + c2.b * weight);
    return `${r} ${g} ${b}`;
  };

  // Preview boxes
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6 border-l-4 border-l-primary-600">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-xl text-primary-600">
            <Palette size={20} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Brand Customization</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize the application's primary color theme.</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={resetToDefault} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Reset Default">
                <RefreshCw size={18} />
            </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="space-y-4 w-full md:w-auto">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Color</label>
              <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-lg ring-2 ring-slate-100 dark:ring-slate-700">
                      <input 
                        type="color" 
                        value={primaryColor} 
                        onChange={handleColorChange} 
                        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer border-none p-0 m-0"
                      />
                  </div>
                  <div className="flex flex-col">
                      <span className="font-mono text-sm font-bold text-slate-800 dark:text-white uppercase">{primaryColor}</span>
                      <span className="text-xs text-slate-400">Click swatch to change</span>
                  </div>
              </div>
              <button 
                onClick={saveTheme} 
                disabled={isSaving}
                className="mt-4 px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all active:scale-95 flex items-center gap-2"
              >
                  <Save size={16} /> {isSaving ? 'Saving...' : 'Save Theme'}
              </button>
          </div>

          <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Live Palette Preview</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
                  {shades.map(shade => (
                      <div key={shade} className="flex flex-col items-center gap-1">
                          <div className={`w-full aspect-square rounded-lg shadow-sm bg-primary-${shade} flex items-center justify-center`}>
                              {shade === 600 && <Check size={14} className="text-white drop-shadow-md" />}
                          </div>
                          <span className="text-[9px] font-mono text-slate-400">{shade}</span>
                      </div>
                  ))}
              </div>
              <div className="mt-6 p-4 rounded-xl bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/50 flex gap-4 items-center">
                  <div className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold shadow-md shadow-primary-500/30">
                      Primary Action
                  </div>
                  <div className="text-primary-700 dark:text-primary-300 font-medium text-sm">
                      This is how your text highlights will appear.
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ThemeCustomizer;
