import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '../../../../lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { watchInbox } from '../../../../lib/google/gmail';
import { logError } from '../../../../lib/logger';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function getAuthorizedUid(request: NextRequest): Promise<string | null> {
  let uid: string | null = null;
  const authHeader = request.headers.get('Authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      logError('gmail-watch-auth-warn', err);
    }
  }

  if (!uid) {
    const { searchParams } = new URL(request.url);
    uid = searchParams.get('uid');
  }

  return uid;
}

export async function POST(request: NextRequest) {
  try {
    const uid = await getAuthorizedUid(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or missing uid' }, { status: 401 });
    }

    const { historyId, expiration } = await watchInbox(uid);
    const expiryTimestamp = Timestamp.fromMillis(Number(expiration));

    const db = getAdminDb();
    await db.doc(`users/${uid}/config/google`).set({
      gmailWatchExpiry: expiryTimestamp,
      gmailHistoryId: historyId
    }, { merge: true });

    return NextResponse.json({
      success: true,
      expiry: expiration
    });

  } catch (error: any) {
    logError('gmail-watch-POST', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const uid = await getAuthorizedUid(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or missing uid' }, { status: 401 });
    }

    const db = getAdminDb();
    const configSnap = await db.doc(`users/${uid}/config/google`).get();
    
    let gmailWatchExpiry = null;
    let gmailHistoryId = null;
    
    if (configSnap.exists) {
      const data = configSnap.data();
      gmailWatchExpiry = data?.gmailWatchExpiry || null;
      gmailHistoryId = data?.gmailHistoryId || null;
    }

    let renewNeeded = false;
    let expiryMillis = 0;

    if (!gmailWatchExpiry) {
      renewNeeded = true;
    } else {
      expiryMillis = gmailWatchExpiry.toDate().getTime();
      const timeDiff = expiryMillis - Date.now();
      // Renew if expiring within 24 hours
      if (timeDiff < 24 * 60 * 60 * 1000) {
        renewNeeded = true;
      }
    }

    if (renewNeeded) {
      const { historyId, expiration } = await watchInbox(uid);
      const expiryTimestamp = Timestamp.fromMillis(Number(expiration));

      await db.doc(`users/${uid}/config/google`).set({
        gmailWatchExpiry: expiryTimestamp,
        gmailHistoryId: historyId
      }, { merge: true });

      return NextResponse.json({
        renewed: true,
        expiry: Number(expiration)
      });
    }

    return NextResponse.json({
      renewed: false,
      expiry: expiryMillis
    });

  } catch (error: any) {
    logError('gmail-watch-GET', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
