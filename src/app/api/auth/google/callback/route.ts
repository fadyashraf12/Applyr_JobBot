import { NextRequest } from 'next/server';
import { exchangeCodeForTokens } from '../../../../../lib/google/oauth';
import { encrypt } from '../../../../../lib/crypto';
import { getAdminDb } from '../../../../../lib/firebase/admin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return new Response('Missing authorization code', { status: 400 });
    }

    if (!state) {
      return new Response('Missing state verification parameter', { status: 400 });
    }

    // Expected state format: service:uid
    const [service, uid] = state.split(':');

    if (!uid || (service !== 'drive' && service !== 'gmail')) {
      return new Response('Invalid state parameter format', { status: 400 });
    }

    // Exchange auth code for raw access and refresh tokens
    const tokens = await exchangeCodeForTokens(code);

    // Encrypt the tokens to secure them at rest
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

    // Set or update the config database document
    await configRef.set(updatePayload, { merge: true });

    // Update root user profile slightly to ensure the core user record exists matches
    const userRef = db.doc(`users/${uid}`);
    await userRef.set({
      uid,
      updatedAt: new Date()
    }, { merge: true });

    // Send visual result page that notifies the React application popup about completion
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Workspace Linked Successfully</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background-color: #0d1117;
              color: #c9d1d9;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .card {
              background-color: #161b22;
              border: 1px solid #30363d;
              border-radius: 12px;
              padding: 32px;
              text-align: center;
              box-shadow: 0 8px 24px rgba(0,0,0,0.5);
              max-width: 420px;
            }
            .icon {
              font-size: 48px;
              color: #2ea043;
              margin-bottom: 16px;
            }
            h1 { font-size: 22px; font-weight: 600; margin-top: 0; margin-bottom: 12px; color: #58a6ff; }
            p { font-size: 14px; color: #8b949e; line-height: 1.6; margin-bottom: 24px; }
            .badge {
              display: inline-block;
              background-color: #1f242c;
              border: 1px solid #30363d;
              color: #58a6ff;
              font-size: 13px;
              padding: 6px 12px;
              border-radius: 6px;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✓</div>
            <h1>Workspace Connected!</h1>
            <p>Your Google ${service === 'drive' ? 'Drive' : 'Gmail'} has been successfully connected to your Applyr account.</p>
            <div id="status" class="badge">Closing window...</div>
          </div>
          <script>
            try {
              if (window.opener) {
                // Signal back success to our app's onboarding/dashboard UI
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', service: '${service}' }, '*');
                setTimeout(() => {
                  window.close();
                }, 1000);
              } else {
                setTimeout(() => {
                  window.location.href = '/onboarding';
                }, 1500);
              }
            } catch (err) {
              console.error('Window closing helper failed:', err);
              document.getElementById('status').innerText = 'You can safely close this tab';
            }
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error: any) {
    console.error('OAuth callback execution error:', error);
    return new Response(`Error exchanging Google OAuth tokens: ${error.message || 'Internal Server Error'}`, { status: 500 });
  }
}
