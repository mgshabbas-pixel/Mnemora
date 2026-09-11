import express from 'express';
import { GoogleGenAI } from '@google/genai';
import crypto from 'node:crypto';
import { db, getSystemSetting, initDatabase, hashPassword, verifyPassword, logAuditEvent } from './db';
import {
  createAuthUser,
  deleteAuthUser,
  ensureAuthDatabase,
  findAuthUser,
  findAuthUserById,
  getAuthSummary,
  listAuthUsers,
  listAuthSessionMetadata,
  pruneExpiredAuthSessions,
  updateAuthPassword,
  updateAuthUserRole,
  updateAuthUserStatus,
  updateLastLogin,
} from './authDb';
import {
  requireAuth,
  requireAdmin,
  createSession,
  deleteSession,
  AuthenticatedRequest,
} from './auth';

// Productivity records retain the existing SQLite implementation for now;
// authentication and sessions use the persistent hosted database below.
initDatabase();
const authDatabaseReady = ensureAuthDatabase();

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (e) {
      console.error('Error initializing GoogleGenAI:', e);
      return null;
    }
  }
  return aiClient;
}

const app = express();

// Standard middleware
app.use(express.json({ limit: '5mb' }));

// Resilient CORS and preflight handling for cross-origin or Vercel deployments
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'FOCUS OS Multi-User Platform Engine',
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    await authDatabaseReady;
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!cleanEmail.includes('@') || password.length < 6) {
      return res.status(400).json({ error: 'Please provide a valid email and a password of at least 6 characters.' });
    }

    if (getSystemSetting('registration_mode', 'open') === 'invite_only') {
      return res.status(403).json({ error: 'Public registration is currently disabled. Please contact an administrator.' });
    }

    const existing = await findAuthUser(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const userId = `usr-${crypto.randomBytes(8).toString('hex')}`;
    const role = 'user';
    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();

    await createAuthUser({
      id: userId,
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash: hash,
      salt,
      role,
      createdAt: now,
    });

    const token = await createSession(userId);

    return res.json({
      token,
      user: {
        id: userId,
        name: String(name).trim(),
        email: cleanEmail,
        role,
        status: 'active',
        created_at: now,
        last_login_at: now,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    await authDatabaseReady;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await findAuthUser(cleanEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status === 'deactivated') {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact the administrator.' });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const now = new Date().toISOString();
    await updateLastLogin(user.id, now);

    const token = await createSession(user.id);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
        last_login_at: now,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Logout
app.post('/api/auth/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.token) {
      await deleteSession(req.token);
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Logout failed.' });
  }
});

// Current user info
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user });
});

// Change password
app.post('/api/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await authDatabaseReady;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Please provide current password and a new password with at least 6 characters.' });
    }

    const userRow = await findAuthUser(req.user!.id);
    if (!userRow || !verifyPassword(currentPassword, userRow.password_hash, userRow.salt)) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const { hash, salt } = hashPassword(newPassword);
    await updateAuthPassword(req.user!.id, hash, salt);
    logAuditEvent('PASSWORD_CHANGED', req.user!.email, 'info', 'User changed their password.');

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

