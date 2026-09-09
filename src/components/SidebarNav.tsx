import React, { useState, useEffect } from 'react';
import {
  Home,
  CalendarDays,
  CalendarCheck2,
  Target,
  BarChart3,
  History,
  Settings,
  Plus,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Clock,
  Menu,
  X,
} from 'lucide-react';
import { MainSection, UserProfile } from '../types';
import { getLocalNowTime, formatFullDate, getLocalToday } from '../utils/dateUtils';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarNavProps {
  activeSection: MainSection;
  onSelectSection: (section: MainSection) => void;
  onOpenQuickAdd: () => void;
  weeklyScore: number;
  hasScoreData?: boolean;
  todayCount?: number;
  currentUser: UserProfile | null;
  onSignOut: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeSection,
  onSelectSection,
  onOpenQuickAdd,
  weeklyScore,
  hasScoreData = false,
  todayCount = 0,
  currentUser,
  onSignOut,
}) => {
  const [liveTime, setLiveTime] = useState<string>(getLocalNowTime());
  const [todayStr, setTodayStr] = useState<string>(getLocalToday());
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Update live clock every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(getLocalNowTime());
      const newToday = getLocalToday();
      if (newToday !== todayStr) {
        setTodayStr(newToday);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [todayStr]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const navItems: Array<{
    id: MainSection;
    label: string;
    icon: React.ElementType;
    badge?: string;
    badgeColor?: 'orange' | 'green' | 'default';
  }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'my_week', label: 'My Week', icon: CalendarDays },
    {
      id: 'today',
      label: 'Today',
      icon: CalendarCheck2,
      badge: todayCount > 0 ? String(todayCount) : undefined,
      badgeColor: 'orange',
    },
    { id: 'goals', label: 'Goals', icon: Target },
    {
      id: 'performance',
      label: 'Performance',
      icon: BarChart3,
      badge: hasScoreData ? `${weeklyScore}%` : undefined,
      badgeColor: 'green',
    },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
    ...(currentUser?.role === 'admin'
      ? [
          {
            id: 'admin' as MainSection,
            label: 'Admin',
            icon: ShieldCheck,
            badge: 'Active',
            badgeColor: 'green' as const,
          },
        ]
      : []),
  ];

  const handleNavItemClick = (sectionId: MainSection) => {
    onSelectSection(sectionId);
    setIsMobileOpen(false);
  };

  const renderNavContent = () => (
    <div className="flex flex-col h-full text-white">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#22242A]">
        <button
          onClick={() => handleNavItemClick('home')}
          className="flex items-center gap-3 w-full text-left group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-black text-xs tracking-wider shadow-sm group-hover:scale-105 transition-transform">
            F
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-white">
                FOCUS OS
              </span>
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" title="System Online" />
            </div>
            <span className="text-[10px] text-[#A1A1AA] tracking-wider uppercase block font-semibold">
              Execution System
            </span>
          </div>
        </button>

        {/* Real System Date & Time widget */}
        <div className="mt-4 pt-3 border-t border-[#1F2026] flex items-center justify-between text-xs text-[#A1A1AA]">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
            <span className="font-semibold text-white font-mono text-xs tracking-wide">
              {liveTime}
            </span>
          </div>
          <span className="text-[11px] font-medium text-[#A1A1AA] truncate max-w-[130px]">
            {formatFullDate(todayStr).split(',')[0]}
          </span>
        </div>
      </div>

      {/* Primary Action Button - Green */}
      <div className="p-4 pb-2">
        <button
          id="sidebar-btn-quick-add"
          onClick={() => {
            onOpenQuickAdd();
            setIsMobileOpen(false);
          }}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>New Activity / Goal</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const isAdmin = item.id === 'admin';

          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => handleNavItemClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer group ${
                isActive
                  ? 'bg-[#16A34A] text-white font-bold shadow-xs'
                  : 'text-[#D4D4D8] hover:text-white hover:bg-[#1E2026]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive
                      ? 'text-white'
                      : isAdmin
                      ? 'text-[#EA580C] group-hover:text-white'
                      : 'text-[#A1A1AA] group-hover:text-white'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                    isActive
                      ? 'bg-black/30 text-white'
                      : item.badgeColor === 'orange'
                      ? 'bg-[#EA580C] text-white'
                      : item.badgeColor === 'green'
                      ? 'bg-[#16A34A]/20 text-[#4ADE80] border border-[#16A34A]/40'
                      : 'bg-[#27272A] text-[#A1A1AA]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Execution Rate Mini-Widget */}
      <div className="p-3 mx-3 mb-3 rounded-xl bg-[#17181D] border border-[#272830]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
            Weekly Execution
          </span>
          <span
            className={`text-xs font-bold font-mono ${
              hasScoreData && weeklyScore >= 70
                ? 'text-[#4ADE80]'
                : hasScoreData
                ? 'text-[#FB923C]'
                : 'text-[#71717A]'
            }`}
          >
            {hasScoreData ? `${weeklyScore}%` : '0%'}
          </span>
        </div>
        <div className="w-full bg-[#272830] h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: hasScoreData ? `${Math.min(100, weeklyScore)}%` : '0%',
              backgroundColor: weeklyScore >= 70 ? '#16A34A' : '#EA580C',
            }}
          />
        </div>
        <button
          onClick={() => handleNavItemClick('performance')}
          className="w-full mt-2 text-[10px] text-[#D4D4D8] hover:text-[#4ADE80] font-semibold flex items-center justify-between transition-colors cursor-pointer"
        >
          <span>View Analytics Lab</span>
          <ChevronRight className="w-3 h-3 text-[#16A34A]" />
        </button>
      </div>

      {/* PWA App Install Button */}
      <div className="px-3 pb-2">
        <PWAInstallButton variant="sidebar" />
      </div>

      {/* User Account & Logout */}
      {currentUser && (
        <div className="p-3 border-t border-[#22242A] bg-[#14151A] flex items-center justify-between">
          <div
            onClick={() => handleNavItemClick('settings')}
            className="flex items-center gap-2 cursor-pointer truncate mr-2"
            title="Open settings"
          >
            <div className="w-7 h-7 rounded-full bg-white text-black font-bold text-[11px] flex items-center justify-center shrink-0">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white block leading-tight truncate">
                  {currentUser.name}
                </span>
                {currentUser.role === 'admin' && (
                  <span className="text-[8px] font-bold px-1 rounded bg-[#EA580C] text-white uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#A1A1AA] font-mono block leading-tight truncate">
                {currentUser.email}
              </span>
            </div>
          </div>

          <button
            onClick={onSignOut}
            title="Sign Out"
            className="p-1.5 rounded-md hover:bg-[#272830] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* DESKTOP FIXED LEFT SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 bg-[#0C0D10] border-r border-[#22242A] select-none z-30">
        {renderNavContent()}
      </aside>

      {/* MOBILE STICKY TOP BAR (With Hamburger Button) */}
      <div className="md:hidden sticky top-0 z-40 bg-[#0C0D10] border-b border-[#22242A] px-4 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <button
            id="btn-mobile-menu-toggle"
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 rounded-lg bg-[#1E2026] text-white hover:bg-[#272830] transition-colors cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => handleNavItemClick('home')}
            className="flex items-center gap-2 text-left"
          >
            <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center font-black text-xs">
              F
            </div>
            <span className="text-sm font-black tracking-tight text-white">
              FOCUS OS
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#16A34A] text-white text-xs font-bold shadow-xs hover:bg-[#15803D]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>

          <button
            onClick={onSignOut}
            title="Sign Out"
            className="p-1.5 rounded text-[#A1A1AA] hover:text-white"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MOBILE SLIDE-OUT DRAWER OVERLAY */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] h-full bg-[#0C0D10] border-r border-[#22242A] shadow-2xl z-50 flex flex-col">
            {/* Drawer Close Button */}
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-lg bg-[#1E2026] text-[#A1A1AA] hover:text-white cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderNavContent()}
          </div>
        </div>
      )}
    </>
  );
};
