import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';

const reqLoader = createRequire(import.meta.url);
const app = reqLoader('./index.cjs').default || reqLoader('./index.cjs');

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Ensure req.url matches the client's actual request URL if Vercel rewrote it
  const matchedPath = (req.headers && (req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'])) as string | undefined;

  if (matchedPath && matchedPath.startsWith('/api') && (req.url === '/api' || req.url === '/api/')) {
    req.url = matchedPath;
  }

  return app(req, res);
}

export { app };
