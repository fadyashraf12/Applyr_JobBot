import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '../../../lib/firebase/admin';

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
      console.warn('ID token verification failed in applications route:', err);
    }
  }

  // Backup fallback: check query string or body if needed
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
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or missing uid' }, { status: 401 });
    }

    const db = getAdminDb();
    const appSnap = await db
      .collection(`users/${uid}/applications`)
      .orderBy('appliedAt', 'desc')
      .get();

    const applications: any[] = [];
    appSnap.forEach((doc) => {
      const data = doc.data();
      // Format timestamps for JSON compatibility
      const formattedApp = {
        ...data,
        applicationId: doc.id,
        appliedAt: data.appliedAt?.toDate ? data.appliedAt.toDate().toISOString() : data.appliedAt,
        followUpDate: data.followUpDate?.toDate ? data.followUpDate.toDate().toISOString() : data.followUpDate,
        lastReplyAt: data.lastReplyAt?.toDate ? data.lastReplyAt.toDate().toISOString() : data.lastReplyAt,
      };
      applications.push(formattedApp);
    });

    return NextResponse.json({ applications });
  } catch (error: any) {
    console.error('Error listing applications:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = await getAuthorizedUid(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or missing uid' }, { status: 401 });
    }

    const body = await request.json();
    const {
      company,
      jobTitle,
      hrEmail,
      status = 'pending',
      notes = '',
      followUpDate = null,
      contacts = [],
      emailSubject = '',
      emailBody = '',
      jobDescription = '',
      profileId = '',
      tailoredCvFileId = '',
      sourceType = 'text',
    } = body;

    if (!company || !jobTitle) {
      return NextResponse.json({ error: 'Missing required fields: company or jobTitle' }, { status: 400 });
    }

    const db = getAdminDb();
    const appColRef = db.collection(`users/${uid}/applications`);
    
    // Create new document reference to auto-generate a valid ID
    const newDocRef = appColRef.doc();
    const applicationId = newDocRef.id;

    const applicationRecord = {
      applicationId,
      company,
      jobTitle,
      hrEmail: hrEmail || '',
      status,
      appliedAt: new Date(),
      notes,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      contacts,
      emailSubject,
      emailBody,
      jobDescription,
      profileId,
      tailoredCvFileId,
      recruiterReplied: false,
      lastReplyAt: null,
      lastReplySnippet: null,
      sourceType,
      createdAt: new Date(),
    };

    await newDocRef.set(applicationRecord);

    return NextResponse.json({ success: true, applicationId, application: applicationRecord });
  } catch (error: any) {
    console.error('Error logging application:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
