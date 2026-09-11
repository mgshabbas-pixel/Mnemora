import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';
import { db, getSystemSetting } from './db';

const databaseUrl = process.env.DATABASE_URL;

const isPlaceholderUrl = Boolean(
  databaseUrl && (
    databaseUrl.includes('user:password@host') ||
    databaseUrl.includes('@host/') ||
    databaseUrl.includes('host/database')
  )
);

let sql = databaseUrl && !isPlaceholderUrl ? neon(databaseUrl) : null;
let localDb = !sql ? db : null;
let schemaPromise: Promise<void> | null = null;

function requireDatabase() {
  if (!sql) {
    throw new Error('DATABASE_URL is required for authentication persistence.');
  }
  return sql;
}

export interface AuthUserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  salt: string;
  role: 'admin' | 'user';
  status: 'active' | 'deactivated';
  created_at: string;
  last_login_at: string | null;
}

export async function initAuthDatabase(): Promise<void> {
  if (sql) {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS auth_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated')),
          created_at TIMESTAMPTZ NOT NULL,
          last_login_at TIMESTAMPTZ
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS auth_sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL
        )
      `;
      return;
    } catch (err: any) {
      console.warn('[AI Studio] Remote database connection failed, falling back to local SQLite:', err?.message || err);
      sql = null;
      localDb = db;
    }
  }

  if (localDb) {
    localDb.exec(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        last_login_at TEXT
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES auth_users(id) ON DELETE CASCADE
      );
    `);
  }
}

export async function findAuthUser(email: string): Promise<AuthUserRow | null> {
  if (sql) {
    try {
      const rows = await sql`
        SELECT id, name, email, password_hash, salt, role, status,
               created_at::text, last_login_at::text
        FROM auth_users WHERE email = ${email} LIMIT 1
      `;
      return (rows[0] as AuthUserRow | undefined) ?? null;
    } catch (err: any) {
      console.warn('[AI Studio] Remote auth query fallback:', err?.message || err);
      sql = null;
      localDb = db;
    }
  }
  if (localDb) {
    return (localDb.prepare('SELECT * FROM auth_users WHERE email = ? LIMIT 1').get(email) as unknown as AuthUserRow | undefined) ?? null;
  }
  return null;
}

export async function findAuthUserById(id: string): Promise<AuthUserRow | null> {
  if (sql) {
    try {
      const rows = await sql`
        SELECT id, name, email, password_hash, salt, role, status,
               created_at::text, last_login_at::text
        FROM auth_users WHERE id = ${id} LIMIT 1
      `;
      return (rows[0] as AuthUserRow | undefined) ?? null;
    } catch (err: any) {
      console.warn('[AI Studio] Remote auth query fallback:', err?.message || err);
      sql = null;
      localDb = db;
    }
  }
  if (localDb) {
    return (localDb.prepare('SELECT * FROM auth_users WHERE id = ? LIMIT 1').get(id) as unknown as AuthUserRow | undefined) ?? null;
  }
  return null;
}

export async function createAuthUser(input: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: 'admin' | 'user';
  createdAt: string;
}): Promise<void> {
  if (sql) {
    try {
      await sql`
        INSERT INTO auth_users (id, name, email, password_hash, salt, role, status, created_at, last_login_at)
        VALUES (${input.id}, ${input.name}, ${input.email}, ${input.passwordHash}, ${input.salt}, ${input.role}, 'active', ${input.createdAt}, ${input.createdAt})
      `;
      return;
    } catch (err: any) {
      console.warn('[AI Studio] Remote auth write fallback:', err?.message || err);
      sql = null;
      localDb = db;
    }
  }
  if (localDb) {
    localDb.prepare(`
      INSERT INTO auth_users (id, name, email, password_hash, salt, role, status, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(input.id, input.name, input.email, input.passwordHash, input.salt, input.role, input.createdAt, input.createdAt);
    localDb.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, password_hash, salt, role, status, created_at, last_login_at)
      VALUES (?, ?, ?, '', '', ?, 'active', ?, ?)
    `).run(input.id, input.name, input.email, input.role, input.createdAt, input.createdAt);
    return;
  }
}

export async function updateLastLogin(id: string, timestamp: string): Promise<void> {
  if (localDb) {
    localDb.prepare('UPDATE auth_users SET last_login_at = ? WHERE id = ?').run(timestamp, id);
    return;
  }
  await requireDatabase()`UPDATE auth_users SET last_login_at = ${timestamp} WHERE id = ${id}`;
}

