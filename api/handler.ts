import app from '../server/app';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const matchedPath = (req.headers && (req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'])) as string | undefined;

  if (matchedPath && matchedPath.startsWith('/api') && (req.url === '/api/handler' || req.url === '/api/handler/')) {
    req.url = matchedPath;
  }

  return app(req, res);
}

export { app };