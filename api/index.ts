import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/server/createApp';

let app: ReturnType<typeof createApp> | null = null;

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

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!app) {
    app = createApp();
  }

  normalizeApiUrl(req);
  return app(req, res);
}
