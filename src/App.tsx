/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  Goal,
  WeeklyTarget,
  WeekPlan,
  HistoricalWeekRecord,
  CategoryItem,
  MainSection,
  ActivityStatus,
  UserProfile,
} from './types';
import {
  INITIAL_ACTIVITIES,
  INITIAL_GOALS,
  INITIAL_WEEKLY_TARGETS,
  INITIAL_WEEK_PLAN,
  INITIAL_HISTORICAL_WEEKS,
  INITIAL_CATEGORIES,
} from './data/initialData';
import { calculateWeeklyPerformance } from './utils/performanceEngine';
import { SidebarNav } from './components/SidebarNav';
import { ReminderBanner } from './components/ReminderBanner';
import { HomeView } from './components/HomeView';
import { MyWeekView } from './components/MyWeekView';
import { TodayView } from './components/TodayView';
import { GoalsView } from './components/GoalsView';
import { PerformanceView } from './components/PerformanceView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { AdminView } from './components/AdminView';
import { AuthView } from './components/AuthView';
import { QuickAddModal } from './components/QuickAddModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { getLocalToday, getWeekBounds } from './utils/dateUtils';
import { safeApiRequest } from './utils/apiClient';

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('focus_os_token');
    } catch {
      return null;
    }
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('focus_os_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Personal Execution State
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  const [goals, setGoals] = useState<Goal[]>(INITIAL_GOALS);
  const [weeklyTargets, setWeeklyTargets] = useState<WeeklyTarget[]>(INITIAL_WEEKLY_TARGETS);
  const [weekPlan, setWeekPlan] = useState<WeekPlan>(INITIAL_WEEK_PLAN);
  const [historicalWeeks, setHistoricalWeeks] = useState<HistoricalWeekRecord[]>(INITIAL_HISTORICAL_WEEKS);
  const [categories, setCategories] = useState<CategoryItem[]>(INITIAL_CATEGORIES);

  // Navigation & UI state
  const [currentDateStr, setCurrentDateStr] = useState<string>(getLocalToday());
  const [activeSection, setActiveSection] = useState<MainSection>('home');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<string>(getLocalToday());
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Midnight checker: update currentDateStr automatically when date changes
  useEffect(() => {
    const timer = setInterval(() => {
      const today = getLocalToday();
      if (today !== currentDateStr) {
        setCurrentDateStr(today);
        setQuickAddDate(today);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [currentDateStr]);

  // 1. Verify token on startup
  useEffect(() => {
    let isMounted = true;
    const verifyAuth = async () => {
      const savedToken = localStorage.getItem('focus_os_token');
      if (!savedToken) {
        if (isMounted) setIsAuthChecking(false);
        return;
      }

      try {
        const result = await safeApiRequest<{ user: UserProfile }>('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (!isMounted) return;

        if (result.ok && result.data?.user) {
          setCurrentUser(result.data.user);
          setToken(savedToken);
          localStorage.setItem('focus_os_user', JSON.stringify(result.data.user));
        } else {
          // Token expired or invalid
          localStorage.removeItem('focus_os_token');
          localStorage.removeItem('focus_os_user');
          setToken(null);
          setCurrentUser(null);
        }
      } catch (err) {
        console.warn('Network error during auth verification', err);
      } finally {
        if (isMounted) setIsAuthChecking(false);
      }
    };

    verifyAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch personal execution data when authenticated
  const loadPersonalData = useCallback(async (authToken: string) => {
    setIsLoadingData(true);
    try {
      const res = await fetch('/api/personal/data', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
        setWeeklyTargets(data.weeklyTargets || []);
        setWeekPlan(data.weekPlan || INITIAL_WEEK_PLAN);
        setActivities(data.activities || []);
        setHistoricalWeeks(data.historicalWeeks || []);
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load personal execution data', err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadPersonalData(token);
    }
  }, [token, loadPersonalData]);

  // Auth Handlers
  const handleAuthSuccess = (newToken: string, user: UserProfile) => {
    localStorage.setItem('focus_os_token', newToken);
    localStorage.setItem('focus_os_user', JSON.stringify(user));
    setToken(newToken);
    setCurrentUser(user);
    setActiveSection('home');
  };

  const handleSignOut = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.warn('Error during logout', err);
      }
    }

    localStorage.removeItem('focus_os_token');
    localStorage.removeItem('focus_os_user');
    setToken(null);
    setCurrentUser(null);
    setActivities([]);
    setGoals([]);
    setWeeklyTargets([]);
    setWeekPlan(INITIAL_WEEK_PLAN);
    setHistoricalWeeks([]);
    setCategories([]);
    setActiveSection('home');
  };

  // Dynamic week boundaries for current date
  const currentWeekBounds = useMemo(() => {
    return getWeekBounds(currentDateStr);
  }, [currentDateStr]);

  // Real-time calculation of weekly performance
  const performanceStats = useMemo(() => {
    return calculateWeeklyPerformance(
      activities,
      weekPlan.startDate || currentWeekBounds.startDate,
      weekPlan.endDate || currentWeekBounds.endDate
    );
  }, [activities, weekPlan, currentWeekBounds]);

  // Today's activities
  const todayActivities = useMemo(() => {
    return activities.filter((a) => a.date === currentDateStr);
  }, [activities, currentDateStr]);

  // Activity Handlers with API Sync
  const handleToggleActivityStatus = async (activityId: string) => {
    const act = activities.find((a) => a.id === activityId);
    if (!act) return;

    const isNowCompleted = act.status !== 'completed';
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const updatedFields: Partial<Activity> = {
      status: isNowCompleted ? 'completed' : 'pending',
      completedAt: isNowCompleted ? now.toISOString() : undefined,
      completedDate: isNowCompleted ? act.date : undefined,
      completedTime: isNowCompleted ? timeStr : undefined,
      isOnTime: isNowCompleted ? true : undefined,
    };

    // Optimistic UI update
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, ...updatedFields } : a))
    );

    if (!token) return;
    try {
      await fetch(`/api/personal/activities/${activityId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedFields),
      });
    } catch (err) {
      console.error('Failed to sync activity status to server', err);
    }
  };

  const handleUpdateActivityStatus = async (
    activityId: string,
    status: ActivityStatus,
    details?: { completedTime?: string; isOnTime?: boolean }
  ) => {
    const act = activities.find((a) => a.id === activityId);
    if (!act) return;

    const now = new Date();
    const timeStr =
      details?.completedTime ||
      `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;

    const updatedFields: Partial<Activity> = {
      status,
      completedAt: status === 'completed' ? now.toISOString() : undefined,
      completedDate: status === 'completed' ? act.date : undefined,
      completedTime: status === 'completed' ? timeStr : undefined,
      isOnTime: status === 'completed' ? details?.isOnTime ?? true : undefined,
    };

    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, ...updatedFields } : a))
    );

    if (!token) return;
    try {
      await fetch(`/api/personal/activities/${activityId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedFields),
      });
    } catch (err) {
      console.error('Failed to update activity status', err);
    }
  };

  const handleAddActivity = async (newAct: Omit<Activity, 'id'>) => {
    const tempId = `act-${Date.now()}`;
    const activity: Activity = {
      ...newAct,
      id: tempId,
    };

    setActivities((prev) => [...prev, activity]);

    if (!token) return;
    try {
      const res = await fetch('/api/personal/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(activity),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.activity && data.activity.id !== tempId) {
          setActivities((prev) =>
            prev.map((a) => (a.id === tempId ? data.activity : a))
          );
        }
      }
    } catch (err) {
      console.error('Failed to save activity', err);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));

    if (!token) return;
    try {
      await fetch(`/api/personal/activities/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error('Failed to delete activity', err);
    }
  };

  const handleMoveActivity = async (id: string, targetDate: string) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, date: targetDate } : a))
    );

    if (!token) return;
    try {
      await fetch(`/api/personal/activities/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ date: targetDate }),
      });
    } catch (err) {
      console.error('Failed to move activity', err);
    }
  };

  // Goal Handlers with API Sync
  const handleAddGoal = async (newGoal: Omit<Goal, 'id'>) => {
    const tempId = `goal-${Date.now()}`;
    const goal: Goal = {
      ...newGoal,
      id: tempId,
    };

    setGoals((prev) => [...prev, goal]);

    if (!token) return;
    try {
      const res = await fetch('/api/personal/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(goal),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.goal && data.goal.id !== tempId) {
          setGoals((prev) =>
            prev.map((g) => (g.id === tempId ? data.goal : g))
          );
        }
      }
    } catch (err) {
      console.error('Failed to save goal', err);
    }
  };

  const handleUpdateGoalProgress = async (goalId: string, progress: number) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? {
              ...g,
              progress,
              status: progress >= 100 ? 'completed' : g.status,
            }
          : g
      )
    );

    if (!token) return;
    try {
      await fetch(`/api/personal/goals/${goalId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          progress,
          status: progress >= 100 ? 'completed' : undefined,
        }),
      });
    } catch (err) {
      console.error('Failed to update goal progress', err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    setWeeklyTargets((prev) => prev.filter((t) => t.goalId !== goalId));

    if (!token) return;
    try {
      await fetch(`/api/personal/goals/${goalId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error('Failed to delete goal', err);
    }
  };

  // Weekly Targets Handlers with API Sync
  const handleAddWeeklyTarget = async (goalId: string, text: string) => {
    const tempId = `wt-${Date.now()}`;
    const target: WeeklyTarget = {
      id: tempId,
      goalId,
      weekId: weekPlan.weekId,
      text,
      completed: false,
    };

    setWeeklyTargets((prev) => [...prev, target]);

    if (!token) return;
    try {
      const res = await fetch('/api/personal/weekly-targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(target),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.target && data.target.id !== tempId) {
          setWeeklyTargets((prev) =>
            prev.map((t) => (t.id === tempId ? data.target : t))
          );
        }
      }
    } catch (err) {
      console.error('Failed to save weekly target', err);
    }
  };

  const handleToggleWeeklyTarget = async (targetId: string) => {
    const target = weeklyTargets.find((t) => t.id === targetId);
    if (!target) return;

    const nextCompleted = !target.completed;
    setWeeklyTargets((prev) =>
      prev.map((t) => (t.id === targetId ? { ...t, completed: nextCompleted } : t))
    );

    if (!token) return;
    try {
      await fetch(`/api/personal/weekly-targets/${targetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completed: nextCompleted }),
      });
    } catch (err) {
      console.error('Failed to update weekly target', err);
    }
  };

  const handleDeleteWeeklyTarget = async (targetId: string) => {
    setWeeklyTargets((prev) => prev.filter((t) => t.id !== targetId));

    if (!token) return;
    try {
      await fetch(`/api/personal/weekly-targets/${targetId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error('Failed to delete weekly target', err);
    }
  };

  // Week Plan Main Goals & Review
  const handleUpdateWeekMainGoals = async (mainGoals: string[]) => {
    const updatedPlan = { ...weekPlan, mainGoals };
    setWeekPlan(updatedPlan);

    if (!token) return;
    try {
      await fetch('/api/personal/week-plan', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedPlan),
      });
    } catch (err) {
      console.error('Failed to update week plan', err);
    }
  };

  const handleSaveCurrentWeekReview = async (review: any) => {
    const updatedPlan = { ...weekPlan, review };
    setWeekPlan(updatedPlan);

    if (!token) return;
    try {
      await fetch('/api/personal/week-plan', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedPlan),
      });
    } catch (err) {
      console.error('Failed to save week review', err);
    }
  };

  const handleCarryForwardActivities = async (activityIds: string[]) => {
    // Re-date activities or flag them
    setActivities((prev) =>
      prev.map((a) => {
        if (!activityIds.includes(a.id)) return a;
        return {
          ...a,
          date: '2026-09-14',
          status: 'pending',
          notes: `${a.notes ? a.notes + ' ' : ''}[Carried forward from Sep 7-13]`,
        };
      })
    );

    if (!token) return;
    for (const id of activityIds) {
      try {
        await fetch(`/api/personal/activities/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            date: '2026-09-14',
            status: 'pending',
          }),
        });
      } catch (err) {
        console.error('Failed to carry forward activity', id, err);
      }
    }
  };

  // Categories Handlers
  const handleAddCategory = async (cat: CategoryItem) => {
    setCategories((prev) => [...prev, cat]);

    if (!token) return;
    try {
      await fetch('/api/personal/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(cat),
      });
    } catch (err) {
      console.error('Failed to add category', err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));

    if (!token) return;
    try {
      await fetch(`/api/personal/categories/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error('Failed to delete category', err);
    }
  };

  // Reset to initial clean data
  const handleResetData = async () => {
    setActivities(INITIAL_ACTIVITIES);
    setGoals(INITIAL_GOALS);
    setWeeklyTargets(INITIAL_WEEKLY_TARGETS);
    setWeekPlan(INITIAL_WEEK_PLAN);
    setHistoricalWeeks(INITIAL_HISTORICAL_WEEKS);
    setCategories(INITIAL_CATEGORIES);
    setActiveSection('home');

    if (!token) return;
    try {
      await fetch('/api/personal/reset-data', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error('Failed to reset data on server', err);
    }
  };

  // Loading spinner during auth check
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded bg-[#1C1D1F] text-white flex items-center justify-center font-bold text-sm mx-auto animate-pulse">
            F
          </div>
          <p className="text-xs font-semibold text-[#71717A] tracking-wider uppercase">
            Loading FOCUS OS...
          </p>
        </div>
      </div>
    );
  }

  // If not logged in, render AuthView
  if (!token || !currentUser) {
    return <AuthView onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-[#121316] flex flex-col md:flex-row font-sans selection:bg-[#EBEBE8]">
      {/* Primary Left Navigation (Desktop) & Mobile Top Header/Drawer */}
      <SidebarNav
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onOpenQuickAdd={() => {
          setQuickAddDate(currentDateStr);
          setIsQuickAddOpen(true);
        }}
        weeklyScore={performanceStats.overallScore}
        hasScoreData={performanceStats.hasData}
        todayCount={todayActivities.length}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Active in-app Reminder notification banner */}
        <ReminderBanner
          activities={activities}
          onStartActivity={(id) => handleUpdateActivityStatus(id, 'in_progress')}
        />

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {activeSection === 'home' && (
            <HomeView
              currentUser={currentUser}
              weekPlan={{
                ...weekPlan,
                dateRange: weekPlan.dateRange || currentWeekBounds.dateRange,
                weekId: weekPlan.weekId || currentWeekBounds.weekId,
              }}
              todayActivities={todayActivities}
              goals={goals}
              performanceStats={performanceStats}
              historicalWeeks={historicalWeeks}
              onSelectSection={setActiveSection}
              onToggleActivityStatus={handleToggleActivityStatus}
              onOpenQuickAdd={() => {
                setQuickAddDate(currentDateStr);
                setIsQuickAddOpen(true);
              }}
            />
          )}

          {activeSection === 'my_week' && (
            <MyWeekView
              weekPlan={{
                ...weekPlan,
                dateRange: weekPlan.dateRange || currentWeekBounds.dateRange,
                weekId: weekPlan.weekId || currentWeekBounds.weekId,
              }}
              activities={activities}
              goals={goals}
              onUpdateWeekMainGoals={handleUpdateWeekMainGoals}
              onUpdateActivityStatus={handleUpdateActivityStatus}
              onDeleteActivity={handleDeleteActivity}
              onMoveActivity={handleMoveActivity}
              onOpenQuickAddWithDate={(date) => {
                setQuickAddDate(date);
                setIsQuickAddOpen(true);
              }}
              onEditActivity={(act) => {
                setQuickAddDate(act.date);
                setIsQuickAddOpen(true);
              }}
            />
          )}

          {activeSection === 'today' && (
            <TodayView
              todayActivities={todayActivities}
              goals={goals}
              onUpdateActivityStatus={handleUpdateActivityStatus}
              onOpenQuickAddWithDate={(date) => {
                setQuickAddDate(date);
                setIsQuickAddOpen(true);
              }}
            />
          )}

          {activeSection === 'goals' && (
            <GoalsView
              goals={goals}
              weeklyTargets={weeklyTargets}
              onAddGoal={handleAddGoal}
              onUpdateGoalProgress={handleUpdateGoalProgress}
              onDeleteGoal={handleDeleteGoal}
              onToggleWeeklyTarget={handleToggleWeeklyTarget}
              onAddWeeklyTarget={handleAddWeeklyTarget}
              onDeleteWeeklyTarget={handleDeleteWeeklyTarget}
            />
          )}

          {activeSection === 'performance' && (
            <PerformanceView
              stats={performanceStats}
              historicalWeeks={historicalWeeks}
              activities={activities}
            />
          )}

          {activeSection === 'history' && (
            <HistoryView
              historicalWeeks={historicalWeeks}
              currentWeekActivities={activities}
              currentWeekPlan={{
                ...weekPlan,
                dateRange: weekPlan.dateRange || currentWeekBounds.dateRange,
                weekId: weekPlan.weekId || currentWeekBounds.weekId,
              }}
              onSaveCurrentWeekReview={handleSaveCurrentWeekReview}
              onCarryForwardActivities={handleCarryForwardActivities}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsView
              categories={categories}
              currentUser={currentUser}
              token={token}
              onAddCategory={handleAddCategory}
              onDeleteCategory={handleDeleteCategory}
              onResetData={handleResetData}
            />
          )}

          {activeSection === 'admin' && currentUser?.role === 'admin' && (
            <AdminView
              token={token}
              currentUser={currentUser}
              onElevateRole={() => {
                const updated = { ...currentUser, role: 'admin' as const };
                setCurrentUser(updated);
                localStorage.setItem('focus_os_user', JSON.stringify(updated));
              }}
            />
          )}
        </main>
      </div>

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        defaultDate={quickAddDate}
        goals={goals}
        categories={categories}
        onAddActivity={handleAddActivity}
        onAddGoal={handleAddGoal}
        onAddWeeklyTarget={handleAddWeeklyTarget}
      />

      {/* Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}
