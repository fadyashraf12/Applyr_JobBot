import React from 'react';

/**
 * Root Layout representing standard App Router wrapper.
 * Houses core dark-slate body styling and font settings.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {children}
    </div>
  );
}
