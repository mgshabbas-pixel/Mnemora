import React, { useState, useEffect } from 'react';
import { X, Plus, Calendar, Clock, Target, Bell, Repeat } from 'lucide-react';
import {
  Activity,
  Goal,
  Priority,
  ReminderOption,
  RecurringOption,
  CategoryItem,
} from '../types';
import { getLocalToday } from '../utils/dateUtils';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
  goals: Goal[];
  categories: CategoryItem[];
  onAddActivity: (activity: Omit<Activity, 'id'>) => void;
  onAddGoal: (goal: Omit<Goal, 'id'>) => void;
  onAddWeeklyTarget: (goalId: string, text: string) => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  goals,
  categories,
  onAddActivity,
  onAddGoal,
  onAddWeeklyTarget,
}) => {
  const [tab, setTab] = useState<'activity' | 'goal' | 'target'>('activity');

  // Activity form fields (Section 16)
  const [activityTitle, setActivityTitle] = useState('');
  const [date, setDate] = useState(defaultDate || getLocalToday());
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [priority, setPriority] = useState<Priority>('high');
  const [goalId, setGoalId] = useState<string>(goals[0]?.id || '');
  const [category, setCategory] = useState<string>(categories[0]?.name || 'AI');
  const [reminder, setReminder] = useState<ReminderOption>('15_min');
  const [recurring, setRecurring] = useState<RecurringOption>('none');
  const [notes, setNotes] = useState('');

  // Goal form fields
  const [goalName, setGoalName] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('2026-12-31');

  // Weekly Target fields
  const [targetGoalId, setTargetGoalId] = useState<string>(goals[0]?.id || '');
  const [targetText, setTargetText] = useState('');

  useEffect(() => {
    if (defaultDate) {
      setDate(defaultDate);
    }
  }, [defaultDate]);

  useEffect(() => {
    if (goals.length > 0 && !goalId) {
      setGoalId(goals[0].id);
      setTargetGoalId(goals[0].id);
    }
  }, [goals, goalId]);

  if (!isOpen) return null;

  const handleActivitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityTitle.trim()) return;

    onAddActivity({
      title: activityTitle.trim(),
      date,
      startTime,
      endTime,
      durationMinutes: 120,
      category,
      priority,
      goalId: goalId || undefined,
      reminder,
      recurring,
      notes: notes.trim() || undefined,
      status: 'pending',
    });

    setActivityTitle('');
    setNotes('');
    onClose();
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim()) return;

    onAddGoal({
      name: goalName.trim(),
      description: goalDesc.trim(),
      targetDate: goalTargetDate,
      progress: 0,
      status: 'in_progress',
    });

    setGoalName('');
    setGoalDesc('');
    onClose();
  };

  const handleTargetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetText.trim() || !targetGoalId) return;

    onAddWeeklyTarget(targetGoalId, targetText.trim());
    setTargetText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-[#E0E0DC] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F0EC] bg-[#FAFAF8]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1C1D1F]" />
            <h2 className="text-sm font-bold text-[#1C1D1F] tracking-tight uppercase">
              QUICK ADD
            </h2>
          </div>

          {/* Sub tabs: Activity, Goal, Weekly Target */}
          <div className="flex items-center gap-1 bg-[#EBEBE8] p-0.5 rounded text-xs">
            <button
              onClick={() => setTab('activity')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                tab === 'activity'
                  ? 'bg-white text-[#1C1D1F] shadow-xs'
                  : 'text-[#71717A] hover:text-[#1C1D1F]'
              }`}
            >
              Activity
            </button>
            <button
              onClick={() => setTab('goal')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                tab === 'goal'
                  ? 'bg-white text-[#1C1D1F] shadow-xs'
                  : 'text-[#71717A] hover:text-[#1C1D1F]'
              }`}
            >
              Goal
            </button>
            <button
              onClick={() => setTab('target')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                tab === 'target'
                  ? 'bg-white text-[#1C1D1F] shadow-xs'
                  : 'text-[#71717A] hover:text-[#1C1D1F]'
              }`}
            >
              Weekly Target
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-[#A1A1AA] hover:text-[#1C1D1F] p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. ACTIVITY FORM (Section 16 Specification) */}
        {tab === 'activity' && (
          <form onSubmit={handleActivitySubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                Activity:
              </label>
              <input
                type="text"
                required
                autoFocus
                value={activityTitle}
                onChange={(e) => setActivityTitle(e.target.value)}
                placeholder="e.g. Study AI, University assignment, Edit video..."
                className="w-full text-xs p-2.5 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                  Date:
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                  Time:
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none font-mono"
                  />
                  <span className="text-xs text-[#71717A]">—</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                  Priority:
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                  Category:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
                >
                  {categories.length === 0 ? (
                    <option value="General">General</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                  Goal:
                </label>
                <select
                  value={goalId}
                  onChange={(e) => setGoalId(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
                >
                  <option value="">(None)</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                  Reminder:
                </label>
                <select
                  value={reminder}
                  onChange={(e) => setReminder(e.target.value as ReminderOption)}
                  className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
                >
                  <option value="none">None</option>
                  <option value="at_time">At scheduled time</option>
                  <option value="5_min">5 minutes before</option>
                  <option value="15_min">15 minutes before</option>
                  <option value="30_min">30 minutes before</option>
                  <option value="1_hour">1 hour before</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                  Recurring:
                </label>
                <select
                  value={recurring}
                  onChange={(e) => setRecurring(e.target.value as RecurringOption)}
                  className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
                >
                  <option value="none">One-time</option>
                  <option value="mon_fri">Every Monday–Friday</option>
                  <option value="daily">Every day</option>
                  <option value="weekly">Weekly on this day</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                  Notes:
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional details or chapter..."
                  className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#F0F0EC]">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-[#71717A] hover:text-[#1C1D1F]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white rounded shadow-xs cursor-pointer"
              >
                SAVE
              </button>
            </div>
          </form>
        )}

        {/* 2. GOAL FORM */}
        {tab === 'goal' && (
          <form onSubmit={handleGoalSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                Goal Name:
              </label>
              <input
                type="text"
                required
                autoFocus
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="e.g. Learn AI, Finish university work..."
                className="w-full text-xs p-2.5 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                Target Date:
              </label>
              <input
                type="date"
                value={goalTargetDate}
                onChange={(e) => setGoalTargetDate(e.target.value)}
                className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                Description:
              </label>
              <textarea
                value={goalDesc}
                onChange={(e) => setGoalDesc(e.target.value)}
                rows={3}
                placeholder="Describe what success looks like..."
                className="w-full text-xs p-2.5 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#F0F0EC]">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-[#71717A] hover:text-[#1C1D1F]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white rounded shadow-xs cursor-pointer"
              >
                SAVE GOAL
              </button>
            </div>
          </form>
        )}

        {/* 3. WEEKLY TARGET FORM */}
        {tab === 'target' && (
          <form onSubmit={handleTargetSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                Connect to Goal:
              </label>
              <select
                value={targetGoalId}
                onChange={(e) => setTargetGoalId(e.target.value)}
                className="w-full text-xs p-2.5 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
              >
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1D1F] mb-1">
                This Week&apos;s Target:
              </label>
              <input
                type="text"
                required
                autoFocus
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
                placeholder="e.g. Complete Python AI module, Build one AI project..."
                className="w-full text-xs p-2.5 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#F0F0EC]">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-[#71717A] hover:text-[#1C1D1F]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white rounded shadow-xs cursor-pointer"
              >
                SAVE TARGET
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
