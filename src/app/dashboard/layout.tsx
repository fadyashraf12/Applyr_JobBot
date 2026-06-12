import React from 'react';

// TODO: Implement dashboard layout
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-slate-100 bg-slate-950 flex flex-col md:flex-row">
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
