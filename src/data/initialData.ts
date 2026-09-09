import {
  Activity,
  Goal,
  WeeklyTarget,
  WeekPlan,
  HistoricalWeekRecord,
  CategoryItem,
} from '../types';

export const INITIAL_CATEGORIES: CategoryItem[] = [];

export const INITIAL_GOALS: Goal[] = [];

export const INITIAL_WEEKLY_TARGETS: WeeklyTarget[] = [];

export const INITIAL_WEEK_PLAN: WeekPlan = {
  weekId: '2026-W37',
  dateRange: 'September 7 – 13, 2026',
  startDate: '2026-09-07',
  endDate: '2026-09-13',
  mainGoals: [],
  notes: '',
};

export const INITIAL_ACTIVITIES: Activity[] = [];

export const INITIAL_HISTORICAL_WEEKS: HistoricalWeekRecord[] = [];
