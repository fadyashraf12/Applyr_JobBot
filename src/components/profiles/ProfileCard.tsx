import React from 'react';

interface Profile {
  profileId: string;
  name: string;
  driveFolderId?: string;
  masterCvFileId?: string | null;
  coverLetterTemplateFileId?: string | null;
  headshotFileId?: string | null;
  isActive: boolean;
}

interface ProfileCardProps {
  profile: Profile;
  onSetAtive: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ProfileCard({ profile, onSetAtive, onDelete }: ProfileCardProps) {
  const isCvUploaded = !!profile.masterCvFileId;
  const isCoverLetterUploaded = !!profile.coverLetterTemplateFileId;
  const isHeadshotUploaded = !!profile.headshotFileId;

  return (
    <div className={`p-6 rounded-2xl border transition-all duration-200 flex flex-col justify-between h-64 ${
      profile.isActive
        ? 'bg-slate-900 border-indigo-500/40 shadow-lg shadow-indigo-650/[0.03]'
        : 'bg-slate-900/55 border-slate-800/80 hover:border-slate-700/60'
    }`}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h4 className="font-extrabold text-white text-base overflow-hidden overflow-ellipsis line-clamp-1">
            {profile.name}
          </h4>
          {profile.isActive ? (
            <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full select-none shrink-0">
              Active Matcher
            </span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full select-none shrink-0 border border-slate-850">
              Ready
            </span>
          )}
        </div>

        {/* Assets Checklists */}
        <div className="space-y-1.5 pt-1.5 border-t border-slate-850/60">
          <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1">Upload Checklists</p>
          
          <div className="flex items-center gap-2 text-xs">
            <span className={`text-sm select-none ${isCvUploaded ? 'text-emerald-400' : 'text-slate-650'}`}>
              {isCvUploaded ? '✅' : '⬜'}
            </span>
            <span className={isCvUploaded ? 'text-slate-350 font-medium' : 'text-slate-500 italic'}>
              Master CV {isCvUploaded ? 'Uploaded (Docx)' : '(Awaiting Setup)'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className={`text-sm select-none ${isCoverLetterUploaded ? 'text-emerald-400' : 'text-slate-650'}`}>
              {isCoverLetterUploaded ? '✅' : '⬜'}
            </span>
            <span className={isCoverLetterUploaded ? 'text-slate-350 font-medium' : 'text-slate-500 italic'}>
              Letter Template {isCoverLetterUploaded ? 'Connected' : 'Optional (Fallback Draft)'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className={`text-sm select-none ${isHeadshotUploaded ? 'text-emerald-400' : 'text-slate-650'}`}>
              {isHeadshotUploaded ? '✅' : '⬜'}
            </span>
            <span className={isHeadshotUploaded ? 'text-slate-350 font-medium' : 'text-slate-500 italic'}>
              Professional Headshot {isHeadshotUploaded ? 'Linked' : 'Optional (CV Frame)'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-850/50 mt-4 shrink-0">
        {!profile.isActive ? (
          <button
            onClick={() => onSetAtive(profile.profileId)}
            className="text-xs px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded font-semibold text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            Switch to Profile
          </button>
        ) : (
          <span className="text-[11px] text-slate-500 font-medium select-none">
            Currently compiling applications
          </span>
        )}

        {!profile.isActive && (
          <button
            onClick={() => onDelete(profile.profileId)}
            className="text-[11px] text-rose-450 hover:text-rose-400 hover:bg-red-950/10 border border-transparent font-semibold px-2 py-1 rounded transition-colors active:scale-95 cursor-pointer ml-auto"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
