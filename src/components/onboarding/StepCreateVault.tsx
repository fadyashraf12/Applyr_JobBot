import React, { useState } from 'react';
import { auth } from '../../lib/firebase/client';

interface StepCreateVaultProps {
  uid: string;
  onFinish: () => void;
  onBack: () => void;
}

export default function StepCreateVault({ uid, onFinish, onBack }: StepCreateVaultProps) {
  const [vaultName, setVaultName] = useState('Applyr Vault');
  const [isLoading, setIsLoading] = useState(false);
  const [gdriveFolderId, setGDriveFolderId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateVault = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch('/api/onboarding/create-vault', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uid,
          folderName: vaultName,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to create Drive workspace folder.');
      }

      setGDriveFolderId(data.vaultFolderId);
    } catch (err: any) {
      console.error('Error in workspace generation:', err);
      setErrorMsg(err.message || 'Something went wrong while connecting with Google Drive. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left">
        <h3 className="text-lg font-bold text-white">Step 2 — Create Your Cloud Vault</h3>
        <p className="text-sm text-slate-400 mt-1">
          Generate an exclusive sandbox folder inside your Google Drive. This folder stores your master CVs and temporary customized attachments in full confidentiality.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800/85 p-6 rounded-xl space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Workspace Folder Name
          </label>
          <input
            type="text"
            value={vaultName}
            onChange={(e) => setVaultName(e.target.value)}
            disabled={isLoading || gdriveFolderId !== null}
            className="w-full h-11 px-4 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-white font-medium outline-none transition-all disabled:opacity-50"
            placeholder="e.g. Applyr Cloud Repository"
          />
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-lg text-xs text-red-300 leading-relaxed">
            <strong>Error:</strong> {errorMsg}
          </div>
        )}

        {gdriveFolderId ? (
          <div className="p-4 bg-emerald-950/30 border border-emerald-900/40 rounded-lg text-xs text-emerald-300 leading-relaxed flex items-start gap-2">
            <span className="text-sm">✓</span>
            <div>
              <p className="font-semibold text-emerald-200">Cloud Repository Successfully Generated!</p>
              <p className="mt-0.5 mt-2 font-mono bg-slate-950/40 p-1.5 rounded text-[10px] break-all border border-emerald-900/20">
                Drive ID: {gdriveFolderId}
              </p>
              <p className="mt-2">Created root repository and initialized a default "Software Engineer" profile inside it.</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            This will create a new folder with standard permissions directly in your drive root. You will be able to review all synced documents from Google Drive anytime.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="text-xs px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-750 hover:bg-slate-850 text-slate-300 rounded-lg transition-all active:scale-95 disabled:opacity-50"
        >
          ← Back to Connections
        </button>

        {gdriveFolderId ? (
          <button
            onClick={onFinish}
            className="h-11 px-8 inline-flex items-center justify-center font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-555 text-white shadow-lg shadow-emerald-600/15 transition-all cursor-pointer active:scale-95"
          >
            Finish Setup & Access Console 🏁
          </button>
        ) : (
          <button
            onClick={handleCreateVault}
            disabled={isLoading || !vaultName.trim()}
            className="h-11 px-6 inline-flex items-center justify-center font-semibold rounded-lg bg-indigo-650 hover:bg-indigo-600 border border-indigo-550 text-white shadow-lg shadow-indigo-600/10 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating cloud workspace...
              </>
            ) : (
              'Generate Cloud Workspace 📁'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
