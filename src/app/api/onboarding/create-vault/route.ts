import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '../../../../lib/google/oauth';
import { getAdminDb } from '../../../../lib/firebase/admin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, folderName } = body;

    if (!uid) {
      return NextResponse.json({ error: 'Missing owner user ID (uid).' }, { status: 400 });
    }

    if (!folderName) {
      return NextResponse.json({ error: 'Missing folder name.' }, { status: 400 });
    }

    // 1. Retrieve a valid access token (handles decryption and refresh tokens)
    const accessToken = await getValidAccessToken(uid);

    // 2. Create the top-level root vault folder on Google Drive
    const createVaultRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createVaultRes.ok) {
      const errorText = await createVaultRes.text();
      console.error('Drive API Root Folder creation failed:', errorText);
      return NextResponse.json({ error: `Drive API error: ${errorText}` }, { status: 502 });
    }

    const vaultFolder = await createVaultRes.json();
    const vaultFolderId = vaultFolder.id;

    // 3. Create a default "Software Engineer" profile sub-folder inside the vault folder
    const createSubfolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Software Engineer',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [vaultFolderId],
      }),
    });

    let profileFolderId = null;
    if (createSubfolderRes.ok) {
      const subFolderData = await createSubfolderRes.json();
      profileFolderId = subFolderData.id;
    } else {
      console.warn('Sub-profile folder creation failed, proceeding on-fallback.');
    }

    const db = getAdminDb();
    
    // 4. Set the Google drive details on user-config
    await db.doc(`users/${uid}/config/google`).set({
      vaultFolderId,
      vaultFolderName: folderName,
    }, { merge: true });

    // 5. Create default Profile schema in subcollection
    const profileId = 'software_engineer_default';
    await db.doc(`users/${uid}/profiles/${profileId}`).set({
      profileId,
      name: 'Software Engineer',
      driveFolderId: profileFolderId,
      masterCvFileId: null,
      coverLetterTemplateFileId: null,
      headshotFileId: null,
      isActive: true,
      createdAt: new Date(),
    });

    // 6. Update user's active profile configuration
    await db.doc(`users/${uid}`).set({
      activeProfileId: profileId,
    }, { merge: true });

    return NextResponse.json({
      success: true,
      vaultFolderId,
      profileFolderId,
    });

  } catch (error: any) {
    console.error('Error in create-vault route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
