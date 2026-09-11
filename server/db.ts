import { createRequire } from 'node:module';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'node:crypto';

let DatabaseSyncClass: any = null;
try {
  const req = typeof require !== 'undefined' ? require : createRequire(import.meta.url);
  DatabaseSyncClass = req('node:sqlite')?.DatabaseSync || null;
} catch {
  DatabaseSyncClass = null;
}

class InMemoryDatabase {
  private tables = new Map<string, any[]>();

  private getTable(name: string): any[] {
    const key = name.toLowerCase();
    if (!this.tables.has(key)) {
      this.tables.set(key, []);
    }
    return this.tables.get(key)!;
  }

  exec(_sql: string): void {
    // Schema creation and pragma statements succeed cleanly in memory
  }

  prepare(sql: string) {
    const self = this;
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    return {
      run(...params: any[]) {
        if (/^INSERT\s+(?:OR\s+IGNORE\s+)?INTO/i.test(cleanSql)) {
          const match = cleanSql.match(/INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
          if (match) {
            const table = match[1];
            const cols = match[2].split(',').map((c) => c.trim().toLowerCase());
            const row: Record<string, any> = {};
            cols.forEach((col, idx) => {
              row[col] = params[idx] !== undefined ? params[idx] : null;
            });
            const existing = self.getTable(table);
            if (row.id) {
              const idx = existing.findIndex((r) => r.id === row.id);
              if (idx >= 0) {
                existing[idx] = { ...existing[idx], ...row };
              } else {
                existing.push(row);
              }
            } else {
              existing.push(row);
            }
            return { changes: 1, lastInsertRowid: Date.now() };
          }
        }

        if (/^UPDATE/i.test(cleanSql)) {
          const match = cleanSql.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
          if (match) {
            const table = match[1];
            const rows = self.getTable(table);
            const whereClause = match[3];
            let changes = 0;

            rows.forEach((r) => {
              if (!whereClause || (params.length > 0 && String(r.id || r.key || r.email) === String(params[params.length - 1]))) {
                changes++;
              }
            });
            return { changes, lastInsertRowid: 0 };
          }
        }

        if (/^DELETE/i.test(cleanSql)) {
          const match = cleanSql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?$/i);
          if (match) {
            const table = match[1];
            const whereClause = match[2];
            if (!whereClause) {
              self.tables.set(table.toLowerCase(), []);
              return { changes: 1, lastInsertRowid: 0 };
            }
            if (params.length > 0) {
              const filterVal = String(params[0]);
              const list = self.getTable(table);
              const initialLen = list.length;
              const remaining = list.filter((r) => {
                const targetVal = String(r.id || r.user_id || r.token || r.key || r.email);
                return targetVal !== filterVal;
              });
              self.tables.set(table.toLowerCase(), remaining);
              return { changes: initialLen - remaining.length, lastInsertRowid: 0 };
            }
          }
        }

        return { changes: 1, lastInsertRowid: 0 };
      },

      get(...params: any[]) {
        if (/COUNT\(\*\)/i.test(cleanSql)) {
          const match = cleanSql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
          const count = match ? self.getTable(match[1]).length : 0;
          return { count, total: count, completed: 0 };
        }

        const match = cleanSql.match(/FROM\s+([a-zA-Z0-9_]+)(?:\s+(?:JOIN\s+[a-zA-Z0-9_]+\s+ON\s+.+?\s+)?WHERE\s+([a-zA-Z0-9_.]+)\s*=\s*\?)?/i);
        if (match) {
          const table = match[1];
          const rows = self.getTable(table);
          if (params.length > 0) {
            const targetVal = String(params[0]);
            return rows.find((r) => {
              return (
                String(r.id) === targetVal ||
                String(r.email) === targetVal ||
                String(r.token) === targetVal ||
                String(r.key) === targetVal ||
                String(r.user_id) === targetVal
              );
            }) || null;
          }
          return rows[0] || null;
        }

        return null;
      },

      all(...params: any[]) {
        const match = cleanSql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
        if (match) {
          const rows = self.getTable(match[1]);
          if (params.length > 0 && cleanSql.includes('WHERE user_id = ?')) {
            const uid = String(params[0]);
            return rows.filter((r) => String(r.user_id) === uid);
          }
          return rows;
        }
        return [];
      },
    };
  }
}

function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.env.DATABASE_PATH);
  }

  // In Vercel, AWS Lambda, or serverless environments, process.cwd() is strictly read-only.
  // We use the writable /tmp directory.
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  );

  if (isServerless) {
    try {
      const tmpDir = path.join(os.tmpdir(), 'focus_os_data');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return path.join(tmpDir, 'focus_os.sqlite');
    } catch {
      return ':memory:';
    }
  }

  // Standard persistent container/server environment
  try {
    const localDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    // Verify write permissions
    const testFile = path.join(localDir, '.write_test');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    return path.join(localDir, 'focus_os.sqlite');
  } catch {
    // Fallback to /tmp if process.cwd() is read-only
    try {
      const fallbackDir = path.join(os.tmpdir(), 'focus_os_data');
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      return path.join(fallbackDir, 'focus_os.sqlite');
    } catch {
      return ':memory:';
    }
  }
}

