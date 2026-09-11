import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';

const reqLoader = createRequire(import.meta.url);
const app = reqLoader('./index.cjs').default || reqLoader('./index.cjs');

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req, res);
}
