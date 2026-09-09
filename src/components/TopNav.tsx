import React from 'react';
import {
  Home,
  CalendarDays,
  CalendarCheck2,
  Target,
  BarChart3,
  History,
  Settings,
  Plus,
  Shield,
  LogOut,
  User,
} from 'lucide-react';
import { MainSection, UserProfile } from '../types';

interface TopNavProps {
  activeSection: MainSection;
  onSelectSection: (section: MainSection) => void;
  onOpenQuickAdd: () => void;
  weeklyScore: number;
  hasScoreData?: boolean;
  currentUser: UserProfile | null;
  onSignOut: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeSection,
  onSelectSection,
  onOpenQuickAdd,
  weeklyScore,
  hasScoreData = false,
  currentUser,
  onSignOut,
}) => {
  const baseNavItems = [
    { id: 'home' as MainSection, label: 'HOME', icon: Home },
    { id: 'my_week' as MainSection, label: 'MY WEEK', icon: CalendarDays },
    { id: 'today' as MainSection, label: 'TODAY', icon: CalendarCheck2 },
    { id: 'goals' as MainSection, label: 'GOALS', icon: Target },
    { id: 'performance' as MainSection, label: 'PERFORMANCE', icon: BarChart3 },
    { id: 'history' as MainSection, label: 'HISTORY', icon: History },
    { id: 'settings' as MainSection, label: 'SETTINGS', icon: Settings },
  ];

  const navItems =
    currentUser?.role === 'admin'
      ? [...baseNavItems, { id: 'admin' as MainSection, label: 'ADMIN', icon: Shield }]
      : baseNavItems;

  return (
    <header className="sticky top-0 z-30 bg-[#FBFBFA]/95 backdrop-blur-sm border-b border-[#EBEBE8] px-4 sm:px-6 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo / System Title */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onSelectSection('home')}
            className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer"
          >
            <div className="w-7 h-7 rounded bg-[#1C1D1F] text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-sm group-hover:bg-[#2D2E32] transition-colors">
              F
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-[#1C1D1F]">
                FOCUS OS
              </span>
              <span className="hidden sm:inline-block ml-2 text-[11px] text-[#71717A] tracking-normal font-normal">
                Personal Execution
              </span>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 border-l border-[#EBEBE8] pl-5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const isAdmin = item.id === 'admin';

              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => onSelectSection(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    isActive
                      ? isAdmin
                        ? 'bg-[#1C1D1F] text-white shadow-xs'
                        : 'bg-white text-[#1C1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-[#E0E0DC]'
                      : isAdmin
                      ? 'text-[#1C1D1F] hover:bg-[#F2F2ED]'
                      : 'text-[#71717A] hover:text-[#1C1D1F] hover:bg-[#F2F2ED]'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive
                        ? isAdmin
                          ? 'text-white'
                          : 'text-[#1C1D1F]'
                        : isAdmin
                        ? 'text-[#1C1D1F]'
                        : 'text-[#8E8E93]'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right side: Execution Badge, + ADD, User Profile & Sign Out */}
        <div className="flex items-center gap-3">
          {/* Quick Score Badge */}
          <button
            onClick={() => onSelectSection('performance')}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded bg-white border border-[#E0E0DC] text-xs hover:border-[#CCCCCC] transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer"
            title="Weekly Execution Score"
          >
            <span className="text-[#71717A] text-[11px] font-medium">WEEK</span>
            <span className="font-bold text-[#1C1D1F] font-mono">
              {hasScoreData ? `${weeklyScore}%` : '—'}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                !hasScoreData
                  ? 'bg-[#A1A1AA]'
                  : weeklyScore >= 80
                  ? 'bg-emerald-600'
                  : weeklyScore >= 60
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            />
          </button>

          {/* Prominent + ADD Button */}
          <button
            id="btn-quick-add"
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#1C1D1F] hover:bg-[#2E3035] text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ ADD</span>
          </button>

          {/* User Profile Pill & Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-[#EBEBE8]">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-semibold text-[#1C1D1F] leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-[#71717A] font-mono leading-tight truncate max-w-[130px]">
                  {currentUser.email}
                </span>
              </div>

              <button
                onClick={onSignOut}
                title="Sign Out"
                className="p-1.5 rounded hover:bg-[#F2F2ED] text-[#71717A] hover:text-[#1C1D1F] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="lg:hidden flex items-center gap-1 overflow-x-auto pt-2.5 pb-0.5 border-t border-[#EBEBE8] mt-2 no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold tracking-wide whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-white text-[#1C1D1F] border border-[#E0E0DC] shadow-xs'
                  : 'text-[#71717A] hover:text-[#1C1D1F]'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
