import React, { useState, useEffect } from 'react';
import { Bell, Clock, X, Play } from 'lucide-react';
import { Activity } from '../types';
import { getLocalToday } from '../utils/dateUtils';

interface ReminderBannerProps {
  activities: Activity[];
  onStartActivity: (activityId: string) => void;
}

export const ReminderBanner: React.FC<ReminderBannerProps> = ({
  activities,
  onStartActivity,
}) => {
  const [activeAlert, setActiveAlert] = useState<{
    activity: Activity;
    message: string;
  } | null>(null);

  // Check today's upcoming activities with reminders
  useEffect(() => {
    const todayStr = getLocalToday();
    const pendingToday = activities.filter(
      (a) =>
        a.date === todayStr &&
        a.status === 'pending' &&
        a.reminder &&
        a.reminder !== 'none'
    );

    // Pick the most imminent activity to display as an active reminder
    if (pendingToday.length > 0 && !activeAlert) {
      const nextAct = pendingToday[0];
      const alertMsg =
        nextAct.reminder === 'at_time'
          ? `Starting at ${nextAct.startTime}`
          : `Scheduled for ${nextAct.startTime} (Reminder: ${nextAct.reminder.replace('_', ' ')})`;

      setActiveAlert({
        activity: nextAct,
        message: alertMsg,
      });
    }
  }, [activities, activeAlert]);

  if (!activeAlert) return null;

  return (
    <div className="bg-[#121316] text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs transition-all border-b border-[#25272C]">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-5 h-5 rounded-full bg-[#EA580C]/20 text-[#EA580C] flex items-center justify-center shrink-0">
          <Bell className="w-3 h-3 animate-pulse" />
        </div>
        <div className="truncate">
          <span className="font-bold mr-2 text-white">
            REMINDER: {activeAlert.activity.title}
          </span>
          <span className="text-[#A1A1AA] font-data">
            {activeAlert.message}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <button
          onClick={() => {
            onStartActivity(activeAlert.activity.id);
            setActiveAlert(null);
          }}
          className="px-2.5 py-1 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-md font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Start Now</span>
        </button>
        <button
          onClick={() => setActiveAlert(null)}
          className="text-[#A1A1AA] hover:text-white p-1 cursor-pointer"
          title="Dismiss reminder"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
