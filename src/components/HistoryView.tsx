import React, { useState } from 'react';
import {
  History,
  Calendar,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowRight,
  FileText,
  Save,
  Check,
  Archive,
} from 'lucide-react';
import {
  HistoricalWeekRecord,
  WeeklyReviewRecord,
  Activity,
  WeekPlan,
} from '../types';

interface HistoryViewProps {
  historicalWeeks: HistoricalWeekRecord[];
  currentWeekActivities: Activity[];
  currentWeekPlan: WeekPlan;
  onSaveCurrentWeekReview: (review: WeeklyReviewRecord) => void;
  onCarryForwardActivities: (activityIds: string[]) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  historicalWeeks,
  currentWeekActivities,
  currentWeekPlan,
  onSaveCurrentWeekReview,
  onCarryForwardActivities,
}) => {
  const [selectedWeekId, setSelectedWeekId] = useState<string>('current');

  // Current week computed review state
  const completedActs = currentWeekActivities.filter((a) => a.status === 'completed');
  const missedActs = currentWeekActivities.filter(
    (a) => a.status === 'not_completed' || a.status === 'skipped'
  );
  const plannedCount = currentWeekActivities.length;
  const completedCount = completedActs.length;
  const missedCount = missedActs.length;
  const overallScore = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;

  // Review form state for current week
  const [whatWentWell, setWhatWentWell] = useState(
    currentWeekPlan.review?.whatWentWell || ''
  );
  const [whatDidnt, setWhatDidnt] = useState(
    currentWeekPlan.review?.whatDidnt || ''
  );
  const [whatShouldImprove, setWhatShouldImprove] = useState(
    currentWeekPlan.review?.whatShouldImprove || ''
  );
  const [carriedActivities, setCarriedActivities] = useState<string[]>([]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleCarryForward = (id: string) => {
    setCarriedActivities((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSaveReview = () => {
    const record: WeeklyReviewRecord = {
      weekId: currentWeekPlan.weekId,
      dateRange: currentWeekPlan.dateRange,
      overallScore,
      plannedCount,
      completedCount,
      missedCount,
      skippedCount: 0,
      whatWentWell,
      whatDidnt,
      whatShouldImprove,
      carriedForwardActivityIds: carriedActivities,
      reviewedAt: new Date().toISOString(),
    };

    onSaveCurrentWeekReview(record);
    if (carriedActivities.length > 0) {
      onCarryForwardActivities(carriedActivities);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const selectedHistoricWeek = historicalWeeks.find((w) => w.weekId === selectedWeekId);

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* 1. Header */}
      <div className="border-b border-[#E8E8E4] pb-5">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-[#71717A] uppercase mb-1">
          <History className="w-3.5 h-3.5 text-[#EA580C]" />
          <span>Long-Term Archive</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121316]">
          HISTORY & WEEKLY REVIEWS
        </h1>
        <p className="text-xs text-[#71717A] mt-0.5 font-medium">
          Permanent chronological archive of weekly execution, retrospective reflections, and carry-forward actions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Weekly Records Navigation */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#71717A]">
            Archived Records
          </h2>

          {/* Current Week Active Review Card */}
          <div
            onClick={() => setSelectedWeekId('current')}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              selectedWeekId === 'current'
                ? 'bg-white border-[#121316] shadow-xs ring-1 ring-[#121316]'
                : 'bg-[#FAFAF8] border-[#E8E8E4] hover:bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#121316]">
                Current Week ({currentWeekPlan.dateRange})
              </span>
              <span className="text-xs font-data font-bold text-[#121316]">
                {overallScore}%
              </span>
            </div>
            <div className="text-[11px] text-[#71717A] flex items-center justify-between font-data">
              <span>{completedCount} of {plannedCount} done</span>
              <span className="text-[#EA580C] font-semibold bg-orange-50 border border-orange-200/50 px-1.5 py-0.5 rounded text-[10px]">
                Active Review
              </span>
            </div>
          </div>

          {/* Past Weeks List or Empty State */}
          {historicalWeeks.length === 0 ? (
            <div className="p-5 text-center text-xs text-[#71717A] border border-dashed border-[#E8E8E4] rounded-lg bg-[#FAFAF8]">
              <Archive className="w-6 h-6 text-[#A1A1AA] mx-auto mb-2" />
              <p className="font-semibold text-[#121316] mb-1">
                No past weeks recorded yet.
              </p>
              <p className="text-[11px] text-[#A1A1AA]">
                Past weeks will appear here after you complete your weekly review.
              </p>
            </div>
          ) : (
            historicalWeeks.map((week) => (
              <div
                key={week.weekId}
                onClick={() => setSelectedWeekId(week.weekId)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                  selectedWeekId === week.weekId
                    ? 'bg-white border-[#121316] shadow-xs ring-1 ring-[#121316]'
                    : 'bg-[#FAFAF8] border-[#E8E8E4] hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#121316]">
                    {week.label || week.weekId}
                  </span>
                  <span className="text-xs font-data font-bold text-[#121316]">
                    {week.score}%
                  </span>
                </div>
                <div className="text-[11px] text-[#71717A] flex items-center justify-between font-data">
                  <span>{week.completed} of {week.planned} completed</span>
                  <span className="text-[#16803C] font-semibold text-[10px]">
                    Archived
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Detailed View / Review Editor */}
        <div className="lg:col-span-8">
          {selectedWeekId === 'current' ? (
            /* Current Week Review Workflow */
            <div className="bg-white rounded-lg border border-[#E8E8E4] p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#F4F4F0]">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#EA580C]">
                    Weekly Review & Closing
                  </span>
                  <h2 className="text-lg font-bold text-[#121316]">
                    {currentWeekPlan.dateRange} Review
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-[#71717A] block uppercase font-bold">
                      Current Score
                    </span>
                    <span className="text-xl font-bold font-data text-[#121316]">
                      {overallScore}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Execution Summary Breakdown */}
              <div className="grid grid-cols-3 gap-3 font-data text-center">
                <div className="p-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-[#71717A] block">Planned</span>
                  <span className="text-base font-bold text-[#121316]">{plannedCount}</span>
                </div>
                <div className="p-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-[#16803C] block">Completed</span>
                  <span className="text-base font-bold text-[#16803C]">{completedCount}</span>
                </div>
                <div className="p-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-[#71717A] block">Remaining</span>
                  <span className="text-base font-bold text-[#71717A]">{plannedCount - completedCount}</span>
                </div>
              </div>

              {/* Retrospective Reflection Questions */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#121316] block mb-1">
                    1. What went well this week?
                  </label>
                  <textarea
                    rows={3}
                    value={whatWentWell}
                    onChange={(e) => setWhatWentWell(e.target.value)}
                    placeholder="Reflect on your wins, deep focus blocks, and goals accomplished..."
                    className="w-full px-3 py-2 text-xs rounded border border-[#E0E0DC] focus:border-[#121316] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#121316] block mb-1">
                    2. What did not go as planned?
                  </label>
                  <textarea
                    rows={3}
                    value={whatDidnt}
                    onChange={(e) => setWhatDidnt(e.target.value)}
                    placeholder="Where did friction occur? Missed slots, interruptions, fatigue..."
                    className="w-full px-3 py-2 text-xs rounded border border-[#E0E0DC] focus:border-[#121316] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#121316] block mb-1">
                    3. What will I adjust next week?
                  </label>
                  <textarea
                    rows={3}
                    value={whatShouldImprove}
                    onChange={(e) => setWhatShouldImprove(e.target.value)}
                    placeholder="Concrete adjustments to scheduling, morning focus, or priority limits..."
                    className="w-full px-3 py-2 text-xs rounded border border-[#E0E0DC] focus:border-[#121316] focus:outline-none"
                  />
                </div>
              </div>

              {/* Carry Forward Section */}
              {missedActs.length > 0 && (
                <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#E8E8E4] space-y-2">
                  <span className="text-xs font-bold text-[#121316] block">
                    Carry Forward Incomplete Activities to Next Week:
                  </span>
                  <div className="space-y-1.5">
                    {missedActs.map((act) => (
                      <label
                        key={act.id}
                        className="flex items-center gap-2 text-xs text-[#52525B] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={carriedActivities.includes(act.id)}
                          onChange={() => toggleCarryForward(act.id)}
                          className="rounded border-[#E0E0DC] text-[#121316] focus:ring-0"
                        />
                        <span>{act.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-[#F4F4F0]">
                <div>
                  {savedSuccess && (
                    <span className="text-xs font-semibold text-[#16803C] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Weekly Review Saved</span>
                    </span>
                  )}
                </div>

                <button
                  onClick={handleSaveReview}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#16A34A] text-white text-xs font-semibold hover:bg-[#15803D] transition-colors shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save & Close Week</span>
                </button>
              </div>
            </div>
          ) : (
            /* Selected Historic Archived Week Details */
            selectedHistoricWeek && (
              <div className="bg-white rounded-lg border border-[#E8E8E4] p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#F4F4F0]">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717A]">
                      Archived Execution Record
                    </span>
                    <h2 className="text-lg font-bold text-[#121316]">
                      {selectedHistoricWeek.label || selectedHistoricWeek.weekId}
                    </h2>
                    <p className="text-xs text-[#71717A] font-data">
                      {selectedHistoricWeek.dateRange}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl font-bold font-data text-[#121316]">
                      {selectedHistoricWeek.score}%
                    </span>
                    <span className="text-[10px] text-[#71717A] block uppercase font-bold">
                      Overall Score
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-data">
                  <div className="p-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded-lg">
                    <span className="text-[10px] uppercase font-bold text-[#71717A] block">Planned</span>
                    <span className="text-sm font-bold text-[#121316]">{selectedHistoricWeek.planned}</span>
                  </div>
                  <div className="p-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded-lg">
                    <span className="text-[10px] uppercase font-bold text-[#16803C] block">Completed</span>
                    <span className="text-sm font-bold text-[#16803C]">{selectedHistoricWeek.completed}</span>
                  </div>
                  <div className="p-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded-lg">
                    <span className="text-[10px] uppercase font-bold text-[#71717A] block">Missed</span>
                    <span className="text-sm font-bold text-[#71717A]">{selectedHistoricWeek.missed}</span>
                  </div>
                  <div className="p-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded-lg">
                    <span className="text-[10px] uppercase font-bold text-[#EA580C] block">On Time</span>
                    <span className="text-sm font-bold text-[#EA580C]">{selectedHistoricWeek.onTimeRate}%</span>
                  </div>
                </div>

                {/* Key Review Reflections */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#121316]">
                    Weekly Review Reflections
                  </h3>

                  <div className="p-3 rounded-lg bg-[#FAFAF8] border border-[#E8E8E4] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] block">
                      What went well:
                    </span>
                    <p className="text-xs text-[#121316] leading-relaxed">
                      {selectedHistoricWeek.reviewNotes || selectedHistoricWeek.whatWentWell || 'No notes entered.'}
                    </p>
                  </div>

                  {selectedHistoricWeek.whatDidnt && (
                    <div className="p-3 rounded-lg bg-[#FAFAF8] border border-[#E8E8E4] space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] block">
                        What did not go as planned:
                      </span>
                      <p className="text-xs text-[#121316] leading-relaxed">
                        {selectedHistoricWeek.whatDidnt}
                      </p>
                    </div>
                  )}

                  {selectedHistoricWeek.whatShouldImprove && (
                    <div className="p-3 rounded-lg bg-[#FAFAF8] border border-[#E8E8E4] space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] block">
                        Adjustments made:
                      </span>
                      <p className="text-xs text-[#121316] leading-relaxed">
                        {selectedHistoricWeek.whatShouldImprove}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
