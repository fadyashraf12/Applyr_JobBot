import { Request } from 'express';
import { getAdminAuth } from '../lib/firebase/admin';
import { logError } from '../lib/logger';

export async function getAuthorizedUid(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.substring(7);
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      return decoded.uid;
    } catch (err) {
      logError('api-auth-header-verify', err);
      // If header was supplied but failed verification, do NOT fall back to query/body.
      return null;
    }
  }

  // Fall back to query or body only if no Authorization header was supplied
  const queryUid = req.query.uid;
  if (typeof queryUid === 'string' && queryUid.trim()) {
    return queryUid.trim();
  }

  const bodyUid = req.body?.uid;
  if (typeof bodyUid === 'string' && bodyUid.trim()) {
    return bodyUid.trim();
  }

  return null;
}
