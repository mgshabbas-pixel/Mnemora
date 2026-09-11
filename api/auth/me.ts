import app from '../../server/app';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url || req.url === '/' || !req.url.startsWith('/api')) {
    req.url = '/api/auth/me' + (req.url && req.url !== '/' ? req.url : '');
  }
  return app(req, res);
}
