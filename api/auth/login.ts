import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../../server/app';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url || req.url === '/' || !req.url.startsWith('/api')) {
    req.url = '/api/auth/login' + (req.url && req.url !== '/' ? req.url : '');
  }
  return app(req, res);
}
