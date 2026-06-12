import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let isInitialized = false;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

export function getFirebaseAdmin() {
  if (!isInitialized) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKeyRaw) {
      console.warn('Firebase Admin is not fully configured. Some server-side features might be disabled.');
      return {
        adminDb: null,
        adminAuth: null,
      };
    }

    try {
      if (getApps().length === 0) {
        const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }
      adminDb = getFirestore();
      adminAuth = getAuth();
      isInitialized = true;
    } catch (err) {
      console.error('Failed to initialize Firebase Admin SDK:', err);
    }
  }

  return { adminDb, adminAuth };
}

// Named exports for ease of access (using getter functions to avoid crash-on-startup)
export const getAdminDb = () => {
  const { adminDb } = getFirebaseAdmin();
  if (!adminDb) {
    throw new Error('Firebase Admin DB is not initialized. Check FIREBASE_ADMIN_env variables.');
  }
  return adminDb;
};

export const getAdminAuth = () => {
  const { adminAuth } = getFirebaseAdmin();
  if (!adminAuth) {
    throw new Error('Firebase Admin Auth is not initialized. Check FIREBASE_ADMIN_env variables.');
  }
  return adminAuth;
};
