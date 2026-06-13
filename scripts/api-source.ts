import type { Express } from 'express';
import { createApp } from '../src/server/createApp';

let app: Express | null = null;

export default function handler(req: any, res: any) {
  if (!app) {
    try {
      app = createApp();
    } catch (err) {
      console.error('Failed to initialize Express app:', err);
      res.status(500).json({ error: 'Application initialization failed' });
      return;
    }
  }
  app(req, res);
}
