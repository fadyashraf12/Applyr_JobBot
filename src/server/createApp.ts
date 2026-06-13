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

  // GET /api/auth/google/login - Initial login popup for unauthenticated users
  app.get('/api/auth/google/login', async (req, res) => {
    try {
      // For initial login, we need identity scopes (openid, email, profile) plus drive for the vault
    const authUrl = buildAuthUrl('drive', 'login_flow', 'drive:login_flow');
      return res.redirect(authUrl);
    } catch (error: any) {
      logError('api-auth-google-login-init', error);
      return res.status(500).send(`Error initiating Google OAuth: ${error.message}`);
    }
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

      const [service, uidOrFlow] = state.split(':');

      if (!uidOrFlow || (service !== 'drive' && service !== 'gmail')) {
        return res.status(400).send('Invalid state parameter format');
      }

      // Exchange authorization code for tokens
      const tokens = await exchangeCodeForTokens(code);

      // Encrypt tokens
      const encryptedAccess = encrypt(tokens.access_token);
      const encryptedRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

      const db = getAdminDb();
      const auth = getAdminAuth();

      // Handle initial login flow (unauthenticated user)
      if (uidOrFlow === 'login_flow') {
        try {
          // Get the user info from the Google token
          const { google } = require('googleapis');
          const googleAuth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          googleAuth.setCredentials({
            access_token: tokens.access_token
          });

          const people = google.people({ version: 'v1', auth: googleAuth });
          const profileRes = await people.people.get({
            resourceName: 'people/me',
            personFields: 'names,emailAddresses'
          });

          const email = profileRes.data.emailAddresses?.[0]?.value;
          const displayName = profileRes.data.names?.[0]?.displayName || email?.split('@')[0] || 'User';

          if (!email) {
            return res.status(400).send('Could not retrieve email from Google account');
          }

          // Create or get Firebase user
          let firebaseUser;
          try {
            firebaseUser = await auth.getUserByEmail(email);
          } catch (err: any) {
            if (err.code === 'auth/user-not-found') {
              // Create new Firebase user
              firebaseUser = await auth.createUser({
                email,
                displayName,
                emailVerified: true
              });
            } else {
              throw err;
            }
          }

          const uid = firebaseUser.uid;
          
          // Create a custom token for the frontend to sign in to Firebase
          const customToken = await auth.createCustomToken(uid);
          
          // Initialize user document with all required fields
          const configRef = db.doc(`users/${uid}/config/google`);
          const updatePayload: Record<string, any> = {
            connectedEmail: email,
            accessToken: encryptedAccess,
            tokenExpiry: tokens.expiry_date,
            driveConnected: true,
            gmailConnected: false,
          };

          if (encryptedRefresh) {
            updatePayload.refreshToken = encryptedRefresh;
          }

          await configRef.set(updatePayload, { merge: true });

          // Initialize root user document with all required fields
          const userRef = db.doc(`users/${uid}`);
          await userRef.set({
            uid,
            email,
            displayName,
            createdAt: new Date(),
            onboardingComplete: false,
            botState: 'idle',
            activeProfileId: null,
            monitoringChannelId: null,
            updatedAt: new Date()
          }, { merge: true });

          // Return success page with popup message
          res.setHeader('Content-Type', 'text/html');
          return res.send(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Authentication Successful</title>
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
                  <h1>Welcome to Applyr!</h1>
                  <p>Your Google account has been securely linked. You can now proceed with onboarding.</p>
                  <div class="badge">Autoclose process active...</div>
                </div>
                <script>
                  try {
                    if (window.opener) {
                      window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${customToken}' }, '*');
                      setTimeout(() => {
                        window.close();
                      }, 1200);
                    } else {
                      setTimeout(() => {
                        window.location.href = '/';
                      }, 1800);
                    }
                  } catch (err) {
                    console.error('Closing popup fail:', err);
                  }
                </script>
              </body>
            </html>
          `);
        } catch (loginErr: any) {
          logError('Error during login flow:', loginErr);
          return res.status(500).send(`Error during authentication: ${loginErr.message}`);
        }
      }

      // Handle post-login service connections (Drive/Gmail linking)
      const uid = uidOrFlow;
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
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const db = getAdminDb();
      const userRef = db.doc(`users/${uid}`);
      const userSnap = await userRef.get();
      const userData = userSnap.data();
      const vaultFolderId = userData?.vaultFolderId;

      if (!vaultFolderId) {
        return res.status(400).json({ error: 'Vault not configured' });
      }

      const accessToken = await getValidAccessToken(uid);

      const listRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${vaultFolderId}' in parents&spaces=drive&pageSize=100`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      if (!listRes.ok) {
        return res.status(502).json({ error: 'Drive API error' });
      }

      const data = await listRes.json();
      return res.json(data.files || []);
    } catch (error: any) {
      logError('Error listing Drive files:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Telegram webhook
  app.post('/api/telegram/webhook', telegramWebhookHandler);

  // Gmail webhook
  app.post('/api/gmail/webhook', gmailWebhookHandler);

  // 404 fallback
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
