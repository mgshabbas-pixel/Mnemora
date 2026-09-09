import React, { useState } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  CalendarCheck,
  HelpCircle,
  Target,
  Sparkles,
  Calendar,
  Flame,
  Award,
} from 'lucide-react';
import {
  WeeklyPerformanceStats,
  HistoricalWeekRecord,
  Activity,
} from '../types';
import { ExecutionRing } from './ExecutionRing';
import { getWeekBounds, getLocalToday } from '../utils/dateUtils';

interface PerformanceViewProps {
  stats: WeeklyPerformanceStats;
  historicalWeeks: HistoricalWeekRecord[];
  activities: Activity[];
}

export const PerformanceView: React.FC<PerformanceViewProps> = ({
  stats,
  historicalWeeks,
  activities,
}) => {
  const [timeRange, setTimeRange] = useState<
    '7_days' | '30_days' | '3_months' | '6_months' | '1_year'
  >('30_days');

  const todayStr = getLocalToday();
  const weekBounds = getWeekBounds(todayStr);

  const hasData = stats.hasData && stats.plannedCount > 0;

  // 1. Consistent days (days in this week where at least 1 planned activity was completed)
  const daysWithCompleted = new Set(
    activities
      .filter((a) => a.date >= weekBounds.startDate && a.date <= weekBounds.endDate && a.status === 'completed')
      .map((a) => a.date)
  ).size;

  // 2. Best day of this week
  const dayCompletionCounts: Record<string, { name: string; count: number }> = {};
  weekBounds.days.forEach((d) => {
    dayCompletionCounts[d.date] = { name: d.dayName, count: 0 };
  });

  activities
    .filter((a) => a.date >= weekBounds.startDate && a.date <= weekBounds.endDate && a.status === 'completed')
    .forEach((a) => {
      if (dayCompletionCounts[a.date]) {
        dayCompletionCounts[a.date].count += 1;
      }
    });

  let bestDayName = 'Wednesday'; // friendly default if just starting
  let bestDayMax = 0;
  Object.values(dayCompletionCounts).forEach((item) => {
    if (item.count > bestDayMax) {
      bestDayMax = item.count;
      bestDayName = item.name;
    }
  });

  // If no completed yet, check planned
  if (bestDayMax === 0) {
    const dayPlanned: Record<string, { name: string; count: number }> = {};
    weekBounds.days.forEach((d) => {
      dayPlanned[d.date] = { name: d.dayName, count: 0 };
    });
    activities
      .filter((a) => a.date >= weekBounds.startDate && a.date <= weekBounds.endDate)
      .forEach((a) => {
        if (dayPlanned[a.date]) {
          dayPlanned[a.date].count += 1;
        }
      });
    Object.values(dayPlanned).forEach((item) => {
      if (item.count > bestDayMax) {
        bestDayMax = item.count;
        bestDayName = item.name;
      }
    });
  }

  // 3. This week vs last week
  const lastWeek = historicalWeeks.length > 0 ? historicalWeeks[0] : null;
  let weekDiffText = 'First week tracked';
  let weekDiffBadge = 'bg-[#F2F2ED] text-[#121316]';
  if (lastWeek && stats.hasData) {
    const diff = stats.overallScore - lastWeek.score;
    if (diff > 0) {
      weekDiffText = `+${diff}% vs last week (${lastWeek.score}%)`;
      weekDiffBadge = 'bg-emerald-50 text-[#16803C] border border-emerald-200';
    } else if (diff < 0) {
      weekDiffText = `${diff}% vs last week (${lastWeek.score}%)`;
      weekDiffBadge = 'bg-orange-50 text-[#EA580C] border border-orange-200';
    } else {
      weekDiffText = `Same as last week (${lastWeek.score}%)`;
      weekDiffBadge = 'bg-[#F2F2ED] text-[#121316] border border-[#E8E8E4]';
    }
  }

  // Real chart points derived from actual historical weeks + current week
  const realHistoryPoints = [
    ...historicalWeeks.slice(0, 6).reverse().map((hw) => ({
      label: hw.weekId,
      score: hw.score,
      completed: hw.completed,
      planned: hw.planned,
    })),
    ...(hasData
      ? [
          {
            label: weekBounds.weekId,
            score: stats.overallScore,
            completed: stats.completedCount,
            planned: stats.plannedCount,
          },
        ]
      : []),
  ];

  // Daily breakdown for the current Monday–Sunday week
  const weekDays = weekBounds.days.map((d) => {
    const dayActs = activities.filter((a) => a.date === d.date);
    const completed = dayActs.filter((a) => a.status === 'completed').length;
    return {
      date: d.date,
      dayShort: d.dayShort,
      dayName: d.dayName,
      isToday: d.isToday,
      planned: dayActs.length,
      completed,
    };
  });

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* 1. Header: Page Title & Timeframe */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E8E8E4] pb-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-[#71717A] uppercase mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>Your Progress & Stats</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#121316]">
            WEEKLY PROGRESS
          </h1>
          <p className="text-sm text-[#71717A] mt-1 font-medium">
            A clear, honest look at what you planned versus what you got done.
          </p>
        </div>

        {/* Time period filter */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E0E0DC] overflow-x-auto shadow-xs">
          {[
            { id: '7_days', label: '7 Days' },
            { id: '30_days', label: '30 Days' },
            { id: '3_months', label: '3 Months' },
            { id: '6_months', label: '6 Months' },
            { id: '1_year', label: '1 Year' },
          ].map((period) => (
            <button
              key={period.id}
              onClick={() => setTimeRange(period.id as any)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
                timeRange === period.id
                  ? 'bg-[#121316] text-white'
                  : 'text-[#71717A] hover:text-[#121316]'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Top Summary Highlights Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Overall Completion */}
        <div className="bg-white p-5 rounded-xl border border-[#E8E8E4] shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">Weekly Progress</div>
          <div className="text-3xl font-black text-[#121316] mt-1">
            {hasData ? `${stats.overallScore}%` : '0%'}
          </div>
          <div className="text-xs text-[#16803C] font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{hasData ? `${stats.completionRate}% completed` : 'Plan activities'}</span>
          </div>
        </div>

        {/* Metric 2: Activities Completed */}
        <div className="bg-white p-5 rounded-xl border border-[#E8E8E4] shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">Activities Done</div>
          <div className="text-3xl font-black text-[#121316] mt-1">
            {stats.completedCount} <span className="text-lg font-normal text-[#71717A]">/ {stats.plannedCount}</span>
          </div>
          <div className="text-xs text-[#71717A] mt-1">
            {stats.plannedCount > 0 ? `${stats.completedCount} of ${stats.plannedCount} activities completed` : 'No activities yet'}
          </div>
        </div>

        {/* Metric 3: Consistency */}
        <div className="bg-white p-5 rounded-xl border border-[#E8E8E4] shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">Daily Consistency</div>
          <div className="text-3xl font-black text-[#121316] mt-1">
            {daysWithCompleted} <span className="text-lg font-normal text-[#71717A]">/ 7 days</span>
          </div>
          <div className="text-xs text-[#71717A] mt-1">
            You stayed consistent on {daysWithCompleted} of 7 days
          </div>
        </div>

        {/* Metric 4: Best Day & Comparison */}
        <div className="bg-white p-5 rounded-xl border border-[#E8E8E4] shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">Best Day</div>
          <div className="text-2xl font-black text-[#EA580C] mt-1 truncate">
            {bestDayName}
          </div>
          <div className="mt-2">
            <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded ${weekDiffBadge}`}>
              {weekDiffText}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Circular Score & Daily Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Execution Ring Card */}
        <section className="lg:col-span-5 bg-white rounded-xl border border-[#E8E8E4] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717A]">
              {weekBounds.weekId} • {weekBounds.dateRange}
            </span>
            <h2 className="text-lg font-bold text-[#121316] mt-1 mb-2">
              Weekly Score
            </h2>
          </div>

          <div className="py-3">
            <ExecutionRing stats={stats} size="large" subtitle="WEEKLY SCORE" />
          </div>

          <div className="mt-4 pt-3 border-t border-[#F4F4F0] text-center text-xs text-[#71717A]">
            {hasData ? (
              <span>
                Based on <strong className="text-[#121316] font-semibold">{stats.plannedCount} planned activities</strong> this week
              </span>
            ) : (
              <span>Add activities to your schedule to see your score</span>
            )}
          </div>
        </section>

        {/* Daily Schedule Breakdown (Monday to Sunday) */}
        <section className="lg:col-span-7 bg-white rounded-xl border border-[#E8E8E4] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F0]">
            <div>
              <h2 className="text-base font-bold text-[#121316]">
                Daily Activity Follow-Through
              </h2>
              <p className="text-xs text-[#71717A] mt-0.5">
                Completed vs. planned activities across Monday through Sunday
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-[#71717A]">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#E8E8E4]" /> Planned
              </span>
              <span className="flex items-center gap-1 text-[#16803C] font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#16803C]" /> Done
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {weekDays.map((d) => {
              const maxBar = Math.max(1, ...weekDays.map((w) => w.planned));
              const plannedWidth = d.planned > 0 ? Math.min(100, Math.round((d.planned / maxBar) * 100)) : 0;
              const completedWidth = d.planned > 0 ? Math.min(100, Math.round((d.completed / maxBar) * 100)) : 0;

              return (
                <div key={d.date} className="flex items-center gap-3 text-xs">
                  <div className="w-12 shrink-0 flex items-center gap-1">
                    <span className={`font-semibold ${d.isToday ? 'text-[#EA580C] font-bold' : 'text-[#121316]'}`}>
                      {d.dayShort}
                    </span>
                    {d.isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" title="Today" />
                    )}
                  </div>

                  <div className="flex-1 bg-[#FAFAF8] rounded-md h-6 relative overflow-hidden flex items-center px-2 border border-[#E8E8E4]">
                    {/* Planned background bar */}
                    {d.planned > 0 && (
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-[#E8E8E4]/60 rounded-l-md"
                        style={{ width: `${plannedWidth}%` }}
                      />
                    )}
                    {/* Completed foreground bar */}
                    {d.completed > 0 && (
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-[#16803C] rounded-l-md transition-all duration-500"
                        style={{ width: `${completedWidth}%` }}
                      />
                    )}

                    <span className="relative z-10 text-[11px] font-medium font-data text-[#121316]">
                      {d.planned > 0 ? (
                        <span>
                          <strong>{d.completed}</strong> of {d.planned} finished
                        </span>
                      ) : (
                        <span className="text-[#A1A1AA]">No activities</span>
                      )}
                    </span>
                  </div>

                  <div className="w-12 text-right font-data text-[11px] font-semibold shrink-0">
                    {d.planned > 0 ? (
                      <span className={d.completed >= d.planned ? 'text-[#16803C]' : 'text-[#71717A]'}>
                        {Math.round((d.completed / d.planned) * 100)}%
                      </span>
                    ) : (
                      <span className="text-[#A1A1AA]">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 4. WHAT MAKES UP YOUR WEEKLY SCORE (Simple Language Mandate) */}
      <section className="bg-white rounded-xl border border-[#E8E8E4] p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle className="w-4 h-4 text-[#121316]" />
          <h2 className="text-base font-bold text-[#121316]">
            What makes up your weekly score
          </h2>
        </div>
        <p className="text-xs text-[#71717A] max-w-3xl mb-4">
          Your score reflects your daily consistency and follow-through across four simple areas:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Component 1 */}
          <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#E8E8E4] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-[#121316]">Getting things done</span>
                <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
              </div>
              <p className="text-xs text-[#71717A] leading-relaxed">
                How many planned activities you completed.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-[#E8E8E4] text-xs font-semibold text-[#121316]">
              {stats.completionRate}% this week
            </div>
          </div>

          {/* Component 2 */}
          <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#E8E8E4] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-[#121316]">Being on time</span>
                <Clock className="w-4 h-4 text-[#EA580C]" />
              </div>
              <p className="text-xs text-[#71717A] leading-relaxed">
                How often you completed things on time.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-[#E8E8E4] text-xs font-semibold text-[#121316]">
              {stats.onTimeRate}% this week
            </div>
          </div>

          {/* Component 3 */}
          <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#E8E8E4] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-[#121316]">Important tasks</span>
                <Target className="w-4 h-4 text-[#EA580C]" />
              </div>
              <p className="text-xs text-[#71717A] leading-relaxed">
                How well you completed your important activities.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-[#E8E8E4] text-xs font-semibold text-[#121316]">
              {stats.highPriorityRate}% this week
            </div>
          </div>

          {/* Component 4 */}
          <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#E8E8E4] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-[#121316]">Staying consistent</span>
                <CalendarCheck className="w-4 h-4 text-[#121316]" />
              </div>
              <p className="text-xs text-[#71717A] leading-relaxed">
                How regularly you followed your plan.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-[#E8E8E4] text-xs font-semibold text-[#121316]">
              {daysWithCompleted} of 7 days active
            </div>
          </div>
        </div>
      </section>

      {/* 5. Score Over Time Trend Chart */}
      <section className="bg-white rounded-xl border border-[#E8E8E4] p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#F4F4F0]">
          <div>
            <h2 className="text-base font-bold text-[#121316]">
              Your score over time
            </h2>
            <p className="text-xs text-[#71717A] mt-0.5">
              Track how your follow-through evolves from week to week
            </p>
          </div>
          <TrendingUp className="w-4 h-4 text-[#16803C]" />
        </div>

        {realHistoryPoints.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#E8E8E4] rounded-lg bg-[#FAFAF8]">
            <TrendingUp className="w-8 h-8 text-[#A1A1AA] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#121316] mb-1">
              Your weekly history will appear here
            </p>
            <p className="text-xs text-[#71717A] max-w-sm mx-auto">
              As you complete activities and past weeks are saved, you&apos;ll see your trend line grow here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-44 w-full relative pt-6 pb-2">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <line x1="0" y1="0%" x2="100%" y2="0%" stroke="#F0F0EC" strokeWidth="1" />
                <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#F0F0EC" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="100%" x2="100%" y2="100%" stroke="#E8E8E4" strokeWidth="1" />

                {realHistoryPoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#121316"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={realHistoryPoints
                      .map((pt, idx) => {
                        const x = (idx / (realHistoryPoints.length - 1)) * 100;
                        const y = 100 - pt.score;
                        return `${x}%,${y}%`;
                      })
                      .join(' ')}
                  />
                )}

                {realHistoryPoints.map((pt, idx) => {
                  const x =
                    realHistoryPoints.length === 1
                      ? 50
                      : (idx / (realHistoryPoints.length - 1)) * 100;
                  const y = 100 - pt.score;
                  const isHighScore = pt.score >= 75;
                  return (
                    <g key={pt.label}>
                      <circle
                        cx={`${x}%`}
                        cy={`${y}%`}
                        r="5.5"
                        fill="#FFFFFF"
                        stroke={isHighScore ? '#16803C' : '#EA580C'}
                        strokeWidth="2.5"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center justify-between text-xs text-[#71717A] pt-3 border-t border-[#F4F4F0] font-data">
              {realHistoryPoints.map((pt) => (
                <div key={pt.label} className="text-center">
                  <div className="font-bold text-[#121316] text-sm">{pt.score}%</div>
                  <div className="text-[10px] text-[#71717A]">{pt.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
