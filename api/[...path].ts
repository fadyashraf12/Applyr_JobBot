import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/server/createApp';

let app: ReturnType<typeof createApp> | null = null;

function normalizeApiUrl(req: VercelRequest) {
  const url = req.url || '/';

  if (url === '/api' || url.startsWith('/api/') || url.startsWith('/api?')) {
    return;
  }

  req.url = url.startsWith('/') ? `/api${url}` : `/api/${url}`;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!app) {
    app = createApp();
  }

  normalizeApiUrl(req);
  return app(req, res);
}
