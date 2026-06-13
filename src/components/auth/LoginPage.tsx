import React, { useState } from 'react';
import { Loader } from 'lucide-react';

interface LoginPageProps {
  onGoogleSignIn: () => void;
  isLoading: boolean;
}

export default function LoginPage({ onGoogleSignIn, isLoading }: LoginPageProps) {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const features = [
    {
      icon: '🤖',
      title: 'AI-Powered Automation',
      description: 'Automatically tailor resumes and generate cover letters using advanced AI'
    },
    {
      icon: '📧',
      title: 'Gmail Integration',
      description: 'Send tailored applications directly from Gmail with live tracking'
    },
    {
      icon: '☁️',
      title: 'Cloud Vault',
      description: 'Secure cloud storage for your CV profiles and application documents'
    },
    {
      icon: '🤖',
      title: 'Telegram Bot',
      description: 'Manage applications and receive alerts via Telegram in real-time'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img src="/rectangular_logo.svg" alt="Applyr Logo" className="h-8 w-auto" />
            <span className="text-xs font-bold text-slate-400 tracking-widest hidden sm:inline">APPLYR</span>
          </div>
          <div className="text-xs text-slate-500 font-mono">v2.0</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col min-h-[calc(100vh-64px)]">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left Column - Hero Content */}
              <div className="space-y-8 text-center lg:text-left">
                {/* Logo */}
                <div className="flex justify-center lg:justify-start">
                  <div className="relative inline-flex">
                    <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-2xl opacity-60"></div>
                    <img src="/square_logo.svg" alt="Applyr Emblem" className="h-24 w-24 relative" />
                  </div>
                </div>

                {/* Headline */}
                <div className="space-y-4">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                    <span className="block text-white">Job Search</span>
                    <span className="block bg-gradient-to-r from-indigo-400 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
                      Automated
                    </span>
                  </h1>
                  <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-md mx-auto lg:mx-0">
                    Connect your Gmail and Google Drive. Let AI tailor your applications while you focus on what matters.
                  </p>
                </div>

                {/* Key Benefits */}
                <div className="space-y-3 pt-4">
                  {[
                    'AI-powered resume tailoring',
                    'Automated cover letter generation',
                    'Real-time application tracking'
                  ].map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm text-slate-300">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0"></div>
                      {benefit}
                    </div>
                  ))}
                </div>

                {/* Sign In Button */}
                <div className="pt-6">
                  <button
                    onClick={onGoogleSignIn}
                    disabled={isLoading}
                    className="w-full sm:w-auto h-12 px-8 inline-flex items-center justify-center gap-3 font-semibold text-sm rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white border border-indigo-500/50 shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span>Sign in with Google</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Security Notice */}
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500 text-center lg:text-left">
                    🔒 Your data is encrypted and secure. We never store your passwords.
                  </p>
                </div>
              </div>

              {/* Right Column - Features Grid */}
              <div className="hidden lg:grid grid-cols-1 gap-4">
                {features.map((feature, idx) => (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredFeature(idx)}
                    onMouseLeave={() => setHoveredFeature(null)}
                    className={`p-5 rounded-lg border transition-all duration-300 cursor-default ${
                      hoveredFeature === idx
                        ? 'bg-slate-800/80 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-2xl flex-shrink-0">{feature.icon}</span>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-sm text-white">{feature.title}</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/50 py-6 text-center text-xs text-slate-600 font-mono tracking-wider">
        APPLYR PLATFORM · SECURE · AUTOMATED · INTELLIGENT
      </footer>
    </div>
  );
}
