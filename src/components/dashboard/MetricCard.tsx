import React from 'react';

interface MetricCardProps {
  label: string;
  value: number | string;
  icon?: string;
  className?: string;
}

export default function MetricCard({ label, value, icon, className = '' }: MetricCardProps) {
  return (
    <div className={`bg-slate-900 border border-slate-800/80 p-5 rounded-xl text-left flex items-center justify-between ${className}`}>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none">
          {label}
        </p>
        <p className="text-3xl font-extrabold text-white">
          {value}
        </p>
      </div>
      {icon && (
        <span className="text-2xl bg-slate-950 p-2.5 rounded-lg border border-slate-850/80 select-none">
          {icon}
        </span>
      )}
    </div>
  );
}
