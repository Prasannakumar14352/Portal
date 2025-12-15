import React, { useState } from 'react';
import { LeaveRequest, LeaveStatus, User } from '../types';
import { Calendar, FileText, Send } from 'lucide-react';

const LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'Casual Leave', 'Unpaid Leave'];

interface LeaveRequestFormProps {
  user: User;
  onSubmit: (request: LeaveRequest) => void;
}

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ user, onSubmit }) => {
  const [formData, setFormData] = useState({
    type: LEAVE_TYPES[0],
    startDate: '',
    endDate: '',
    reason: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRequest: LeaveRequest = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      userName: user.name,
      status: LeaveStatus.PENDING_MANAGER,
      ...formData,
      // Optional legacy fields
      employeeId: user.id,
      employeeName: user.name,
    };
    onSubmit(newRequest);
    // Reset form or show success message
    alert("Leave request submitted successfully!");
    setFormData({
      type: LEAVE_TYPES[0],
      startDate: '',
      endDate: '',
      reason: ''
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Apply for Leave</h2>
        <p className="text-slate-500">Submit a new leave request for approval.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Leave Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {LEAVE_TYPES.map((type) => (
                <div key={type}>
                  <input
                    type="radio"
                    name="leaveType"
                    id={type}
                    value={type}
                    checked={formData.type === type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="hidden peer"
                  />
                  <label 
                    htmlFor={type}
                    className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 peer-checked:bg-blue-50 peer-checked:border-blue-500 peer-checked:text-blue-700 hover:bg-slate-100 transition-all text-xs font-medium text-center h-full"
                  >
                    {type}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Reason</label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-slate-400" size={18} />
              <textarea
                required
                rows={4}
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="Please describe the reason for your leave request..."
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-sm"
            >
              <Send size={18} />
              <span>Submit Request</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default LeaveRequestForm;