import { Activity, WeeklyPerformanceStats } from '../types';

export function calculateWeeklyPerformance(
  activities: Activity[],
  weekStartDate: string = '2026-09-07',
  weekEndDate: string = '2026-09-13'
): WeeklyPerformanceStats {
  const weekActivities = activities.filter(
    (a) => a.date >= weekStartDate && a.date <= weekEndDate
  );

  const plannedCount = weekActivities.length;
  if (plannedCount === 0) {
    return {
      overallScore: 0,
      plannedCount: 0,
      completedCount: 0,
      notCompletedCount: 0,
      skippedCount: 0,
      completionRate: 0,
      onTimeRate: 0,
      highPriorityRate: 0,
      consistency: 0,
      hasData: false,
      calculationFormula: {
        completionContribution: 0,
        onTimeContribution: 0,
        highPriorityContribution: 0,
        consistencyContribution: 0,
      },
    };
  }

  const completedActivities = weekActivities.filter((a) => a.status === 'completed');
  const notCompletedActivities = weekActivities.filter((a) => a.status === 'not_completed');
  const skippedActivities = weekActivities.filter((a) => a.status === 'skipped');

  const completedCount = completedActivities.length;
  const notCompletedCount = notCompletedActivities.length;
  const skippedCount = skippedActivities.length;

  // 1. Completion Rate: completed / planned
  const completionRate = Math.round((completedCount / plannedCount) * 100);

  // 2. On-Time Completion: completed activities that were marked on-time
  const onTimeCount = completedActivities.filter((a) => a.isOnTime !== false).length;
  const onTimeRate = completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : 100;

  // 3. High-Priority Execution: completed high-priority / planned high-priority
  const highPriorityPlanned = weekActivities.filter((a) => a.priority === 'high');
  const highPriorityCompleted = completedActivities.filter((a) => a.priority === 'high');
  const highPriorityRate =
    highPriorityPlanned.length > 0
      ? Math.round((highPriorityCompleted.length / highPriorityPlanned.length) * 100)
      : 100;

  // 4. Consistency: days where at least 1 planned activity was completed vs days with planned activities
  const plannedDaysSet = new Set(weekActivities.map((a) => a.date));
  const executedDaysSet = new Set(completedActivities.map((a) => a.date));
  const plannedDaysCount = Math.max(1, plannedDaysSet.size);
  const executedDaysCount = executedDaysSet.size;
  const consistency = Math.round((executedDaysCount / plannedDaysCount) * 100);

  // Transparent Weighted Formula:
  // Completion (40%) + On-Time (25%) + High Priority (20%) + Consistency (15%)
  const completionContribution = (completionRate * 0.4).toFixed(1);
  const onTimeContribution = (onTimeRate * 0.25).toFixed(1);
  const highPriorityContribution = (highPriorityRate * 0.2).toFixed(1);
  const consistencyContribution = (consistency * 0.15).toFixed(1);

  const rawScore =
    completionRate * 0.4 +
    onTimeRate * 0.25 +
    highPriorityRate * 0.2 +
    consistency * 0.15;

  const overallScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  return {
    overallScore,
    plannedCount,
    completedCount,
    notCompletedCount,
    skippedCount,
    completionRate,
    onTimeRate,
    highPriorityRate,
    consistency,
    hasData: true,
    calculationFormula: {
      completionContribution: parseFloat(completionContribution),
      onTimeContribution: parseFloat(onTimeContribution),
      highPriorityContribution: parseFloat(highPriorityContribution),
      consistencyContribution: parseFloat(consistencyContribution),
    },
  };
}

export function formatTimeSlot(start: string, end?: string, durationMinutes?: number): string {
  if (end) return `${start} – ${end}`;
  if (durationMinutes) {
    return `${start} (${durationMinutes}m)`;
  }
  return start;
}

export function getDayName(dateString: string): string {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  } catch {
    return dateString;
  }
}

export function formatFriendlyDate(dateString: string): string {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  } catch {
    return dateString;
  }
}
