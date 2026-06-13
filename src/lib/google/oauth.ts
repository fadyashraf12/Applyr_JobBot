import { google } from 'googleapis';
import { getAdminDb } from '../firebase/admin';
import { encrypt, decrypt } from '../crypto';

function getOAuthClient(customRedirectUri?: string): any {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  let redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!redirectUri && process.env.NEXT_PUBLIC_APP_URL) {
    redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;
  }
  if (customRedirectUri) {
    redirectUri = customRedirectUri;
  }

  if (!clientId || !clientSecret) {
    console.warn('Google OAuth client ID/Secret warning: Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Build the Google OAuth consent URL for a given service
export function buildAuthUrl(service: 'drive' | 'gmail', uid: string, state?: string): string {
  const oauth2Client = getOAuthClient();
  
  let scopes = service === 'drive'
    ? ['https://www.googleapis.com/auth/drive.file']
    : [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ];

  // If this is the initial login flow, we need identity scopes
  if (uid === 'login_flow') {
    scopes = [
      ...scopes,
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];
  }
  
  const finalState = state || `${service}:${uid}`;

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // gets refresh token
    scope: scopes,
    state: finalState,
    prompt: 'consent' // guarantees refresh token is returned
  });
}

// Exchange the authorization code for access + refresh tokens
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}> {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return {
    access_token: tokens.access_token || '',
    refresh_token: tokens.refresh_token || '',
    expiry_date: tokens.expiry_date || 0
  };
}

// Refresh an expired access token using the refresh token
export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expiry_date: number;
}> {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return {
    access_token: credentials.access_token || '',
    expiry_date: credentials.expiry_date || 0
  };
}

// Get a valid access token, auto-refreshing if expired
export async function getValidAccessToken(uid: string): Promise<string> {
  const db = getAdminDb();
  const googleRef = db.doc(`users/${uid}/config/google`);
  const snap = await googleRef.get();
  
  if (!snap.exists) {
    throw new Error(`Google OAuth config not found for user: ${uid}`);
  }

  const data = snap.data();
  if (!data) {
    throw new Error(`Google OAuth config is empty for user: ${uid}`);
  }

  const { accessToken, refreshToken, tokenExpiry } = data;

  if (tokenExpiry && Number(tokenExpiry) > Date.now() + 60000) {
    // Access token is still valid. Decrypt and return.
    return decrypt(accessToken);
  }

  // Token is expired or expiring soon. Refresh it.
  if (!refreshToken) {
    throw new Error(`No refresh token available to refresh Google access token for user: ${uid}`);
  }

  const decryptedRefreshToken = decrypt(refreshToken);
  const newTokens = await refreshGoogleToken(decryptedRefreshToken);

  const encryptedNewAccessToken = encrypt(newTokens.access_token);
  
  await googleRef.update({
    accessToken: encryptedNewAccessToken,
    tokenExpiry: newTokens.expiry_date
  });

  return newTokens.access_token;
}
