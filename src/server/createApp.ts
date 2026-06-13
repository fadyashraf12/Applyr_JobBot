import express from 'express';
import { randomUUID } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { buildAuthUrl, exchangeCodeForTokens, getValidAccessToken } from '../lib/google/oauth';
import { encrypt } from '../lib/crypto';
import { getAdminDb, getAdminAuth } from '../lib/firebase/admin';
import { watchInbox } from '../lib/google/gmail';
import { logError } from '../lib/logger';
import { getAuthorizedUid } from './auth';
import { telegramWebhookHandler } from './telegramWebhook';
import { gmailWebhookHandler } from './gmailWebhook';

export function createApp(): express.Express {
  const app = express();

  // Setup standard json and form body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── API ROUTES ───

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  // GET /api/auth/google
  app.get('/api/auth/google', async (req, res) => {
    try {
      const service = req.query.service as 'drive' | 'gmail';
      const uid = await getAuthorizedUid(req);

      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials or missing uid' });
      }

      if (!service || (service !== 'drive' && service !== 'gmail')) {
        return res.status(400).json({ error: 'Invalid or missing service. Must be "drive" or "gmail".' });
      }

      const authUrl = buildAuthUrl(service, uid);
      return res.redirect(authUrl);
    } catch (error: any) {
      logError('api-auth-google-init', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // GET /api/auth/google/callback
  app.get('/api/auth/google/callback', async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code) {
        return res.status(400).send('Missing authorization code');
      }

      if (!state) {
        return res.status(400).send('Missing state verification parameter');
      }

      const [service, uid] = state.split(':');

      if (!uid || (service !== 'drive' && service !== 'gmail')) {
        return res.status(400).send('Invalid state parameter format');
      }

      // Exchange authorization code for tokens
      const tokens = await exchangeCodeForTokens(code);

      // Encrypt tokens
      const encryptedAccess = encrypt(tokens.access_token);
      const encryptedRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

      const db = getAdminDb();
      const configRef = db.doc(`users/${uid}/config/google`);

      const updatePayload: Record<string, any> = {
        accessToken: encryptedAccess,
        tokenExpiry: tokens.expiry_date,
      };

      if (encryptedRefresh) {
        updatePayload.refreshToken = encryptedRefresh;
      }

      if (service === 'drive') {
        updatePayload.driveConnected = true;
      } else if (service === 'gmail') {
        updatePayload.gmailConnected = true;
      }

      // Merge and write tokens back securely
      await configRef.set(updatePayload, { merge: true });

      const userRef = db.doc(`users/${uid}`);
      await userRef.set({
        uid,
        updatedAt: new Date()
      }, { merge: true });

      res.setHeader('Content-Type', 'text/html');
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Workspace Connected Successfully</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background-color: #0b0f17;
                color: #f8fafc;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
              }
              .card {
                background-color: #111827;
                border: 1px solid #1f2937;
                border-radius: 12px;
                padding: 32px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                max-width: 440px;
              }
              .icon {
                font-size: 52px;
                color: #10b981;
                margin-bottom: 20px;
                animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
              }
              h1 { font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 12px; color: #60a5fa; }
              p { font-size: 14px; color: #9ca3af; line-height: 1.6; margin-bottom: 24px; }
              .badge {
                display: inline-block;
                background-color: #1e293b;
                border: 1px solid #334155;
                color: #38bdf8;
                font-size: 13px;
                padding: 6px 14px;
                border-radius: 9999px;
                font-weight: 600;
              }
              @keyframes scaleIn {
                from { transform: scale(0); }
                to { transform: scale(1); }
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">✓</div>
              <h1>Workspace Linked!</h1>
              <p>Your Google ${service === 'drive' ? 'Drive' : 'Gmail'} is securely linked. Communication is encrypted and safe.</p>
              <div id="status" class="badge">Autoclose process active...</div>
            </div>
            <script>
              try {
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', service: '${service}' }, '*');
                  setTimeout(() => {
                    window.close();
                  }, 1200);
                } else {
                  setTimeout(() => {
                    window.location.href = '/onboarding';
                  }, 1800);
                }
              } catch (err) {
                console.error('Closing popup fail:', err);
                document.getElementById('status').innerText = 'You can close this window now';
              }
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      logError('OAuth callback execution error:', error);
      return res.status(500).send(`Error exchanging Google OAuth tokens: ${error.message || 'Internal Server Error'}`);
    }
  });

  // POST /api/auth/pair-token
  app.post('/api/auth/pair-token', async (req, res) => {
    try {
      const uid = await getAuthorizedUid(req);

      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid credentials' });
      }

      const token = randomUUID();
      const db = getAdminDb();
      const expiryDate = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lease duration

      await db.collection('pairing_tokens').doc(token).set({
        token,
        firebaseUid: uid,
        createdAt: new Date(),
        expiresAt: expiryDate,
        used: false
      });

      return res.json({ token });
    } catch (error: any) {
      logError('Error in pairing token generation:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // POST /api/onboarding/create-vault
  app.post('/api/onboarding/create-vault', async (req, res) => {
    try {
      const uid = await getAuthorizedUid(req);
      const { folderName } = req.body;

      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials or missing uid' });
      }

      if (!folderName) {
        return res.status(400).json({ error: 'Missing repository name.' });
      }

      const accessToken = await getValidAccessToken(uid);

      // Create main Drive folder
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
        return res.status(502).json({ error: `Drive API creation error: ${errorText}` });
      }

      const vaultFolder = await createVaultRes.json();
      const vaultFolderId = vaultFolder.id;

      // Create active profile directory
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
      }

      const db = getAdminDb();
      
      await db.doc(`users/${uid}/config/google`).set({
        vaultFolderId,
        vaultFolderName: folderName,
      }, { merge: true });

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

      await db.doc(`users/${uid}`).set({
        activeProfileId: profileId,
      }, { merge: true });

      return res.json({
        success: true,
        vaultFolderId,
        profileFolderId,
      });
    } catch (error: any) {
      logError('Error in create-vault route:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // GET /api/drive/files
  app.get('/api/drive/files', async (req, res) => {
    try {
      const uid = await getAuthorizedUid(req);
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials or missing uid' });
      }

      const accessToken = await getValidAccessToken(uid);
      const db = getAdminDb();
      const configSnap = await db.doc(`users/${uid}/config/google`).get();
      if (!configSnap.exists) {
        return res.json({ files: [] });
      }

      const vaultFolderId = configSnap.data()?.vaultFolderId;
      if (!vaultFolderId) {
        return res.json({ files: [] });
      }

      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${vaultFolderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=100`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      if (!driveRes.ok) {
        return res.json({ files: [] });
      }

      const driveData = await driveRes.json();
      return res.json({ files: driveData.files || [] });
    } catch (error: any) {
      logError('Error listing Drive vaults:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/drive/delete
  app.post('/api/drive/delete', async (req, res) => {
    try {
      const uid = await getAuthorizedUid(req);
      const { fileId } = req.body;
      if (!uid || !fileId) {
        if (!uid) {
          return res.status(401).json({ error: 'Unauthorized: Invalid credentials or missing uid' });
        }
        return res.status(400).json({ error: 'Missing parameters.' });
      }

      const accessToken = await getValidAccessToken(uid);

      const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!driveRes.ok) {
        const errorText = await driveRes.text();
        return res.status(502).json({ error: errorText });
      }

      return res.json({ success: true });
    } catch (error: any) {
      logError('Error deleting Drive resource:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // ─── TELEGRAM & GMAIL WEBHOOK REGISTER ───
  app.post('/api/telegram-webhook', telegramWebhookHandler);
  app.post('/api/gmail/webhook', gmailWebhookHandler);

  // ─── GMAIL WATCH ENDPOINTS ───
  app.post('/api/gmail/watch', async (req, res) => {
    try {
      const uid = await getAuthorizedUid(req);
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials or missing uid' });
      }

      const { historyId, expiration } = await watchInbox(uid);
      const expiryTimestamp = Timestamp.fromMillis(Number(expiration));

      const db = getAdminDb();
      await db.doc(`users/${uid}/config/google`).set({
        gmailWatchExpiry: expiryTimestamp,
        gmailHistoryId: historyId
      }, { merge: true });

      return res.json({
        success: true,
        expiry: Number(expiration)
      });
    } catch (error: any) {
      logError('api-gmail-watch-POST', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  app.get('/api/gmail/watch', async (req, res) => {
    try {
      const uid = await getAuthorizedUid(req);
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials or missing uid' });
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

        return res.json({
          renewed: true,
          expiry: Number(expiration)
        });
      }

      return res.json({
        renewed: false,
        expiry: expiryMillis
      });
    } catch (error: any) {
      logError('api-gmail-watch-GET', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // ─── APPLICATIONS ENDPOINTS ───
  app.get('/api/applications', async (req, res) => {
    try {
      const uid = await getAuthorizedUid(req);
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials or missing uid' });
      }

      const db = getAdminDb();
      const appSnap = await db
        .collection(`users/${uid}/applications`)
        .orderBy('appliedAt', 'desc')
        .get();

      const applications: any[] = [];
      appSnap.forEach((doc) => {
        const data = doc.data();
        const formattedApp = {
          ...data,
          applicationId: doc.id,
          appliedAt: data.appliedAt?.toDate ? data.appliedAt.toDate().toISOString() : data.appliedAt,
          followUpDate: data.followUpDate?.toDate ? data.followUpDate.toDate().toISOString() : data.followUpDate,
          lastReplyAt: data.lastReplyAt?.toDate ? data.lastReplyAt.toDate().toISOString() : data.lastReplyAt,
        };
        applications.push(formattedApp);
      });

      return res.json({ applications });
    } catch (error: any) {
      logError('api-applications-GET', error);
      return res.status(500).json({ error: 'Failed to balance application records.' });
    }
  });

  app.post('/api/applications', async (req, res) => {
    try {
      const uid = await getAuthorizedUid(req);
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials or missing uid' });
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
      } = req.body;

      if (!company || typeof company !== 'string' || !company.trim()) {
        return res.status(400).json({ error: 'Missing or malformed company name.' });
      }
      if (!jobTitle || typeof jobTitle !== 'string' || !jobTitle.trim()) {
        return res.status(400).json({ error: 'Missing or malformed job title.' });
      }

      if (profileId && (typeof profileId !== 'string' || !profileId.trim())) {
        return res.status(400).json({ error: 'Invalid profile identity format.' });
      }

      const db = getAdminDb();
      const appColRef = db.collection(`users/${uid}/applications`);
      
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

      return res.json({ success: true, applicationId, application: applicationRecord });
    } catch (error: any) {
      logError('api-applications-POST', error);
      return res.status(500).json({ error: 'Failed to create application log safely.' });
    }
  });

  app.get('/api/applications/:id', async (req, res) => {
    try {
      const uid = await getAuthorizedUid(req);
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials or missing uid' });
      }

      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        return res.status(400).json({ error: 'Missing or malformed application ID' });
      }

      const db = getAdminDb();
      const docRef = db.doc(`users/${uid}/applications/${id}`);
      const snap = await docRef.get();

      if (!snap.exists) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const data = snap.data();
      const formattedApp = {
        ...data,
        applicationId: snap.id,
        appliedAt: data?.appliedAt?.toDate ? data.appliedAt.toDate().toISOString() : data?.appliedAt,
        followUpDate: data?.followUpDate?.toDate ? data.followUpDate.toDate().toISOString() : data?.followUpDate,
        lastReplyAt: data?.lastReplyAt?.toDate ? data.lastReplyAt.toDate().toISOString() : data?.lastReplyAt,
      };

      return res.json({ application: formattedApp });
    } catch (error: any) {
      logError('api-applications-id-GET', error);
      return res.status(500).json({ error: 'Failed to retrieve application details.' });
    }
  });

  app.patch('/api/applications/:id', async (req, res) => {
    try {
      const uid = await getAuthorizedUid(req);
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials or missing uid' });
      }

      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        return res.status(400).json({ error: 'Missing or malformed application ID' });
      }

      const cleanFields: Record<string, any> = {};
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
        if (req.body[key] !== undefined) {
          if (key === 'followUpDate' && req.body[key] !== null) {
            cleanFields[key] = new Date(req.body[key]);
          } else {
            cleanFields[key] = req.body[key];
          }
        }
      }

      cleanFields.updatedAt = new Date();

      const db = getAdminDb();
      const docRef = db.doc(`users/${uid}/applications/${id}`);
      
      const checkSnap = await docRef.get();
      if (!checkSnap.exists) {
        return res.status(404).json({ error: 'Application not found or unauthorized access.' });
      }

      await docRef.set(cleanFields, { merge: true });

      return res.json({ success: true, updatedFields: cleanFields });
    } catch (error: any) {
      logError('api-applications-id-PATCH', error);
      return res.status(500).json({ error: 'Failed to update application records securely.' });
    }
  });

  app.delete('/api/applications/:id', async (req, res) => {
    try {
      const uid = await getAuthorizedUid(req);
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials or missing uid' });
      }

      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        return res.status(400).json({ error: 'Missing or malformed application ID' });
      }

      const db = getAdminDb();
      const docRef = db.doc(`users/${uid}/applications/${id}`);

      const checkSnap = await docRef.get();
      if (!checkSnap.exists) {
        return res.status(404).json({ error: 'Application not found or unauthorized access.' });
      }
      
      await docRef.delete();

      return res.json({ success: true });
    } catch (error: any) {
      logError('api-applications-id-DELETE', error);
      return res.status(500).json({ error: 'Failed to purge application record securely.' });
    }
  });

  return app;
}
