import React from 'react';

interface Application {
  applicationId: string;
  company: string;
  jobTitle: string;
  status: 'pending' | 'interview' | 'offer' | 'rejected' | 'ghosted';
  appliedAt: any;
  followUpDate?: any;
  recruiterReplied?: boolean;
}

interface ApplicationCardProps {
  application: Application;
  onUpdateStatus: (id: string, status: any) => void;
  onSelect: (id: string) => void;
}

const statusColors = {
  pending: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', text: 'Pending' },
  interview: { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', text: 'Interview' },
  offer: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', text: 'Offer' },
  rejected: { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', text: 'Rejected' },
  ghosted: { bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20', text: 'Ghosted' },
};

export default function ApplicationCard({
  application,
  onUpdateStatus,
  onSelect,
}: ApplicationCardProps) {
  const { bg, text } = statusColors[application.status] || statusColors.pending;
  
  // Format dates safely
  const formatDate = (val: any) => {
    if (!val) return 'None';
    const date = val.toDate ? val.toDate() : new Date(val);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isTodayOrOverdue = (val: any) => {
    if (!val) return false;
    const date = val.toDate ? val.toDate() : new Date(val);
    return date.getTime() <= Date.now();
  };

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 hover:border-slate-700/60 transition-all flex flex-col justify-between space-y-4">
      {/* Upper row clickable header */}
      <div 
        onClick={() => onSelect(application.applicationId)}
        className="cursor-pointer space-y-1 group"
      >
        <div className="flex items-start justify-between">
          <h4 className="font-bold text-white text-base group-hover:text-indigo-400 transition-colors">
            {application.company}
          </h4>
          {application.recruiterReplied && (
            <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
              📬 REPLY
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-slate-400">{application.jobTitle}</p>
        <p className="text-[11px] text-slate-500">Applied: {formatDate(application.appliedAt)}</p>
      </div>

      {/* Action panel with selector */}
      <div className="border-t border-slate-850 pt-3.5 flex items-center justify-between gap-3 flex-wrap">
        {/* Status Dropdown */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[10px] font-bold border rounded-full px-2.5 py-1 ${bg}`}>
            {text}
          </span>
          <select
            value={application.status}
            onChange={(e) => onUpdateStatus(application.applicationId, e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded px-2 py-1 outline-none focus:border-indigo-500 transition-all"
          >
            <option value="pending">Pending</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
            <option value="ghosted">Ghosted</option>
          </select>
        </div>

        {/* Follow up date flag */}
        {application.followUpDate && (
          <span className={`text-[10px] font-mono font-medium flex items-center gap-1.5 ${
            isTodayOrOverdue(application.followUpDate) ? 'text-rose-400 font-semibold' : 'text-slate-500'
          }`}>
            <span>⏰</span> {formatDate(application.followUpDate)}
          </span>
        )}
      </div>
    </div>
  );
}
