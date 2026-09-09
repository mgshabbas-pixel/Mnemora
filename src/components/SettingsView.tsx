import React, { useState } from 'react';
import {
  Settings,
  Tag,
  Plus,
  Trash2,
  Bell,
  Volume2,
  RotateCcw,
  User,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { CategoryItem, UserProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsViewProps {
  categories: CategoryItem[];
  currentUser: UserProfile | null;
  token: string | null;
  onAddCategory: (category: CategoryItem) => void;
  onDeleteCategory: (id: string) => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  categories,
  currentUser,
  token,
  onAddCategory,
  onDeleteCategory,
  onResetData,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#16A34A');
  const [testChimePlayed, setTestChimePlayed] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    onAddCategory({
      id: `cat-${Date.now()}`,
      name: newCatName.trim(),
      color: newCatColor,
    });

    setNewCatName('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setPwMessage(null);
    setPwLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setPwMessage({ text: 'Password changed successfully.', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPwMessage({ text: err.message, type: 'error' });
    } finally {
      setPwLoading(false);
    }
  };

  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
      setTestChimePlayed(true);
      setTimeout(() => setTestChimePlayed(false), 2000);
    } catch (e) {
      console.warn('Audio not available in this context');
    }
  };

  return (
    <div className="space-y-8 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#EBEBE8] pb-5">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#71717A] uppercase mb-1">
          <Settings className="w-3.5 h-3.5" />
          <span>System Preferences</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1C1D1F]">
          SETTINGS & ACCOUNT
        </h1>
        <p className="text-xs text-[#71717A] mt-0.5">
          Account management, security credentials, personalized categories, and audio reminders.
        </p>
      </div>

      {/* USER ACCOUNT & SECURITY */}
      {currentUser && (
        <section className="bg-white rounded-lg border border-[#E8E8E4] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-5">
          <div className="border-b border-[#F0F0EC] pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#1C1D1F] uppercase tracking-wide flex items-center gap-2">
                <User className="w-4 h-4 text-[#1C1D1F]" />
                <span>MY ACCOUNT PROFILE</span>
              </h2>
              <p className="text-xs text-[#71717A]">
                Your personal identity and secure credentials in FOCUS OS.
              </p>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                currentUser.role === 'admin'
                  ? 'bg-[#1C1D1F] text-white'
                  : 'bg-[#F2F2ED] text-[#52525B]'
              }`}
            >
              {currentUser.role}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded bg-[#FBFBFA] border border-[#EBEBE8]">
              <span className="text-[10px] uppercase font-semibold text-[#71717A] block">
                Full Name
              </span>
              <span className="text-sm font-semibold text-[#1C1D1F]">
                {currentUser.name}
              </span>
            </div>

            <div className="p-3 rounded bg-[#FBFBFA] border border-[#EBEBE8]">
              <span className="text-[10px] uppercase font-semibold text-[#71717A] block">
                Email Address
              </span>
              <span className="text-sm font-semibold text-[#1C1D1F] font-mono truncate block">
                {currentUser.email}
              </span>
            </div>

            <div className="p-3 rounded bg-[#FBFBFA] border border-[#EBEBE8]">
              <span className="text-[10px] uppercase font-semibold text-[#71717A] block">
                Status
              </span>
              <span className="text-sm font-semibold text-emerald-700 capitalize flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                {currentUser.status}
              </span>
            </div>
          </div>

          {/* Change Password Form */}
          <div className="pt-2 border-t border-[#F0F0EC]">
            <h3 className="text-xs font-bold text-[#1C1D1F] uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#1C1D1F]" />
              <span>Change Password</span>
            </h3>

            {pwMessage && (
              <div
                className={`mb-3 p-2.5 rounded text-xs flex items-center gap-2 border ${
                  pwMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {pwMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{pwMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#71717A] mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71717A] mb-1">
                  New Password (min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {pwLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* SECTION 11: MY CATEGORIES */}
      <section className="bg-white rounded-lg border border-[#E8E8E4] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="border-b border-[#F0F0EC] pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#1C1D1F] uppercase tracking-wide flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#1C1D1F]" />
              <span>MY CATEGORIES</span>
            </h2>
            <p className="text-xs text-[#71717A]">
              Keep categories simple. Add, customize, or remove tags to categorize your activities.
            </p>
          </div>
        </div>

        {/* Existing Categories or Empty State */}
        {categories.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#71717A] border border-dashed border-[#E8E8E4] rounded-lg">
            No custom categories yet. Add one below to organize your activities.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2.5 rounded bg-[#FBFBFA] border border-[#E8E8E4]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-xs font-semibold text-[#1C1D1F]">
                    {cat.name}
                  </span>
                </div>
                <button
                  onClick={() => onDeleteCategory(cat.id)}
                  className="text-[#A1A1AA] hover:text-rose-600 p-1 cursor-pointer"
                  title="Delete category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Category Form */}
        <form onSubmit={handleAddCategorySubmit} className="pt-2 flex items-center gap-2">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New category name (e.g. Deep Work, Strategy, Health)..."
            className="flex-1 text-xs p-2 rounded border border-[#E0E0DC] bg-[#FBFBFA] focus:bg-white focus:outline-none"
          />
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            className="w-8 h-8 p-0 border border-[#E0E0DC] rounded cursor-pointer"
            title="Pick accent color"
          />
          <button
            type="submit"
            className="px-3.5 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>
      </section>

      {/* SECTION 4: REMINDER ALERTS */}
      <section className="bg-white rounded-lg border border-[#E8E8E4] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="border-b border-[#F0F0EC] pb-3">
          <h2 className="text-sm font-bold text-[#1C1D1F] uppercase tracking-wide flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#1C1D1F]" />
            <span>REMINDERS & AUDIO NOTIFICATIONS</span>
          </h2>
          <p className="text-xs text-[#71717A]">
            When you schedule an activity, FOCUS OS alerts you at your chosen interval.
          </p>
        </div>

        <div className="flex items-center justify-between p-3 rounded bg-[#FBFBFA] border border-[#EBEBE8]">
          <div>
            <span className="text-xs font-semibold text-[#1C1D1F] block">
              Audio Alert Chime
            </span>
            <span className="text-[11px] text-[#71717A]">
              Subtle, pleasant acoustic sound when an activity is due
            </span>
          </div>

          <button
            onClick={playChime}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E0E0DC] rounded text-xs font-medium text-[#1C1D1F] hover:bg-[#F4F4F0] shadow-xs cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#52525B]" />
            <span>{testChimePlayed ? 'Played!' : 'Test Sound'}</span>
          </button>
        </div>
      </section>

      {/* PWA INSTALLATION */}
      <section className="bg-white rounded-lg border border-[#E8E8E4] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="border-b border-[#F0F0EC] pb-3">
          <h2 className="text-sm font-bold text-[#1C1D1F] uppercase tracking-wide">
            APP INSTALLATION & OFFLINE ACCESS
          </h2>
          <p className="text-xs text-[#71717A]">
            Install Focus OS as an application on your phone, tablet, or desktop computer.
          </p>
        </div>

        <PWAInstallButton variant="settings" />
      </section>

      {/* DATA RESET */}
      <section className="bg-white rounded-lg border border-[#E8E8E4] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="border-b border-[#F0F0EC] pb-3">
          <h2 className="text-sm font-bold text-[#1C1D1F] uppercase tracking-wide">
            RESET PERSONAL DATA
          </h2>
          <p className="text-xs text-[#71717A]">
            Clear all your current goals, weekly targets, activities, and historical records to start completely fresh.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div>
            <span className="text-xs font-semibold text-[#1C1D1F] block">
              Clear All My Data
            </span>
            <span className="text-[11px] text-[#71717A]">
              Empties all goals, targets, activities, and historical records from your personal account.
            </span>
          </div>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to clear all personal data? This cannot be undone.')) {
                onResetData();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear My Data</span>
          </button>
        </div>
      </section>
    </div>
  );
};