// Reset password by email (public reset)
app.post(['/api/auth/reset-password', '/api/auth/reset'], async (req, res) => {
  try {
    await authDatabaseReady;
    const { email, newPassword } = req.body;
    if (!email || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Valid email and new password (min 6 characters) required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await findAuthUser(cleanEmail);

    if (!user) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }

    const { hash, salt } = hashPassword(newPassword);
    await updateAuthPassword(user.id, hash, salt);
    logAuditEvent('PASSWORD_RESET', cleanEmail, 'info', 'User reset password via self-service form.');

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// ==========================================
// PERSONAL DATA ROUTES (USER SCOPED)
// ==========================================

// Get all personal data
app.get('/api/personal/data', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    const activitiesRows = db.prepare(`
      SELECT * FROM activities WHERE user_id = ? ORDER BY date ASC, start_time ASC
    `).all(userId) as any[];

    const activities = activitiesRows.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time || undefined,
      durationMinutes: r.duration_minutes,
      category: r.category || 'Focus',
      priority: r.priority || 'medium',
      goalId: r.goal_id || undefined,
      reminder: r.reminder || 'none',
      recurring: r.recurring || 'none',
      notes: r.notes || undefined,
      status: r.status,
      completedAt: r.completed_at || undefined,
      completedDate: r.completed_date || undefined,
      completedTime: r.completed_time || undefined,
      isOnTime: r.is_on_time ? Boolean(r.is_on_time) : undefined,
    }));

    const goalsRows = db.prepare(`
      SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId) as any[];

    const goals = goalsRows.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description || '',
      targetDate: g.target_date,
      progress: g.progress,
      status: g.status,
      category: g.category || 'General',
      color: g.color || '#3B82F6',
    }));

    const targetRows = db.prepare(`
      SELECT * FROM weekly_targets WHERE user_id = ? ORDER BY created_at ASC
    `).all(userId) as any[];

    const weeklyTargets = targetRows.map((t) => ({
      id: t.id,
      goalId: t.goal_id || '',
      weekId: t.week_id,
      text: t.text,
      completed: Boolean(t.completed),
    }));

    const planRow = db.prepare(`
      SELECT * FROM week_plans WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1
    `).get(userId) as any;

    const weekPlan = planRow
      ? {
          weekId: planRow.week_id,
          dateRange: planRow.date_range,
          startDate: planRow.start_date,
          endDate: planRow.end_date,
          mainGoals: (() => {
            try {
              return JSON.parse(planRow.main_goals);
            } catch {
              return ['', '', ''];
            }
          })(),
          notes: planRow.notes || '',
          review: (() => {
            try {
              return JSON.parse(planRow.review);
            } catch {
              return {
                wentWell: '',
                couldImprove: '',
                nextWeekFocus: '',
                score: 0,
                completed: false,
              };
            }
          })(),
        }
      : {
          weekId: '',
          dateRange: '',
          startDate: '',
          endDate: '',
          mainGoals: ['', '', ''],
          notes: '',
          review: {
            wentWell: '',
            couldImprove: '',
            nextWeekFocus: '',
            score: 0,
            completed: false,
          },
        };

    const historicalRows = db.prepare(`
      SELECT * FROM historical_weeks WHERE user_id = ? ORDER BY created_at ASC
    `).all(userId) as any[];

    const historicalWeeks = historicalRows.map((h) => ({
      id: h.id,
      weekId: h.week_id,
      label: h.label,
      dateRange: h.date_range,
      score: h.score,
      planned: h.planned,
      completed: h.completed,
      missed: h.missed,
      skipped: h.skipped,
      onTimeRate: h.on_time_rate,
      highPriorityRate: h.high_priority_rate,
      consistency: h.consistency,
      review: (() => {
        try {
          return JSON.parse(h.review);
        } catch {
          return undefined;
        }
      })(),
    }));

    const categoryRows = db.prepare(`
      SELECT id, name, color FROM categories WHERE user_id = ?
    `).all(userId) as any[];

    const categories = categoryRows.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    }));

    return res.json({
      activities,
      goals,
      weeklyTargets,
      weekPlan,
      historicalWeeks,
      categories: categories.length > 0 ? categories : [
        { id: 'cat-1', name: 'Deep Work', color: '#EA580C' },
        { id: 'cat-2', name: 'Strategy', color: '#2563EB' },
        { id: 'cat-3', name: 'Execution', color: '#16A34A' },
        { id: 'cat-4', name: 'Health & Fitness', color: '#059669' },
        { id: 'cat-5', name: 'Admin & Ops', color: '#6B7280' },
      ],
    });
  } catch (err: any) {
    console.error('Fetch personal data error:', err);
    return res.status(500).json({ error: 'Failed to retrieve personal data.' });
  }
});

// Create Activity
app.post('/api/personal/activities', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const act = req.body;
    const id = act.id || `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO activities (
        id, user_id, title, date, start_time, end_time, duration_minutes,
        category, priority, goal_id, reminder, recurring, notes,
        status, completed_at, completed_date, completed_time, is_on_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      act.title || 'Untitled Session',
      act.date,
      act.startTime || '09:00',
      act.endTime || null,
      act.durationMinutes || 60,
      act.category || 'Focus',
      act.priority || 'medium',
      act.goalId || null,
      act.reminder || 'none',
      act.recurring || 'none',
      act.notes || null,
      act.status || 'pending',
      act.completedAt || null,
      act.completedDate || null,
      act.completedTime || null,
      act.isOnTime ? 1 : 0,
      now
    );

    return res.json({ success: true, id, activity: { ...act, id } });
  } catch (err: any) {
    console.error('Create activity error:', err);
    return res.status(500).json({ error: 'Failed to create activity.' });
  }
});

