import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, writeBatch, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import ProfileCard from './ProfileCard';

interface Profile {
  profileId: string;
  name: string;
  driveFolderId?: string;
  masterCvFileId?: string | null;
  coverLetterTemplateFileId?: string | null;
  headshotFileId?: string | null;
  isActive: boolean;
}

interface ProfileManagerProps {
  uid: string;
}

export default function ProfileManager({ uid }: ProfileManagerProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const colRef = collection(db, `users/${uid}/profiles`);
    const unsubscribe = onSnapshot(colRef, (snap) => {
      const list: Profile[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as Profile);
      });
      // Sort: active first, then by date/id
      list.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
      setProfiles(list);
      setLoading(false);
    }, (err) => {
      console.error('Error tracking profiles collection:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  const handleSetActive = async (id: string) => {
    try {
      const batch = writeBatch(db);
      
      // Set all other profiles inactive, target active
      profiles.forEach((p) => {
        const docRef = doc(db, `users/${uid}/profiles/${p.profileId}`);
        batch.update(docRef, { isActive: p.profileId === id });
      });

      // Update parent user document activeProfileId reference
      const userRef = doc(db, `users/${uid}`);
      batch.update(userRef, { activeProfileId: id });

      await batch.commit();
    } catch (err) {
      console.error('Error modifying active job profile:', err);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!window.confirm('Delete this CV profile? This will remove all local files and active structures.')) {
      return;
    }
    try {
      await deleteDoc(doc(db, `users/${uid}/profiles/${id}`));
    } catch (err) {
      console.error('Error removing profile card:', err);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    setIsCreating(true);
    try {
      const profileId = 'profile_' + Date.now();
      const docRef = doc(db, `users/${uid}/profiles/${profileId}`);
      
      const newProfile: Profile = {
        profileId,
        name: newProfileName,
        isActive: false,
        masterCvFileId: null,
        coverLetterTemplateFileId: null,
        headshotFileId: null,
        driveFolderId: '', // Syncing later via webhook or manual link
      };

      await setDoc(docRef, newProfile);
      setNewProfileName('');
      setShowModal(false);
    } catch (err) {
      console.error('Error creating profile document:', err);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
        <svg className="animate-spin h-7 w-7 text-indigo-500 mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-slate-400 text-xs font-mono tracking-wider">SYNCING JOB PROFILES...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-850 pb-3">
        <h3 className="text-sm uppercase font-bold tracking-wider text-slate-400">CV Management</h3>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs px-3 py-1.5 bg-indigo-650 hover:bg-indigo-600 border border-indigo-500 text-white rounded font-semibold transition-all active:scale-95"
          aria-label="Add project profile"
        >
          Create CV Profile +
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.profileId}
            profile={profile}
            onSetAtive={handleSetActive}
            onDelete={handleDeleteProfile}
          />
        ))}
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowModal(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
          
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl z-10 space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-white">Create Job Match Profile</h4>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-2">Profile Name</label>
                <input
                  type="text"
                  required
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  disabled={isCreating}
                  placeholder="e.g. Senior Machine Learning Engineer"
                  className="w-full h-11 px-4 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-sm text-white font-medium outline-none transition-all disabled:opacity-50"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isCreating}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-350 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-lg transition-all shadow-md shadow-indigo-600/10"
                >
                  {isCreating ? 'Creating...' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
