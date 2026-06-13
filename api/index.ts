import type { VercelRequest, VercelResponse } from '@vercel/node';

let appPromise: Promise<any> | null = null;

function getPathParam(req: VercelRequest, url: URL) {
  const value = req.query?.path ?? url.searchParams.get('path');

  if (Array.isArray(value)) {
    return value.join('/');
  }

  return typeof value === 'string' ? value : null;
}

function normalizeApiUrl(req: VercelRequest) {
  const url = new URL(req.url || '/', 'https://applyr.local');
  const path = getPathParam(req, url);

  if (path) {
    url.searchParams.delete('path');
    const query = url.searchParams.toString();
    req.url = `/api/${path}${query ? `?${query}` : ''}`;
    return;
  }

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    return;
  }

  req.url = `/api${url.pathname}${url.search}`;
}

function getLoginRedirectUri(req: VercelRequest) {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    return `${appUrl.replace(/\/$/, '')}/api/auth/google/callback`;
  }

  const host = req.headers.host;
  if (host) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}/api/auth/google/callback`;
  }

  return null;
}

function buildLoginAuthUrl(req: VercelRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = getLoginRedirectUri(req);

  if (!clientId || !redirectUri) {
    throw new Error('Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or redirect URI.');
  }

  const params = new URLSearchParams({
    access_type: 'offline',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.file',
    ].join(' '),
    state: 'drive:login_flow',
    prompt: 'consent',
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function getApp() {
  if (!appPromise) {
    appPromise = import('../src/server/createApp').then(({ createApp }) => createApp());
  }

  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  normalizeApiUrl(req);

  if (req.method === 'GET' && req.url?.startsWith('/api/auth/google/login')) {
    try {
      res.statusCode = 302;
      res.setHeader('Location', buildLoginAuthUrl(req));
      res.end();
      return;
    } catch (error: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(error.message || 'Error initiating Google OAuth');
      return;
    }
  }

  const app = await getApp();
  return app(req, res);
}