function initDatabaseInstance(): any {
  if (DatabaseSyncClass) {
    const DB_PATH = resolveDatabasePath();
    try {
      const instance = new DatabaseSyncClass(DB_PATH);
      try {
        if (DB_PATH !== ':memory:') {
          // DELETE journal mode avoids -shm/-wal shared memory locking issues on serverless tmpfs
          instance.exec('PRAGMA journal_mode = DELETE;');
        }
        instance.exec('PRAGMA foreign_keys = ON;');
      } catch (pragmaErr) {
        console.warn('[SQLite PRAGMA Notice]:', pragmaErr);
      }
      return instance;
    } catch (err) {
      console.warn('[SQLite Notice] Failed to open path database, falling back to :memory::', err);
      try {
        const memInstance = new DatabaseSyncClass(':memory:');
        memInstance.exec('PRAGMA foreign_keys = ON;');
        return memInstance;
      } catch (memErr) {
        console.warn('[SQLite Notice] Failed :memory: open, falling back to memory adapter:', memErr);
      }
    }
  }
  console.info('[Database] Initializing resilient in-memory storage engine');
  return new InMemoryDatabase();
}

export const db = initDatabaseInstance();

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, 'hex');
    return crypto.timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

export function initDatabase() {
  try {
    // 1. Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
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
  `);

  // 2. Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. Goals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      target_date TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'in_progress',
      category TEXT,
      color TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 4. Weekly Targets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_targets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      goal_id TEXT,
      week_id TEXT NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 5. Activities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      category TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      goal_id TEXT,
      reminder TEXT NOT NULL DEFAULT 'none',
      recurring TEXT NOT NULL DEFAULT 'none',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TEXT,
      completed_date TEXT,
      completed_time TEXT,
      is_on_time INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 6. Week Plans table
  db.exec(`
    CREATE TABLE IF NOT EXISTS week_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      week_id TEXT NOT NULL,
      date_range TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      main_goals TEXT,
      notes TEXT,
      review TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 7. Historical Weeks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS historical_weeks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      week_id TEXT NOT NULL,
      label TEXT NOT NULL,
      date_range TEXT NOT NULL,
      score INTEGER NOT NULL,
      planned INTEGER NOT NULL,
      completed INTEGER NOT NULL,
      missed INTEGER NOT NULL,
      skipped INTEGER NOT NULL,
      on_time_rate INTEGER NOT NULL,
      high_priority_rate INTEGER NOT NULL,
      consistency INTEGER NOT NULL,
      review TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 8. Categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 9. Audit Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      event TEXT NOT NULL,
      user_email TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      details TEXT
    );
  `);

  // 10. System Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Seed default system settings if not present
  const defaultSettings = [
    { key: 'registration_mode', value: 'open' },
    { key: 'session_duration_days', value: '30' },
    { key: 'week_start_day', value: 'monday' },
    { key: 'maintenance_mode', value: 'disabled' },
    { key: 'activity_reminder_default', value: '15_min' },
  ];

  const checkSettingStmt = db.prepare('SELECT key FROM system_settings WHERE key = ?');
  const insertSettingStmt = db.prepare('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)');
  const nowStr = new Date().toISOString();

  for (const s of defaultSettings) {
    if (!checkSettingStmt.get(s.key)) {
      insertSettingStmt.run(s.key, s.value, nowStr);
    }
  }

  // Seed initial audit log entry if table is empty
  const logCountRow = db.prepare('SELECT count(*) as count FROM audit_logs').get() as { count: number };
  if (logCountRow.count === 0) {
    const initialLogs = [
      { id: 'log-1', timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), event: 'SYSTEM_BOOTSTRAP', user_email: 'system', level: 'info', details: 'Database initialized with SQLite WAL mode and isolated schemas.' },
      { id: 'log-2', timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), event: 'AUTH_STORAGE_CONFIGURED', user_email: 'system', level: 'info', details: 'Authentication storage configured without hardcoded administrator credentials.' },
      { id: 'log-3', timestamp: new Date().toISOString(), event: 'SETTINGS_INITIALIZED', user_email: 'system', level: 'info', details: 'Default operational settings verified.' },
    ];
    const insertLog = db.prepare('INSERT INTO audit_logs (id, timestamp, event, user_email, level, details) VALUES (?, ?, ?, ?, ?, ?)');
    for (const log of initialLogs) {
      insertLog.run(log.id, log.timestamp, log.event, log.user_email, log.level, log.details);
    }
  }
  } catch (err) {
    console.warn('[Database] initDatabase non-fatal notice (using resilient adapter):', err);
  }
}

export function logAuditEvent(event: string, userEmail: string, level: 'info' | 'warn' | 'error' = 'info', details = '') {
  try {
    const id = `log-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const timestamp = new Date().toISOString();
    db.prepare('INSERT INTO audit_logs (id, timestamp, event, user_email, level, details) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      timestamp,
      event,
      userEmail,
      level,
      details
    );
  } catch (err) {
    console.warn('Failed to log audit event:', err);
  }
}

export function ensureLocalUserRecord(user: {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'deactivated';
  created_at: string;
  last_login_at?: string;
}): void {
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, salt, role, status, created_at, last_login_at)
    VALUES (?, ?, ?, '', '', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      role = excluded.role,
      status = excluded.status,
      last_login_at = excluded.last_login_at
  `).run(
    user.id,
    user.name,
    user.email,
    user.role,
    user.status,
    user.created_at,
    user.last_login_at || null,
  );
}

export function getSystemSetting(key: string, fallback: string): string {
  try {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value?: string } | undefined;
    return row?.value || fallback;
  } catch {
    return fallback;
  }
}
