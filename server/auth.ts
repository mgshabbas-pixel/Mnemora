import { Request, Response, NextFunction } from 'express';
import { ensureLocalUserRecord } from './db';
import {
  createAuthSession,
  deleteAuthSession,
  ensureAuthDatabase,
  findUserBySession,
} from './authDb';

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

export async function createSession(userId: string): Promise<string> {
  await ensureAuthDatabase();
  return createAuthSession(userId);
}

export async function deleteSession(token: string): Promise<void> {
  await ensureAuthDatabase();
  await deleteAuthSession(token);
}

export async function getUserFromToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token) return null;

  await ensureAuthDatabase();
  const row = await findUserBySession(token);
  if (!row) return null;

  // Check if session has expired
  if (new Date(row.expires_at) < new Date()) {
    await deleteSession(token);
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

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const user = await getUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
      return;
    }

    ensureLocalUserRecord(user);
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Authentication store error:', error);
    res.status(503).json({ error: 'Authentication service is temporarily unavailable.' });
  }
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden. Administrator privileges required.' });
      return;
    }
    next();
  });
}
