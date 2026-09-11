import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';

const reqLoader = createRequire(import.meta.url);
const app = reqLoader('../index.cjs').default || reqLoader('../index.cjs');

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url || req.url === '/' || !req.url.startsWith('/api')) {
    req.url = '/api/auth/register' + (req.url && req.url !== '/' ? req.url : '');
  }
  return app(req, res);
}