export async function updateAuthPassword(id: string, passwordHash: string, salt: string): Promise<void> {
  if (localDb) {
    localDb.prepare('UPDATE auth_users SET password_hash = ?, salt = ? WHERE id = ?').run(passwordHash, salt, id);
    return;
  }
  await requireDatabase()`UPDATE auth_users SET password_hash = ${passwordHash}, salt = ${salt} WHERE id = ${id}`;
}

export async function createAuthSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date().toISOString();
  const durationDays = Number(getSystemSetting('session_duration_days', '30')) || 30;
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  if (localDb) {
    localDb.prepare('INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(token, userId, createdAt, expiresAt);
    return token;
  }
  await requireDatabase()`
    INSERT INTO auth_sessions (token, user_id, created_at, expires_at)
    VALUES (${token}, ${userId}, ${createdAt}, ${expiresAt})
  `;
  return token;
}

export async function deleteAuthSession(token: string): Promise<void> {
  if (localDb) {
    localDb.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
    return;
  }
  await requireDatabase()`DELETE FROM auth_sessions WHERE token = ${token}`;
}

export async function findUserBySession(token: string): Promise<(AuthUserRow & { expires_at: string }) | null> {
  if (localDb) {
    return (localDb.prepare(`
      SELECT u.*, s.expires_at
      FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
      WHERE s.token = ? LIMIT 1
    `).get(token) as unknown as (AuthUserRow & { expires_at: string }) | undefined) ?? null;
  }
  const rows = await requireDatabase()`
    SELECT u.id, u.name, u.email, u.password_hash, u.salt, u.role, u.status,
           u.created_at::text, u.last_login_at::text, s.expires_at::text
    FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
    WHERE s.token = ${token} LIMIT 1
  `;
  return (rows[0] as (AuthUserRow & { expires_at: string }) | undefined) ?? null;
}

export async function provisionConfiguredAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !password || (!sql && !localDb)) return;

  if (await findAuthUser(email)) return;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  await createAuthUser({
    id: `usr-admin-${crypto.randomBytes(8).toString('hex')}`,
    name: process.env.ADMIN_NAME?.trim() || 'Administrator',
    email,
    passwordHash,
    salt,
    role: 'admin',
    createdAt: new Date().toISOString(),
  });
}

export function ensureAuthDatabase(): Promise<void> {
  schemaPromise ??= initAuthDatabase()
    .then(provisionConfiguredAdmin)
    .catch((err) => {
      console.warn('[AI Studio] Auth database init non-fatal notice:', err?.message || err);
    });
  return schemaPromise;
}

export async function getAuthSummary(): Promise<{
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  newUsersPast7Days: number;
  sessionCount: number;
  adminCount: number;
}> {
  if (localDb) {
    const users = localDb.prepare(`
      SELECT
        count(*) AS total_users,
        sum(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_users,
        sum(CASE WHEN status = 'deactivated' THEN 1 ELSE 0 END) AS inactive_users,
        sum(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_users,
        sum(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admin_count
      FROM auth_users
    `).get(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) as any;
    const sessions = localDb.prepare('SELECT count(*) AS count FROM auth_sessions WHERE expires_at >= ?').get(new Date().toISOString()) as any;
    return {
      totalUsers: Number(users?.total_users || 0),
      activeUsers: Number(users?.active_users || 0),
      inactiveUsers: Number(users?.inactive_users || 0),
      newUsersPast7Days: Number(users?.new_users || 0),
      sessionCount: Number(sessions?.count || 0),
      adminCount: Number(users?.admin_count || 0),
    };
  }

  const rows = await requireDatabase()`
    SELECT
      count(*)::int AS total_users,
      count(*) FILTER (WHERE status = 'active')::int AS active_users,
      count(*) FILTER (WHERE status = 'deactivated')::int AS inactive_users,
      count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS new_users,
      count(*) FILTER (WHERE role = 'admin')::int AS admin_count,
      (SELECT count(*)::int FROM auth_sessions WHERE expires_at >= now()) AS session_count
    FROM auth_users
  `;
  const row = rows[0] as any;
  return {
    totalUsers: Number(row?.total_users || 0),
    activeUsers: Number(row?.active_users || 0),
    inactiveUsers: Number(row?.inactive_users || 0),
    newUsersPast7Days: Number(row?.new_users || 0),
    sessionCount: Number(row?.session_count || 0),
    adminCount: Number(row?.admin_count || 0),
  };
}

