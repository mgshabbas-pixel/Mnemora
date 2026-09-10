import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { safeApiRequest } from '../utils/apiClient';

interface AuthViewProps {
  onAuthSuccess: (token: string, user: UserProfile) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (mode === 'login') {
        const result = await safeApiRequest<{ token: string; user: UserProfile }>(
          '/api/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email: cleanEmail, password }),
          }
        );

        if (!result.ok || !result.data) {
          throw new Error(result.error || 'Invalid email or password.');
        }

        onAuthSuccess(result.data.token, result.data.user);
      } else if (mode === 'register') {
        const result = await safeApiRequest<{ token: string; user: UserProfile }>(
          '/api/auth/register',
          {
            method: 'POST',
            body: JSON.stringify({ name: name.trim(), email: cleanEmail, password }),
          }
        );

        if (!result.ok || !result.data) {
          throw new Error(result.error || 'Failed to create account.');
        }

        onAuthSuccess(result.data.token, result.data.user);
      } else if (mode === 'reset') {
        const result = await safeApiRequest(
          '/api/auth/reset-password',
          {
            method: 'POST',
            body: JSON.stringify({ email: cleanEmail, newPassword: password }),
          }
        );

        if (!result.ok) {
          throw new Error(result.error || 'Failed to reset password.');
        }

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
                type={isPasswordVisible ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-9 py-2 text-xs rounded border border-[#DCDCD8] focus:border-[#1C1D1F] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                title={isPasswordVisible ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#A1A1AA] hover:text-[#1C1D1F] transition-colors cursor-pointer"
              >
                {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
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
      </div>

      {/* Security Statement */}
      <p className="text-[11px] text-[#A1A1AA] text-center mt-6 max-w-sm">
        Strict data separation. Every personal record belongs solely to your authenticated ID. Passwords salted and scrypt-hashed.
      </p>
    </div>
  );
};
