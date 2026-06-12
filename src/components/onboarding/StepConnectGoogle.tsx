import React from 'react';

interface StepConnectGoogleProps {
  uid: string;
  driveConnected: boolean;
  gmailConnected: boolean;
  onNext: () => void;
}

export default function StepConnectGoogle({
  uid,
  driveConnected,
  gmailConnected,
  onNext,
}: StepConnectGoogleProps) {

  const handleLink = (service: 'drive' | 'gmail') => {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    window.open(
      `/api/auth/google?service=${service}&uid=${uid}`,
      `google_auth_${service}`,
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
    );
  };

  const isCompleted = driveConnected && gmailConnected;

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left">
        <h3 className="text-lg font-bold text-white">Step 1 — Connect Google Workspace</h3>
        <p className="text-sm text-slate-400 mt-1">
          Applyr requires secure delegated access to Google Drive (to store tailored resumes) and Gmail (to send applications and receive alerts).
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Google Drive Connection Card */}
        <div className="bg-slate-900 border border-slate-800/80 hover:border-slate-700/60 p-6 rounded-xl flex flex-col justify-between h-52 transition-all">
          <div>
            <h4 className="font-bold text-white text-lg flex items-center gap-2">
              <span className="text-xl">📁</span> Connect Google Drive
            </h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Enables creating safe folders inside your Drive where your Master CV is saved and customized job attachments are temporarily compiled.
            </p>
          </div>
          <div className="flex items-center justify-between">
            {driveConnected ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/40"></span>
                Connected
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                Connection Required
              </span>
            )}
            <button
              onClick={() => handleLink('drive')}
              className={`text-xs px-4 py-2 font-semibold rounded-md transition-all active:scale-95 border ${
                driveConnected
                  ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-550 shadow-md shadow-indigo-600/10'
              }`}
            >
              {driveConnected ? 'Re-link Drive' : 'Link Drive'}
            </button>
          </div>
        </div>

        {/* Gmail Connection Card */}
        <div className="bg-slate-900 border border-slate-800/80 hover:border-slate-700/60 p-6 rounded-xl flex flex-col justify-between h-52 transition-all">
          <div>
            <h4 className="font-bold text-white text-lg flex items-center gap-2">
              <span className="text-xl">✉️</span> Connect Gmail Inbox
            </h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Allows emailing tailored cover documents automatically from your personal email and setting up the watcher script for real-time recruiter alerts.
            </p>
          </div>
          <div className="flex items-center justify-between">
            {gmailConnected ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/40"></span>
                Connected
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                Connection Required
              </span>
            )}
            <button
              onClick={() => handleLink('gmail')}
              className={`text-xs px-4 py-2 font-semibold rounded-md transition-all active:scale-95 border ${
                gmailConnected
                  ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-550 shadow-md shadow-indigo-600/10'
              }`}
            >
              {gmailConnected ? 'Re-link Gmail' : 'Link Gmail'}
            </button>
          </div>
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          onClick={onNext}
          disabled={!isCompleted}
          className={`h-11 px-6 inline-flex items-center justify-center font-semibold rounded-lg transition-all border ${
            isCompleted
              ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-600/15 cursor-pointer active:scale-95'
              : 'bg-slate-800 text-slate-500 border-slate-850 cursor-not-allowed'
          }`}
        >
          Continue to Step 2 ➜
        </button>
      </div>
    </div>
  );
}
