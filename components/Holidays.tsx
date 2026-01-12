
import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Calendar, Trash2, Plus, Info, Clock, PartyPopper, Calculator, CalendarDays, CalendarRange, FileSpreadsheet, UploadCloud, ChevronRight, Hash, Filter, CheckCircle2, MapPin } from 'lucide-react';
import { UserRole, Holiday } from '../types';
import DraggableModal from './DraggableModal';
import { read, utils } from 'xlsx';

const getDateParts = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { day: '?', month: '???', full: 'Invalid Date', dayName: '', dayOfWeek: -1, year: '?' };
    return {
        day: date.getDate(),
        month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
        full: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
        dayOfWeek: date.getDay(),
        year: date.getFullYear().toString()
    };
};

const isUpcoming = (dateStr: string) => {
    const hDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    return hDate >= today;
};

// Helper to map holiday names to images
const getHolidayImage = (name: string) => {
    const n = name.toLowerCase();
    // Sankranthi / Pongal / Lohri
    if (n.includes('sankranti') || n.includes('sankranthi') || n.includes('pongal') || n.includes('lohri')) {
        return 'https://images.unsplash.com/photo-1610996886915-c220df44b491?q=80&w=1000&auto=format&fit=crop'; // Kites/Harvest
    }
    // Republic Day / Independence Day (India/Generic Flags)
    if (n.includes('republic') || n.includes('independence')) {
        return 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?q=80&w=1000&auto=format&fit=crop'; // Tricolor/Flag
    }
    // Diwali
    if (n.includes('diwali') || n.includes('deepavali')) {
        return 'https://images.unsplash.com/photo-1572917730623-a0e231575747?q=80&w=1000&auto=format&fit=crop'; // Diya/Lights
    }
    // Holi
    if (n.includes('holi')) {
        return 'https://images.unsplash.com/photo-1552861268-2a9674092b77?q=80&w=1000&auto=format&fit=crop'; // Colors
    }
    // Christmas
    if (n.includes('christmas') || n.includes('xmas')) {
        return 'https://images.unsplash.com/photo-1544980219-9430b06e6f98?q=80&w=1000&auto=format&fit=crop'; // Tree/Decor
    }
    // New Year
    if (n.includes('new year')) {
        return 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?q=80&w=1000&auto=format&fit=crop'; // Fireworks
    }
    // Eid
    if (n.includes('eid') || n.includes('ramadan')) {
        return 'https://images.unsplash.com/photo-1526829777977-9bd72120b608?q=80&w=1000&auto=format&fit=crop'; // Lantern/Moon
    }
    // Shivratri
    if (n.includes('shivratri') || n.includes('shiva')) {
        return 'https://images.unsplash.com/photo-1616745873428-21d72379ae20?q=80&w=1000&auto=format&fit=crop'; // Spiritual/Temple
    }
    // Gandhi Jayanti
    if (n.includes('gandhi')) {
        return 'https://images.unsplash.com/photo-1566938064504-a63443722953?q=80&w=1000&auto=format&fit=crop'; // Spinning Wheel/Peace
    }
    // Thanksgiving
    if (n.includes('thanksgiving')) {
        return 'https://images.unsplash.com/photo-1509456592530-5d38e33f3fdd?q=80&w=1000&auto=format&fit=crop'; // Pumpkin/Autumn
    }
    // Default Celebration
    return 'https://images.unsplash.com/photo-1514565131-fce0801e5785?q=80&w=1000&auto=format&fit=crop'; 
};

interface HolidayCardProps { 
    holiday: Holiday; 
    compact?: boolean; 
    isHR: boolean; 
    onDelete: (id: string | number) => void;
    onClick: (holiday: Holiday) => void;
}

