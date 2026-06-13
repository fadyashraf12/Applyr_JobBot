import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { doc, onSnapshot, collection, updateDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase/client';
import { openGoogleAuthPopup } from './lib/auth/popupAuth';

// Import newly implemented components
import LoginPage from './components/auth/LoginPage';
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
  const [googleSignInLoading, setGoogleSignInLoading] = useState(false);

  // Layout navigation tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'applications' | 'vault' | 'profiles'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Dynamic document title update
  useEffect(() => {
    const tabNames: Record<string, string> = {
      dashboard: 'Dashboard',
      applications: 'Applications CRM',
      vault: 'Cloud Vault',
      profiles: 'CV Profiles',
    };
    document.title = `Applyr | ${tabNames[activeTab] || 'JobBot'}`;
  }, [activeTab]);

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

  // Google sign in trigger using popup
  const handleGoogleSignIn = async () => {
    setGoogleSignInLoading(true);
    try {
      const result = await openGoogleAuthPopup();
      if (!result.success) {
        console.error('Google sign-in failed:', result.error);
        return;
      }
      
      // If we got a custom token, sign in with it
      if (result.token) {
        await signInWithCustomToken(auth, result.token);
      }
      // If successful, onAuthStateChanged will trigger and update currentUser
    } catch (err) {
      console.error('Error during Google authentication:', err);
    } finally {
      setGoogleSignInLoading(false);
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

  // A: Pre-login Landing Page with Modern Design
  if (!currentUser) {
    return (
      <ErrorBoundary>
        <LoginPage onGoogleSignIn={handleGoogleSignIn} isLoading={googleSignInLoading} />
      </ErrorBoundary>
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
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
                  <p className="text-sm text-slate-400 mt-1">Track your job applications and manage your profiles</p>
                </div>
                <TelegramLaunchpad uid={currentUser.uid} />
                <MetricsRow
                  totalAppsCount={totalAppsCount}
                  pendingAppsCount={pendingAppsCount}
                  interviewAppsCount={interviewAppsCount}
                />
              </div>
            )}

            {/* VIEW TAB 2: APPLICATIONS CRM */}
            {activeTab === 'applications' && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">Applications</h1>
                  <p className="text-sm text-slate-400 mt-1">Manage and track all your job applications</p>
                </div>
                <ApplicationsList
                  applications={applications}
                  isLoading={appsLoading}
                  onSelectApp={setSelectedApp}
                  onUpdateStatus={handleUpdateStatus}
                />
                {selectedApp && (
                  <ApplicationDetailModal
                    app={selectedApp}
                    onClose={() => setSelectedApp(null)}
                    onUpdateStatus={handleUpdateStatus}
                  />
                )}
              </div>
            )}

            {/* VIEW TAB 3: VAULT */}
            {activeTab === 'vault' && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">Cloud Vault</h1>
                  <p className="text-sm text-slate-400 mt-1">Access your stored documents and files</p>
                </div>
                <VaultExplorer uid={currentUser.uid} />
              </div>
            )}

            {/* VIEW TAB 4: PROFILES */}
            {activeTab === 'profiles' && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">CV Profiles</h1>
                  <p className="text-sm text-slate-400 mt-1">Create and manage your CV profiles</p>
                </div>
                <ProfileManager uid={currentUser.uid} />
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

export default App;
