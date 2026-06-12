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

interface ApplicationsTableProps {
  applications: Application[];
  onUpdateStatus: (id: string, status: any) => void;
  onSelect: (id: string) => void;
}

const statusColors = {
  pending: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', text: 'Pending' },
  interview: { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', text: 'Interview' },
  offer: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10', text: 'Offer' },
  rejected: { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', text: 'Rejected' },
  ghosted: { bg: 'bg-slate-500/10 text-slate-400 border-slate-500/25', text: 'Ghosted' },
};

export default function ApplicationsTable({
  applications,
  onUpdateStatus,
  onSelect,
}: ApplicationsTableProps) {
  
  const formatDate = (val: any) => {
    if (!val) return '—';
    const date = val.toDate ? val.toDate() : new Date(val);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isTodayOrOverdue = (val: any) => {
    if (!val) return false;
    const date = val.toDate ? val.toDate() : new Date(val);
    return date.getTime() <= Date.now();
  };

  return (
    <div className="w-full overflow-hidden bg-slate-900 border border-slate-800/80 rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-850 bg-slate-950/40 text-xs font-semibold text-slate-450 uppercase tracking-wider h-11 select-none">
              <th className="px-6">Company</th>
              <th className="px-6">Role</th>
              <th className="px-6">Status</th>
              <th className="px-6">Applied Date</th>
              <th className="px-6">Follow-up</th>
              <th className="px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {applications.map((app) => {
              const { bg, text } = statusColors[app.status] || statusColors.pending;
              return (
                <tr
                  key={app.applicationId}
                  className="hover:bg-slate-850/20 transition-all text-sm group"
                >
                  <td className="px-6 py-4 font-bold text-white max-w-[180px] break-words">
                    <div className="flex items-center gap-2">
                      <span className="cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => onSelect(app.applicationId)}>
                        {app.company}
                      </span>
                      {app.recruiterReplied && (
                        <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold px-1.5 py-0.5 rounded">
                          REPLY
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-300 max-w-[200px] break-words">
                    {app.jobTitle}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold border rounded-full px-2.5 py-0.5 ${bg}`}>
                      {text}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                    {formatDate(app.appliedAt)}
                  </td>
                  <td className={`px-6 py-4 text-xs font-mono ${app.followUpDate && isTodayOrOverdue(app.followUpDate) ? 'text-red-400 font-bold animate-pulse' : 'text-slate-450'}`}>
                    {formatDate(app.followUpDate)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-3">
                      <select
                        value={app.status}
                        onChange={(e) => onUpdateStatus(app.applicationId, e.target.value as any)}
                        className="bg-slate-950 border border-slate-800 text-xs text-slate-350 rounded-md px-2 py-1 outline-none h-8 focus:border-indigo-500 transition-all"
                      >
                        <option value="pending">Pending</option>
                        <option value="interview">Interview</option>
                        <option value="offer">Offer</option>
                        <option value="rejected">Rejected</option>
                        <option value="ghosted">Ghosted</option>
                      </select>
                      <button
                        onClick={() => onSelect(app.applicationId)}
                        className="h-8 px-3 text-xs bg-slate-800 hover:bg-indigo-600/20 hover:text-indigo-300 hover:border-indigo-500/30 text-slate-300 rounded-md border border-slate-700 transition-all cursor-pointer font-semibold active:scale-95"
                      >
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
