import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_API_KEY : null) || firebaseConfigJson.apiKey || ((import.meta as any).env?.VITE_FIREBASE_API_KEY || ''),
  authDomain: (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN : null) || firebaseConfigJson.authDomain || ((import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || ''),
  projectId: (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID : null) || firebaseConfigJson.projectId || ((import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || ''),
  storageBucket: (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET : null) || firebaseConfigJson.storageBucket || ((import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || ''),
  messagingSenderId: (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID : null) || firebaseConfigJson.messagingSenderId || ((import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
  appId: (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_APP_ID : null) || firebaseConfigJson.appId || ((import.meta as any).env?.VITE_FIREBASE_APP_ID || ''),
};

// Singleton initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Firestore Error Handler as specified in the firebase-integration skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default app;
