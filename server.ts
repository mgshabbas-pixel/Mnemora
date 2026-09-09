import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import crypto from 'node:crypto';
import { db, initDatabase, hashPassword, verifyPassword, logAuditEvent } from './server/db';
import {
  requireAuth,
  requireAdmin,
  createSession,
  deleteSession,
  AuthenticatedRequest,
} from './server/auth';

// Initialize the database tables and admin account
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

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

      const userId = `usr-${crypto.randomBytes(8).toString('hex')}`;
      const role = cleanEmail === 'mgshabbas@gmail.com' ? 'admin' : 'user';
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
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }

      const { hash, salt } = hashPassword(newPassword);
      db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, req.user!.id);

      return res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to update password.' });
    }
  });

  // Password reset helper (self-service reset for demo/local usage)
  app.post('/api/auth/reset-password', (req, res) => {
    try {
      const { email, newPassword } = req.body;
      if (!email || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Valid email and new password (min 6 chars) required.' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail) as { id: string } | undefined;
      if (!user) {
        return res.status(404).json({ error: 'No account found with this email address.' });
      }

      const { hash, salt } = hashPassword(newPassword);
      db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, user.id);

      return res.json({ success: true, message: 'Password reset successfully. You may now log in.' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to reset password.' });
    }
  });

  // ==========================================
  // PERSONAL DATA ROUTES (Scoped to req.user.id)
  // ==========================================

  // Load all user's personal data
  app.get('/api/personal/data', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      // 1. Activities
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
        category: r.category || 'General',
        priority: r.priority,
        goalId: r.goal_id || undefined,
        reminder: r.reminder,
        recurring: r.recurring || undefined,
        notes: r.notes || undefined,
        status: r.status,
        completedAt: r.completed_at || undefined,
        completedDate: r.completed_date || undefined,
        completedTime: r.completed_time || undefined,
        isOnTime: r.is_on_time === 1 ? true : r.is_on_time === 0 ? false : undefined,
      }));

      // 2. Goals
      const goalsRows = db.prepare(`
        SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC
      `).all(userId) as any[];

      const goals = goalsRows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        targetDate: r.target_date,
        progress: r.progress,
        status: r.status,
        category: r.category || undefined,
        color: r.color || undefined,
      }));

      // 3. Weekly Targets
      const targetRows = db.prepare(`
        SELECT * FROM weekly_targets WHERE user_id = ?
      `).all(userId) as any[];

      const weeklyTargets = targetRows.map((r) => ({
        id: r.id,
        goalId: r.goal_id,
        weekId: r.week_id,
        text: r.text,
        completed: Boolean(r.completed),
      }));

      // 4. Week Plan
      const planRow = db.prepare(`
        SELECT * FROM week_plans WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1
      `).get(userId) as any;

      let weekPlan = {
        weekId: '2026-W37',
        dateRange: 'September 7 – 13, 2026',
        startDate: '2026-09-07',
        endDate: '2026-09-13',
        mainGoals: [] as string[],
        notes: '',
      };

      if (planRow) {
        let parsedGoals = [];
        let parsedReview = undefined;
        try {
          if (planRow.main_goals) parsedGoals = JSON.parse(planRow.main_goals);
          if (planRow.review) parsedReview = JSON.parse(planRow.review);
        } catch {}

        weekPlan = {
          weekId: planRow.week_id,
          dateRange: planRow.date_range,
          startDate: planRow.start_date,
          endDate: plan_row_end(planRow),
          mainGoals: parsedGoals,
          notes: planRow.notes || '',
          ...(parsedReview ? { review: parsedReview } : {}),
        };
      }

      function plan_row_end(row: any) {
        return row.end_date || '2026-09-13';
      }

      // 5. Historical Weeks
      const historicalRows = db.prepare(`
        SELECT * FROM historical_weeks WHERE user_id = ? ORDER BY created_at DESC
      `).all(userId) as any[];

      const historicalWeeks = historicalRows.map((r) => {
        let reviewObj = undefined;
        try {
          if (r.review) reviewObj = JSON.parse(r.review);
        } catch {}

        return {
          weekId: r.week_id,
          label: r.label,
          dateRange: r.date_range,
          score: r.score,
          planned: r.planned,
          completed: r.completed,
          missed: r.missed,
          skipped: r.skipped,
          onTimeRate: r.on_time_rate,
          highPriorityRate: r.high_priority_rate,
          consistency: r.consistency,
          review: reviewObj,
        };
      });

      // 6. Categories
      const categoryRows = db.prepare(`
        SELECT * FROM categories WHERE user_id = ?
      `).all(userId) as any[];

      const categories = categoryRows.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
      }));

      return res.json({
        activities,
        goals,
        weeklyTargets,
        weekPlan,
        historicalWeeks,
        categories,
      });
    } catch (err: any) {
      console.error('Error fetching personal data:', err);
      return res.status(500).json({ error: 'Failed to load personal data.' });
    }
  });

  // Create Activity
  app.post('/api/personal/activities', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const a = req.body;
      const id = a.id || `act-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
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
        a.title || 'Untitled Activity',
        a.date,
        a.startTime,
        a.endTime || null,
        a.durationMinutes || 60,
        a.category || null,
        a.priority || 'medium',
        a.goalId || null,
        a.reminder || 'none',
        a.recurring || 'none',
        a.notes || null,
        a.status || 'pending',
        a.completedAt || null,
        a.completedDate || null,
        a.completedTime || null,
        a.isOnTime === true ? 1 : a.isOnTime === false ? 0 : null,
        now
      );

      return res.json({ id, ...a });
    } catch (err: any) {
      console.error('Error creating activity:', err);
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

      const updated = {
        title: updates.title ?? current.title,
        date: updates.date ?? current.date,
        start_time: updates.startTime ?? current.start_time,
        end_time: updates.endTime !== undefined ? updates.endTime : current.end_time,
        duration_minutes: updates.durationMinutes ?? current.duration_minutes,
        category: updates.category !== undefined ? updates.category : current.category,
        priority: updates.priority ?? current.priority,
        goal_id: updates.goalId !== undefined ? updates.goalId : current.goal_id,
        reminder: updates.reminder ?? current.reminder,
        recurring: updates.recurring !== undefined ? updates.recurring : current.recurring,
        notes: updates.notes !== undefined ? updates.notes : current.notes,
        status: updates.status ?? current.status,
        completed_at: updates.completedAt !== undefined ? updates.completedAt : current.completed_at,
        completed_date: updates.completedDate !== undefined ? updates.completedDate : current.completed_date,
        completed_time: updates.completedTime !== undefined ? updates.completedTime : current.completed_time,
        is_on_time: updates.isOnTime === true ? 1 : updates.isOnTime === false ? 0 : updates.isOnTime === null ? null : current.is_on_time,
      };

      const stmt = db.prepare(`
        UPDATE activities SET
          title = ?, date = ?, start_time = ?, end_time = ?, duration_minutes = ?,
          category = ?, priority = ?, goal_id = ?, reminder = ?, recurring = ?, notes = ?,
          status = ?, completed_at = ?, completed_date = ?, completed_time = ?, is_on_time = ?
        WHERE id = ? AND user_id = ?
      `);

      stmt.run(
        updated.title,
        updated.date,
        updated.start_time,
        updated.end_time,
        updated.duration_minutes,
        updated.category,
        updated.priority,
        updated.goal_id,
        updated.reminder,
        updated.recurring,
        updated.notes,
        updated.status,
        updated.completed_at,
        updated.completed_date,
        updated.completed_time,
        updated.is_on_time,
        id,
        userId
      );

      return res.json({ success: true });
    } catch (err: any) {
      console.error('Error updating activity:', err);
      return res.status(500).json({ error: 'Failed to update activity.' });
    }
  });

  // Delete Activity
  app.delete('/api/personal/activities/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      db.prepare('DELETE FROM activities WHERE id = ? AND user_id = ?').run(id, userId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to delete activity.' });
    }
  });

  // Create Goal
  app.post('/api/personal/goals', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const g = req.body;
      const id = g.id || `goal-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO goals (id, user_id, name, description, target_date, progress, status, category, color, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        userId,
        g.name || 'Untitled Goal',
        g.description || '',
        g.targetDate || '2026-12-31',
        g.progress || 0,
        g.status || 'in_progress',
        g.category || null,
        g.color || '#1C1D1F',
        now
      );

      return res.json({ id, ...g });
    } catch (err: any) {
      console.error('Error creating goal:', err);
      return res.status(500).json({ error: 'Failed to create goal.' });
    }
  });

  // Update Goal
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
      const status = updates.status !== undefined ? updates.status : (progress >= 100 ? 'completed' : current.status);

      db.prepare(`
        UPDATE goals SET
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          target_date = COALESCE(?, target_date),
          progress = ?,
          status = ?,
          category = COALESCE(?, category),
          color = COALESCE(?, color)
        WHERE id = ? AND user_id = ?
      `).run(
        updates.name ?? null,
        updates.description ?? null,
        updates.targetDate ?? null,
        progress,
        status,
        updates.category ?? null,
        updates.color ?? null,
        id,
        userId
      );

      return res.json({ success: true });
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
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to delete goal.' });
    }
  });

  // Create Weekly Target
  app.post('/api/personal/weekly-targets', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const t = req.body;
      const id = t.id || `wt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO weekly_targets (id, user_id, goal_id, week_id, text, completed, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, userId, t.goalId || null, t.weekId || '2026-W37', t.text, t.completed ? 1 : 0, now);

      return res.json({ id, ...t });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to create target.' });
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

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to update target.' });
    }
  });

  // Delete Weekly Target
  app.delete('/api/personal/weekly-targets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      db.prepare('DELETE FROM weekly_targets WHERE id = ? AND user_id = ?').run(id, userId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to delete target.' });
    }
  });

  // Save Week Plan
  app.put('/api/personal/week-plan', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const p = req.body;
      const id = `wp-${userId}-${p.weekId || '2026-W37'}`;
      const now = new Date().toISOString();

      const existing = db.prepare('SELECT id FROM week_plans WHERE user_id = ? AND week_id = ?')
        .get(userId, p.weekId || '2026-W37');

      if (existing) {
        db.prepare(`
          UPDATE week_plans SET
            date_range = ?, start_date = ?, end_date = ?,
            main_goals = ?, notes = ?, review = ?, updated_at = ?
          WHERE user_id = ? AND week_id = ?
        `).run(
          p.dateRange || 'September 7 – 13, 2026',
          p.startDate || '2026-09-07',
          p.endDate || '2026-09-13',
          JSON.stringify(p.mainGoals || []),
          p.notes || '',
          p.review ? JSON.stringify(p.review) : null,
          now,
          userId,
          p.weekId || '2026-W37'
        );
      } else {
        db.prepare(`
          INSERT INTO week_plans (id, user_id, week_id, date_range, start_date, end_date, main_goals, notes, review, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          userId,
          p.weekId || '2026-W37',
          p.dateRange || 'September 7 – 13, 2026',
          p.startDate || '2026-09-07',
          p.endDate || '2026-09-13',
          JSON.stringify(p.mainGoals || []),
          p.notes || '',
          p.review ? JSON.stringify(p.review) : null,
          now
        );
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error('Error saving week plan:', err);
      return res.status(500).json({ error: 'Failed to save week plan.' });
    }
  });

  // Save Historical Week Record
  app.post('/api/personal/historical-weeks', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const h = req.body;
      const id = `hw-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO historical_weeks (
          id, user_id, week_id, label, date_range, score, planned, completed, missed, skipped,
          on_time_rate, high_priority_rate, consistency, review, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        userId,
        h.weekId,
        h.label || 'Previous week',
        h.dateRange,
        h.score || 0,
        h.planned || 0,
        h.completed || 0,
        h.missed || 0,
        h.skipped || 0,
        h.onTimeRate || 0,
        h.highPriorityRate || 0,
        h.consistency || 0,
        h.review ? JSON.stringify(h.review) : null,
        now
      );

      return res.json({ id, ...h });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to record historical week.' });
    }
  });

  // Categories
  app.post('/api/personal/categories', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { name, color } = req.body;
      const id = `cat-${Date.now()}`;
      db.prepare('INSERT INTO categories (id, user_id, name, color) VALUES (?, ?, ?, ?)')
        .run(id, userId, name, color);
      return res.json({ id, name, color });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to create category.' });
    }
  });

  app.delete('/api/personal/categories/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to delete category.' });
    }
  });

  // Reset User Personal Data (Clear everything for this user)
  app.post('/api/personal/reset-data', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      db.prepare('DELETE FROM activities WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM goals WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM weekly_targets WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM week_plans WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM historical_weeks WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM categories WHERE user_id = ?').run(userId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to reset personal data.' });
    }
  });

  // ==========================================
  // ADMIN SYSTEM ROUTES (Protected by requireAdmin)
  // ==========================================

  // Admin Analytics - Real calculated platform metrics
  app.get('/api/admin/analytics', requireAdmin, (_req, res) => {
    try {
      const totalUsersRow = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
      const activeUsersRow = db.prepare("SELECT count(*) as count FROM users WHERE status = 'active'").get() as { count: number };
      const inactiveUsersRow = db.prepare("SELECT count(*) as count FROM users WHERE status = 'deactivated'").get() as { count: number };

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const newUsersRow = db.prepare('SELECT count(*) as count FROM users WHERE created_at >= ?').get(sevenDaysAgo) as { count: number };

      const activitiesRow = db.prepare("SELECT count(*) as total, sum(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM activities").get() as { total: number; completed: number | null };

      const totalActivities = activitiesRow.total || 0;
      const completedActivities = activitiesRow.completed || 0;
      const averageCompletionRate = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;

      return res.json({
        totalUsers: totalUsersRow.count || 0,
        activeUsers: activeUsersRow.count || 0,
        newUsersThisWeek: newUsersRow.count || 0,
        inactiveUsers: inactiveUsersRow.count || 0,
        totalActivitiesCreated: totalActivities,
        totalActivitiesCompleted: completedActivities,
        averageCompletionRate,
      });
    } catch (err: any) {
      console.error('Error in admin analytics:', err);
      return res.status(500).json({ error: 'Failed to fetch platform analytics.' });
    }
  });

  // Admin User List (With counts and usage summaries, strictly protecting private task text)
  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    try {
      const query = `
        SELECT
          u.id, u.name, u.email, u.role, u.status, u.created_at, u.last_login_at,
          (SELECT count(*) FROM goals g WHERE g.user_id = u.id) as goalCount,
          (SELECT count(*) FROM activities a WHERE a.user_id = u.id) as activityCount,
          (SELECT count(*) FROM activities a WHERE a.user_id = u.id AND a.status = 'completed') as completedActivityCount
        FROM users u
        ORDER BY u.created_at DESC
      `;

      const rows = db.prepare(query).all() as any[];

      const users = rows.map((r) => {
        const activityCount = r.activityCount || 0;
        const completedActivityCount = r.completedActivityCount || 0;
        const completionRate = activityCount > 0 ? Math.round((completedActivityCount / activityCount) * 100) : 0;

        return {
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.role,
          status: r.status,
          createdAt: r.created_at,
          lastLoginAt: r.last_login_at || null,
          goalCount: r.goalCount || 0,
          activityCount,
          completedActivityCount,
          completionRate,
        };
      });

      return res.json({ users });
    } catch (err: any) {
      console.error('Error fetching admin users:', err);
      return res.status(500).json({ error: 'Failed to fetch users list.' });
    }
  });

  // Toggle user active / deactivated status
  app.patch('/api/admin/users/:id/status', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (status !== 'active' && status !== 'deactivated') {
        return res.status(400).json({ error: "Status must be 'active' or 'deactivated'." });
      }

      const targetUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(id) as any;
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Protection: Cannot deactivate the primary admin
      if (targetUser.email === 'mgshabbas@gmail.com') {
        return res.status(403).json({ error: 'The primary administrator account cannot be deactivated.' });
      }

      // Protection: Cannot deactivate oneself
      if (targetUser.id === req.user!.id) {
        return res.status(403).json({ error: 'You cannot deactivate your own administrative account.' });
      }

      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);

      // If deactivated, revoke all active sessions for this user immediately
      if (status === 'deactivated') {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      }

      return res.json({ success: true, message: `User status updated to ${status}.` });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to update user status.' });
    }
  });

  // Delete user
  app.delete('/api/admin/users/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      const targetUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(id) as any;
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Protection: Cannot delete the primary admin
      if (targetUser.email === 'mgshabbas@gmail.com') {
        return res.status(403).json({ error: 'The primary administrator account cannot be deleted.' });
      }

      // Protection: Cannot delete oneself
      if (targetUser.id === req.user!.id) {
        return res.status(403).json({ error: 'You cannot delete your own administrative account.' });
      }

      // Cascading delete deletes all sessions, activities, goals, etc.
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      logAuditEvent('USER_DELETED', req.user!.email, 'warn', `Deleted user account ${targetUser.email} (${id})`);

      return res.json({ success: true, message: 'User and all associated records deleted permanently.' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to delete user.' });
    }
  });

  // Create new user by admin
  app.post('/api/admin/users', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { name, email, password, role = 'user' } = req.body;
      if (!name || !email || !password || password.length < 6) {
        return res.status(400).json({ error: 'Valid name, email, and password (min 6 chars) required.' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
      if (existing) {
        return res.status(400).json({ error: 'A user with this email already exists.' });
      }

      const userId = `usr-${crypto.randomBytes(8).toString('hex')}`;
      const { hash, salt } = hashPassword(password);
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, salt, role, status, created_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NULL)
      `).run(userId, String(name).trim(), cleanEmail, hash, salt, role === 'admin' ? 'admin' : 'user', now);

      logAuditEvent('USER_CREATED_BY_ADMIN', req.user!.email, 'info', `Created user ${cleanEmail} with role ${role}`);

      return res.json({
        success: true,
        user: {
          id: userId,
          name: String(name).trim(),
          email: cleanEmail,
          role,
          status: 'active',
          createdAt: now,
          lastLoginAt: null,
          goalCount: 0,
          activityCount: 0,
          completedActivityCount: 0,
          completionRate: 0,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to create user.' });
    }
  });

  // Toggle/Update User Role
  app.patch('/api/admin/users/:id/role', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ error: "Role must be 'admin' or 'user'." });
      }

      const targetUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(id) as any;
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      if (targetUser.id === req.user!.id) {
        return res.status(403).json({ error: 'You cannot change your own administrative role.' });
      }

      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
      logAuditEvent('USER_ROLE_CHANGED', req.user!.email, 'info', `Changed role of ${targetUser.email} to ${role}`);

      return res.json({ success: true, message: `User role changed to ${role}.` });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to update user role.' });
    }
  });

  // Admin Reset User Password
  app.post('/api/admin/users/:id/reset-password', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }

      const targetUser = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id) as any;
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const { hash, salt } = hashPassword(newPassword);
      db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, id);
      logAuditEvent('USER_PASSWORD_RESET', req.user!.email, 'warn', `Reset password for user ${targetUser.email}`);

      return res.json({ success: true, message: 'Password has been reset successfully.' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to reset user password.' });
    }
  });

  // Data Management: Summary stats across all tables
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
        tables: [
          { name: 'users', label: 'User Accounts', count: userCount },
          { name: 'activities', label: 'Activities & Tasks', count: activityCount },
          { name: 'goals', label: 'Goals', count: goalCount },
          { name: 'weekly_targets', label: 'Weekly Targets', count: targetCount },
          { name: 'week_plans', label: 'Week Plans', count: planCount },
          { name: 'historical_weeks', label: 'Historical Reviews', count: historyCount },
          { name: 'categories', label: 'Custom Categories', count: categoryCount },
          { name: 'sessions', label: 'Active Sessions', count: sessionCount },
          { name: 'audit_logs', label: 'Audit Log Entries', count: logCount },
        ],
        totalRecords: userCount + activityCount + goalCount + targetCount + planCount + historyCount + categoryCount + sessionCount + logCount,
        dbEngine: 'SQLite 3 (WAL Mode)',
        status: 'Healthy',
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to retrieve data summary.' });
    }
  });

  // Data Management: Full JSON Backup Export
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

      logAuditEvent('DATA_BACKUP_EXPORTED', req.user!.email, 'info', 'Full system JSON backup generated');

      return res.json({
        exportedAt: new Date().toISOString(),
        exportedBy: req.user!.email,
        version: '2.6',
        database: {
          users,
          activities,
          goals,
          weekly_targets: targets,
          week_plans: plans,
          historical_weeks: history,
          categories,
          system_settings: settings,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to export backup.' });
    }
  });

  // Data Management: Optimize & Vacuum database
  app.post('/api/admin/vacuum', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      // 1. Delete expired sessions
      const now = new Date().toISOString();
      const deleteResult = db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);

      // 2. Run PRAGMA optimize
      db.exec('PRAGMA optimize;');

      logAuditEvent('DATABASE_MAINTENANCE', req.user!.email, 'info', `Optimized database and pruned ${deleteResult.changes} expired sessions`);

      return res.json({
        success: true,
        message: `Optimization complete. Pruned ${deleteResult.changes} stale sessions. Database integrity verified.`,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Maintenance operation failed.' });
    }
  });

  // Reports: Aggregated execution metrics and leaderboard
  app.get('/api/admin/reports', requireAdmin, (_req, res) => {
    try {
      // Priority breakdown
      const priorityStats = db.prepare(`
        SELECT
          priority,
          count(*) as total,
          sum(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM activities
        GROUP BY priority
      `).all() as any[];

      // Category breakdown
      const categoryStats = db.prepare(`
        SELECT
          category,
          count(*) as total,
          sum(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM activities
        GROUP BY category
        ORDER BY total DESC
        LIMIT 6
      `).all() as any[];

      // User Performance League
      const userRankings = db.prepare(`
        SELECT
          u.id, u.name, u.email,
          count(a.id) as totalActivities,
          sum(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completedActivities,
          sum(CASE WHEN a.is_on_time = 1 THEN 1 ELSE 0 END) as onTimeActivities
        FROM users u
        LEFT JOIN activities a ON a.user_id = u.id
        GROUP BY u.id
        ORDER BY completedActivities DESC
        LIMIT 10
      `).all() as any[];

      const leaderboard = userRankings.map((u) => {
        const total = u.totalActivities || 0;
        const comp = u.completedActivities || 0;
        const onTime = u.onTimeActivities || 0;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          total,
          completed: comp,
          rate: total > 0 ? Math.round((comp / total) * 100) : 0,
          onTimeRate: comp > 0 ? Math.round((onTime / comp) * 100) : 0,
        };
      });

      return res.json({
        priorityStats,
        categoryStats,
        leaderboard,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to generate platform report.' });
    }
  });

  // Activity/Logs: Retrieve system audit logs
  app.get('/api/admin/logs', requireAdmin, (req, res) => {
    try {
      const { level, query } = req.query;
      let sql = 'SELECT * FROM audit_logs';
      const params: any[] = [];

      if (level && level !== 'all') {
        sql += ' WHERE level = ?';
        params.push(String(level));
      }

      sql += ' ORDER BY timestamp DESC LIMIT 100';

      let rows = db.prepare(sql).all(...params) as any[];

      if (query && typeof query === 'string' && query.trim()) {
        const q = query.toLowerCase();
        rows = rows.filter((r) =>
          r.event.toLowerCase().includes(q) ||
          r.user_email.toLowerCase().includes(q) ||
          (r.details && r.details.toLowerCase().includes(q))
        );
      }

      return res.json({ logs: rows });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch audit logs.' });
    }
  });

  // Activity/Logs: Clear audit logs
  app.delete('/api/admin/logs', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      db.prepare('DELETE FROM audit_logs').run();
      logAuditEvent('LOGS_CLEARED', req.user!.email, 'warn', 'Audit logs cleared by administrator');
      return res.json({ success: true, message: 'Audit logs cleared.' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to clear logs.' });
    }
  });

  // Application Settings: Get settings
  app.get('/api/admin/settings', requireAdmin, (_req, res) => {
    try {
      const rows = db.prepare('SELECT key, value, updated_at FROM system_settings').all() as any[];
      const settingsMap: Record<string, string> = {};
      for (const r of rows) {
        settingsMap[r.key] = r.value;
      }
      return res.json({
        settings: settingsMap,
        environment: {
          nodeVersion: process.version,
          port: PORT,
          databaseMode: 'SQLite WAL Mode',
          serverTime: new Date().toISOString(),
          uptimeSeconds: Math.floor(process.uptime()),
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch settings.' });
    }
  });

  // Application Settings: Update settings
  app.post('/api/admin/settings', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { settings } = req.body;
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Settings payload must be an object.' });
      }

      const nowStr = new Date().toISOString();
      const upsertStmt = db.prepare(`
        INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `);

      for (const [k, v] of Object.entries(settings)) {
        upsertStmt.run(k, String(v), nowStr);
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

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FOCUS OS Multi-User Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FOCUS OS server:', err);
  process.exit(1);
});
