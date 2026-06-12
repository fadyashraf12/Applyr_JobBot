import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '../../../../lib/firebase/admin';
import { getValidAccessToken } from '../../../../lib/google/oauth';

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
      console.warn('ID token verification failed in watch route:', err);
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

    // Get decrypted access token
    const accessToken = await getValidAccessToken(uid);

    // Get current GCP project ID for Pub/sub topic
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'applyr-prod';
    const topicName = `projects/${projectId}/topics/gmail-notifications`;

    // Register Inbox Gmail Watch via Google REST API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topicName,
        labelIds: ['INBOX']
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Gmail watch API failure: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    const expiryTimestamp = data.expiration ? new Date(Number(data.expiration)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const db = getAdminDb();
    await db.doc(`users/${uid}/config/google`).set({
      gmailWatchExpiry: expiryTimestamp,
      gmailHistoryId: data.historyId || null
    }, { merge: true });

    return NextResponse.json({
      success: true,
      historyId: data.historyId,
      expiration: expiryTimestamp.toISOString()
    });

  } catch (error: any) {
    console.error('Error establishing Gmail watch watcher:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
