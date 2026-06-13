import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '../../../lib/firebase/admin';
import { logError } from '../../../lib/logger';

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
      logError('api-applications-auth-idtoken', err);
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
    logError('api-applications-GET', error);
    return NextResponse.json({ error: 'Failed to balance application records.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = await getAuthorizedUid(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or missing uid' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json({ error: 'Malformed request JSON body.' }, { status: 400 });
    }

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

    // Rigid check: Non-empty strings
    if (!company || typeof company !== 'string' || !company.trim()) {
      return NextResponse.json({ error: 'Missing or malformed company name.' }, { status: 400 });
    }
    if (!jobTitle || typeof jobTitle !== 'string' || !jobTitle.trim()) {
      return NextResponse.json({ error: 'Missing or malformed job title.' }, { status: 400 });
    }

    if (profileId && (typeof profileId !== 'string' || !profileId.trim())) {
      return NextResponse.json({ error: 'Invalid profile identity format.' }, { status: 400 });
    }

    const db = getAdminDb();
    const appColRef = db.collection(`users/${uid}/applications`);
    
    // Create new document reference to auto-generate a valid ID
    const newDocRef = appColRef.doc();
    const applicationId = newDocRef.id;

    const applicationRecord = {
      applicationId,
      company: company.trim(),
      jobTitle: jobTitle.trim(),
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
    logError('api-applications-POST', error);
    return NextResponse.json({ error: 'Failed to create application log safely.' }, { status: 500 });
  }
}
