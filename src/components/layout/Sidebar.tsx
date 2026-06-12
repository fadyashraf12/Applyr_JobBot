import React from 'react';

interface SidebarProps {
  activeTab: 'dashboard' | 'applications' | 'vault' | 'profiles';
  setActiveTab: (tab: 'dashboard' | 'applications' | 'vault' | 'profiles') => void;
  userEmail: string;
  onSignOut: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, userEmail, onSignOut }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'applications', label: 'Applications CRM', icon: '💼' },
    { id: 'vault', label: 'Cloud Vault', icon: '📁 font-semibold' },
    { id: 'profiles', label: 'CV Profiles', icon: '👤' },
  ] as const;

  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 shrink-0">
      {/* Brand logo section */}
      <div>
        <div className="h-16 flex items-center px-6 border-b border-slate-850">
          <img src="/rectangular_logo.svg" alt="Applyr Logo" className="h-9 w-auto" />
        </div>

        {/* Links list */}
        <nav className="p-4 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 text-left ${
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

      {/* User profile footer */}
      <div className="p-4 border-t border-slate-850 bg-slate-950/20">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-500 font-mono overflow-ellipsis overflow-hidden whitespace-nowrap leading-relaxed">
              LOGGED IN AS
            </span>
            <span className="text-sm font-medium text-slate-300 overflow-hidden overflow-ellipsis whitespace-nowrap">
              {userEmail}
            </span>
          </div>
          <button
            onClick={onSignOut}
            className="w-full h-8 flex items-center justify-center gap-1.5 rounded bg-slate-850 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-800"
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
