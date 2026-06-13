import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, updateDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase/client';

// Import newly implemented components
import OnboardingWizard from './components/onboarding/OnboardingWizard';
import Sidebar from './components/layout/Sidebar';
import MobileTopNav from './components/layout/MobileTopNav';
import NavDrawer from './components/layout/NavDrawer';
import TelegramLaunchpad from './components/dashboard/TelegramLaunchpad';
import MetricsRow from './components/dashboard/MetricsRow';
import ApplicationsList from './components/dashboard/ApplicationsList';
import VaultExplorer from './components/vault/VaultExplorer';
import ProfileManager from './components/profiles/ProfileManager';
import ApplicationDetailModal from './components/crm/ApplicationDetailModal';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Core app boundary caught exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen text-slate-105 bg-slate-950 font-sans p-6 text-center">
          <div className="relative inline-flex mb-6">
            <div className="absolute inset-0 rounded-full bg-red-500/20 blur-3xl opacity-65"></div>
            <span className="text-5xl relative">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            The application encountered an unexpected error. Your workspace and sessions remain secure.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="h-10 px-6 inline-flex items-center justify-center font-bold text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-550 transition-all active:scale-95 cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Layout navigation tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'applications' | 'vault' | 'profiles'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // CRM applications metrics & elements
  const [applications, setApplications] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);

  // 1. Firebase authentication observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (!user) {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time parent user profile configuration lookup
  useEffect(() => {
    if (!currentUser) return;
    setProfileLoading(true);

    const docRef = doc(db, `users/${currentUser.uid}`);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      } else {
        setUserProfile(null);
      }
      setProfileLoading(false);
    }, (error) => {
      console.error('Error tracking parent user details:', error);
      setProfileLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 3. Real-time applications updates observer
  useEffect(() => {
    if (!currentUser || !userProfile?.onboardingComplete) return;
    setAppsLoading(true);

    const colRef = collection(db, `users/${currentUser.uid}/applications`);
    const unsubscribe = onSnapshot(colRef, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({
          applicationId: docSnap.id,
          ...docSnap.data()
        });
      });
      // Sort appliedAt descending
      list.sort((a, b) => {
        const tA = a.appliedAt?.toDate ? a.appliedAt.toDate().getTime() : new Date(a.appliedAt || 0).getTime();
        const tB = b.appliedAt?.toDate ? b.appliedAt.toDate().getTime() : new Date(b.appliedAt || 0).getTime();
        return tB - tA;
      });
      setApplications(list);
      setAppsLoading(false);
    }, (err) => {
      console.error('Error listing user applications collection:', err);
      setAppsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, userProfile?.onboardingComplete]);

  // Google sign in trigger
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Required scopes for Google APIs access
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.addScope('https://www.googleapis.com/auth/gmail.send');
      provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
      provider.addScope('https://www.googleapis.com/auth/gmail.modify');

      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Error during Google authentication popups selection:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error logging out seeker:', err);
    }
  };

  const handleUpdateStatus = async (appId: string, status: string) => {
    try {
      const appRef = doc(db, `users/${currentUser.uid}/applications/${appId}`);
      await updateDoc(appRef, { status, updatedAt: new Date() });
    } catch (err) {
      console.error('Error in status change update:', err);
    }
  };

  // Aggregated analytics metrics
  const totalAppsCount = applications.length;
  const pendingAppsCount = applications.filter((a) => a.status === 'pending').length;
  const interviewAppsCount = applications.filter((a) => a.status === 'interview').length;

  // Active onboarding check
  const isOnboardingComplete = userProfile?.onboardingComplete === true;

  // Render auth loading screen
  if (authLoading || (currentUser && profileLoading)) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-screen text-slate-100 bg-slate-950 font-sans">
          <svg className="animate-spin h-9 w-9 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-slate-400 text-xs font-mono tracking-wider">APPLYR FIREBASE SYNCHRONIZING...</span>
        </div>
      </>
    );
  }

  // A: Pre-login Landing Intercept Page
  if (!currentUser) {
    return (
      <>
        <div className="flex flex-col min-h-screen text-slate-100 bg-slate-950 font-sans">
          {/* Header display */}
          <header className="sticky top-0 z-45 w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
              <div className="flex items-center">
                <img src="/rectangular_logo.svg" alt="Applyr Logo" className="h-9 w-auto" />
              </div>
            </div>
          </header>

          <main className="flex-1 flex flex-col mx-auto w-full max-w-7xl px-6 py-12 justify-center">
            <div className="max-w-2xl mx-auto text-center space-y-8 py-10">
              {/* Glowing logo asset frame */}
              <div className="relative inline-flex">
                <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-3xl opacity-60"></div>
                <img src="/square_logo.svg" alt="Applyr App Emblem" className="h-36 w-36 relative select-none" />
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  Automation for <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Job Seekers</span>
                </h1>
                <p className="mx-auto max-w-lg text-sm md:text-base text-slate-400 leading-relaxed">
                  Integrate your Gmail and Google Drive. Automatically tailor resume sections and cover drafts via Telegram with live push alert answers.
                </p>
              </div>

              {/* Crucial account alignment notice callback */}
              <div className="mx-auto max-w-md p-5 bg-slate-900 border border-slate-800 rounded-xl text-left text-xs text-slate-400 leading-relaxed shadow-lg space-y-2">
                <p className="font-bold text-slate-200 flex items-center gap-1.5 leading-none">
                  <span>⚠️</span> Crucial Account Alignment Notice
                </p>
                <p className="text-slate-400">
                  The Google account you select next will be permanently linked to your Applyr workspace. Ensure it is the exact account you wish to host files and compose hiring mails with.
                </p>
              </div>

              {/* Sign-in button */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full sm:w-auto h-12 px-8 inline-flex items-center justify-center font-bold text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-550 shadow-lg shadow-indigo-600/15 transition-all active:scale-95 cursor-pointer"
                >
                  Sign in with Google Account
                </button>
              </div>
            </div>
          </main>

          <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600 font-mono tracking-wider">
            APPLYR PLATFORM V2.0 · INCOMING THREAD READY
          </footer>
        </div>
      </>
    );
  }

  // B: Active Onboarding Sequence
  if (!isOnboardingComplete) {
    return (
      <>
        <div className="flex flex-col min-h-screen text-slate-100 bg-slate-950 font-sans">
          <header className="sticky top-0 z-40 w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <img src="/rectangular_logo.svg" alt="Applyr Logo" className="h-9 w-auto" />
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 py-0.5 px-2.5 rounded-full font-mono uppercase font-bold tracking-widest border border-indigo-500/10">Onboarding</span>
              </div>
              <button
                onClick={handleSignOut}
                className="text-xs font-semibold px-3.5 py-2 bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </header>

          <main className="flex-1 flex flex-col mx-auto w-full max-w-4xl px-6 py-12 justify-center">
            <OnboardingWizard uid={currentUser.uid} onComplete={() => {}} />
          </main>

          <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-700 font-mono tracking-wider">
            STEPPER ACTIVE · DATA SECURE
          </footer>
        </div>
      </>
    );
  }

  // C: Seeker Dashboard / Admin Console Main Layout
  return (
    <>
      <div className="flex min-h-screen text-slate-150 bg-slate-950 font-sans">
        
        {/* Fixed left sidebar on desktop displays */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userEmail={currentUser.email || 'seeker@workspace.com'}
          onSignOut={handleSignOut}
        />

        {/* Console layout area */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* TopNav visibility on mobile displays */}
          <MobileTopNav onOpenMenu={() => setIsMobileMenuOpen(true)} />

          {/* Slide-out navigation drawer overlay on mobile displays */}
          <NavDrawer
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            userEmail={currentUser.email || 'seeker@workspace.com'}
            onSignOut={handleSignOut}
          />

          {/* Seeker View Viewport */}
          <main className="flex-1 p-6 sm:p-8 overflow-y-auto max-w-6xl w-full mx-auto space-y-8">
            
            {/* VIEW TAB 1: COCKPIT DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-fade-in">
                {/* Title and stats layout */}
                <div className="border-b border-slate-900 pb-5 space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    Seeker Console <span className="text-[10px] bg-indigo-500/10 text-indigo-400 py-0.5 px-2.5 rounded-full font-mono uppercase font-bold tracking-widest border border-indigo-500/10">Mobile First</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 font-medium">Control career logs, PDF attachments, and active sub-profiles.</p>
                </div>

                {/* Secure Telegram Launchpad button */}
                <TelegramLaunchpad uid={currentUser.uid} />

                {/* Metric counters rows */}
                {appsLoading ? (
                  <div className="h-28 bg-slate-900/40 border border-slate-850 animate-pulse rounded-xl flex items-center justify-center">
                    <span className="text-xs font-mono text-slate-500">AGGREGATING CRM LOGS...</span>
                  </div>
                ) : (
                  <MetricsRow
                    total={totalAppsCount}
                    pending={pendingAppsCount}
                    interviews={interviewAppsCount}
                  />
                )}

                {/* Recent submissions block layout */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-450 leading-none">Recent Submissions</h3>
                    <button
                      onClick={() => setActiveTab('applications')}
                      className="text-xs text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
                    >
                      View CRM Grid ➜
                    </button>
                  </div>

                  {appsLoading ? (
                    <div className="space-y-3.5">
                      <div className="h-14 bg-slate-900/60 animate-pulse rounded-lg" />
                      <div className="h-14 bg-slate-900/60 animate-pulse rounded-lg" />
                    </div>
                  ) : (
                    <ApplicationsList
                      applications={applications}
                      onUpdateStatus={handleUpdateStatus}
                      onSelect={(appId) => {
                        const target = applications.find((a) => a.applicationId === appId);
                        setSelectedApp(target || null);
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* VIEW TAB 2: FULL APPLICATION LIST CRM */}
            {activeTab === 'applications' && (
              <div className="space-y-6 animate-fade-in">
                <div className="border-b border-slate-900 pb-4 space-y-1">
                  <h2 className="text-lg font-bold text-white tracking-tight">Job Applications CRM</h2>
                  <p className="text-xs text-slate-400">Review full job post descriptions, email letters, and active recruiter contact catalogs.</p>
                </div>

                {appsLoading ? (
                  <div className="h-64 bg-slate-900/40 border border-slate-850 animate-pulse rounded-xl flex items-center justify-center">
                    <span className="text-xs font-mono text-slate-500">SYNCING LIVE DIRECT STATS...</span>
                  </div>
                ) : (
                  <ApplicationsList
                    applications={applications}
                    onUpdateStatus={handleUpdateStatus}
                    onSelect={(appId) => {
                      const target = applications.find((a) => a.applicationId === appId);
                      setSelectedApp(target || null);
                    }}
                  />
                )}
              </div>
            )}

            {/* VIEW TAB 3: FILE REPOSITORY VAULT */}
            {activeTab === 'vault' && (
              <div className="space-y-6 animate-fade-in">
                <div className="border-b border-slate-900 pb-4 space-y-1">
                  <h2 className="text-lg font-bold text-white tracking-tight">Cloud Workspace Vault</h2>
                  <p className="text-xs text-slate-400 font-medium">Browse files, read-only PDF attachments, and active CV modules synced directly in your Drive.</p>
                </div>
                <VaultExplorer uid={currentUser.uid} />
              </div>
            )}

            {/* VIEW TAB 4: MULTI PROFILE CONFIG */}
            {activeTab === 'profiles' && (
              <div className="space-y-6 animate-fade-in">
                <div className="border-b border-slate-900 pb-4 space-y-1">
                  <h2 className="text-lg font-bold text-white tracking-tight">Professional CV Profiles</h2>
                  <p className="text-xs text-slate-400">Setup specific professional niches, upload custom master attachments, and control matching rules.</p>
                </div>
                <ProfileManager uid={currentUser.uid} />
              </div>
            )}

          </main>

          {/* Footer element */}
          <footer className="border-t border-slate-900/80 py-5 text-center text-[10px] text-slate-600 font-mono tracking-widest bg-slate-950/20 shrink-0 select-none">
            APPLYR PLATFORM V2.0 · CONSOLE SECURED
          </footer>

        </div>

        {/* CRM Detail Modal popup overlay */}
        {selectedApp && (
          <ApplicationDetailModal
            uid={currentUser.uid}
            application={selectedApp}
            onClose={() => setSelectedApp(null)}
            onRefreshList={() => {
              // snapshot handles of firestore listen to updating state automatically, no manual triggers required
            }}
          />
        )}

      </div>
    </>
  );
}

export default function ErrorBoundaryWrappedApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
