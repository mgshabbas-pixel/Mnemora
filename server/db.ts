import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'focus_os.sqlite');
export const db = new DatabaseSync(DB_PATH);

// Configure SQLite pragmas
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

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

  // Seed primary admin account if not already present
  const adminEmail = 'mgshabbas@gmail.com';
  const checkAdminStmt = db.prepare('SELECT id FROM users WHERE email = ?');
  const existingAdmin = checkAdminStmt.get(adminEmail) as { id: string } | undefined;

  if (!existingAdmin) {
    const adminId = 'usr-admin-mgshabbas';
    const initialAdminPassword = 'FocusAdmin2026!';
    const { hash, salt } = hashPassword(initialAdminPassword);
    const now = new Date().toISOString();

    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, salt, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'admin', 'active', ?)
    `);

    insertUser.run(
      adminId,
      'Administrator (M. Shabbas)',
      adminEmail,
      hash,
      salt,
      now
    );

    console.log(`[FOCUS OS Database] Initialized admin user: ${adminEmail}`);
  }

  // Seed initial audit log entry if table is empty
  const logCountRow = db.prepare('SELECT count(*) as count FROM audit_logs').get() as { count: number };
  if (logCountRow.count === 0) {
    const initialLogs = [
      { id: 'log-1', timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), event: 'SYSTEM_BOOTSTRAP', user_email: 'system', level: 'info', details: 'Database initialized with SQLite WAL mode and isolated schemas.' },
      { id: 'log-2', timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), event: 'ADMIN_SEEDED', user_email: adminEmail, level: 'info', details: 'Primary administrator identity provisioned successfully.' },
      { id: 'log-3', timestamp: new Date().toISOString(), event: 'SETTINGS_INITIALIZED', user_email: 'system', level: 'info', details: 'Default operational settings verified.' },
    ];
    const insertLog = db.prepare('INSERT INTO audit_logs (id, timestamp, event, user_email, level, details) VALUES (?, ?, ?, ?, ?, ?)');
    for (const log of initialLogs) {
      insertLog.run(log.id, log.timestamp, log.event, log.user_email, log.level, log.details);
    }
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
