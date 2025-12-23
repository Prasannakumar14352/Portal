import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Calendar, Trash2, Plus, Info, Clock, PartyPopper, Calculator, CalendarDays, CalendarRange, FileSpreadsheet, UploadCloud, ChevronRight, Hash, Filter } from 'lucide-react';
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
  const { holidays, addHoliday, addHolidays, deleteHoliday, currentUser, showToast } = useAppContext();
  const [showModal, setShowModal] = useState(false);
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
      // Fix: addHoliday expects Omit<Holiday, 'id'>, ID is generated in AppContext
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
                                    <HolidayCard key={holiday.id} holiday={holiday} isHR={isHR} onDelete={deleteHoliday} />
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
                 <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
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
    </div>
  );
};

export default Holidays;