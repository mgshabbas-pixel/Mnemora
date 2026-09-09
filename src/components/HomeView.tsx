import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  TrendingUp,
  Target,
  Clock,
  Plus,
  Calendar,
  AlertCircle,
  Flame,
} from 'lucide-react';
import {
  Activity,
  Goal,
  WeekPlan,
  WeeklyPerformanceStats,
  HistoricalWeekRecord,
  MainSection,
  UserProfile,
} from '../types';
import { ExecutionRing } from './ExecutionRing';
import {
  formatFullDate,
  getLocalToday,
  getGreeting,
  isActivityHappeningNow,
  isActivityOverdue,
} from '../utils/dateUtils';

interface HomeViewProps {
  currentUser: UserProfile | null;
  weekPlan: WeekPlan;
  todayActivities: Activity[];
  goals: Goal[];
  performanceStats: WeeklyPerformanceStats;
  historicalWeeks: HistoricalWeekRecord[];
  onSelectSection: (section: MainSection) => void;
  onToggleActivityStatus: (activityId: string) => void;
  onOpenQuickAdd: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentUser,
  weekPlan,
  todayActivities,
  goals,
  performanceStats,
  historicalWeeks,
  onSelectSection,
  onToggleActivityStatus,
  onOpenQuickAdd,
}) => {
  const todayStr = getLocalToday();
  const greeting = getGreeting();
  const userFirstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'there';
  const fullTodayLabel = formatFullDate(todayStr);

  // Today's activities sorted chronologically by start time
  const sortedTodayActivities = [...todayActivities].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  const todayTotal = sortedTodayActivities.length;
  const todayCompleted = sortedTodayActivities.filter((a) => a.status === 'completed').length;
  const todayProgress = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* 1. Header: Greeting & Dynamic Date */}
      <div className="border-b border-[#E8E8E4] pb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
          <div>
            <div className="text-xs font-bold tracking-widest text-[#EA580C] uppercase mb-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
              <span>Today&apos;s Focus</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#121316]">
              {greeting}, {userFirstName}
            </h1>
            <p className="text-sm text-[#71717A] mt-1 font-medium">
              {fullTodayLabel}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#71717A] font-data self-start sm:self-auto">
            <span className="px-3 py-1 rounded-full bg-[#F2F2ED] text-[#121316] font-semibold border border-[#E8E8E4]">
              {weekPlan.weekId || 'Current Week'}
            </span>
            <span>•</span>
            <span>{weekPlan.dateRange || 'Personal Schedule'}</span>
          </div>
        </div>
      </div>

      {/* 2. Signature Weekly Score Card */}
      <section className="bg-white rounded-2xl border border-[#E8E8E4] p-6 sm:p-8 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#F4F4F0]">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717A]">
              Weekly Progress
            </span>
            <h2 className="text-lg font-black text-[#121316] tracking-tight">
              YOUR WEEKLY SCORE
            </h2>
          </div>
          <button
            onClick={() => onSelectSection('performance')}
            className="text-xs font-bold text-[#121316] hover:text-[#EA580C] transition-colors flex items-center gap-1 cursor-pointer bg-[#F8F8F5] px-3 py-1.5 rounded-lg border border-[#E8E8E4] hover:border-[#EA580C]"
          >
            <span>View your progress</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#EA580C]" />
          </button>
        </div>

        <div className="py-2">
          <ExecutionRing
            stats={performanceStats}
            size="large"
            subtitle="WEEKLY SCORE"
          />
        </div>
      </section>

      {/* 3. Today's Chronological Schedule */}
      <section className="bg-white rounded-2xl border border-[#E8E8E4] p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#F4F4F0]">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717A]">
              Daily Schedule
            </span>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h2 className="text-xl font-black text-[#121316] tracking-tight">
                TODAY&apos;S SCHEDULE
              </h2>
              {todayTotal > 0 && (
                <span className="text-xs font-bold font-data bg-[#F2F2ED] text-[#121316] px-2.5 py-0.5 rounded-full border border-[#E8E8E4]">
                  {todayCompleted} of {todayTotal} done ({todayProgress}%)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectSection('today')}
              className="text-xs font-semibold text-[#71717A] hover:text-[#121316] px-3 py-1.5 rounded-lg border border-transparent hover:border-[#E8E8E4] transition-all cursor-pointer"
            >
              Open Today View
            </button>
            <button
              onClick={onOpenQuickAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {/* Chronological Activities List */}
        {sortedTodayActivities.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#E8E8E4] rounded-xl bg-[#FAFAF8]">
            <Clock className="w-8 h-8 text-[#A1A1AA] mx-auto mb-2" />
            <p className="text-sm font-bold text-[#121316] mb-1">
              No tasks scheduled for today yet
            </p>
            <p className="text-xs text-[#71717A] max-w-sm mx-auto mb-4">
              Add the activities you want to accomplish today to stay on track and boost your weekly score.
            </p>
            <button
              onClick={onOpenQuickAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>Add your first task for today</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedTodayActivities.map((act) => {
              const isCompleted = act.status === 'completed';
              const isHappening = isActivityHappeningNow(act.date, act.startTime, act.durationMinutes);
              const isOverdue = !isCompleted && isActivityOverdue(act.date, act.startTime);

              return (
                <div
                  key={act.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                    isCompleted
                      ? 'bg-[#FBFBF9] border-[#ECECE8] text-[#71717A]'
                      : isHappening
                      ? 'bg-[#FFF7ED] border-[#FDBA74] text-[#121316] shadow-xs'
                      : isOverdue
                      ? 'bg-rose-50/40 border-rose-200 text-[#121316]'
                      : 'bg-white border-[#E8E8E4] text-[#121316] hover:border-[#121316]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Time pill */}
                    <div className="flex items-center gap-1 text-xs font-data font-semibold text-[#52525B] w-20 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-[#71717A]" />
                      <span>{act.startTime}</span>
                    </div>

                    {/* Checkbox toggle */}
                    <button
                      onClick={() => onToggleActivityStatus(act.id)}
                      className="cursor-pointer focus:outline-none shrink-0"
                      title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-[#16803C]" />
                      ) : (
                        <Circle className="w-5 h-5 text-[#A1A1AA] hover:text-[#121316] transition-colors" />
                      )}
                    </button>

                    {/* Title & metadata */}
                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-bold truncate ${
                            isCompleted ? 'line-through text-[#8E8E93]' : 'text-[#121316]'
                          }`}
                        >
                          {act.title}
                        </span>

                        {isHappening && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EA580C] text-white uppercase tracking-wider">
                            Happening Now
                          </span>
                        )}

                        {isOverdue && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 uppercase tracking-wider">
                            Overdue
                          </span>
                        )}

                        {act.priority === 'high' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">
                            High Priority
                          </span>
                        )}

                        {act.category && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#F2F2ED] text-[#52525B]">
                            {act.category}
                          </span>
                        )}
                      </div>
                      {act.notes && (
                        <p className="text-[11px] text-[#71717A] mt-0.5 truncate max-w-lg">
                          {act.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status Indicator / quick toggle */}
                  <div className="text-right shrink-0 ml-3">
                    {isCompleted ? (
                      <span className="text-xs font-bold text-[#16803C] bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-lg">
                        ✓ Done
                      </span>
                    ) : isHappening ? (
                      <button
                        onClick={() => onToggleActivityStatus(act.id)}
                        className="text-xs font-bold text-white bg-[#EA580C] hover:bg-[#C2410C] px-3 py-1 rounded-lg shadow-xs cursor-pointer transition-colors"
                      >
                        Finish
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-[#71717A]">
                        Scheduled
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Your Goals Progress */}
      <section className="bg-white rounded-2xl border border-[#E8E8E4] p-6 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#F4F4F0]">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717A]">
              Long-Term Focus
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="text-xl font-black text-[#121316] tracking-tight">
                YOUR GOALS
              </h2>
              <span className="text-xs font-data font-bold bg-[#F2F2ED] px-2.5 py-0.5 rounded-full text-[#121316]">
                {goals.length}
              </span>
            </div>
          </div>
          <button
            onClick={() => onSelectSection('goals')}
            className="text-xs font-bold text-[#121316] hover:text-[#EA580C] transition-colors flex items-center gap-1 cursor-pointer bg-[#F8F8F5] px-3 py-1.5 rounded-lg border border-[#E8E8E4] hover:border-[#EA580C]"
          >
            <span>View all goals</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#EA580C]" />
          </button>
        </div>

        {goals.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-[#E8E8E4] rounded-xl bg-[#FAFAF8]">
            <Target className="w-8 h-8 text-[#A1A1AA] mx-auto mb-2" />
            <p className="text-sm font-bold text-[#121316] mb-1">
              No goals set yet
            </p>
            <p className="text-xs text-[#71717A] max-w-sm mx-auto mb-4">
              Set clear goals to guide what you plan each week.
            </p>
            <button
              onClick={() => onSelectSection('goals')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#121316] text-white text-xs font-bold hover:bg-[#25272C] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Add a goal</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => (
              <div
                key={goal.id}
                onClick={() => onSelectSection('goals')}
                className="p-4 rounded-xl border border-[#E8E8E4] hover:border-[#121316] transition-all cursor-pointer bg-[#FAFAF8] hover:bg-white flex flex-col justify-between group shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-xs font-bold text-[#121316] group-hover:text-[#EA580C] transition-colors line-clamp-1">
                      {goal.name}
                    </h3>
                    <span className={`text-xs font-data font-bold ${goal.progress >= 75 ? 'text-[#16803C]' : 'text-[#EA580C]'}`}>
                      {goal.progress}%
                    </span>
                  </div>
                  {goal.description && (
                    <p className="text-[11px] text-[#71717A] line-clamp-2 mb-3">
                      {goal.description}
                    </p>
                  )}
                </div>

                <div>
                  <div className="w-full bg-[#ECECE8] h-1.5 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, goal.progress))}%`,
                        backgroundColor: goal.progress >= 75 ? '#16803C' : '#EA580C',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#71717A]">
                    <span>Target: {goal.targetDate || 'Ongoing'}</span>
                    <span className="font-semibold text-[#121316] group-hover:text-[#EA580C] flex items-center gap-0.5">
                      Details <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
