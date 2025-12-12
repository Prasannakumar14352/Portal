
import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Calendar, Trash2, Plus, Edit2 } from 'lucide-react';
import { UserRole, Holiday } from '../types';

const Holidays = () => {
  const { holidays, addHoliday, deleteHoliday, currentUser } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', type: 'Public' as 'Public' | 'Company' });

  const isHR = currentUser?.role === UserRole.HR;
  const currentYear = new Date().getFullYear();

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      addHoliday(newHoliday);
      setShowModal(false);
      setNewHoliday({ name: '', date: '', type: 'Public' });
  };

  // Sort holidays by date
  const sortedHolidays = [...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Stats Logic
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const upcomingHolidays = sortedHolidays.filter(h => {
      // Parse date in local time to avoid timezone issues with simple yyyy-mm-dd strings
      const [year, month, day] = h.date.split('-').map(Number);
      const hDate = new Date(year, month - 1, day);
      return hDate >= today;
  });
  
  const nextHoliday = upcomingHolidays.length > 0 ? upcomingHolidays[0] : null;
  
  const stats = {
      total: holidays.length,
      upcoming: upcomingHolidays.length,
      thisMonth: holidays.filter(h => {
          const [year, month] = h.date.split('-').map(Number);
          return month - 1 === today.getMonth() && year === today.getFullYear();
      }).length
  };

  const getDateParts = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      return {
          day: date.getDate(),
          month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
          full: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          dayName: date.toLocaleDateString('en-US', { weekday: 'long' })
      };
  };

  const isUpcoming = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const hDate = new Date(year, month - 1, day);
      return hDate >= today;
  };

  const HolidayCard = ({ holiday, compact = false }: { holiday: Holiday, compact?: boolean }) => {
      const { day, month, dayName } = getDateParts(holiday.date);
      const upcoming = isUpcoming(holiday.date);

      return (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition group ${compact ? 'p-4' : 'p-5'}`}>
            <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Date Box */}
                <div className={`flex flex-col items-center justify-center text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl flex-shrink-0 ${compact ? 'w-14 h-14' : 'w-16 h-16'}`}>
                    <span className="text-xs font-bold tracking-wider">{month}</span>
                    <span className={`${compact ? 'text-xl' : 'text-2xl'} font-bold leading-none`}>{day}</span>
                </div>
                
                {/* Details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h4 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-slate-800 truncate`}>{holiday.name}</h4>
                        {upcoming && (
                            <span className="bg-slate-700 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold whitespace-nowrap flex-shrink-0">Upcoming</span>
                        )}
                    </div>
                    <p className="text-slate-500 text-sm font-medium truncate">
                        {dayName} • <span className="text-slate-400 font-normal">{holiday.type} Holiday</span>
                    </p>
                    {!compact && (
                        <p className="text-xs text-slate-400 mt-1 truncate">
                            {holiday.type === 'Public' ? 'National observance' : 'Company observance'}
                        </p>
                    )}
                </div>
            </div>

            {/* Actions (Only in full view and if HR) */}
            {!compact && isHR && (
                <div className="flex gap-1 ml-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button className="p-2 text-slate-400 hover:text-emerald-600 rounded-full hover:bg-emerald-50 transition" title="Edit">
                        <Edit2 size={18} />
                    </button>
                    <button onClick={() => deleteHoliday(holiday.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition" title="Delete">
                        <Trash2 size={18} />
                    </button>
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="space-y-6 animate-fade-in">
       {/* Page Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Holidays</h2>
            <p className="text-slate-500 text-sm">View company holidays and plan your time off</p>
          </div>
          {isHR && (
            <button 
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm font-medium text-sm w-full md:w-auto justify-center"
            >
                <Plus size={16} /> Add Holiday
            </button>
          )}
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
           
           {/* Left Column: Holiday List */}
           <div className="lg:col-span-2 space-y-6">
               <h3 className="font-bold text-xl text-slate-800">All Holidays ({currentYear})</h3>
               
               <div className="space-y-4">
                   {sortedHolidays.map(holiday => (
                       <HolidayCard key={holiday.id} holiday={holiday} />
                   ))}
                   
                   {sortedHolidays.length === 0 && (
                       <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
                           No holidays found for this year.
                       </div>
                   )}
               </div>
           </div>

           {/* Right Column: Widgets */}
           <div className="space-y-6">
               
               {/* Upcoming Holidays Card */}
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-lg text-slate-800 mb-6">Upcoming Holidays</h3>
                   
                   {nextHoliday ? (
                       <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                           <div className="flex flex-col gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 bg-emerald-50 rounded-xl flex flex-col items-center justify-center text-emerald-700 border border-emerald-100 flex-shrink-0">
                                        <span className="text-xs font-bold tracking-wider">{getDateParts(nextHoliday.date).month}</span>
                                        <span className="text-xl font-bold leading-none">{getDateParts(nextHoliday.date).day}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-base font-bold text-slate-800 truncate">{nextHoliday.name}</h4>
                                        <p className="text-slate-500 text-sm">{getDateParts(nextHoliday.date).full}</p>
                                        <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                            {nextHoliday.type}
                                        </span>
                                    </div>
                                </div>
                           </div>
                       </div>
                   ) : (
                       <p className="text-slate-500 text-sm italic">No upcoming holidays this year.</p>
                   )}
               </div>

               {/* Holiday Stats Card */}
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-lg text-slate-800 mb-6">Holiday Stats</h3>
                   
                   <div className="space-y-5">
                       <div className="flex justify-between items-center">
                           <span className="text-slate-600 text-sm">Total Holidays</span>
                           <span className="font-bold text-slate-800 text-lg">{stats.total}</span>
                       </div>
                       <div className="flex justify-between items-center border-t border-slate-50 pt-4">
                           <span className="text-slate-600 text-sm">Upcoming</span>
                           <span className="font-bold text-emerald-600 text-lg">{stats.upcoming}</span>
                       </div>
                       <div className="flex justify-between items-center border-t border-slate-50 pt-4">
                           <span className="text-slate-600 text-sm">This Month</span>
                           <span className="font-bold text-slate-800 text-lg">{stats.thisMonth}</span>
                       </div>
                   </div>
               </div>

           </div>
       </div>

       {/* Add Holiday Modal */}
       {showModal && (
           <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
               <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                   <div className="flex justify-between items-center mb-4">
                       <h3 className="text-lg font-bold text-slate-800">Add New Holiday</h3>
                       <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                   </div>
                   <form onSubmit={handleSubmit} className="space-y-4">
                       <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Holiday Name</label>
                           <input required type="text" placeholder="e.g. Thanksgiving" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={newHoliday.name} onChange={e => setNewHoliday({...newHoliday, name: e.target.value})} />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                           <input required type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={newHoliday.date} onChange={e => setNewHoliday({...newHoliday, date: e.target.value})} />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                           <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white" value={newHoliday.type} onChange={e => setNewHoliday({...newHoliday, type: e.target.value as any})}>
                               <option value="Public">Public Holiday</option>
                               <option value="Company">Company Holiday</option>
                           </select>
                       </div>
                       <div className="flex justify-end gap-2 pt-2">
                           <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
                           <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm">Add Holiday</button>
                       </div>
                   </form>
               </div>
           </div>
       )}
    </div>
  );
};

export default Holidays;
