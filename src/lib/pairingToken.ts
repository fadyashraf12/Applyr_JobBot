import { randomUUID } from 'crypto';
import { getAdminDb } from './firebase/admin';

export async function createPairingToken(firebaseUid: string): Promise<string> {
  const db = getAdminDb();
  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins

  await db.collection('pairing_tokens').doc(token).set({
    token,
    firebaseUid,
    createdAt: now,
    expiresAt,
    used: false,
  });

  return token;
}

export interface PairingResult {
  success: boolean;
  error?: 'invalid' | 'used' | 'expired';
  firebaseUid?: string;
}

export async function consumePairingToken(token: string): Promise<PairingResult> {
  const db = getAdminDb();
  const tokenRef = db.collection('pairing_tokens').doc(token);
  const snap = await tokenRef.get();

  if (!snap.exists) {
    return { success: false, error: 'invalid' };
  }

  const data = snap.data();
  if (!data) {
    return { success: false, error: 'invalid' };
  }

  if (data.used) {
    return { success: false, error: 'used' };
  }

  const expiresTime = data.expiresAt?.toDate ? data.expiresAt.toDate().getTime() : new Date(data.expiresAt).getTime();
  if (expiresTime < Date.now()) {
    return { success: false, error: 'expired' };
  }

  // Mark as consumed
  await tokenRef.update({ used: true });

  return {
    success: true,
    firebaseUid: data.firebaseUid,
  };
}
