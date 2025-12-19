
import React, { useState, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Calendar, Trash2, Plus, Edit2, UploadCloud, FileSpreadsheet, Info, Sun, Moon, ChevronDown, X } from 'lucide-react';
import { UserRole, Holiday } from '../types';
import { read, utils } from 'xlsx';

const getDateParts = (dateStr: string) => {
    // Attempt to handle different date formats gracefully
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
         return { day: '?', month: '???', full: 'Invalid Date', dayName: '' };
    }
    
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

const HolidayCard: React.FC<{ holiday: Holiday, compact?: boolean, isHR: boolean, onDelete: (id: string) => void }> = ({ holiday, compact = false, isHR, onDelete }) => {
    const { day, month, dayName } = getDateParts(holiday.date);
    const upcoming = isUpcoming(holiday.date);

    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:shadow-md transition group ${compact ? 'p-4' : 'p-5'}`}>
          <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Date Box */}
              <div className={`flex flex-col items-center justify-center text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 rounded-xl flex-shrink-0 ${compact ? 'w-14 h-14' : 'w-16 h-16'}`}>
                  <span className="text-xs font-bold tracking-wider">{month}</span>
                  <span className={`${compact ? 'text-xl' : 'text-2xl'} font-bold leading-none`}>{day}</span>
              </div>
              
              {/* Details */}
              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                      <h4 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-slate-800 dark:text-slate-100 truncate`}>{holiday.name}</h4>
                      {upcoming && (
                          <span className="bg-slate-700 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold whitespace-nowrap flex-shrink-0">Upcoming</span>
                      )}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium truncate">
                      {dayName} • <span className="text-slate-400 dark:text-slate-500 font-normal">{holiday.type} Holiday</span>
                  </p>
                  {!compact && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
                          {holiday.type === 'Public' ? 'National observance' : 'Company observance'}
                      </p>
                  )}
              </div>
          </div>

          {/* Actions (Only in full view and if HR) */}
          {!compact && isHR && (
              <div className="flex gap-1 ml-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <button className="p-2 text-slate-400 hover:text-emerald-600 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition" title="Edit">
                      <Edit2 size={18} />
                  </button>
                  <button onClick={() => onDelete(holiday.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition" title="Delete">
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
  const [showImportInfo, setShowImportInfo] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', type: 'Public' as 'Public' | 'Company' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHR = currentUser?.role === UserRole.HR;
  const currentYear = new Date().getFullYear();

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      addHoliday(newHoliday);
      setShowModal(false);
      setNewHoliday({ name: '', date: '', type: 'Public' });
  };

  // Excel Import Handler
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !e.target.files[0]) return;
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const data = utils.sheet_to_json(ws);
              const validHolidays: Omit<Holiday, 'id'>[] = [];
              let skippedCount = 0;
              for (const row of (data as any[])) {
                  const holidayName = row.HolidayName || row.Name;
                  const holidayDateRaw = row.HolidayDate || row.Date;
                  const holidayType = row.Type;
                  if (holidayName && holidayDateRaw) {
                      let dateStr = holidayDateRaw;
                      if (typeof holidayDateRaw === 'number') {
                          const excelDate = new Date(Math.round((holidayDateRaw - 25569) * 86400 * 1000));
                          dateStr = excelDate.toISOString().split('T')[0];
                      }
                      const d = new Date(dateStr);
                      if (!isNaN(d.getTime())) {
                          const formattedDate = d.toISOString().split('T')[0];
                          const exists = holidays.some(h => h.date === formattedDate && h.name === holidayName);
                          const duplicateInBatch = validHolidays.some(h => h.date === formattedDate && h.name === holidayName);
                          if (!exists && !duplicateInBatch) {
                              validHolidays.push({
                                  name: holidayName,
                                  date: formattedDate,
                                  type: (holidayType && String(holidayType).toLowerCase().includes('company')) ? 'Company' : 'Public'
                              });
                          } else {
                              skippedCount++;
                          }
                      }
                  }
              }
              if (validHolidays.length > 0) {
                  await addHolidays(validHolidays);
              } 
              if (skippedCount > 0 && validHolidays.length === 0) {
                  showToast(`No new holidays imported. ${skippedCount} duplicates found.`, "info");
              } else if (validHolidays.length === 0 && skippedCount === 0) {
                  showToast("No valid holiday data found in file. Check columns.", "warning");
              }
          } catch (error) {
              console.error(error);
              showToast("Failed to parse Excel file.", "error");
          }
      };
      reader.readAsBinaryString(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sortedHolidays = [...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const weekendHolidaysList = sortedHolidays.filter(h => {
      const day = new Date(h.date).getDay();
      return day === 0 || day === 6;
  });
  const weekdayHolidaysList = sortedHolidays.filter(h => {
      const day = new Date(h.date).getDay();
      return day >= 1 && day <= 5;
  });
  const today = new Date();
  today.setHours(0,0,0,0);
  const upcomingHolidays = sortedHolidays.filter(h => {
      const hDate = new Date(h.date);
      return hDate >= today;
  });
  const nextHoliday = upcomingHolidays.length > 0 ? upcomingHolidays[0] : null;
  const stats = {
      total: holidays.length,
      upcoming: upcomingHolidays.length,
      thisMonth: holidays.filter(h => {
          const hDate = new Date(h.date);
          return hDate.getMonth() === today.getMonth() && hDate.getFullYear() === today.getFullYear();
      }).length
  };

  const MiniList = ({ items, emptyText }: { items: Holiday[], emptyText: string }) => (
      <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
          {items.map(h => {
              const { month, day, dayName } = getDateParts(h.date);
              return (
                  <div key={h.id} className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded px-1 transition-colors">
                      <div className="text-center w-8 shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase leading-none mb-0.5">{month}</span>
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-none">{day}</span>
                      </div>
                      <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={h.name}>{h.name}</p>
                          <p className="text-[10px] text-slate-400">{dayName}</p>
                      </div>
                  </div>
              );
          })}
          {items.length === 0 && <p className="text-xs text-slate-400 py-2 italic">{emptyText}</p>}
      </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
       {/* Page Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Holidays</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">View company holidays and plan your time off</p>
          </div>
          {isHR && (
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    ref={fileInputRef} 
                    onChange={handleExcelImport} 
                    className="hidden" 
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm font-medium text-sm w-full md:w-auto justify-center"
                >
                    <UploadCloud size={16} /> Import Excel
                </button>
                <button 
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm font-medium text-sm w-full md:w-auto justify-center"
                >
                    <Plus size={16} /> Add Holiday
                </button>
            </div>
          )}
       </div>

        {/* HR Note for Excel Format (Collapsible) */}
        {isHR && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden transition-all duration-200">
                <button 
                    onClick={() => setShowImportInfo(!showImportInfo)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${showImportInfo ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200' : 'bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-300'} transition-colors`}>
                            <Info size={18} />
                        </div>
                        <span className="text-sm font-semibold text-blue-800 dark:text-blue-200 group-hover:text-blue-900 dark:group-hover:text-blue-100">
                            Excel Import Format Instructions
                        </span>
                    </div>
                    <ChevronDown size={16} className={`text-blue-500 dark:text-blue-400 transition-transform duration-200 ${showImportInfo ? 'rotate-180' : ''}`} />
                </button>

                {showImportInfo && (
                    <div className="px-4 pb-4 pt-0 pl-[3.25rem] animate-in slide-in-from-top-1 fade-in duration-200">
                        <p className="text-sm text-blue-700/80 dark:text-blue-300/80 mb-3">
                            Ensure your Excel file has the following column headers (case-sensitive):
                        </p>
                        <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                            {['HolidayName', 'HolidayDate', 'Type', 'Day'].map((col, idx) => (
                                <div key={col} className="bg-white dark:bg-slate-800 px-3 py-2 rounded border border-blue-200 dark:border-blue-700 shadow-sm min-w-[120px]">
                                    <span className="text-xs text-slate-400 block uppercase font-bold">Column {String.fromCharCode(65 + idx)}</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-200 font-bold text-sm">{col}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1">{idx === 0 ? 'e.g. New Year' : idx === 1 ? 'YYYY-MM-DD' : idx === 2 ? 'Public / Company' : '(Optional)'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
           
           {/* Left Column: Holiday List */}
           <div className="lg:col-span-2 space-y-6">
               <h3 className="font-bold text-xl text-slate-800 dark:text-white">All Holidays ({currentYear})</h3>
               
               <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                   {sortedHolidays.map(holiday => (
                       <HolidayCard key={holiday.id} holiday={holiday} isHR={isHR} onDelete={deleteHoliday} />
                   ))}
                   
                   {sortedHolidays.length === 0 && (
                       <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                           No holidays found for this year.
                       </div>
                   )}
               </div>
           </div>

           {/* Right Column: Widgets */}
           <div className="space-y-6">
               
               {/* Upcoming Holidays Card */}
               <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                   <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6">Upcoming Holidays</h3>
                   
                   {nextHoliday ? (
                       <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                           <div className="flex flex-col gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 flex-shrink-0">
                                        <span className="text-xs font-bold tracking-wider">{getDateParts(nextHoliday.date).month}</span>
                                        <span className="text-xl font-bold leading-none">{getDateParts(nextHoliday.date).day}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">{nextHoliday.name}</h4>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">{getDateParts(nextHoliday.date).full}</p>
                                        <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                            {nextHoliday.type}
                                        </span>
                                    </div>
                                </div>
                           </div>
                       </div>
                   ) : (
                       <p className="text-slate-500 dark:text-slate-400 text-sm italic">No upcoming holidays this year.</p>
                   )}
               </div>

               {/* Holiday Stats Card */}
               <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                   <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6">Holiday Stats</h3>
                   
                   <div className="space-y-5">
                       <div className="flex justify-between items-center">
                           <span className="text-slate-600 dark:text-slate-400 text-sm">Total Holidays</span>
                           <span className="font-bold text-slate-800 dark:text-white text-lg">{stats.total}</span>
                       </div>
                       <div className="flex justify-between items-center border-t border-slate-50 dark:border-slate-700 pt-4">
                           <span className="text-slate-600 dark:text-slate-400 text-sm">Upcoming</span>
                           <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{stats.upcoming}</span>
                       </div>
                       <div className="flex justify-between items-center border-t border-slate-50 dark:border-slate-700 pt-4">
                           <span className="text-slate-600 dark:text-slate-400 text-sm">This Month</span>
                           <span className="font-bold text-slate-800 dark:text-white text-lg">{stats.thisMonth}</span>
                       </div>
                   </div>
               </div>

               {/* Weekday Holidays Card */}
               <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                   <div className="flex justify-between items-center mb-4">
                       <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                           <Sun size={18} className="text-blue-500"/> Weekday Holidays
                       </h3>
                       <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold px-2.5 py-1 rounded-full">{weekdayHolidaysList.length}</span>
                   </div>
                   <MiniList items={weekdayHolidaysList} emptyText="No weekday holidays." />
               </div>

               {/* Weekend Holidays Card */}
               <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                   <div className="flex justify-between items-center mb-4">
                       <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                           <Moon size={18} className="text-orange-500"/> Weekend Holidays
                       </h3>
                       <span className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-bold px-2.5 py-1 rounded-full">{weekendHolidaysList.length}</span>
                   </div>
                   <MiniList items={weekendHolidaysList} emptyText="No weekend holidays." />
               </div>

           </div>
       </div>

       {/* Add Holiday Modal with Scrolling */}
       {showModal && (
           <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                   <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                       <h3 className="text-lg font-bold text-slate-800 dark:text-white">Add New Holiday</h3>
                       <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X size={20}/></button>
                   </div>
                   <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form id="holiday-form" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Holiday Name</label>
                            <input required type="text" placeholder="e.g. Thanksgiving" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={newHoliday.name} onChange={e => setNewHoliday({...newHoliday, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Date</label>
                            <input required type="date" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={newHoliday.date} onChange={e => setNewHoliday({...newHoliday, date: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Type</label>
                            <select className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={newHoliday.type} onChange={e => setNewHoliday({...newHoliday, type: e.target.value as any})}>
                                <option value="Public">Public Holiday</option>
                                <option value="Company">Company Holiday</option>
                            </select>
                        </div>
                    </form>
                   </div>
                   <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 flex-shrink-0">
                       <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium">Cancel</button>
                       <button type="submit" form="holiday-form" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm">Add Holiday</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default Holidays;
