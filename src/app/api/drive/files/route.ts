import { NextRequest, NextResponse } from 'next/server';
import { listFilesForUser } from '../../../lib/google/drive';
import { getAdminAuth } from '../../../lib/firebase/admin';

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
      console.warn('ID token verification failed in drive files route:', err);
    }
  }

  if (!uid) {
    const { searchParams } = new URL(request.url);
    uid = searchParams.get('uid');
  }

  return uid;
}

export async function GET(request: NextRequest) {
  try {
    const uid = await getAuthorizedUid(request);

    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized: Missing owner user ID (uid) or invalid credentials' }, { status: 401 });
    }

    const files = await listFilesForUser(uid);
    return NextResponse.json({ files });
  } catch (error: any) {
    console.error('Error listing drive files:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
