import { getAdminDb } from './firebase/admin';
import { UserDoc, GoogleConfigDoc, ProfileDoc, BotSessionDoc } from '../types/firestore';

export interface UserContext {
  uid: string;
  user: UserDoc | null;
  googleConfig: GoogleConfigDoc | null;
  activeProfile: ProfileDoc | null;
  botSession: BotSessionDoc | null;
}

export async function loadUserContext(uid: string): Promise<UserContext> {
  const db = getAdminDb();
  
  // Load in parallel
  const [userSnap, googleConfigSnap, botSessionSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`users/${uid}/config/google`).get(),
    db.doc(`users/${uid}/botSession/current`).get(),
  ]);

  const user = userSnap.exists ? (userSnap.data() as UserDoc) : null;
  const googleConfig = googleConfigSnap.exists ? (googleConfigSnap.data() as GoogleConfigDoc) : null;
  const botSession = botSessionSnap.exists ? (botSessionSnap.data() as BotSessionDoc) : null;

  let activeProfile: ProfileDoc | null = null;
  if (user?.activeProfileId) {
    const profileSnap = await db.doc(`users/${uid}/profiles/${user.activeProfileId}`).get();
    if (profileSnap.exists) {
      activeProfile = profileSnap.data() as ProfileDoc;
    }
  }

  // Fallback to first profile if activeProfileId is missing or invalid but profiles exist
  if (!activeProfile) {
    const profilesSnap = await db.collection(`users/${uid}/profiles`).limit(1).get();
    if (!profilesSnap.empty) {
      activeProfile = profilesSnap.docs[0].data() as ProfileDoc;
    }
  }

  return {
    uid,
    user,
    googleConfig,
    activeProfile,
    botSession,
  };
}