const HolidayCard: React.FC<HolidayCardProps> = ({ holiday, compact = false, isHR, onDelete, onClick }) => {
    const { day, month, dayName } = getDateParts(holiday.date);
    const upcoming = isUpcoming(holiday.date);
    const isPast = !upcoming;

    return (
      <div 
        onClick={() => onClick(holiday)}
        className={`
        rounded-xl border flex items-center justify-between transition-all group relative overflow-hidden select-none cursor-pointer
        ${compact ? 'p-4' : 'p-5'}
        ${isPast 
            ? 'bg-slate-50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800 opacity-60 grayscale-[0.8] hover:opacity-100 hover:grayscale-0' 
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-teal-200 dark:hover:border-teal-700 hover:-translate-y-0.5'
        }
      `}>
          <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={`
                flex flex-col items-center justify-center rounded-xl flex-shrink-0 border transition-colors
                ${compact ? 'w-12 h-12' : 'w-16 h-16'}
                ${isPast 
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700' 
                    : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50'
                }
              `}>
                  <span className="text-[10px] font-bold tracking-wider">{month}</span>
                  <span className={`${compact ? 'text-lg' : 'text-2xl'} font-bold leading-none`}>{day}</span>
              </div>
              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                      <h4 className={`${compact ? 'text-sm' : 'text-lg'} font-bold text-slate-800 dark:text-slate-100 truncate ${isPast ? 'line-through text-slate-500' : ''}`}>
                          {holiday.name}
                      </h4>
                      {upcoming && !compact && <span className="bg-slate-700 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold whitespace-nowrap">Upcoming</span>}
                      {isPast && !compact && <span className="bg-slate-200 text-slate-500 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold whitespace-nowrap flex items-center gap-1"><CheckCircle2 size={10} /> Done</span>}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium truncate">{dayName} • {holiday.type} Holiday</p>
              </div>
          </div>
          {!compact && isHR && (
              <div className={`flex gap-1 transition-opacity ${isPast ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'}`}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(holiday.id); }} 
                    className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    <Trash2 size={18} />
                  </button>
              </div>
          )}
      </div>
    );
};

