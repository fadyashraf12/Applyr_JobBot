import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 backdrop-blur-xs max-w-lg mx-auto">
      {icon ? (
        <div className="mb-4 text-slate-500">{icon}</div>
      ) : (
        <div className="mb-4 p-3 bg-slate-900 border border-slate-800 rounded-full text-slate-500">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 012-2m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-sm">{description}</p>
      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="mt-6 inline-flex items-center justify-center font-medium rounded-lg text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10 border border-indigo-500/20 active:scale-95 transition-all outline-none"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
