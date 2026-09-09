import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Circle,
  PlayCircle,
  AlertCircle,
  Plus,
  Calendar,
  Check,
  ChevronRight,
  Bell,
  Sparkles,
} from 'lucide-react';
import { Activity, ActivityStatus, Goal } from '../types';
import {
  getLocalToday,
  getLocalNowTime,
  formatFullDate,
  isActivityHappeningNow,
  isActivityOverdue,
} from '../utils/dateUtils';

interface TodayViewProps {
  todayActivities: Activity[];
  goals: Goal[];
  onUpdateActivityStatus: (
    activityId: string,
    status: ActivityStatus,
    details?: { completedTime?: string; isOnTime?: boolean }
  ) => void;
  onOpenQuickAddWithDate: (date: string) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  todayActivities,
  goals,
  onUpdateActivityStatus,
  onOpenQuickAddWithDate,
}) => {
  const [liveTime, setLiveTime] = useState(getLocalNowTime());
  const todayStr = getLocalToday();
  const todayTitle = formatFullDate(todayStr);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(getLocalNowTime());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Sorted timeline
  const sortedActivities = [...todayActivities].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  const total = sortedActivities.length;
  const completedActivities = sortedActivities.filter((a) => a.status === 'completed');
  const completedCount = completedActivities.length;
  const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Active / Happening right now
  const happeningNowAct = sortedActivities.find(
    (a) =>
      a.status !== 'completed' &&
      (a.status === 'in_progress' ||
        isActivityHappeningNow(a.date, a.startTime, a.durationMinutes))
  );

  const handleToggleComplete = (act: Activity) => {
    const isNowCompleted = act.status !== 'completed';
    const currentTimeStr = getLocalNowTime();

    onUpdateActivityStatus(act.id, isNowCompleted ? 'completed' : 'pending', {
      completedTime: isNowCompleted ? currentTimeStr : undefined,
      isOnTime: isNowCompleted ? true : undefined,
    });
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      {/* 1. Header: Date, Live Time & Progress Pill */}
      <div className="border-b border-[#E8E8E4] pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#EA580C] uppercase mb-1">
              <span>Today&apos;s Schedule</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-[#52525B] font-data">
                <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>{liveTime} Local Time</span>
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#121316]">
              {todayTitle}
            </h1>
          </div>

          {/* Quick Progress Indicator */}
          <div className="flex items-center gap-4 bg-white border border-[#E8E8E4] px-5 py-3 rounded-xl shadow-xs">
            <div>
              <div className="text-xs font-medium text-[#71717A]">
                Completed Today
              </div>
              <div className="text-2xl font-black text-[#121316]">
                {completedCount} <span className="text-sm font-normal text-[#71717A]">/ {total}</span>
              </div>
              <div className="text-[11px] font-semibold text-[#16803C]">
                {progressPercent}% done
              </div>
            </div>

            <div className="w-12 h-12 relative flex items-center justify-center">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="#EDEDE8"
                  strokeWidth="4.5"
                  fill="transparent"
                />
                {total > 0 && (
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke={progressPercent === 100 ? '#16803C' : '#EA580C'}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 20}
                    strokeDashoffset={
                      2 * Math.PI * 20 - (progressPercent / 100) * (2 * Math.PI * 20)
                    }
                  />
                )}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Active Highlight: Happening Right Now */}
      {happeningNowAct && (
        <div className="p-4 sm:p-5 rounded-xl bg-[#FFF7ED] border border-[#FDBA74] flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#EA580C] text-white flex items-center justify-center font-bold shrink-0">
              <PlayCircle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#EA580C] text-white px-2 py-0.5 rounded-full">
                  Happening Now
                </span>
                <span className="text-xs font-data font-bold text-[#52525B]">
                  {happeningNowAct.startTime} ({happeningNowAct.durationMinutes} min)
                </span>
              </div>
              <div className="text-base font-bold text-[#121316] mt-0.5 truncate">
                {happeningNowAct.title}
              </div>
            </div>
          </div>

          <button
            onClick={() => handleToggleComplete(happeningNowAct)}
            className="px-4 py-2 rounded-lg bg-[#16803C] hover:bg-[#15803d] text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Mark Done</span>
          </button>
        </div>
      )}

      {/* 3. Practical Checklist Schedule */}
      <section className="bg-white rounded-xl border border-[#E8E8E4] p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#F4F4F0]">
          <div>
            <h2 className="text-base font-bold text-[#121316]">
              Today&apos;s Checklist
            </h2>
            <p className="text-xs text-[#71717A] mt-0.5">
              Arranged by scheduled time. Tap to mark done.
            </p>
          </div>

          <button
            onClick={() => onOpenQuickAddWithDate(todayStr)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#16A34A] text-white text-xs font-bold hover:bg-[#15803D] transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>Add Task</span>
          </button>
        </div>

        {sortedActivities.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-[#E8E8E4] rounded-xl bg-[#FAFAF8]">
            <Clock className="w-9 h-9 text-[#A1A1AA] mx-auto mb-2" />
            <p className="text-base font-bold text-[#121316] mb-1">
              Your schedule is clear for today
            </p>
            <p className="text-xs text-[#71717A] max-w-sm mx-auto mb-4">
              Add your planned tasks, meetings, or deep work sessions to make the most of today.
            </p>
            <button
              onClick={() => onOpenQuickAddWithDate(todayStr)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-xs font-bold hover:bg-[#15803D] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Add a task for today</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedActivities.map((act) => {
              const isCompleted = act.status === 'completed';
              const isHappening = isActivityHappeningNow(act.date, act.startTime, act.durationMinutes);
              const isOverdue = !isCompleted && isActivityOverdue(act.date, act.startTime);

              return (
                <div
                  key={act.id}
                  onClick={() => handleToggleComplete(act)}
                  className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer select-none ${
                    isCompleted
                      ? 'bg-[#FBFBF9] border-[#EDEDE8] text-[#71717A]'
                      : isHappening
                      ? 'bg-[#FFF7ED] border-[#FDBA74] text-[#121316] shadow-xs'
                      : isOverdue
                      ? 'bg-rose-50/40 border-rose-200 text-[#121316]'
                      : 'bg-white border-[#E8E8E4] text-[#121316] hover:border-[#121316]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Checkbox button */}
                    <div className="shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6 text-[#16803C]" />
                      ) : (
                        <Circle className="w-6 h-6 text-[#A1A1AA] hover:text-[#121316] transition-colors" />
                      )}
                    </div>

                    {/* Time chip */}
                    <div className="flex items-center gap-1 text-xs font-data font-semibold text-[#52525B] w-20 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-[#71717A]" />
                      <span>{act.startTime}</span>
                    </div>

                    {/* Content */}
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
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EA580C] text-white">
                            Current
                          </span>
                        )}

                        {isOverdue && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                            Overdue
                          </span>
                        )}

                        {act.priority === 'high' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">
                            Important
                          </span>
                        )}

                        {act.category && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#F2F2ED] text-[#52525B]">
                            {act.category}
                          </span>
                        )}

                        {act.reminderMinutes !== undefined && act.reminderMinutes > 0 && (
                          <span className="text-[10px] font-medium text-[#71717A] flex items-center gap-0.5">
                            <Bell className="w-2.5 h-2.5 text-[#EA580C]" />
                            <span>{act.reminderMinutes}m</span>
                          </span>
                        )}
                      </div>

                      {act.notes && (
                        <p className="text-[11px] text-[#71717A] mt-0.5 truncate max-w-md">
                          {act.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Completion badge */}
                  <div className="shrink-0 ml-3">
                    {isCompleted ? (
                      <span className="text-xs font-bold text-[#16803C] bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-lg">
                        Done
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[#A1A1AA] hover:text-[#121316]">
                        {act.durationMinutes}m
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
