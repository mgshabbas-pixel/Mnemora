export type Priority = 'high' | 'medium' | 'low';

export type ActivityStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'not_completed';

export type ReminderOption = 'none' | 'at_time' | '5_min' | '15_min' | '30_min' | '1_hour';

export type RecurringOption = 'none' | 'daily' | 'mon_fri' | 'weekly';

export interface Activity {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (e.g. "08:00")
  endTime?: string; // HH:mm (e.g. "10:00")
  durationMinutes: number; // e.g. 60 or 120
  category: string;
  priority: Priority;
  goalId?: string; // Related goal
  reminder: ReminderOption;
  recurring?: RecurringOption;
  notes?: string;
  status: ActivityStatus;
  completedAt?: string; // ISO timestamp
  completedDate?: string; // YYYY-MM-DD
  completedTime?: string; // HH:mm
  isOnTime?: boolean;
}

export interface Goal {
  id: string;
  name: string;
  description: string;
  targetDate: string; // YYYY-MM-DD
  progress: number; // 0 to 100
  status: 'in_progress' | 'completed' | 'on_hold';
  category?: string;
  color?: string;
}

export interface WeeklyTarget {
  id: string;
  goalId: string;
  weekId: string; // e.g. "2026-W37"
  text: string;
  completed: boolean;
}

export interface WeeklyReviewRecord {
  weekId: string;
  dateRange: string;
  overallScore: number;
  plannedCount: number;
  completedCount: number;
  missedCount: number;
  skippedCount: number;
  whatWentWell: string;
  whatDidnt: string;
  whatShouldImprove: string;
  carriedForwardActivityIds?: string[];
  reviewedAt?: string;
}

export interface WeekPlan {
  weekId: string; // e.g. "2026-W37"
  dateRange: string; // e.g. "September 7 – 13, 2026"
  startDate: string; // "2026-09-07"
  endDate: string; // "2026-09-13"
  mainGoals: string[];
  notes?: string;
  review?: WeeklyReviewRecord;
}

export interface WeeklyPerformanceStats {
  overallScore: number; // 0 - 100
  plannedCount: number;
  completedCount: number;
  notCompletedCount: number;
  skippedCount: number;
  completionRate: number; // percentage
  onTimeRate: number; // percentage
  highPriorityRate: number; // percentage
  consistency: number; // percentage
  hasData: boolean; // false when plannedCount === 0
  calculationFormula: {
    completionContribution: number; // 40% weight
    onTimeContribution: number; // 25% weight
    highPriorityContribution: number; // 20% weight
    consistencyContribution: number; // 15% weight
  };
}

export interface HistoricalWeekRecord {
  weekId: string;
  label: string;
  dateRange: string;
  score: number;
  planned: number;
  completed: number;
  missed: number;
  skipped: number;
  onTimeRate: number;
  highPriorityRate: number;
  consistency: number;
  review?: WeeklyReviewRecord;
}

export interface CategoryItem {
  id: string;
  name: string;
  color: string;
}

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'deactivated';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AdminUserListItem extends UserProfile {
  goalCount: number;
  activityCount: number;
  completedActivityCount: number;
  completionRate: number;
}

export interface AdminAnalyticsData {
  totalUsers: number;
  activeUsers: number;
  newUsersThisWeek: number;
  inactiveUsers: number;
  totalActivitiesCreated: number;
  totalActivitiesCompleted: number;
  averageCompletionRate: number;
}

export type MainSection =
  | 'home'
  | 'my_week'
  | 'today'
  | 'goals'
  | 'performance'
  | 'history'
  | 'settings'
  | 'admin';
