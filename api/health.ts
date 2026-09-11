export default function handler(_req: unknown, res: { setHeader: (name: string, value: string) => void; statusCode: number; end: (body: string) => void }) {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ status: 'ok', service: 'FOCUS OS Multi-User Platform Engine' }));
}
