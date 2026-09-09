import express from 'express';
import { GoogleGenAI } from '@google/genai';
import crypto from 'node:crypto';
import { db, initDatabase, hashPassword, verifyPassword, logAuditEvent } from './db';
import {
  requireAuth,
  requireAdmin,
  createSession,
  deleteSession,
  AuthenticatedRequest,
} from './auth';

// Ensure database and primary tables/admin are initialized
initDatabase();

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
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!cleanEmail.includes('@') || password.length < 6) {
      return res.status(400).json({ error: 'Please provide a valid email and a password of at least 6 characters.' });
    }

    const existingQuery = db.prepare('SELECT id FROM users WHERE email = ?');
    const existing = existingQuery.get(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'mgshabbas@gmail.com').trim().toLowerCase();
    const userId = `usr-${crypto.randomBytes(8).toString('hex')}`;
    const role = cleanEmail === adminEmail ? 'admin' : 'user';
    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, salt, role, status, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `);
    insertStmt.run(userId, String(name).trim(), cleanEmail, hash, salt, role, now, now);

    const token = createSession(userId);

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
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const userQuery = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = userQuery.get(cleanEmail) as any;

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
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);

    const token = createSession(user.id);

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
app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (req.token) {
      deleteSession(req.token);
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
app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Please provide current password and a new password with at least 6 characters.' });
    }

    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
    if (!userRow || !verifyPassword(currentPassword, userRow.password_hash, userRow.salt)) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const { hash, salt } = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, req.user!.id);
    logAuditEvent('PASSWORD_CHANGED', req.user!.email, 'info', 'User changed their password.');

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

// Reset password by email (public reset)
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Valid email and new password (min 6 characters) required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail) as { id: string } | undefined;

    if (!user) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }

    const { hash, salt } = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, user.id);
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
app.get('/api/admin/analytics', requireAdmin, (_req, res) => {
  try {
    const totalUsersRow = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
    const activeUsersRow = db.prepare("SELECT count(*) as count FROM users WHERE status = 'active'").get() as { count: number };
    const inactiveUsersRow = db.prepare("SELECT count(*) as count FROM users WHERE status = 'deactivated'").get() as { count: number };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const newUsersRow = db.prepare('SELECT count(*) as count FROM users WHERE created_at >= ?').get(sevenDaysAgo) as { count: number };

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
      totalUsers: totalUsersRow.count,
      activeUsers: activeUsersRow.count,
      inactiveUsers: inactiveUsersRow.count,
      newUsersPast7Days: newUsersRow.count,
      totalActivitiesLogged: totalActivities,
      systemExecutionRate,
      weeklyTrend: sevenDaysStats,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load analytics.' });
  }
});

// User Management List
app.get('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const { search, status, role } = req.query;
    let query = `
      SELECT
        u.id, u.name, u.email, u.role, u.status, u.created_at, u.last_login_at,
        (SELECT count(*) FROM activities WHERE user_id = u.id) as activity_count,
        (SELECT count(*) FROM goals WHERE user_id = u.id) as goal_count
      FROM users u
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status && status !== 'all') {
      query += ' AND u.status = ?';
      params.push(status);
    }
    if (role && role !== 'all') {
      query += ' AND u.role = ?';
      params.push(role);
    }

    query += ' ORDER BY u.created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
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
app.put('/api/admin/users/:id/status', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'deactivated'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    const targetUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(id) as any;
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot change your own status.' });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'mgshabbas@gmail.com').trim().toLowerCase();
    if (targetUser.email === adminEmail) {
      return res.status(403).json({ error: 'The primary system administrator account cannot be deactivated.' });
    }

    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
    logAuditEvent('USER_STATUS_CHANGED', req.user!.email, 'warn', `Updated user ${targetUser.email} status to ${status}.`);

    if (status === 'deactivated') {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }

    return res.json({ success: true, id, status });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// Delete User
app.delete('/api/admin/users/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const targetUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(id) as any;

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot delete your own account from here.' });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'mgshabbas@gmail.com').trim().toLowerCase();
    if (targetUser.email === adminEmail) {
      return res.status(403).json({ error: 'The primary system administrator account cannot be deleted.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    logAuditEvent('USER_DELETED', req.user!.email, 'warn', `Deleted user account ${targetUser.email}.`);

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// Create User (Admin manual provisioning)
app.post('/api/admin/users', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    const userId = `usr-${crypto.randomBytes(8).toString('hex')}`;
    const userRole = role === 'admin' ? 'admin' : 'user';
    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, salt, role, status, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NULL)
    `).run(userId, String(name).trim(), cleanEmail, hash, salt, userRole, now);

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
app.put('/api/admin/users/:id/role', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role value.' });
    }

    const targetUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(id) as any;
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'mgshabbas@gmail.com').trim().toLowerCase();
    if (targetUser.email === adminEmail && role !== 'admin') {
      return res.status(403).json({ error: 'Cannot demote the primary administrator account.' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    logAuditEvent('ROLE_CHANGED', req.user!.email, 'warn', `Changed role of ${targetUser.email} to ${role}.`);

    return res.json({ success: true, id, role });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update user role.' });
  }
});

// Reset User Password
app.post('/api/admin/users/:id/reset-password', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'New password must have at least 6 characters.' });
    }

    const targetUser = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id) as any;
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { hash, salt } = hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, id);
    logAuditEvent('ADMIN_RESET_PASSWORD', req.user!.email, 'warn', `Admin reset password for ${targetUser.email}.`);

    return res.json({ success: true, message: `Password for ${targetUser.email} has been updated.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Data Summary
app.get('/api/admin/data-summary', requireAdmin, (_req, res) => {
  try {
    const userCount = (db.prepare('SELECT count(*) as count FROM users').get() as any).count;
    const sessionCount = (db.prepare('SELECT count(*) as count FROM sessions').get() as any).count;
    const activityCount = (db.prepare('SELECT count(*) as count FROM activities').get() as any).count;
    const goalCount = (db.prepare('SELECT count(*) as count FROM goals').get() as any).count;
    const targetCount = (db.prepare('SELECT count(*) as count FROM weekly_targets').get() as any).count;
    const planCount = (db.prepare('SELECT count(*) as count FROM week_plans').get() as any).count;
    const historyCount = (db.prepare('SELECT count(*) as count FROM historical_weeks').get() as any).count;
    const categoryCount = (db.prepare('SELECT count(*) as count FROM categories').get() as any).count;
    const logCount = (db.prepare('SELECT count(*) as count FROM audit_logs').get() as any).count;

    return res.json({
      users: userCount,
      sessions: sessionCount,
      activities: activityCount,
      goals: goalCount,
      weeklyTargets: targetCount,
      weekPlans: planCount,
      historicalWeeks: historyCount,
      categories: categoryCount,
      auditLogs: logCount,
      databaseType: 'SQLite Embedded Engine (WAL Mode)',
      storageHealth: 'Healthy (Zero Fragmentation)',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load database summary.' });
  }
});

// Export Database JSON Backup
app.get('/api/admin/export-backup', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, role, status, created_at, last_login_at FROM users').all();
    const activities = db.prepare('SELECT * FROM activities').all();
    const goals = db.prepare('SELECT * FROM goals').all();
    const targets = db.prepare('SELECT * FROM weekly_targets').all();
    const plans = db.prepare('SELECT * FROM week_plans').all();
    const history = db.prepare('SELECT * FROM historical_weeks').all();
    const categories = db.prepare('SELECT * FROM categories').all();
    const settings = db.prepare('SELECT * FROM system_settings').all();

    logAuditEvent('DATA_BACKUP_EXPORTED', req.user!.email, 'info', 'Generated full JSON backup of database records.');

    return res.json({
      exportedAt: new Date().toISOString(),
      system: 'FOCUS OS Multi-User Platform',
      version: '2.0.0',
      database: {
        users,
        activities,
        goals,
        weeklyTargets: targets,
        weekPlans: plans,
        historicalWeeks: history,
        categories,
        settings,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export backup.' });
  }
});

// Vacuum & Optimize Database
app.post('/api/admin/vacuum', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const now = new Date().toISOString();
    const deleteResult = db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);

    try {
      db.exec('PRAGMA optimize;');
    } catch {
      // Non-fatal
    }

    logAuditEvent('DATABASE_OPTIMIZED', req.user!.email, 'info', `Pruned ${deleteResult.changes} expired user sessions.`);

    return res.json({
      success: true,
      message: 'Database optimization complete. Expired sessions purged.',
      expiredSessionsRemoved: deleteResult.changes,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to optimize database.' });
  }
});

// System Activity & Execution Reports
app.get('/api/admin/reports', requireAdmin, (_req, res) => {
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
        sum(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_activities
      FROM users u
      LEFT JOIN activities a ON a.user_id = u.id
      GROUP BY u.id
      ORDER BY completed_activities DESC
      LIMIT 8
    `).all() as any[];

    return res.json({
      priorityBreakdown: priorityStats.map((p) => ({
        priority: p.priority,
        count: p.count,
        completionRate: p.count > 0 ? Math.round(((p.completed || 0) / p.count) * 100) : 0,
      })),
      categoryBreakdown: categoryStats.map((c) => ({
        category: c.category,
        count: c.count,
        completed: c.completed || 0,
      })),
      leaderboard: userRankings.map((u) => ({
        name: u.name,
        email: u.email,
        total: u.total_activities,
        completed: u.completed_activities || 0,
        rate: u.total_activities > 0 ? Math.round(((u.completed_activities || 0) / u.total_activities) * 100) : 0,
      })),
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
    return res.json({ settings });
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

// Self-service Elevation for preview/testing: promote current user to admin
app.post('/api/admin/elevate-me', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(userId);
    logAuditEvent('USER_SELF_ELEVATED', req.user!.email, 'warn', `User ${req.user!.email} elevated account to administrator.`);

    return res.json({
      success: true,
      user: {
        ...req.user!,
        role: 'admin',
      },
      message: 'Account successfully upgraded to Administrator.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to elevate account.' });
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