// Update Activity
app.patch('/api/personal/activities/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = req.body;

    const current = db.prepare('SELECT * FROM activities WHERE id = ? AND user_id = ?').get(id, userId) as any;
    if (!current) {
      return res.status(404).json({ error: 'Activity not found.' });
    }

    const title = updates.title !== undefined ? updates.title : current.title;
    const date = updates.date !== undefined ? updates.date : current.date;
    const startTime = updates.startTime !== undefined ? updates.startTime : current.start_time;
    const endTime = updates.endTime !== undefined ? updates.endTime : current.end_time;
    const durationMinutes = updates.durationMinutes !== undefined ? updates.durationMinutes : current.duration_minutes;
    const category = updates.category !== undefined ? updates.category : current.category;
    const priority = updates.priority !== undefined ? updates.priority : current.priority;
    const goalId = updates.goalId !== undefined ? updates.goalId : current.goal_id;
    const reminder = updates.reminder !== undefined ? updates.reminder : current.reminder;
    const recurring = updates.recurring !== undefined ? updates.recurring : current.recurring;
    const notes = updates.notes !== undefined ? updates.notes : current.notes;
    const status = updates.status !== undefined ? updates.status : current.status;
    const completedAt = updates.completedAt !== undefined ? updates.completedAt : current.completed_at;
    const completedDate = updates.completedDate !== undefined ? updates.completedDate : current.completed_date;
    const completedTime = updates.completedTime !== undefined ? updates.completedTime : current.completed_time;
    const isOnTime = updates.isOnTime !== undefined ? (updates.isOnTime ? 1 : 0) : current.is_on_time;

    const stmt = db.prepare(`
      UPDATE activities SET
        title = ?, date = ?, start_time = ?, end_time = ?, duration_minutes = ?,
        category = ?, priority = ?, goal_id = ?, reminder = ?, recurring = ?,
        notes = ?, status = ?, completed_at = ?, completed_date = ?,
        completed_time = ?, is_on_time = ?
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(
      title, date, startTime, endTime, durationMinutes,
      category, priority, goalId, reminder, recurring,
      notes, status, completedAt, completedDate,
      completedTime, isOnTime, id, userId
    );

    return res.json({ success: true, id });
  } catch (err: any) {
    console.error('Update activity error:', err);
    return res.status(500).json({ error: 'Failed to update activity.' });
  }
});

// Delete Activity
app.delete('/api/personal/activities/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    db.prepare('DELETE FROM activities WHERE id = ? AND user_id = ?').run(id, userId);
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete activity.' });
  }
});

// Create Goal
app.post('/api/personal/goals', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const goal = req.body;
    const id = goal.id || `goal-${Date.now()}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO goals (id, user_id, name, description, target_date, progress, status, category, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      goal.name,
      goal.description || '',
      goal.targetDate,
      goal.progress || 0,
      goal.status || 'in_progress',
      goal.category || 'General',
      goal.color || '#3B82F6',
      now
    );

    return res.json({ success: true, id, goal: { ...goal, id } });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create goal.' });
  }
});

// Update Goal Progress / Fields
app.patch('/api/personal/goals/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = req.body;

    const current = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(id, userId) as any;
    if (!current) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    const progress = updates.progress !== undefined ? updates.progress : current.progress;
    const status = updates.status !== undefined ? updates.status : current.status;
    const name = updates.name !== undefined ? updates.name : current.name;
    const description = updates.description !== undefined ? updates.description : current.description;

    db.prepare(`
      UPDATE goals SET progress = ?, status = ?, name = ?, description = ?
      WHERE id = ? AND user_id = ?
    `).run(progress, status, name, description, id, userId);

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update goal.' });
  }
});

// Delete Goal
app.delete('/api/personal/goals/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(id, userId);
    db.prepare('DELETE FROM weekly_targets WHERE goal_id = ? AND user_id = ?').run(id, userId);
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete goal.' });
  }
});