const Holidays = () => {
  const { holidays, addHoliday, addHolidays, deleteHoliday, currentUser, showToast } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [viewHoliday, setViewHoliday] = useState<Holiday | null>(null);
  
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', type: 'Public' as 'Public' | 'Company' });
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHR = currentUser?.role === UserRole.HR;

  // Group and Filter by Year
  const groupedHolidays = useMemo(() => {
    const sorted = [...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const groups: Record<string, Holiday[]> = {};
    
    sorted.forEach(h => {
        const year = new Date(h.date).getFullYear().toString();
        if (!groups[year]) groups[year] = [];
        groups[year].push(h);
    });
    
    return groups;
  }, [holidays]);

  // Changed to Ascending Order as per user request
  const allAvailableYears = useMemo(() => 
    Object.keys(groupedHolidays).sort((a, b) => parseInt(a) - parseInt(b)), 
    [groupedHolidays]
  );

  const filteredYears = useMemo(() => {
    if (selectedYear === 'All') return allAvailableYears;
    return allAvailableYears.filter(y => y === selectedYear);
  }, [allAvailableYears, selectedYear]);

  const upcomingHolidays = useMemo(() => 
    [...holidays]
      .filter(h => isUpcoming(h.date))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [holidays]
  );

  const nextHoliday = upcomingHolidays[0];

  const analyticsYear = selectedYear === 'All' ? new Date().getFullYear().toString() : selectedYear;

  const currentYearStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const targetYearNum = parseInt(analyticsYear);
    
    const yearHolidays = holidays.filter(h => new Date(h.date).getFullYear() === targetYearNum);
    
    return {
      year: analyticsYear,
      total: yearHolidays.length,
      upcoming: yearHolidays.filter(h => isUpcoming(h.date)).length,
      thisMonth: yearHolidays.filter(h => {
        const d = new Date(h.date);
        return d.getMonth() === currentMonth;
      }).length,
      weekdays: yearHolidays.filter(h => {
        const day = new Date(h.date).getDay();
        return day >= 1 && day <= 5;
      }).length,
      weekends: yearHolidays.filter(h => {
        const day = new Date(h.date).getDay();
        return day === 0 || day === 6;
      }).length
    };
  }, [holidays, analyticsYear]);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      addHoliday({
        ...newHoliday
      });
      setShowModal(false);
      setNewHoliday({ name: '', date: '', type: 'Public' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet) as any[];

      const mappedHolidays = jsonData.map(row => {
        let dateValue = row.Date;
        if (typeof dateValue === 'number') {
            const date = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
            dateValue = date.toISOString().split('T')[0];
        } else if (dateValue) {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
                dateValue = d.toISOString().split('T')[0];
            }
        }

        return {
          name: row.Holiday || 'Unnamed Holiday',
          date: dateValue || new Date().toISOString().split('T')[0],
          type: 'Public' as const
        };
      });

      if (mappedHolidays.length > 0) {
        await addHolidays(mappedHolidays);
        showToast(`Successfully imported ${mappedHolidays.length} holidays`, 'success');
      } else {
        showToast('No valid holiday records found in file', 'warning');
      }
    } catch (error) {
      console.error('Excel Import Error:', error);
      showToast('Failed to parse Excel file. Ensure it matches the required format.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Holidays</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">View company holidays by year and plan your time off</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                  <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none w-full shadow-sm"
                  >
                      <option value="All">All Years</option>
                      {allAvailableYears.map(y => <option key={y} value={y}>{y}</option>)}
                      {!allAvailableYears.includes(new Date().getFullYear().toString()) && (
                        <option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</option>
                      )}
                  </select>
              </div>
              {isHR && (
                <div className="flex gap-2 w-full md:w-auto">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm font-medium text-sm">
                        <UploadCloud size={16} /> <span className="hidden sm:inline">Import</span>
                    </button>
                    <button onClick={() => setShowModal(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm font-medium text-sm">
                        <Plus size={16} /> <span className="hidden sm:inline">Add Holiday</span>
                    </button>
                </div>
              )}
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Main Column - Grouped Holiday List */}
           <div className="lg:col-span-2 space-y-6">
               <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                 <Calendar className="text-emerald-600" size={20} />
                 {selectedYear === 'All' ? 'All Scheduled Holidays' : `${selectedYear} Scheduled Holidays`}
               </h3>
               
               {filteredYears.length === 0 ? (
                 <div className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
                    <Calendar className="mx-auto text-slate-300 mb-3" size={40} />
                    <p className="text-slate-500 font-medium">No holidays scheduled for this period.</p>
                 </div>
               ) : (
                 <div className="max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar space-y-8 pb-10">
                    {filteredYears.map(year => (
                        <div key={year} className="space-y-4">
                            <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 py-2">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl font-black text-slate-300 dark:text-slate-700">{year}</span>
                                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{groupedHolidays[year]?.length || 0} Holidays</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {groupedHolidays[year]?.map(holiday => (
                                    <HolidayCard 
                                        key={holiday.id} 
                                        holiday={holiday} 
                                        isHR={isHR} 
                                        onDelete={deleteHoliday} 
                                        onClick={(h) => setViewHoliday(h)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                 </div>
               )}
           </div>

           {/* Side Column - Metrics and Insights */}
           <div className="space-y-6">
               {/* Next Holiday Card */}
               {nextHoliday && (
                 <div 
                    onClick={() => setViewHoliday(nextHoliday)}
                    className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all hover:scale-[1.02]"
                 >
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <PartyPopper size={18} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Coming Up Next</span>
                        </div>
                        <h4 className="text-2xl font-bold mb-1 leading-tight">{nextHoliday.name}</h4>
                        <p className="text-emerald-100 text-sm font-medium flex items-center gap-2">
                           <Clock size={14} />
                           {new Date(nextHoliday.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                 </div>
               )}

               {/* Calendar Summary Dashboard */}
               <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <Calculator size={14} className="text-emerald-600" />
                    {currentYearStats.year} Holiday Analytics
                  </h4>
                  <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Total Holidays</span>
                          <span className="font-bold text-slate-800 dark:text-white text-lg">{currentYearStats.total}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Remaining</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{currentYearStats.upcoming}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                          <span className="text-sm text-slate-600 dark:text-slate-400">This Month</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">{currentYearStats.thisMonth}</span>
                      </div>
                  </div>
               </div>

               {/* Weekday vs Weekend cards */}
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                          <CalendarDays size={16} className="text-blue-600 dark:text-blue-400" />
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-tighter">Weekdays</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-800 dark:text-blue-100">{currentYearStats.weekdays}</div>
                      <p className="text-[10px] text-blue-600/60 dark:text-blue-400/60 mt-1 font-medium">Mon - Fri</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30 p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                          <CalendarRange size={16} className="text-amber-600 dark:text-amber-400" />
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-tighter">Weekends</span>
                      </div>
                      <div className="text-2xl font-bold text-amber-800 dark:text-amber-100">{currentYearStats.weekends}</div>
                      <p className="text-[10px] text-amber-600/60 dark:text-amber-400/60 mt-1 font-medium">Sat & Sun</p>
                  </div>
               </div>

               {/* Excel Import Guide */}
               {isHR && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 p-5 shadow-sm">
                   <div className="flex items-center gap-2 mb-3">
                      <FileSpreadsheet size={16} className="text-emerald-600" />
                      <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Excel Import Guide</h4>
                   </div>
                   <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mb-4 leading-relaxed">
                      All imports are set as <strong>Public</strong>. Use the following columns:
                   </p>
                   <div className="bg-white dark:bg-slate-800 rounded-lg border border-emerald-100 dark:border-emerald-700 overflow-hidden text-[10px]">
                      <table className="w-full text-left">
                        <thead>
                           <tr className="bg-emerald-100/50 dark:bg-emerald-900/40 border-b border-emerald-100 font-bold text-emerald-800 dark:text-emerald-200">
                              <th className="px-2 py-1.5 border-r border-emerald-100 dark:border-emerald-700">Holiday</th>
                              <th className="px-2 py-1.5 border-r border-emerald-100 dark:border-emerald-700">Date</th>
                              <th className="px-2 py-1.5">Day</th>
                           </tr>
                        </thead>
                        <tbody className="text-slate-600 dark:text-slate-400">
                           <tr className="border-b border-slate-50 dark:border-slate-700">
                              <td className="px-2 py-1.5 border-r border-slate-50">Christmas</td>
                              <td className="px-2 py-1.5 border-r border-slate-50">2025-12-25</td>
                              <td className="px-2 py-1.5">Thursday</td>
                           </tr>
                        </tbody>
                      </table>
                   </div>
                </div>
               )}

               {/* Info Card */}
               <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex items-start gap-3">
                      <Info className="text-slate-400 mt-0.5 shrink-0" size={18} />
                      <div>
                          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Holiday Policy</h4>
                          <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2 list-disc pl-4 leading-relaxed">
                              <li>Public holidays follow regional updates.</li>
                              <li>Weekend holidays don't carry over unless notified.</li>
                          </ul>
                      </div>
                  </div>
               </div>
           </div>
       </div>

       <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Holiday" width="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 uppercase mb-1">Name</label>
                  <input required type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="e.g. Independence Day" value={newHoliday.name} onChange={e => setNewHoliday({...newHoliday, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 uppercase mb-1">Date</label>
                  <input required type="date" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={newHoliday.date} onChange={e => setNewHoliday({...newHoliday, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 uppercase mb-1">Type</label>
                  <select className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={newHoliday.type} onChange={e => setNewHoliday({...newHoliday, type: e.target.value as any})}>
                    <option value="Public">Public Holiday</option>
                    <option value="Company">Company Holiday</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 text-sm font-bold">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 transition">Save Holiday</button>
                </div>
            </form>
       </DraggableModal>

       {/* View Holiday Image Modal */}
       <DraggableModal isOpen={!!viewHoliday} onClose={() => setViewHoliday(null)} title={viewHoliday?.name || 'Holiday'} width="max-w-lg">
            {viewHoliday && (
                <div className="space-y-5">
                    <div className="w-full h-56 rounded-2xl overflow-hidden shadow-lg relative bg-slate-100 dark:bg-slate-900 group">
                        <img 
                            src={getHolidayImage(viewHoliday.name)} 
                            alt={viewHoliday.name} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                        <div className="absolute bottom-4 left-5 text-white">
                            <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1 flex items-center gap-1.5"><Calendar size={12}/> {new Date(viewHoliday.date).getFullYear()}</p>
                            <h3 className="text-2xl font-bold leading-tight">{viewHoliday.name}</h3>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <CalendarDays size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                    {getDateParts(viewHoliday.date).full}
                                </p>
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <PartyPopper size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Type</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{viewHoliday.type} Holiday</p>
                            </div>
                        </div>
                    </div>

                    {isUpcoming(viewHoliday.date) ? (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl text-center">
                            <p className="text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center justify-center gap-2">
                                <Clock size={16} /> This holiday is upcoming. Plan ahead!
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-center">
                            <p className="text-slate-500 text-sm font-medium flex items-center justify-center gap-2">
                                <CheckCircle2 size={16} /> This holiday has passed.
                            </p>
                        </div>
                    )}
                </div>
            )}
       </DraggableModal>
    </div>
  );
};

export default Holidays;
