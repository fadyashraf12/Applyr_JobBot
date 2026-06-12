import React from 'react';

type ApplicationStatus = 'pending' | 'interview' | 'offer' | 'rejected' | 'ghosted';

interface StatusBadgeProps {
  status: ApplicationStatus;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const configs = {
    pending: {
      label: 'Pending Response',
      styles: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-xs shadow-amber-500/2',
    },
    interview: {
      label: 'Interviewing',
      styles: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-xs shadow-blue-500/2',
    },
    offer: {
      label: 'Offer Echoed',
      styles: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-xs shadow-emerald-500/2',
    },
    rejected: {
      label: 'Rejected',
      styles: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-xs shadow-rose-500/2',
    },
    ghosted: {
      label: 'Silent (Ghosted)',
      styles: 'bg-slate-800 text-slate-400 border-slate-700/60',
    },
  };

  const current = configs[status] || configs.pending;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide transition-colors ${current.styles} ${className}`}
    >
      {current.label}
    </span>
  );
}