// Create Weekly Target
app.post('/api/personal/weekly-targets', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const target = req.body;
    const id = target.id || `target-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO weekly_targets (id, user_id, goal_id, week_id, text, completed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      target.goalId || null,
      target.weekId,
      target.text,
      target.completed ? 1 : 0,
      now
    );

    return res.json({ success: true, id, target: { ...target, id } });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create weekly target.' });
  }
});

// Update Weekly Target
app.patch('/api/personal/weekly-targets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { completed, text } = req.body;

    if (completed !== undefined) {
      db.prepare('UPDATE weekly_targets SET completed = ? WHERE id = ? AND user_id = ?')
        .run(completed ? 1 : 0, id, userId);
    }
    if (text !== undefined) {
      db.prepare('UPDATE weekly_targets SET text = ? WHERE id = ? AND user_id = ?')
        .run(text, id, userId);
    }

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update weekly target.' });
  }
});

// Delete Weekly Target
app.delete('/api/personal/weekly-targets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    db.prepare('DELETE FROM weekly_targets WHERE id = ? AND user_id = ?').run(id, userId);
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete weekly target.' });
  }
});

// Save Week Plan
app.put('/api/personal/week-plan', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const plan = req.body;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT id FROM week_plans WHERE user_id = ? AND week_id = ?')
      .get(userId, plan.weekId) as { id: string } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE week_plans SET
          date_range = ?, start_date = ?, end_date = ?,
          main_goals = ?, notes = ?, review = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(
        plan.dateRange,
        plan.startDate,
        plan.endDate,
        JSON.stringify(plan.mainGoals || []),
        plan.notes || '',
        JSON.stringify(plan.review || {}),
        now,
        existing.id,
        userId
      );
    } else {
      const id = `plan-${Date.now()}`;
      db.prepare(`
        INSERT INTO week_plans (id, user_id, week_id, date_range, start_date, end_date, main_goals, notes, review, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        userId,
        plan.weekId,
        plan.dateRange,
        plan.startDate,
        plan.endDate,
        JSON.stringify(plan.mainGoals || []),
        plan.notes || '',
        JSON.stringify(plan.review || {}),
        now
      );
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save week plan.' });
  }
});

