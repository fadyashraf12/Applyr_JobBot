import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

// Load variables from .env
dotenv.config();

import { buildAuthUrl, exchangeCodeForTokens, getValidAccessToken } from './src/lib/google/oauth';
import { encrypt } from './src/lib/crypto';
import { getAdminDb, getAdminAuth } from './src/lib/firebase/admin';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Setup standard json and form body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── API ROUTES ───

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  // GET /api/auth/google
  app.get('/api/auth/google', (req, res) => {
    try {
      const service = req.query.service as 'drive' | 'gmail';
      const uid = req.query.uid as string;

      if (!service || (service !== 'drive' && service !== 'gmail')) {
        return res.status(400).json({ error: 'Invalid or missing service. Must be "drive" or "gmail".' });
      }

      if (!uid) {
        return res.status(400).json({ error: 'Missing user ID (uid).' });
      }

      const authUrl = buildAuthUrl(service, uid);
      return res.redirect(authUrl);
    } catch (error: any) {
      console.error('Error initiating Google OAuth:', error);
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
      console.error('OAuth callback execution error:', error);
      return res.status(500).send(`Error exchanging Google OAuth tokens: ${error.message || 'Internal Server Error'}`);
    }
  });

  // POST /api/auth/pair-token
  app.post('/api/auth/pair-token', async (req, res) => {
    try {
      let uid = req.body.uid;

      // Extract ID token from OAuth Authorization bearer schema
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        try {
          const decoded = await getAdminAuth().verifyIdToken(idToken);
          uid = decoded.uid;
        } catch (err) {
          console.warn('ID token verification failed, checking payload elements:', err);
        }
      }

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
      console.error('Error in pairing token generation:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // POST /api/onboarding/create-vault
  app.post('/api/onboarding/create-vault', async (req, res) => {
    try {
      const { uid, folderName } = req.body;

      if (!uid) {
        return res.status(400).json({ error: 'Missing owner user ID (uid).' });
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
      console.error('Error in create-vault route:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // GET /api/drive/files
  app.get('/api/drive/files', async (req, res) => {
    try {
      const uid = req.query.uid as string;
      if (!uid) {
        return res.status(400).json({ error: 'Missing user ID (uid).' });
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
      console.error('Error listing Drive vaults:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/drive/delete
  app.post('/api/drive/delete', async (req, res) => {
    try {
      const { uid, fileId } = req.body;
      if (!uid || !fileId) {
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
      console.error('Error deleting Drive resource:', error);
      return res.status(505).json({ error: error.message });
    }
  });

  // ─── STATIC SHIELD SERVING (VITE OR COMPILED ASSETS) ───

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Applyr Admin Server] listening on http://localhost:${PORT}`);
  });
}

// Kickstart server loops
startServer();
