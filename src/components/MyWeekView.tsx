import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  Calendar,
  Trash2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import {
  Activity,
  WeekPlan,
  ActivityStatus,
  Goal,
} from '../types';
import {
  getWeekBounds,
  shiftWeek,
  getLocalToday,
  isActivityHappeningNow,
  isActivityOverdue,
} from '../utils/dateUtils';

interface MyWeekViewProps {
  weekPlan: WeekPlan;
  activities: Activity[];
  goals: Goal[];
  onUpdateWeekMainGoals: (goals: string[]) => void;
  onUpdateActivityStatus: (activityId: string, status: ActivityStatus) => void;
  onDeleteActivity: (activityId: string) => void;
  onMoveActivity: (activityId: string, targetDate: string) => void;
  onOpenQuickAddWithDate: (date: string) => void;
  onEditActivity?: (activity: Activity) => void;
}

export const MyWeekView: React.FC<MyWeekViewProps> = ({
  weekPlan,
  activities,
  goals,
  onUpdateWeekMainGoals,
  onUpdateActivityStatus,
  onDeleteActivity,
  onOpenQuickAddWithDate,
}) => {
  const [referenceDate, setReferenceDate] = useState<string>(getLocalToday());
  const [newGoalInput, setNewGoalInput] = useState('');
  const [isAddingGoal, setIsAddingGoal] = useState(false);

  // Compute Monday-Sunday bounds dynamically for the selected reference date
  const weekBounds = getWeekBounds(referenceDate);
  const todayStr = getLocalToday();
  const isCurrentWeek = weekBounds.startDate <= todayStr && todayStr <= weekBounds.endDate;

  // Filter activities strictly belonging to this week (Monday to Sunday)
  const weekActivities = activities.filter(
    (a) => a.date >= weekBounds.startDate && a.date <= weekBounds.endDate
  );

  const completedInWeek = weekActivities.filter((a) => a.status === 'completed').length;
  const weekExecutionRate =
    weekActivities.length > 0
      ? Math.round((completedInWeek / weekActivities.length) * 100)
      : 0;

  const handlePrevWeek = () => {
    setReferenceDate((prev) => shiftWeek(prev, -1));
  };

  const handleNextWeek = () => {
    setReferenceDate((prev) => shiftWeek(prev, 1));
  };

  const handleCurrentWeek = () => {
    setReferenceDate(todayStr);
  };

  const handleAddMainGoal = () => {
    if (!newGoalInput.trim()) return;
    onUpdateWeekMainGoals([...(weekPlan.mainGoals || []), newGoalInput.trim()]);
    setNewGoalInput('');
    setIsAddingGoal(false);
  };

  const handleRemoveMainGoal = (index: number) => {
    const updated = (weekPlan.mainGoals || []).filter((_, i) => i !== index);
    onUpdateWeekMainGoals(updated);
  };

  return (
    <div className="space-y-8 pb-16 max-w-6xl mx-auto">
      {/* 1. Header & Dynamic Week Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E8E4] pb-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-[#71717A] uppercase mb-1">
            <span>Weekly Schedule</span>
            <span>•</span>
            <span className="text-[#EA580C]">{weekBounds.weekId}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#121316]">
            MY WEEK
          </h1>
          <p className="text-xs text-[#71717A] mt-1 font-semibold uppercase tracking-wider">
            {weekBounds.dateRange}
          </p>
        </div>

        {/* Navigation Controls: [Previous Week] [Current Week] [Next Week] */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handlePrevWeek}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#E0E0DC] text-xs font-semibold text-[#121316] hover:bg-[#F2F2ED] transition-colors shadow-xs cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous Week</span>
            <span className="sm:hidden">Prev</span>
          </button>

          <button
            onClick={handleCurrentWeek}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isCurrentWeek
                ? 'bg-[#121316] text-white'
                : 'bg-white border border-[#E0E0DC] text-[#71717A] hover:text-[#121316]'
            }`}
          >
            Current Week
          </button>

          <button
            onClick={handleNextWeek}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#E0E0DC] text-xs font-semibold text-[#121316] hover:bg-[#F2F2ED] transition-colors shadow-xs cursor-pointer"
          >
            <span className="hidden sm:inline">Next Week</span>
            <span className="sm:hidden">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Simple Week Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white border border-[#E8E8E4] rounded-xl shadow-xs">
          <span className="text-xs font-medium text-[#71717A] block">
            Planned
          </span>
          <span className="text-2xl font-black text-[#121316] mt-1 block">
            {weekActivities.length}
          </span>
          <span className="text-[11px] text-[#71717A]">Activities this week</span>
        </div>
        <div className="p-4 bg-white border border-[#E8E8E4] rounded-xl shadow-xs">
          <span className="text-xs font-medium text-[#71717A] block">
            Completed
          </span>
          <span className="text-2xl font-black text-[#16803C] mt-1 block">
            {completedInWeek}
          </span>
          <span className="text-[11px] text-[#16803C] font-semibold">Done so far</span>
        </div>
        <div className="p-4 bg-white border border-[#E8E8E4] rounded-xl shadow-xs">
          <span className="text-xs font-medium text-[#71717A] block">
            Weekly Progress
          </span>
          <span className="text-2xl font-black text-[#121316] mt-1 block">
            {weekExecutionRate}%
          </span>
          <span className="text-[11px] text-[#71717A]">Completion rate</span>
        </div>
        <div className="p-4 bg-white border border-[#E8E8E4] rounded-xl shadow-xs">
          <span className="text-xs font-medium text-[#71717A] block">
            Left to do
          </span>
          <span className="text-2xl font-black text-[#EA580C] mt-1 block">
            {weekActivities.length - completedInWeek}
          </span>
          <span className="text-[11px] text-[#71717A]">Activities remaining</span>
        </div>
      </div>

      {/* 3. Main Goals This Week */}
      <section className="bg-white rounded-xl border border-[#E8E8E4] p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#F4F4F0]">
          <div>
            <h2 className="text-base font-bold text-[#121316]">
              Main things to get done this week
            </h2>
            <p className="text-xs text-[#71717A] mt-0.5">
              The key results that will make this week a success
            </p>
          </div>
          {!isAddingGoal && (
            <button
              onClick={() => setIsAddingGoal(true)}
              className="text-xs font-bold text-[#121316] hover:text-[#EA580C] transition-colors flex items-center gap-1.5 cursor-pointer bg-[#F8F8F5] px-3 py-1.5 rounded-lg border border-[#E8E8E4] hover:border-[#EA580C]"
            >
              <Plus className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Add weekly goal</span>
            </button>
          )}
        </div>

        {isAddingGoal && (
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={newGoalInput}
              onChange={(e) => setNewGoalInput(e.target.value)}
              placeholder="E.g., Finish quarterly plan presentation"
              className="flex-1 px-3.5 py-2 text-xs rounded-lg border border-[#121316] focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddMainGoal();
                if (e.key === 'Escape') setIsAddingGoal(false);
              }}
            />
            <button
              onClick={handleAddMainGoal}
              className="px-4 py-2 rounded-lg bg-[#121316] text-white text-xs font-bold cursor-pointer"
            >
              Save
            </button>
            <button
              onClick={() => setIsAddingGoal(false)}
              className="px-3.5 py-2 rounded-lg border border-[#E8E8E4] text-[#71717A] text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {(!weekPlan.mainGoals || weekPlan.mainGoals.length === 0) && !isAddingGoal ? (
          <p className="text-xs text-[#71717A] py-2">
            No weekly goals set yet. Click &quot;Add weekly goal&quot; to define your main targets for this week.
          </p>
        ) : (
          <div className="space-y-2">
            {(weekPlan.mainGoals || []).map((goal, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-[#FAFAF8] border border-[#E8E8E4] text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#121316] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-[#121316]">{goal}</span>
                </div>
                <button
                  onClick={() => handleRemoveMainGoal(idx)}
                  className="text-[#71717A] hover:text-rose-600 p-1 cursor-pointer transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. MON - SUN 7-DAY CALENDAR GRID */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#121316]">
              Monday to Sunday Schedule
            </h2>
            <p className="text-xs text-[#71717A] mt-0.5">
              Click the plus (+) button on any day to schedule an activity
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {weekBounds.days.map((day) => {
            const dayActs = weekActivities
              .filter((a) => a.date === day.date)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

            const dayCompleted = dayActs.filter((a) => a.status === 'completed').length;

            return (
              <div
                key={day.date}
                className={`flex flex-col min-h-[340px] rounded-xl border p-3.5 transition-all ${
                  day.isToday
                    ? 'bg-white border-[#EA580C] ring-2 ring-[#EA580C]/20 shadow-xs'
                    : 'bg-white border-[#E8E8E4]'
                }`}
              >
                {/* Day Card Header */}
                <div className="flex items-baseline justify-between pb-2 mb-2 border-b border-[#F4F4F0]">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-black tracking-wider uppercase block ${
                          day.isToday ? 'text-[#EA580C]' : 'text-[#71717A]'
                        }`}
                      >
                        {day.dayShort}
                      </span>
                      {day.isToday && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#EA580C] text-white uppercase tracking-wider">
                          Today
                        </span>
                      )}
                    </div>
                    <span className="text-lg font-black font-data text-[#121316]">
                      {day.dayNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {dayActs.length > 0 && (
                      <span className="text-[10px] font-data font-semibold text-[#71717A]">
                        {dayCompleted}/{dayActs.length}
                      </span>
                    )}
                    <button
                      onClick={() => onOpenQuickAddWithDate(day.date)}
                      className="p-1 rounded-md bg-[#F2F2ED] hover:bg-[#121316] text-[#121316] hover:text-white transition-colors cursor-pointer"
                      title={`Add activity on ${day.dayShort}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scheduled Activities for Day */}
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {dayActs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                      <span className="text-[11px] text-[#A1A1AA]">No tasks</span>
                      <button
                        onClick={() => onOpenQuickAddWithDate(day.date)}
                        className="mt-2 text-[10px] font-bold text-[#121316] hover:text-[#EA580C] cursor-pointer"
                      >
                        + Add task
                      </button>
                    </div>
                  ) : (
                    dayActs.map((act) => {
                      const isCompleted = act.status === 'completed';
                      const isHappening = isActivityHappeningNow(
                        act.date,
                        act.startTime,
                        act.durationMinutes
                      );
                      const isOverdue =
                        !isCompleted && isActivityOverdue(act.date, act.startTime);

                      return (
                        <div
                          key={act.id}
                          className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                            isCompleted
                              ? 'bg-[#FAFAF8] border-[#ECECE8] text-[#71717A]'
                              : isHappening
                              ? 'bg-[#FFF7ED] border-[#FDBA74] text-[#121316]'
                              : isOverdue
                              ? 'bg-rose-50/50 border-rose-200 text-[#121316]'
                              : 'bg-white border-[#E8E8E4] text-[#121316] hover:border-[#121316]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-data font-bold text-[10px] text-[#52525B]">
                              {act.startTime}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  onUpdateActivityStatus(
                                    act.id,
                                    isCompleted ? 'pending' : 'completed'
                                  )
                                }
                                className="cursor-pointer text-[#71717A] hover:text-[#121316]"
                                title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" />
                                ) : (
                                  <Circle className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => onDeleteActivity(act.id)}
                                className="cursor-pointer text-[#A1A1AA] hover:text-rose-600"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div
                            className={`font-semibold leading-tight line-clamp-2 ${
                              isCompleted ? 'line-through text-[#8E8E93]' : 'text-[#121316]'
                            }`}
                          >
                            {act.title}
                          </div>

                          {act.priority === 'high' && (
                            <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-100 text-orange-800">
                              Important
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
