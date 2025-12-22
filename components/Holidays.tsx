
import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Calendar, Trash2, Plus, Edit2, UploadCloud, FileSpreadsheet, Info, Sun, Moon, ChevronDown, X, Clock, PartyPopper, BookOpen } from 'lucide-react';
import { UserRole, Holiday } from '../types';
import { read, utils } from 'xlsx';
import DraggableModal from './DraggableModal';

const getDateParts = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { day: '?', month: '???', full: 'Invalid Date', dayName: '' };
    return {
        day: date.getDate(),
        month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
        full: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        dayName: date.toLocaleDateString('en-US', { weekday: 'long' })
    };
};

const isUpcoming = (dateStr: string) => {
    const hDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    return hDate >= today;
};

const HolidayCard: React.FC<{ holiday: Holiday, compact?: boolean, isHR: boolean, onDelete: (id: string | number) => void }> = ({ holiday, compact = false, isHR, onDelete }) => {
    const { day, month, dayName } = getDateParts(holiday.date);
    const upcoming = isUpcoming(holiday.date);

    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:shadow-md transition group ${compact ? 'p-4' : 'p-5'}`}>
          <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={`flex flex-col items-center justify-center text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 rounded-xl flex-shrink-0 ${compact ? 'w-12 h-12' : 'w-16 h-16'}`}>
                  <span className="text-[10px] font-bold tracking-wider">{month}</span>
                  <span className={`${compact ? 'text-lg' : 'text-2xl'} font-bold leading-none`}>{day}</span>
              </div>
              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                      <h4 className={`${compact ? 'text-sm' : 'text-lg'} font-bold text-slate-800 dark:text-slate-100 truncate`}>{holiday.name}</h4>
                      {upcoming && !compact && <span className="bg-slate-700 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold whitespace-nowrap">Upcoming</span>}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium truncate">{dayName} • {holiday.type} Holiday</p>
              </div>
          </div>
          {!compact && isHR && (
              <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onDelete(holiday.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition"><Trash2 size={18} /></button>
              </div>
          )}
      </div>
    );
};

const Holidays = () => {
  const { holidays, addHoliday, deleteHoliday, currentUser } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', type: 'Public' as 'Public' | 'Company' });

  const isHR = currentUser?.role === UserRole.HR;

  const sortedHolidays = useMemo(() => 
    [...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [holidays]
  );

  const upcomingHolidays = useMemo(() => 
    sortedHolidays.filter(h => isUpcoming(h.date)),
    [sortedHolidays]
  );

  const nextHoliday = upcomingHolidays[0];

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const thisYearHolidays = holidays.filter(h => new Date(h.date).getFullYear() === currentYear);
    return {
      public: thisYearHolidays.filter(h => h.type === 'Public').length,
      company: thisYearHolidays.filter(h => h.type === 'Company').length,
      remaining: upcomingHolidays.length
    };
  }, [holidays, upcomingHolidays]);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      addHoliday({
        ...newHoliday,
        id: Math.random().toString(36).substr(2, 9)
      });
      setShowModal(false);
      setNewHoliday({ name: '', date: '', type: 'Public' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Holidays</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">View company holidays and plan your time off</p>
          </div>
          {isHR && (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm font-medium text-sm">
                <Plus size={16} /> Add Holiday
            </button>
          )}
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Main Column - Holiday List */}
           <div className="lg:col-span-2 space-y-4">
               <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                 <Calendar className="text-emerald-600" size={20} />
                 All Scheduled Holidays
               </h3>
               {sortedHolidays.length === 0 ? (
                 <div className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
                    <Calendar className="mx-auto text-slate-300 mb-3" size={40} />
                    <p className="text-slate-500 font-medium">No holidays scheduled yet.</p>
                 </div>
               ) : (
                 <div className="space-y-4">
                    {sortedHolidays.map(holiday => (
                        <HolidayCard key={holiday.id} holiday={holiday} isHR={isHR} onDelete={deleteHoliday} />
                    ))}
                 </div>
               )}
           </div>

           {/* Side Column - Insights and Next Holiday */}
           <div className="space-y-6">
               {/* Next Holiday Card */}
               {nextHoliday && (
                 <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200 dark:shadow-none relative overflow-hidden group transition-transform hover:scale-[1.02]">
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <PartyPopper size={18} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider opacity-90">Coming Up Next</span>
                        </div>
                        <h4 className="text-2xl font-bold mb-1">{nextHoliday.name}</h4>
                        <p className="text-emerald-100 text-sm font-medium flex items-center gap-2">
                           <Clock size={14} />
                           {new Date(nextHoliday.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'long' })}
                        </p>
                    </div>
                 </div>
               )}

               {/* Summary Stats */}
               <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                    <BookOpen size={16} className="text-emerald-600" />
                    2025 Calendar Summary
                  </h4>
                  <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Public Holidays</span>
                          <span className="font-bold text-slate-800 dark:text-white">{stats.public}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Company Holidays</span>
                          <span className="font-bold text-slate-800 dark:text-white">{stats.company}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                          <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Remaining Holidays</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">{stats.remaining}</span>
                      </div>
                  </div>
               </div>

               {/* Info Card */}
               <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 p-6">
                  <div className="flex items-start gap-3">
                      <Info className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" size={18} />
                      <div>
                          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-2">Holiday Policy</h4>
                          <ul className="text-xs text-blue-700 dark:text-blue-200 space-y-2 list-disc pl-4">
                              <li>Public holidays are observed based on regional calendar.</li>
                              <li>Company holidays are fixed corporate off-days.</li>
                              <li>If a holiday falls on a weekend, no compensatory off is provided unless announced.</li>
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
    </div>
  );
};

export default Holidays;
