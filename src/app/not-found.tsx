'use client';

import React from 'react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center font-sans">
        <div className="w-16 h-16 bg-slate-800/50 border border-slate-700 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6 font-mono text-xl font-bold">
          404
        </div>
        <h2 className="text-xl font-semibold mb-2 tracking-tight">Page Not Found</h2>
        <p className="text-slate-400 text-sm mb-6">
          The page you are looking for doesn't exist or has been moved to a different location.
        </p>
        <div className="space-y-2">
          <a
            href="/dashboard"
            className="block w-full py-2.5 px-4 rounded-lg font-medium text-sm transition bg-slate-100 text-slate-950 hover:bg-slate-200 text-center shadow-lg"
          >
            Go to Dashboard
          </a>
          <a
            href="/"
            className="block w-full py-2 px-4 rounded-lg font-medium text-sm transition border border-slate-800 hover:border-slate-700 hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 text-center"
          >
            Go back Home
          </a>
        </div>
      </div>
    </div>
  );
}
