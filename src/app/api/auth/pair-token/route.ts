import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAdminDb, getAdminAuth } from '../../../../lib/firebase/admin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let uid: string | null = null;

    // Try verifying ID token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      try {
        const decoded = await getAdminAuth().verifyIdToken(idToken);
        uid = decoded.uid;
      } catch (err) {
        console.warn('ID token verification failed, checking alternate payload methods:', err);
      }
    }

    // Fallback: parse body
    if (!uid) {
      try {
        const body = await request.json();
        uid = body.uid;
      } catch (e) {
        // Body reading failed
      }
    }

    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid credentials' }, { status: 401 });
    }

    const token = randomUUID();
    const db = getAdminDb();

    // Store pairing token with 15-minute expiration
    const expiryDate = new Date(Date.now() + 15 * 60 * 1000); // +15 mins
    
    await db.collection('pairing_tokens').doc(token).set({
      token,
      firebaseUid: uid,
      createdAt: new Date(),
      expiresAt: expiryDate,
      used: false
    });

    return NextResponse.json({ token });

  } catch (error: any) {
    console.error('Error in pairing token generation:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
