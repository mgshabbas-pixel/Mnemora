import app from '../server/app';
import type { IncomingMessage, ServerResponse } from 'node:http';

function resolveOriginalUrl(req: IncomingMessage): void {
  let url = req.url || '/';

  // 1. Check _vercel_path from vercel.json rewrite: /api/handler?_vercel_path=...
  const qIdx = url.indexOf('?');
  if (qIdx >= 0) {
    const searchParams = new URLSearchParams(url.slice(qIdx + 1));
    const vercelPath = searchParams.get('_vercel_path');
    if (vercelPath) {
      searchParams.delete('_vercel_path');
      const rest = searchParams.toString();
      req.url = '/api/' + vercelPath.replace(/^\/+/, '') + (rest ? '?' + rest : '');
      return;
    }
  }

  // 2. Check matched path headers from Vercel edge routing
  const headers = req.headers || {};
  const matched = (headers['x-matched-path'] || headers['x-vercel-matched-path'] || headers['x-forwarded-uri'] || headers['x-real-url']) as string | undefined;
  if (matched && matched.startsWith('/api') && !matched.includes(':') && !matched.includes('*')) {
    const query = qIdx >= 0 ? url.slice(qIdx) : '';
    req.url = matched + (matched.includes('?') ? '' : query);
    return;
  }

  // 3. Fallback: if url is /api/handler or /api/handler/, default to /api/health
  if (url === '/api/handler' || url === '/api/handler/') {
    req.url = '/api/health';
  }
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  resolveOriginalUrl(req);
  return app(req, res);
}

export { app };
