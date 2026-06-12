import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import StepConnectGoogle from './StepConnectGoogle';
import StepCreateVault from './StepCreateVault';

interface OnboardingWizardProps {
  uid: string;
  onComplete: () => void;
}

export default function OnboardingWizard({ uid, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [googleConfig, setGoogleConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, `users/${uid}/config/google`);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setGoogleConfig(docSnap.data());
      } else {
        setGoogleConfig(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error reading real-time Google config:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  const driveConnected = googleConfig?.driveConnected === true;
  const gmailConnected = googleConfig?.gmailConnected === true;

  const handleFinish = async () => {
    try {
      // Set onboardingComplete to true
      await updateDoc(doc(db, `users/${uid}`), {
        onboardingComplete: true,
        updatedAt: new Date()
      });
      onComplete();
    } catch (e) {
      console.warn("updateDoc failed, attempting setDoc with merge instead:", e);
      try {
        await setDoc(doc(db, `users/${uid}`), {
          uid,
          onboardingComplete: true,
          updatedAt: new Date()
        }, { merge: true });
        onComplete();
      } catch (err) {
        console.error("Critical Firestore save error during onboarding completion:", err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
        <svg className="animate-spin h-8 w-8 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-slate-400 text-sm font-mono tracking-wider">SECURE CONFIG SYNCHRONIZATION...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full py-6 space-y-8">
      <div className="flex items-center justify-between border-b border-slate-900 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Account Onboarding</h2>
          <p className="text-sm text-slate-400">
            {step === 1 ? 'Step 1 of 2 — Connections config' : 'Step 2 of 2 — Active Repository creation'}
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-full font-mono text-slate-300">
          Setup active
        </span>
      </div>

      {step === 1 ? (
        <StepConnectGoogle
          uid={uid}
          driveConnected={driveConnected}
          gmailConnected={gmailConnected}
          onNext={() => setStep(2)}
        />
      ) : (
        <StepCreateVault
          uid={uid}
          onBack={() => setStep(1)}
          onFinish={handleFinish}
        />
      )}
    </div>
  );
}
