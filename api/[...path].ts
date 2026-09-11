import app from '../server/app';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url || req.url === '/' || !req.url.startsWith('/api')) {
    const headers = req.headers || {};
    const matched = (headers['x-matched-path'] || headers['x-vercel-matched-path'] || headers['x-forwarded-uri'] || headers['x-real-url']) as string | undefined;
    if (matched && matched.startsWith('/api')) {
      req.url = matched;
    }
  }
  return app(req, res);
}

export { app };

