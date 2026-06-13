'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Structured log in background for tracking
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unhandled app router runtime error:', error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center font-sans animate-fade-in">
        <div className="w-16 h-16 bg-red-950/30 border border-red-900/50 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2 tracking-tight">Something went wrong</h2>
        <p className="text-slate-400 text-sm mb-6">
          Please try refreshing the page or restarting your session.
        </p>
        <button
          onClick={() => reset()}
          className="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition bg-slate-100 text-slate-950 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-lg"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
