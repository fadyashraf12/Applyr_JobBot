import { NextRequest, NextResponse } from 'next/server';
import { deleteFile } from '../../../lib/google/drive';
import { getAdminAuth } from '../../../lib/firebase/admin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function getAuthorizedUid(request: NextRequest, body: any): Promise<string | null> {
  let uid: string | null = null;
  const authHeader = request.headers.get('Authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      console.warn('ID token verification failed in drive delete route:', err);
    }
  }

  if (!uid) {
    uid = body.uid;
  }

  return uid;
}

async function handleDeleteRequest(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId } = body;
    const uid = await getAuthorizedUid(request, body);

    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized: Missing owner user ID (uid) or invalid credentials.' }, { status: 401 });
    }

    if (!fileId) {
      return NextResponse.json({ error: 'Missing file ID (fileId).' }, { status: 400 });
    }

    await deleteFile(uid, fileId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting drive file:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleDeleteRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleDeleteRequest(request);
}
