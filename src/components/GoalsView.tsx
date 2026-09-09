import React, { useState } from 'react';
import {
  Target,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Trash2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Goal, WeeklyTarget } from '../types';

interface GoalsViewProps {
  goals: Goal[];
  weeklyTargets: WeeklyTarget[];
  onAddGoal: (goal: Omit<Goal, 'id'>) => void;
  onUpdateGoalProgress: (goalId: string, progress: number) => void;
  onDeleteGoal: (goalId: string) => void;
  onToggleWeeklyTarget: (targetId: string) => void;
  onAddWeeklyTarget: (goalId: string, text: string) => void;
  onDeleteWeeklyTarget: (targetId: string) => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  weeklyTargets,
  onAddGoal,
  onUpdateGoalProgress,
  onDeleteGoal,
  onToggleWeeklyTarget,
  onAddWeeklyTarget,
  onDeleteWeeklyTarget,
}) => {
  const [isCreatingGoal, setIsCreatingGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalDesc, setNewGoalDesc] = useState('');
  const [newGoalTargetDate, setNewGoalTargetDate] = useState('2026-12-31');
  const [newGoalCategory, setNewGoalCategory] = useState('Personal');

  // Input state for adding weekly targets under a goal
  const [activeTargetInputGoalId, setActiveTargetInputGoalId] = useState<string | null>(null);
  const [newTargetText, setNewTargetText] = useState('');

  const handleCreateGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim()) return;

    onAddGoal({
      name: newGoalName.trim(),
      description: newGoalDesc.trim(),
      targetDate: newGoalTargetDate,
      progress: 0,
      status: 'in_progress',
      category: newGoalCategory,
    });

    setNewGoalName('');
    setNewGoalDesc('');
    setIsCreatingGoal(false);
  };

  const handleAddTargetSubmit = (goalId: string) => {
    if (!newTargetText.trim()) return;
    onAddWeeklyTarget(goalId, newTargetText.trim());
    setNewTargetText('');
    setActiveTargetInputGoalId(null);
  };

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E8E4] pb-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-[#71717A] uppercase mb-1">
            <Target className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>Direction & Strategy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121316]">
            MY GOALS
          </h1>
          <p className="text-xs text-[#71717A] mt-0.5 font-medium">
            Core outcomes connected directly to your weekly targets and daily execution.
          </p>
        </div>

        <button
          onClick={() => setIsCreatingGoal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Create Goal</span>
        </button>
      </div>

      {/* 2. New Goal Inline Form */}
      {isCreatingGoal && (
        <form
          onSubmit={handleCreateGoalSubmit}
          className="bg-white p-5 rounded-lg border border-[#121316] shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#F4F4F0]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#121316]">
              Create New Goal
            </h3>
            <button
              type="button"
              onClick={() => setIsCreatingGoal(false)}
              className="text-xs text-[#71717A] hover:text-[#121316] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[#52525B] block mb-1">
                Goal Title *
              </label>
              <input
                type="text"
                required
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                placeholder="E.g., Launch version 1.0 of FOCUS OS"
                className="w-full px-3 py-2 text-xs rounded border border-[#E0E0DC] focus:border-[#121316] focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#52525B] block mb-1">
                Deadline *
              </label>
              <input
                type="date"
                required
                value={newGoalTargetDate}
                onChange={(e) => setNewGoalTargetDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded border border-[#E0E0DC] focus:border-[#121316] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#52525B] block mb-1">
              Description / Definition of Done
            </label>
            <textarea
              rows={2}
              value={newGoalDesc}
              onChange={(e) => setNewGoalDesc(e.target.value)}
              placeholder="What specifically does success look like when this goal is completed?"
              className="w-full px-3 py-2 text-xs rounded border border-[#E0E0DC] focus:border-[#121316] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingGoal(false)}
              className="px-3 py-1.5 rounded text-xs font-semibold text-[#71717A] hover:text-[#121316] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-[#16A34A] text-white text-xs font-semibold hover:bg-[#15803D] transition-colors cursor-pointer"
            >
              Save Goal
            </button>
          </div>
        </form>
      )}

      {/* 3. Goals List or Empty State */}
      {goals.length === 0 && !isCreatingGoal ? (
        <div className="text-center py-16 border border-dashed border-[#E8E8E4] rounded-lg bg-[#FAFAF8]">
          <Target className="w-10 h-10 text-[#A1A1AA] mx-auto mb-3" />
          <h2 className="text-base font-bold text-[#121316] mb-1">
            No goals created yet.
          </h2>
          <p className="text-xs text-[#71717A] max-w-sm mx-auto mb-5">
            Define the strategic goals you want to achieve. Everything in FOCUS OS cascades from your goals into weekly targets and daily activities.
          </p>
          <button
            onClick={() => setIsCreatingGoal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#16A34A] text-white text-xs font-semibold hover:bg-[#15803D] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Goal</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {goals.map((goal) => {
            const targetsForGoal = weeklyTargets.filter((t) => t.goalId === goal.id);
            const isCompleted = goal.progress >= 100 || goal.status === 'completed';

            return (
              <div
                key={goal.id}
                className="bg-white rounded-lg border border-[#E8E8E4] p-5 sm:p-6 shadow-xs transition-colors"
              >
                {/* Goal Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-3 border-b border-[#F4F4F0]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-[#121316]">
                        {goal.name}
                      </h2>
                      {isCompleted && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-[#16803C] uppercase tracking-wider">
                          Completed
                        </span>
                      )}
                    </div>
                    {goal.description && (
                      <p className="text-xs text-[#71717A] mt-0.5 max-w-2xl leading-relaxed">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1 text-xs text-[#71717A]">
                      <Calendar className="w-3.5 h-3.5 text-[#71717A]" />
                      <span className="font-data">Deadline: {goal.targetDate}</span>
                    </div>

                    <button
                      onClick={() => onDeleteGoal(goal.id)}
                      className="text-[#A1A1AA] hover:text-rose-600 p-1 cursor-pointer"
                      title="Delete Goal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Slider */}
                <div className="py-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-[#52525B]">Progress</span>
                    <span className="font-bold font-data text-sm text-[#121316]">
                      {goal.progress}%
                    </span>
                  </div>

                  <div className="w-full bg-[#EDEDE8] h-2 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${goal.progress}%`,
                        backgroundColor:
                          goal.progress >= 100
                            ? '#16803C' // Green
                            : goal.progress > 0
                            ? '#EA580C' // Orange
                            : '#D4D4D0',
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#71717A]">
                    <span>Update:</span>
                    {[0, 25, 50, 75, 100].map((step) => (
                      <button
                        key={step}
                        onClick={() => onUpdateGoalProgress(goal.id, step)}
                        className={`px-2 py-0.5 rounded text-[11px] font-data font-semibold border transition-colors cursor-pointer ${
                          goal.progress === step
                            ? 'bg-[#121316] text-white border-[#121316]'
                            : 'bg-[#FAFAF8] text-[#52525B] border-[#E8E8E4] hover:border-[#121316]'
                        }`}
                      >
                        {step}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Related Weekly Targets Section */}
                <div className="pt-3 border-t border-[#F4F4F0]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                      Related Weekly Targets ({targetsForGoal.length})
                    </span>
                    {activeTargetInputGoalId !== goal.id && (
                      <button
                        onClick={() => {
                          setActiveTargetInputGoalId(goal.id);
                          setNewTargetText('');
                        }}
                        className="text-[11px] font-semibold text-[#121316] hover:text-[#EA580C] transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-[#EA580C]" />
                        <span>Add Weekly Target</span>
                      </button>
                    )}
                  </div>

                  {activeTargetInputGoalId === goal.id && (
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="text"
                        value={newTargetText}
                        onChange={(e) => setNewTargetText(e.target.value)}
                        placeholder="E.g., Complete 3 focus sessions this week for this goal"
                        className="flex-1 px-3 py-1.5 text-xs rounded border border-[#121316] focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTargetSubmit(goal.id);
                          if (e.key === 'Escape') setActiveTargetInputGoalId(null);
                        }}
                      />
                      <button
                        onClick={() => handleAddTargetSubmit(goal.id)}
                        className="px-3 py-1.5 rounded bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold cursor-pointer"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setActiveTargetInputGoalId(null)}
                        className="px-2 py-1.5 text-xs text-[#71717A] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {targetsForGoal.length === 0 ? (
                    <p className="text-xs text-[#A1A1AA] italic">
                      No weekly targets assigned for this goal yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {targetsForGoal.map((target) => (
                        <div
                          key={target.id}
                          className="flex items-center justify-between p-2 rounded bg-[#FAFAF8] border border-[#E8E8E4] text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onToggleWeeklyTarget(target.id)}
                              className="cursor-pointer shrink-0"
                            >
                              {target.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                              ) : (
                                <Circle className="w-4 h-4 text-[#A1A1AA] hover:text-[#121316]" />
                              )}
                            </button>
                            <span
                              className={`${
                                target.completed
                                  ? 'line-through text-[#8E8E93]'
                                  : 'text-[#121316] font-medium'
                              }`}
                            >
                              {target.text}
                            </span>
                          </div>

                          <button
                            onClick={() => onDeleteWeeklyTarget(target.id)}
                            className="text-[#A1A1AA] hover:text-rose-600 p-1 cursor-pointer"
                            title="Delete Target"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
