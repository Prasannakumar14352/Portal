
import React, { useState, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Calendar, Trash2, Plus, Edit2, UploadCloud, FileSpreadsheet, Info, Sun, Moon, ChevronDown, X } from 'lucide-react';
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

const HolidayCard: React.FC<{ holiday: Holiday, compact?: boolean, isHR: boolean, onDelete: (id: string) => void }> = ({ holiday, compact = false, isHR, onDelete }) => {
    const { day, month, dayName } = getDateParts(holiday.date);
    const upcoming = isUpcoming(holiday.date);

    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:shadow-md transition group ${compact ? 'p-4' : 'p-5'}`}>
          <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={`flex flex-col items-center justify-center text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 rounded-xl flex-shrink-0 ${compact ? 'w-14 h-14' : 'w-16 h-16'}`}>
                  <span className="text-xs font-bold tracking-wider">{month}</span>
                  <span className={`${compact ? 'text-xl' : 'text-2xl'} font-bold leading-none`}>{day}</span>
              </div>
              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                      <h4 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-slate-800 dark:text-slate-100 truncate`}>{holiday.name}</h4>
                      {upcoming && <span className="bg-slate-700 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold whitespace-nowrap">Upcoming</span>}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium truncate">{dayName} • {holiday.type} Holiday</p>
              </div>
          </div>
          {!compact && isHR && (
              <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onDelete(holiday.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition"><Trash2 size={18} /></button>
              </div>
          )}
      </div>
    );
};

const Holidays = () => {
  const { holidays, addHoliday, addHolidays, deleteHoliday, currentUser, showToast } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', type: 'Public' as 'Public' | 'Company' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHR = currentUser?.role === UserRole.HR;

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      addHoliday(newHoliday);
      setShowModal(false);
      setNewHoliday({ name: '', date: '', type: 'Public' });
  };

  const sortedHolidays = [...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Holidays</h2><p className="text-slate-500 dark:text-slate-400 text-sm">View company holidays and plan your time off</p></div>
          {isHR && (
            <div className="flex gap-2">
                <input type="file" ref={fileInputRef} className="hidden" onChange={() => {}} />
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm font-medium text-sm"><Plus size={16} /> Add Holiday</button>
            </div>
          )}
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 space-y-4">
               <h3 className="font-bold text-lg text-slate-800 dark:text-white">Upcoming Holidays</h3>
               <div className="space-y-4">
                   {sortedHolidays.map(holiday => <HolidayCard key={holiday.id} holiday={holiday} isHR={isHR} onDelete={deleteHoliday} />)}
               </div>
           </div>
       </div>

       <DraggableModal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Holiday" width="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label><input required type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-700 dark:text-white" value={newHoliday.name} onChange={e => setNewHoliday({...newHoliday, name: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label><input required type="date" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-700 dark:text-white" value={newHoliday.date} onChange={e => setNewHoliday({...newHoliday, date: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label><select className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-700 dark:text-white" value={newHoliday.type} onChange={e => setNewHoliday({...newHoliday, type: e.target.value as any})}><option value="Public">Public</option><option value="Company">Company</option></select></div>
                <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 text-sm">Cancel</button><button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium shadow-sm">Save Holiday</button></div>
            </form>
       </DraggableModal>
    </div>
  );
};

export default Holidays;
