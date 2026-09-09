import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { db } from './db';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'deactivated';
  created_at: string;
  last_login_at?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date().toISOString();
  // 30 days session expiry
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const stmt = db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(token, userId, createdAt, expiresAt);

  return token;
}

export function deleteSession(token: string): void {
  const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
  stmt.run(token);
}

export function getUserFromToken(token: string): AuthenticatedUser | null {
  if (!token) return null;

  const query = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.status, u.created_at, u.last_login_at, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `);

  const row = query.get(token) as unknown as (AuthenticatedUser & { expires_at: string }) | undefined;
  if (!row) return null;

  // Check if session has expired
  if (new Date(row.expires_at) < new Date()) {
    deleteSession(token);
    return null;
  }

  // If user is deactivated, prevent access
  if (row.status === 'deactivated') {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as 'admin' | 'user',
    status: row.status as 'active' | 'deactivated',
    created_at: row.created_at,
    last_login_at: row.last_login_at,
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const user = getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    return;
  }

  req.user = user;
  req.token = token;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden. Administrator privileges required.' });
      return;
    }
    next();
  });
}