// Save Historical Week
app.post('/api/personal/historical-weeks', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const hw = req.body;
    const id = hw.id || `hw-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO historical_weeks (
        id, user_id, week_id, label, date_range, score, planned,
        completed, missed, skipped, on_time_rate, high_priority_rate,
        consistency, review, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      hw.weekId,
      hw.label,
      hw.dateRange,
      hw.score,
      hw.planned,
      hw.completed,
      hw.missed,
      hw.skipped,
      hw.onTimeRate,
      hw.highPriorityRate,
      hw.consistency,
      JSON.stringify(hw.review || {}),
      now
    );

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record historical week.' });
  }
});

// Save Category
app.post('/api/personal/categories', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const cat = req.body;
    const id = cat.id || `cat-${Date.now()}`;

    db.prepare('INSERT INTO categories (id, user_id, name, color) VALUES (?, ?, ?, ?)')
      .run(id, userId, cat.name, cat.color);

    return res.json({ success: true, category: { ...cat, id } });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create category.' });
  }
});

// Delete Category
app.delete('/api/personal/categories/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId);
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete category.' });
  }
});

// Reset Personal Data
app.post('/api/personal/reset-data', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    db.prepare('DELETE FROM activities WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM goals WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM weekly_targets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM week_plans WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM historical_weeks WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM categories WHERE user_id = ?').run(userId);

    logAuditEvent('PERSONAL_DATA_RESET', req.user!.email, 'warn', 'User cleared their personal execution data.');
    return res.json({ success: true, message: 'All personal records cleared.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reset personal data.' });
  }
});

// ==========================================
// ADMINISTRATOR PLATFORM ROUTES (ROLE: ADMIN)
// ==========================================

// Global Analytics Overview
app.get('/api/admin/analytics', requireAdmin, async (_req, res) => {
  try {
    await authDatabaseReady;
    const authSummary = await getAuthSummary();
    let databaseHealthy = false;
    try {
      db.prepare('SELECT 1').get();
      databaseHealthy = true;
    } catch {
      databaseHealthy = false;
    }

    const activitiesRow = db.prepare("SELECT count(*) as total, sum(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM activities").get() as { total: number; completed: number | null };

    const totalActivities = activitiesRow?.total || 0;
    const completedActivities = activitiesRow?.completed || 0;
    const systemExecutionRate = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;

    const sevenDaysStats: Array<{ date: string; activeUsers: number; completedSessions: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const countRow = db.prepare("SELECT count(*) as count FROM activities WHERE date = ? AND status = 'completed'").get(dateStr) as { count: number };
      const usersRow = db.prepare('SELECT count(DISTINCT user_id) as count FROM activities WHERE date = ?').get(dateStr) as { count: number };
      sevenDaysStats.push({
        date: dateStr,
        activeUsers: usersRow?.count || 0,
        completedSessions: countRow?.count || 0,
      });
    }

    return res.json({
      totalUsers: authSummary.totalUsers,
      activeUsers: authSummary.activeUsers,
      inactiveUsers: authSummary.inactiveUsers,
      newUsersPast7Days: authSummary.newUsersPast7Days,
      adminCount: authSummary.adminCount,
      totalActivitiesLogged: totalActivities,
      systemExecutionRate,
      newUsersThisWeek: authSummary.newUsersPast7Days,
      totalActivitiesCreated: totalActivities,
      totalActivitiesCompleted: completedActivities,
      averageCompletionRate: systemExecutionRate,
      systemStatus: databaseHealthy ? 'Healthy & Operational' : 'Database unavailable',
      databaseHealthy,
      weeklyTrend: sevenDaysStats,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load analytics.' });
  }
});

// User Management List
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    await authDatabaseReady;
    const rows = await listAuthUsers({
      search: String(req.query.search || ''),
      status: String(req.query.status || ''),
      role: String(req.query.role || ''),
    });
    const users = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      status: r.status,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at || undefined,
      activityCount: r.activity_count || 0,
      goalCount: r.goal_count || 0,
    }));

    return res.json({ users });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// Toggle User Status (Active / Deactivated)
app.put('/api/admin/users/:id/status', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    await authDatabaseReady;
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'deactivated'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    const targetUser = await findAuthUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot change your own status.' });
    }

    await updateAuthUserStatus(id, status);
    logAuditEvent('USER_STATUS_CHANGED', req.user!.email, 'warn', `Updated user ${targetUser.email} status to ${status}.`);

    return res.json({ success: true, id, status });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// Delete User
app.delete('/api/admin/users/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    await authDatabaseReady;
    const { id } = req.params;
    const targetUser = await findAuthUserById(id);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot delete your own account from here.' });
    }

    await deleteAuthUser(id);
    db.prepare('DELETE FROM activities WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM goals WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM weekly_targets WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM week_plans WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM historical_weeks WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM categories WHERE user_id = ?').run(id);
    logAuditEvent('USER_DELETED', req.user!.email, 'warn', `Deleted user account ${targetUser.email}.`);

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// Create User (Admin manual provisioning)
app.post('/api/admin/users', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    await authDatabaseReady;
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await findAuthUser(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    const userId = `usr-${crypto.randomBytes(8).toString('hex')}`;
    const userRole = role === 'admin' ? 'admin' : 'user';
    if (userRole === 'admin' && (await getAuthSummary()).adminCount > 0) {
      return res.status(409).json({ error: 'Only one administrator account is permitted.' });
    }
    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();

    await createAuthUser({
      id: userId,
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash: hash,
      salt,
      role: userRole,
      createdAt: now,
    });

    logAuditEvent('USER_CREATED_BY_ADMIN', req.user!.email, 'info', `Provisioned new user: ${cleanEmail} (${userRole})`);

    return res.json({
      success: true,
      user: {
        id: userId,
        name: String(name).trim(),
        email: cleanEmail,
        role: userRole,
        status: 'active',
        createdAt: now,
        activityCount: 0,
        goalCount: 0,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create user.' });
  }
});

// Change User Role
app.put('/api/admin/users/:id/role', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    await authDatabaseReady;
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role value.' });
    }

    const targetUser = await findAuthUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot modify your own administrative role.' });
    }
    const authSummary = await getAuthSummary();
    if (role === 'admin' && targetUser.role !== 'admin' && authSummary.adminCount > 0) {
      return res.status(409).json({ error: 'Only one administrator account is permitted.' });
    }
    if (role === 'user' && targetUser.role === 'admin' && authSummary.adminCount <= 1) {
      return res.status(400).json({ error: 'The administrator account cannot be demoted.' });
    }

    await updateAuthUserRole(id, role);
    logAuditEvent('ROLE_CHANGED', req.user!.email, 'warn', `Changed role of ${targetUser.email} to ${role}.`);

    return res.json({ success: true, id, role });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update user role.' });
  }
});

// Reset User Password
app.post('/api/admin/users/:id/reset-password', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    await authDatabaseReady;
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'New password must have at least 6 characters.' });
    }

    const targetUser = await findAuthUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { hash, salt } = hashPassword(password);
    await updateAuthPassword(id, hash, salt);
    logAuditEvent('ADMIN_RESET_PASSWORD', req.user!.email, 'warn', `Admin reset password for ${targetUser.email}.`);

    return res.json({ success: true, message: `Password for ${targetUser.email} has been updated.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Data Summary
app.get('/api/admin/data-summary', requireAdmin, async (_req, res) => {
  try {
    await authDatabaseReady;
    const authSummary = await getAuthSummary();
    const activityCount = (db.prepare('SELECT count(*) as count FROM activities').get() as any).count;
    const goalCount = (db.prepare('SELECT count(*) as count FROM goals').get() as any).count;
    const targetCount = (db.prepare('SELECT count(*) as count FROM weekly_targets').get() as any).count;
    const planCount = (db.prepare('SELECT count(*) as count FROM week_plans').get() as any).count;
    const historyCount = (db.prepare('SELECT count(*) as count FROM historical_weeks').get() as any).count;
    const categoryCount = (db.prepare('SELECT count(*) as count FROM categories').get() as any).count;
    const logCount = (db.prepare('SELECT count(*) as count FROM audit_logs').get() as any).count;

    return res.json({
      users: authSummary.totalUsers,
      sessions: authSummary.sessionCount,
      activities: activityCount,
      goals: goalCount,
      weeklyTargets: targetCount,
      weekPlans: planCount,
      historicalWeeks: historyCount,
      categories: categoryCount,
      auditLogs: logCount,
      tables: [
        { name: 'auth_users', label: 'Registered Users', count: authSummary.totalUsers },
        { name: 'auth_sessions', label: 'Active Sessions', count: authSummary.sessionCount },
        { name: 'activities', label: 'Activities', count: activityCount },
        { name: 'goals', label: 'Goals', count: goalCount },
        { name: 'weekly_targets', label: 'Weekly Targets', count: targetCount },
        { name: 'week_plans', label: 'Week Plans', count: planCount },
        { name: 'historical_weeks', label: 'Historical Weeks', count: historyCount },
        { name: 'categories', label: 'Categories', count: categoryCount },
        { name: 'audit_logs', label: 'Audit Logs', count: logCount },
      ],
      totalRecords: authSummary.totalUsers + authSummary.sessionCount + activityCount + goalCount + targetCount + planCount + historyCount + categoryCount + logCount,
      databaseType: process.env.DATABASE_URL ? 'Neon Postgres' : 'SQLite Local Development',
      storageHealth: process.env.DATABASE_URL ? 'Persistent hosted database' : 'Local development storage',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load database summary.' });
  }
});

// Export Database JSON Backup
app.get('/api/admin/export-backup', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    await authDatabaseReady;
    const users = (await listAuthUsers()).map(({ id, name, email, role, status, created_at, last_login_at }) => ({
      id, name, email, role, status, createdAt: created_at, lastLoginAt: last_login_at,
    }));
    const sessions = await listAuthSessionMetadata();
    const activities = db.prepare('SELECT * FROM activities').all();
    const goals = db.prepare('SELECT * FROM goals').all();
    const weeklyTargets = db.prepare('SELECT * FROM weekly_targets').all();
    const weekPlans = db.prepare('SELECT * FROM week_plans').all();
    const historicalWeeks = db.prepare('SELECT * FROM historical_weeks').all();
    const categories = db.prepare('SELECT * FROM categories').all();
    const settings = db.prepare('SELECT * FROM system_settings').all();
    const auditLogs = db.prepare('SELECT * FROM audit_logs').all();

    logAuditEvent('DATA_BACKUP_EXPORTED', req.user!.email, 'info', 'Generated full JSON backup of database records.');

    res.setHeader('Content-Disposition', `attachment; filename="mnemora-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    return res.json({
      exportedAt: new Date().toISOString(),
      system: 'FOCUS OS Multi-User Platform',
      version: '2.0.0',
      database: {
        users,
        sessions,
        activities,
        goals,
        weeklyTargets,
        weekPlans,
        historicalWeeks,
        categories,
        settings,
        auditLogs,
        note: 'Authentication passwords, password hashes, salts, session tokens, and API secrets are excluded.',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export backup.' });
  }
});

// Vacuum & Optimize Database
app.post('/api/admin/vacuum', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const expiredSessionsRemoved = await pruneExpiredAuthSessions();

    try {
      db.exec('PRAGMA optimize;');
    } catch {
      // Non-fatal
    }

    logAuditEvent('DATABASE_OPTIMIZED', req.user!.email, 'info', `Pruned ${expiredSessionsRemoved} expired authentication sessions.`);

    return res.json({
      success: true,
      message: 'Database optimization complete. Expired sessions purged.',
      expiredSessionsRemoved,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to optimize database.' });
  }
});

// System Activity & Execution Reports
app.get('/api/admin/reports', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const priorityStats = db.prepare(`
      SELECT priority, count(*) as count, sum(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM activities
      GROUP BY priority
    `).all() as any[];

    const categoryStats = db.prepare(`
      SELECT category, count(*) as count, sum(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM activities
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
      LIMIT 6
    `).all() as any[];

    const userRankings = db.prepare(`
      SELECT
        u.id, u.name, u.email,
        count(a.id) as total_activities,
        sum(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_activities,
        sum(CASE WHEN a.is_on_time = 1 THEN 1 ELSE 0 END) as on_time_activities
      FROM users u
      LEFT JOIN activities a ON a.user_id = u.id
      GROUP BY u.id
      ORDER BY completed_activities DESC
      LIMIT 8
    `).all() as any[];

    logAuditEvent('REPORT_GENERATED', req.user!.email, 'info', 'Generated execution report summary.');

    return res.json({
      priorityStats: priorityStats.map((p) => ({
        priority: p.priority,
        total: p.count,
        completed: p.completed || 0,
      })),
      categoryStats: categoryStats.map((c) => ({
        category: c.category,
        total: c.count,
        completed: c.completed || 0,
      })),
      leaderboard: userRankings.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        total: u.total_activities,
        completed: u.completed_activities || 0,
        rate: u.total_activities > 0 ? Math.round(((u.completed_activities || 0) / u.total_activities) * 100) : 0,
        onTimeRate: u.total_activities > 0 ? Math.round(((u.on_time_activities || 0) / u.total_activities) * 100) : 0,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate reports.' });
  }
});

// Audit Logs
app.get('/api/admin/logs', requireAdmin, (req, res) => {
  try {
    const { level, query: searchQuery } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (level && level !== 'all') {
      sql += ' AND level = ?';
      params.push(level);
    }
    if (searchQuery) {
      sql += ' AND (event LIKE ? OR user_email LIKE ? OR details LIKE ?)';
      params.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);
    }

    sql += ' ORDER BY timestamp DESC LIMIT 100';

    let rows = db.prepare(sql).all(...params) as any[];

    const logs = rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      event: r.event,
      userEmail: r.user_email,
      level: r.level,
      details: r.details || '',
    }));

    return res.json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

// Clear Audit Logs
app.delete('/api/admin/logs', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    db.prepare('DELETE FROM audit_logs').run();
    logAuditEvent('LOGS_PURGED', req.user!.email, 'warn', 'Admin cleared the audit logs table.');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to clear logs.' });
  }
});

// System Settings
app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  try {
    const rows = db.prepare('SELECT key, value, updated_at FROM system_settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    return res.json({
      settings,
      environment: {
        nodeVersion: process.version,
        port: Number(process.env.PORT || 3000),
        databaseMode: process.env.DATABASE_URL ? 'Neon Postgres auth + SQLite local data' : 'SQLite local development',
        uptimeSeconds: Math.floor(process.uptime()),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve system settings.' });
  }
});

// Update System Settings
app.post('/api/admin/settings', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings payload.' });
    }

    const now = new Date().toISOString();
    const upsertStmt = db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    for (const [k, v] of Object.entries(settings)) {
      upsertStmt.run(k, String(v), now);
    }

    logAuditEvent('SETTINGS_UPDATED', req.user!.email, 'info', `Updated system configuration keys: ${Object.keys(settings).join(', ')}`);

    return res.json({ success: true, message: 'Application settings saved successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Catch-all 404 handler for any unmatched /api routes ensuring JSON response
app.use('/api', (req, res) => {
  res.status(404).json({
    error: `API route ${req.method} ${req.originalUrl || req.url} not found.`,
  });
});

// Global unhandled error handler ensuring JSON response
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[FOCUS OS Server Error]:', err);
  res.status(500).json({
    error: err?.message || 'An unexpected server error occurred.',
  });
});

export default app;
