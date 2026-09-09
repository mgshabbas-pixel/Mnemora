import React, { useState } from 'react';
import { Shield, KeyRound, User, Mail, Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';

interface AuthViewProps {
  onAuthSuccess: (token: string, user: UserProfile) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFillAdmin = () => {
    setEmail('mgshabbas@gmail.com');
    setPassword('FocusAdmin2026!');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to sign in');

        onAuthSuccess(data.token, data.user);
      } else if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create account');

        onAuthSuccess(data.token, data.user);
      } else if (mode === 'reset') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, newPassword: password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reset password');

        setSuccessMessage('Password reset successfully. You can now sign in.');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 selection:bg-[#EBEBE8]">
      {/* Brand Header */}
      <div className="text-center max-w-sm w-full mb-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#1C1D1F] text-white font-bold text-base shadow-sm mb-3">
          F
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1C1D1F]">FOCUS OS</h1>
        <p className="text-xs text-[#71717A] mt-1">
          Personal Execution & Performance System
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-white border border-[#E8E8E4] rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6 sm:p-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#EBEBE8] mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 pb-3 text-xs font-bold tracking-wider uppercase transition-colors border-b-2 text-center ${
              mode === 'login'
                ? 'border-[#1C1D1F] text-[#1C1D1F]'
                : 'border-transparent text-[#71717A] hover:text-[#1C1D1F]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 pb-3 text-xs font-bold tracking-wider uppercase transition-colors border-b-2 text-center ${
              mode === 'register'
                ? 'border-[#1C1D1F] text-[#1C1D1F]'
                : 'border-transparent text-[#71717A] hover:text-[#1C1D1F]'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('reset');
              setError(null);
            }}
            className={`flex-1 pb-3 text-xs font-bold tracking-wider uppercase transition-colors border-b-2 text-center ${
              mode === 'reset'
                ? 'border-[#1C1D1F] text-[#1C1D1F]'
                : 'border-transparent text-[#71717A] hover:text-[#1C1D1F]'
            }`}
          >
            Reset
          </button>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div className="mb-5 p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[#1C1D1F] uppercase tracking-wide mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. M. Shabbas"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded border border-[#DCDCD8] focus:border-[#1C1D1F] focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1C1D1F] uppercase tracking-wide mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs rounded border border-[#DCDCD8] focus:border-[#1C1D1F] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1C1D1F] uppercase tracking-wide mb-1">
              {mode === 'reset' ? 'New Password (min 6 chars)' : 'Password'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs rounded border border-[#DCDCD8] focus:border-[#1C1D1F] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold tracking-wide transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span>
              {loading
                ? 'Processing...'
                : mode === 'login'
                ? 'Sign In to FOCUS OS'
                : mode === 'register'
                ? 'Create New Account'
                : 'Update Password'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Administrator Quick Helper */}
        {mode === 'login' && (
          <div className="mt-6 pt-4 border-t border-[#F0F0EC] bg-[#FBFBFA] -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 p-4 rounded-b-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="text-left">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1C1D1F]">
                  <Shield className="w-3.5 h-3.5 text-[#1C1D1F]" />
                  <span>Administrator Account</span>
                </div>
                <p className="text-[11px] text-[#71717A] mt-0.5 font-mono">
                  mgshabbas@gmail.com
                </p>
              </div>
              <button
                type="button"
                onClick={handleFillAdmin}
                className="px-2.5 py-1 text-[11px] font-semibold text-[#1C1D1F] bg-white border border-[#DCDCD8] hover:border-[#1C1D1F] rounded transition-colors cursor-pointer"
              >
                Auto-fill
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Security Statement */}
      <p className="text-[11px] text-[#A1A1AA] text-center mt-6 max-w-sm">
        Strict data separation. Every personal record belongs solely to your authenticated ID. Passwords salted and scrypt-hashed.
      </p>
    </div>
  );
};
