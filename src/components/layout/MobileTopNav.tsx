import React from 'react';

interface MobileTopNavProps {
  onOpenMenu: () => void;
}

export default function MobileTopNav({ onOpenMenu }: MobileTopNavProps) {
  return (
    <header className="md:hidden sticky top-0 z-40 w-full h-16 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center">
        <img src="/rectangular_logo.svg" alt="Applyr Logo" className="h-8 w-auto" />
      </div>

      <button
        onClick={onOpenMenu}
        className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-350 hover:text-white transition-all active:scale-90"
        aria-label="Open navigation menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  );
}
