import { getValidAccessToken } from './oauth';
import { getAdminDb } from '../firebase/admin';

export async function listFilesForUser(uid: string) {
  const db = getAdminDb();
  const googleRef = db.doc(`users/${uid}/config/google`);
  const snap = await googleRef.get();
  
  if (!snap.exists) {
    throw new Error('Google OAuth config has not been configured.');
  }
  
  const config = snap.data();
  const folderId = config?.vaultFolderId;
  
  if (!folderId) {
    throw new Error('No root vault folder configured for this workspace.');
  }
  
  const accessToken = await getValidAccessToken(uid);
  
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&orderBy=modifiedTime+desc`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive API error: ${errText}`);
  }

  const data = await res.json();
  return data.files || [];
}

export async function deleteFileForUser(uid: string, fileId: string) {
  const accessToken = await getValidAccessToken(uid);
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Google Drive API error: ${errText}`);
  }
  return true;
}

export async function uploadFile(
  uid: string,
  folderId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const accessToken = await getValidAccessToken(uid);

  const boundary = 'foo_bar_boundary';
  
  const metadata = {
    name: filename,
    parents: [folderId],
  };

  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  
  const introBinaryBuffer = Buffer.from(delimiter + metadataPart + delimiter + `Content-Type: ${mimeType}\r\n\r\n`);
  const outroBinaryBuffer = Buffer.from(closeDelimiter);

  const finalBody = Buffer.concat([
    introBinaryBuffer,
    fileBuffer,
    outroBinaryBuffer
  ]);

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(finalBody.length)
    },
    body: finalBody as any,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to upload file to Google Drive: ${errorText}`);
  }

  const result = await res.json();
  return result.id;
}

export async function downloadFile(uid: string, fileId: string): Promise<Buffer> {
  const accessToken = await getValidAccessToken(uid);
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to download file ${fileId} from Drive: ${errorText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function createFolder(uid: string, folderName: string, parentFolderId?: string): Promise<string> {
  const accessToken = await getValidAccessToken(uid);
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentFolderId ? [parentFolderId] : undefined
  };

  const url = 'https://www.googleapis.com/drive/v3/files';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create Google Drive folder: ${errorText}`);
  }

  const result = await res.json();
  return result.id;
}

export async function updateFile(
  uid: string,
  fileId: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<void> {
  const accessToken = await getValidAccessToken(uid);
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': mimeType,
      'Content-Length': String(fileBuffer.length)
    },
    body: fileBuffer as any,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update Google Drive file content: ${errorText}`);
  }
}

export async function deleteFile(uid: string, fileId: string): Promise<void> {
  await deleteFileForUser(uid, fileId);

  // If the deleted file was referenced in any profile, clear that reference
  const db = getAdminDb();
  const profilesSnap = await db.collection(`users/${uid}/profiles`).get();
  
  const batch = db.batch();
  let hasUpdates = false;

  profilesSnap.forEach((doc) => {
    const data = doc.data();
    const updates: Record<string, any> = {};
    if (data.masterCvFileId === fileId) {
      updates.masterCvFileId = null;
    }
    if (data.coverLetterTemplateFileId === fileId) {
      updates.coverLetterTemplateFileId = null;
    }
    if (data.headshotFileId === fileId) {
      updates.headshotFileId = null;
    }

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      hasUpdates = true;
    }
  });

  if (hasUpdates) {
    await batch.commit();
  }
}
