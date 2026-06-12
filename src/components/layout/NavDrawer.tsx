import React, { useEffect } from 'react';

interface NavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'dashboard' | 'applications' | 'vault' | 'profiles';
  setActiveTab: (tab: 'dashboard' | 'applications' | 'vault' | 'profiles') => void;
  userEmail: string;
  onSignOut: () => void;
}

export default function NavDrawer({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  userEmail,
  onSignOut,
}: NavDrawerProps) {
  // Lock scroll when menu is active
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => document.body.classList.remove('overflow-hidden');
  }, [isOpen]);

  if (!isOpen) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'applications', label: 'Applications CRM', icon: '💼' },
    { id: 'vault', label: 'Cloud Vault', icon: '📁 font-semibold' },
    { id: 'profiles', label: 'CV Profiles', icon: '👤' },
  ] as const;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer content */}
      <div className="relative w-72 max-w-xs bg-slate-900 border-l border-slate-800 h-full flex flex-col justify-between p-6 shadow-2xl z-10 transition-transform duration-250 transform translate-x-0">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-6">
            <span className="text-base font-extrabold text-white">Menu Navigation</span>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-850 bg-slate-950 text-slate-400 hover:text-white transition-all active:scale-90"
              aria-label="Close menu"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Links list */}
          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    onClose();
                  }}
                  className={`w-full h-11 flex items-center gap-3 px-4 rounded-lg text-sm font-semibold transition-all duration-150 text-left ${
                    isActive
                      ? 'bg-indigo-600/10 border border-indigo-500/20 text-white shadow-sm'
                      : 'text-slate-400 border border-transparent hover:bg-slate-850/50 hover:text-slate-200'
                  }`}
                >
                  <span className="text-base select-none">{item.icon.split(' ')[0]}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User context footer */}
        <div className="border-t border-slate-850 pt-5 mt-auto">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-500 font-mono tracking-wider overflow-ellipsis overflow-hidden whitespace-nowrap leading-relaxed">
                LOGGED IN AS
              </span>
              <span className="text-sm font-semibold text-slate-300 overflow-hidden overflow-ellipsis whitespace-nowrap">
                {userEmail}
              </span>
            </div>
            <button
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="w-full h-10 flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer border border-slate-750"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
