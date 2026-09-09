import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, CalendarCheck } from 'lucide-react';
import { WeeklyPerformanceStats } from '../types';

interface ExecutionRingProps {
  stats: WeeklyPerformanceStats;
  size?: 'normal' | 'compact' | 'large';
  subtitle?: string;
}

export const ExecutionRing: React.FC<ExecutionRingProps> = ({
  stats,
  size = 'normal',
  subtitle = 'WEEKLY EXECUTION',
}) => {
  const dimension = size === 'large' ? 240 : size === 'compact' ? 160 : 200;
  const strokeWidth = size === 'large' ? 12 : size === 'compact' ? 8 : 10;
  const center = dimension / 2;
  const radius = center - strokeWidth - 6;
  const circumference = 2 * Math.PI * radius;

  const hasData = stats.hasData && stats.plannedCount > 0;
  const score = hasData ? Math.min(100, Math.max(0, stats.overallScore)) : 0;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Semantic color for progress ring based on execution score:
  // Green (#16803C) for high execution (>= 75%), Orange (#EA580C) for active momentum
  const strokeColor = !hasData
    ? '#ECECE8'
    : score >= 75
    ? '#16803C' // Green (Target achieved / high health)
    : '#EA580C'; // Warm Orange (Momentum building)

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: dimension, height: dimension }}>
        <svg
          width={dimension}
          height={dimension}
          viewBox={`0 0 ${dimension} ${dimension}`}
          className="transform -rotate-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
        >
          {/* Subtle track background */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#ECECE8"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Animated active progress arc */}
          {hasData ? (
            <motion.circle
              cx={center}
              cy={center}
              r={radius}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : (
            // Idle zero indicator circle
            <circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#ECECE8"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
          )}
        </svg>

        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none px-4">
          <motion.div
            key={score}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex items-baseline justify-center"
          >
            <span
              className={`font-extrabold tracking-tight text-[#121316] font-sans ${
                size === 'large' ? 'text-5xl' : size === 'compact' ? 'text-3xl' : 'text-4xl'
              }`}
            >
              {score}
            </span>
            <span
              className={`text-[#71717A] font-medium ml-0.5 ${
                size === 'large' ? 'text-xl' : 'text-base'
              }`}
            >
              %
            </span>
          </motion.div>

          <span
            className={`uppercase font-semibold tracking-wider text-[#71717A] mt-1 ${
              size === 'compact' ? 'text-[9px]' : 'text-[10px]'
            }`}
          >
            {hasData ? subtitle : 'NO ACTIVITY YET'}
          </span>
        </div>
      </div>

      {/* Sub-metrics beneath ring */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-5 w-full max-w-sm pt-4 border-t border-[#E8E8E4]">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-[#71717A] text-[11px] mb-0.5">
            <CheckCircle2 className="w-3 h-3 text-[#16803C]" />
            <span>Completed</span>
          </div>
          <div className="text-sm font-semibold text-[#121316] font-data">
            {stats.completedCount} <span className="text-xs text-[#71717A] font-normal">/ {stats.plannedCount}</span>
          </div>
        </div>

        <div className="text-center border-x border-[#E8E8E4] px-2">
          <div className="flex items-center justify-center gap-1 text-[#71717A] text-[11px] mb-0.5">
            <Clock className="w-3 h-3 text-[#EA580C]" />
            <span>On-time</span>
          </div>
          <div className="text-sm font-semibold text-[#121316] font-data">
            {hasData ? `${stats.onTimeRate}%` : '0%'}
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-[#71717A] text-[11px] mb-0.5">
            <CalendarCheck className="w-3 h-3 text-[#121316]" />
            <span>Consistency</span>
          </div>
          <div className="text-sm font-semibold text-[#121316] font-data">
            {hasData ? `${stats.consistency}%` : '0%'}
          </div>
        </div>
      </div>
    </div>
  );
};
