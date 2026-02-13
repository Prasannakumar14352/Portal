
import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Calendar, Trash2, Plus, Info, Clock, PartyPopper, Calculator, CalendarDays, CalendarRange, FileSpreadsheet, UploadCloud, ChevronRight, Hash, Filter, CheckCircle2, MapPin, X, ArrowRight, Briefcase } from 'lucide-react';
import { UserRole, Holiday } from '../types';
import DraggableModal from './DraggableModal';
import { read, utils } from 'xlsx';

// ... (Keep Helper functions: getDateParts, isUpcoming) ...
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

interface TimelineItemProps { 
    holiday: Holiday; 
    isHR: boolean; 
    onDelete: (id: string | number) => void;
    isLast: boolean;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ holiday, isHR, onDelete, isLast }) => {
    const { day, month, dayName } = getDateParts(holiday.date);
    const upcoming = isUpcoming(holiday.date);
    const isPast = !upcoming;

    return (
        <div className={`relative pl-8 pb-8 ${isLast ? '' : 'border-l-2'} ${isPast ? 'border-slate-200 dark:border-slate-800' : 'border-emerald-500/30 dark:border-emerald-500/30'}`}>
            <div className={`absolute -left-[9px] top-0 w-[18px] h-[18px] rounded-full border-4 ${isPast ? 'bg-slate-300 border-white dark:bg-slate-700 dark:border-slate-900' : 'bg-emerald-500 border-white dark:border-slate-900 shadow-lg shadow-emerald-500/40'}`}></div>
            <div className={`group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md ${isPast ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 opacity-70 grayscale' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border ${isPast ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{month}</span>
                    <span className="text-2xl font-black leading-none">{day}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-bold text-slate-800 dark:text-white truncate">{holiday.name}</h4>
                        {upcoming && <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Upcoming</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5"><Calendar size={12}/> {dayName}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span className="flex items-center gap-1.5">
                            {holiday.type === 'Public' ? <PartyPopper size={12} className="text-amber-500"/> : <Briefcase size={12} className="text-blue-500"/>}
                            {holiday.type} Holiday
                        </span>
                    </div>
                </div>
                {isHR && (
                    <button onClick={() => onDelete(holiday.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100" title="Delete Holiday">
                        <Trash2 size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

const Holidays = () => {
  const { holidays, addHoliday, addHolidays, deleteHoliday, currentUser, showToast } = useAppContext();
  // ... (Keep existing state) ...
  const [showModal, setShowModal] = useState(false);
  const [filterModal, setFilterModal] = useState<{ isOpen: boolean; title: string; list: Holiday[] }>({ isOpen: false, title: '', list: [] });
  
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', type: 'Public' as 'Public' | 'Company' });
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHR = currentUser?.role === UserRole.HR;

  // ... (Keep existing useMemos: sortedHolidays, allAvailableYears, filteredList, stats) ...
  const sortedHolidays = useMemo(() => {
      return [...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [holidays]);

  const allAvailableYears = useMemo(() => {
      const years = new Set(sortedHolidays.map(h => new Date(h.date).getFullYear().toString()));
      years.add(new Date().getFullYear().toString());
      return Array.from(years).sort((a: string, b: string) => parseInt(a) - parseInt(b));
  }, [sortedHolidays]);

  const filteredList = useMemo(() => {
      if (selectedYear === 'All') return sortedHolidays;
      return sortedHolidays.filter(h => new Date(h.date).getFullYear().toString() === selectedYear);
  }, [sortedHolidays, selectedYear]);

  const stats = useMemo(() => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const total = filteredList.length;
      const passed = filteredList.filter(h => new Date(h.date) < today).length;
      const upcoming = total - passed;
      const weekdays = filteredList.filter(h => { const d = new Date(h.date).getDay(); return d > 0 && d < 6; });
      const weekends = filteredList.filter(h => { const d = new Date(h.date).getDay(); return d === 0 || d === 6; });
      const nextOne = sortedHolidays.find(h => isUpcoming(h.date));
      return { total, passed, upcoming, weekdays, weekends, nextOne };
  }, [filteredList, sortedHolidays]);

  // ... (Keep Handlers) ...
  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      addHoliday({ ...newHoliday, id: Math.random().toString(36).substr(2, 9) });
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
      const jsonData = utils.sheet_to_json(worksheet as any) as any[];
      const mappedHolidays: Holiday[] = jsonData.map(row => {
        let dateValue = row.Date;
        if (typeof dateValue === 'number') {
            const date = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
            dateValue = date.toISOString().split('T')[0];
        } else if (dateValue) {
            const d = new Date(String(dateValue));
            if (!isNaN(d.getTime())) dateValue = d.toISOString().split('T')[0];
        }
        return {
          id: Math.random().toString(36).substr(2, 9),
          name: row.Holiday || 'Unnamed Holiday',
          date: (typeof dateValue === 'string' ? dateValue : new Date().toISOString().split('T')[0]),
          type: 'Public' as const
        };
      });
      if (mappedHolidays.length > 0) {
        await addHolidays(mappedHolidays);
        showToast(`Imported ${mappedHolidays.length} holidays`, 'success');
      }
    } catch (error) {
      showToast('Import failed. Check format.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openFilterModal = (title: string, list: Holiday[]) => {
      const sorted = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setFilterModal({ isOpen: true, title, list: sorted });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 dark:border-slate-700 pb-6">
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Holiday Calendar</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Plan your year ahead with the company schedule.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <div className="relative">
                  <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full sm:w-auto pl-10 pr-8 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none cursor-pointer"
                  >
                      <option value="All">All Years</option>
                      {allAvailableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronRight size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
              </div>
              
              {isHR && (
                <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all shadow-sm">
                        <UploadCloud size={18} /> <span className="hidden sm:inline">Import</span>
                    </button>
                    <button onClick={() => setShowModal(true)} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary-500/20 active:scale-95">
                        <Plus size={18} /> <span>Add Event</span>
                    </button>
                </div>
              )}
          </div>
       </div>

       {/* ... (Timeline and Stats display - keep structure, replace colors where necessary if hardcoded to teal/blue, mostly using semantic colors for status is fine) ... */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2">
               <div className="mb-6 flex items-center gap-3">
                   <div className="h-8 w-1 bg-primary-500 rounded-full"></div>
                   <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                       {selectedYear === 'All' ? 'All Events' : `${selectedYear} Timeline`}
                   </h3>
                   <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold px-2 py-1 rounded-md">
                       {filteredList.length} Entries
                   </span>
               </div>

               <div className="bg-white dark:bg-slate-800/50 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[400px]">
                   {filteredList.length === 0 ? (
                       <div className="flex flex-col items-center justify-center h-64 text-center">
                           <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                               <CalendarRange className="text-slate-300" size={32} />
                           </div>
                           <p className="text-slate-500 dark:text-slate-400 font-medium">No holidays scheduled for {selectedYear}.</p>
                       </div>
                   ) : (
                       <div className="pt-2">
                           {filteredList.map((holiday, index) => (
                               <TimelineItem 
                                   key={holiday.id} 
                                   holiday={holiday} 
                                   isHR={isHR} 
                                   onDelete={deleteHoliday}
                                   isLast={index === filteredList.length - 1}
                               />
                           ))}
                       </div>
                   )}
               </div>
           </div>

           <div className="space-y-6">
                {stats.nextOne && (
                    <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-6">
                                <span className="bg-white/20 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded">Next Up</span>
                            </div>
                            <h3 className="text-3xl font-black mb-1 leading-tight">{stats.nextOne.name}</h3>
                            <div className="flex items-center gap-2 text-primary-100 font-medium mt-2">
                                <Clock size={16} />
                                <span>{new Date(stats.nextOne.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* ... Stats boxes (Total, Completed) - Semantic colors OK ... */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between h-32">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 w-fit rounded-xl text-blue-600"><Calculator size={20} /></div>
                        <div>
                            <span className="text-2xl font-black text-slate-800 dark:text-white">{stats.total}</span>
                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Events</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between h-32">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 w-fit rounded-xl text-emerald-600"><CheckCircle2 size={20} /></div>
                        <div>
                            <span className="text-2xl font-black text-slate-800 dark:text-white">{stats.passed}</span>
                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Completed</p>
                        </div>
                    </div>
                </div>

                {/* Quick Views */}
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-6 border border-slate-200 dark:border-slate-700">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-4">Quick Views</h4>
                    <div className="space-y-3">
                        <button onClick={() => openFilterModal(`Weekdays (${stats.weekdays.length})`, stats.weekdays)} className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary-500 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600"><CalendarDays size={18} /></div>
                                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Weekdays</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 dark:text-white">{stats.weekdays.length}</span>
                                <ArrowRight size={14} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                            </div>
                        </button>
                        
                        <button onClick={() => openFilterModal(`Weekends (${stats.weekends.length})`, stats.weekends)} className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary-500 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600"><CalendarRange size={18} /></div>
                                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Weekends</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 dark:text-white">{stats.weekends.length}</span>
                                <ArrowRight size={14} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                            </div>
                        </button>
                    </div>
                </div>
           </div>
       </div>

       <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title="New Event" width="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Event Name</label>
                  <input required type="text" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" placeholder="e.g. Founder's Day" value={newHoliday.name} onChange={e => setNewHoliday({...newHoliday, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Date</label>
                  <input required type="date" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" value={newHoliday.date} onChange={e => setNewHoliday({...newHoliday, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Category</label>
                  <select className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" value={newHoliday.type} onChange={e => setNewHoliday({...newHoliday, type: e.target.value as any})}>
                    <option value="Public">Public Holiday</option>
                    <option value="Company">Company Event</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-slate-500 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" className="px-8 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all active:scale-95">Save</button>
                </div>
            </form>
       </DraggableModal>

       <DraggableModal isOpen={filterModal.isOpen} onClose={() => setFilterModal({ ...filterModal, isOpen: false })} title={filterModal.title} width="max-w-md">
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {filterModal.list.length > 0 ? (
                    filterModal.list.map(h => {
                        const d = getDateParts(h.date);
                        return (
                            <div key={h.id} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <div className="text-center w-12 shrink-0">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase">{d.month}</span>
                                    <span className="block text-xl font-black text-slate-800 dark:text-white">{d.day}</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">{h.name}</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">{d.dayName} • {d.year}</p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-12 text-slate-400">
                        <CalendarRange size={32} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">No holidays found in this category.</p>
                    </div>
                )}
            </div>
       </DraggableModal>
    </div>
  );
};

export default Holidays;
