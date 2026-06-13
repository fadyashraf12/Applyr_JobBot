import React, { useState, useEffect } from 'react';
import FileCard from './FileCard';
import { auth } from '../../lib/firebase/client';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
}

interface VaultExplorerProps {
  uid: string;
}

export default function VaultExplorer({ uid }: VaultExplorerProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchFiles = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const res = await fetch(`/api/drive/files?uid=${uid}`, {
        headers,
      });
      if (!res.ok) {
        throw new Error('Could not connect with your Google Drive. Ensure OAuth permission remains valid.');
      }
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error('Drive listing error:', err);
      setErrorMsg(err.message || 'Error syncing workspace folders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [uid]);

  const handleDeleteFile = async (fileId: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const res = await fetch('/api/drive/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ uid, fileId }),
      });

      if (!res.ok) {
        throw new Error('Permission denied. Cannot delete selected asset from Drive.');
      }

      // Filter local state instantly
      setFiles((current) => current.filter((file) => file.id !== fileId));
    } catch (err: any) {
      alert(err.message || 'Delete operation failed. Please check your network connection.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
        <svg className="animate-spin h-7 w-7 text-indigo-500 mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-slate-400 text-xs font-mono tracking-wider">SYNCING DRIVE REPOSITORY...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 bg-red-950/20 border border-red-900/40 rounded-xl text-center max-w-lg mx-auto space-y-3">
        <p className="text-sm text-red-300 leading-relaxed font-medium">⚠️ {errorMsg}</p>
        <button
          onClick={fetchFiles}
          className="text-xs px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-semibold rounded-lg transition-all active:scale-95"
        >
          Retry Connection Sync
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-850 pb-3">
        <h3 className="text-sm uppercase font-bold tracking-wider text-slate-400">Drive Assets</h3>
        <button
          onClick={fetchFiles}
          className="text-xs px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-750 hover:bg-slate-850 text-slate-350 rounded font-semibold transition-all active:scale-95 flex items-center gap-1.5"
          aria-label="Refresh list"
        >
          <span>🔄</span> Refresh
        </button>
      </div>

      {files.length === 0 ? (
        <div className="border border-dashed border-slate-800 bg-slate-900/5 p-12 text-center rounded-xl max-w-lg mx-auto">
          <div className="text-2xl mb-3">📁</div>
          <h4 className="font-bold text-slate-300 text-sm">Cloud Directory Empty</h4>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Your customized PDF outputs and professional attachment subdirectories will sync here automatically upon recruiter execution.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {files.map((file) => (
            <FileCard key={file.id} file={file} onDelete={handleDeleteFile} />
          ))}
        </div>
      )}
    </div>
  );
}
