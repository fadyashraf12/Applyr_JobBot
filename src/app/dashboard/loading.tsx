import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="p-6 md:p-8 space-y-8 font-sans max-w-7xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-slate-800 rounded-lg" />
          <div className="h-4 w-72 bg-slate-900 rounded" />
        </div>
        <div className="h-10 w-32 bg-slate-800 rounded-lg" />
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-slate-900 border border-slate-800/60 rounded-xl p-5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-slate-800 rounded" />
              <div className="h-3 w-40 bg-slate-950 rounded" />
            </div>
            <div className="h-8 w-16 bg-slate-800 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Main Block */}
      <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-5 w-40 bg-slate-800 rounded" />
          <div className="h-4 w-20 bg-slate-950 rounded" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-950/40 rounded-lg border border-slate-800/30 flex items-center justify-between px-4">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-1/3 bg-slate-800 rounded" />
                <div className="h-3 w-1/4 bg-slate-900 rounded" />
              </div>
              <div className="h-6 w-20 bg-slate-850 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