export async function pruneExpiredAuthSessions(): Promise<number> {
  if (localDb) {
    return Number(localDb.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').run(new Date().toISOString()).changes || 0);
  }
  const rows = await requireDatabase()`
    WITH deleted AS (
      DELETE FROM auth_sessions WHERE expires_at < now() RETURNING token
    ) SELECT count(*)::int AS count FROM deleted
  `;
  return Number((rows[0] as any)?.count || 0);
}

export async function listAuthUsers(filters: {
  search?: string;
  status?: string;
  role?: string;
} = {}): Promise<Array<AuthUserRow & { activity_count: number; goal_count: number }>> {
  if (localDb) {
    let query = 'SELECT *, 0 AS activity_count, 0 AS goal_count FROM auth_users WHERE 1=1';
    const params: string[] = [];
    if (filters.search && filters.search !== 'all') {
      query += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.status && filters.status !== 'all') {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.role && filters.role !== 'all') {
      query += ' AND role = ?';
      params.push(filters.role);
    }
    query += ' ORDER BY created_at DESC';
    return localDb.prepare(query).all(...params) as unknown as Array<AuthUserRow & { activity_count: number; goal_count: number }>;
  }
  const search = filters.search && filters.search !== 'all' ? `%${filters.search}%` : null;
  const status = filters.status && filters.status !== 'all' ? filters.status : null;
  const role = filters.role && filters.role !== 'all' ? filters.role : null;
  const rows = await requireDatabase()`
    SELECT id, name, email, password_hash, salt, role, status,
           created_at::text, last_login_at::text, 0::int AS activity_count, 0::int AS goal_count
    FROM auth_users
    WHERE (${search}::text IS NULL OR name ILIKE ${search} OR email ILIKE ${search})
      AND (${status}::text IS NULL OR status = ${status})
      AND (${role}::text IS NULL OR role = ${role})
    ORDER BY created_at DESC
  `;
  return rows as Array<AuthUserRow & { activity_count: number; goal_count: number }>;
}

export async function updateAuthUserStatus(id: string, status: 'active' | 'deactivated'): Promise<AuthUserRow | null> {
  if (localDb) {
    const result = localDb.prepare('UPDATE auth_users SET status = ? WHERE id = ?').run(status, id);
    if (!result.changes) return null;
    if (status === 'deactivated') {
      localDb.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(id);
    }
    return findAuthUserById(id);
  }
  const rows = await requireDatabase()`
    UPDATE auth_users SET status = ${status} WHERE id = ${id}
    RETURNING id, name, email, password_hash, salt, role, status, created_at::text, last_login_at::text
  `;
  if (status === 'deactivated') {
    await requireDatabase()`DELETE FROM auth_sessions WHERE user_id = ${id}`;
  }
  return (rows[0] as AuthUserRow | undefined) ?? null;
}

export async function updateAuthUserRole(id: string, role: 'admin' | 'user'): Promise<AuthUserRow | null> {
  if (localDb) {
    const result = localDb.prepare('UPDATE auth_users SET role = ? WHERE id = ?').run(role, id);
    return result.changes ? findAuthUserById(id) : null;
  }
  const rows = await requireDatabase()`
    UPDATE auth_users SET role = ${role} WHERE id = ${id}
    RETURNING id, name, email, password_hash, salt, role, status, created_at::text, last_login_at::text
  `;
  return (rows[0] as AuthUserRow | undefined) ?? null;
}

export async function deleteAuthUser(id: string): Promise<AuthUserRow | null> {
  const existing = await findAuthUserById(id);
  if (!existing) return null;
  if (localDb) {
    localDb.prepare('DELETE FROM auth_users WHERE id = ?').run(id);
    localDb.prepare('DELETE FROM users WHERE id = ?').run(id);
    return existing;
  }
  await requireDatabase()`DELETE FROM auth_users WHERE id = ${id}`;
  return existing;
}

export async function listAuthSessionMetadata(): Promise<Array<{
  userId: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'expired';
}>> {
  if (localDb) {
    const rows = localDb.prepare(`
      SELECT user_id, created_at, expires_at
      FROM auth_sessions
      ORDER BY created_at DESC
    `).all() as unknown as Array<{ user_id: string; created_at: string; expires_at: string }>;
    const now = Date.now();
    return rows.map((row) => ({
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      status: new Date(row.expires_at).getTime() >= now ? 'active' : 'expired',
    }));
  }

  const rows = await requireDatabase()`
    SELECT user_id, created_at::text, expires_at::text
    FROM auth_sessions
    ORDER BY created_at DESC
  `;
  const now = Date.now();
  return (rows as Array<{ user_id: string; created_at: string; expires_at: string }>).map((row) => ({
    userId: row.user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: new Date(row.expires_at).getTime() >= now ? 'active' : 'expired',
  }));
}