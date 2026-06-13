import React, { useEffect } from 'react';
import { auth } from '../../lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';

// Dashboard layout - automatically checks and renews Gmail watch registration on mount
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          await fetch(`/api/gmail/watch?uid=${user.uid}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          });
        } catch (err) {
          console.warn('Failed to renew/check Gmail watch in layout check:', err);
        }
      }
    });

    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen text-slate-100 bg-slate-950 flex flex-col md:flex-row">
      <div className="flex-1 overflow-y-auto font-sans">
        {children}
      </div>
    </div>
  );
}
