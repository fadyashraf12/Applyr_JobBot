import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '../../../../lib/firebase/admin';

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
      console.warn('ID token verification failed in applications dynamic route:', err);
    }
  }

  // Backup fallback: check query string or body
  if (!uid) {
    const { searchParams } = new URL(request.url);
    uid = searchParams.get('uid');
  }

  return uid;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const uid = await getAuthorizedUid(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or missing uid' }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Missing application ID (id)' }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.doc(`users/${uid}/applications/${id}`);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const data = snap.data();
    const formattedApp = {
      ...data,
      applicationId: snap.id,
      appliedAt: data?.appliedAt?.toDate ? data.appliedAt.toDate().toISOString() : data?.appliedAt,
      followUpDate: data?.followUpDate?.toDate ? data.followUpDate.toDate().toISOString() : data?.followUpDate,
      lastReplyAt: data?.lastReplyAt?.toDate ? data.lastReplyAt.toDate().toISOString() : data?.lastReplyAt,
    };

    return NextResponse.json({ application: formattedApp });
  } catch (error: any) {
    console.error('Error fetching application:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const uid = await getAuthorizedUid(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or missing uid' }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Missing application ID (id)' }, { status: 400 });
    }

    const body = await request.json();
    const cleanFields: Record<string, any> = {};

    // Allow updating specific permitted tracker fields dynamically
    const fieldsToUpdate = [
      'company',
      'jobTitle',
      'hrEmail',
      'status',
      'notes',
      'followUpDate',
      'contacts',
      'emailSubject',
      'emailBody',
      'jobDescription',
      'profileId',
      'tailoredCvFileId',
      'recruiterReplied',
      'lastReplySnippet',
    ];

    for (const key of fieldsToUpdate) {
      if (body[key] !== undefined) {
        if (key === 'followUpDate' && body[key] !== null) {
          cleanFields[key] = new Date(body[key]);
        } else {
          cleanFields[key] = body[key];
        }
      }
    }

    cleanFields.updatedAt = new Date();

    const db = getAdminDb();
    const docRef = db.doc(`users/${uid}/applications/${id}`);
    
    await docRef.set(cleanFields, { merge: true });

    return NextResponse.json({ success: true, updatedFields: cleanFields });
  } catch (error: any) {
    console.error('Error patching application:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const uid = await getAuthorizedUid(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or missing uid' }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Missing application ID (id)' }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.doc(`users/${uid}/applications/${id}`);
    
    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting application:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
