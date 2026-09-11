import app from '../server/app';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url || req.url === '/' || req.url === '/api' || req.url === '/api/') {
    req.url = '/api/health';
  }
  return app(req, res);
}

export { app };
