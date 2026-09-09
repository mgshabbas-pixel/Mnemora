import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Users,
  Database,
  FileText,
  Activity,
  Sliders,
  Search,
  RefreshCw,
  Trash2,
  KeyRound,
  UserPlus,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Server,
  Lock,
  Check,
  X,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { AdminAnalyticsData, AdminUserListItem, UserProfile } from '../types';

interface AdminViewProps {
  token: string;
  currentUser: UserProfile;
  onElevateRole?: () => void;
}

type AdminTab = 'dashboard' | 'users' | 'data' | 'reports' | 'logs' | 'settings';

interface DataSummary {
  tables: Array<{ name: string; label: string; count: number }>;
  totalRecords: number;
  dbEngine: string;
  status: string;
}

interface ReportData {
  priorityStats: Array<{ priority: string; total: number; completed: number }>;
  categoryStats: Array<{ category: string; total: number; completed: number }>;
  leaderboard: Array<{
    id: string;
    name: string;
    email: string;
    total: number;
    completed: number;
    rate: number;
    onTimeRate: number;
  }>;
  generatedAt: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  event: string;
  user_email: string;
  level: 'info' | 'warn' | 'error';
  details?: string;
}

export const AdminView: React.FC<AdminViewProps> = ({
  token,
  currentUser,
  onElevateRole,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Elevation state if user is not admin
  const isUserAdmin = currentUser.role === 'admin';

  // Dashboard & Users state
  const [analytics, setAnalytics] = useState<AdminAnalyticsData | null>(null);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'deactivated'>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'user'>('all');

  // Modals
  const [resetModalUser, setResetModalUser] = useState<AdminUserListItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');

  // Data Management state
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);

  // Reports state
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // Logs state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logLevel, setLogLevel] = useState<string>('all');

  // Settings state
  const [appSettings, setAppSettings] = useState<Record<string, string>>({
    registration_mode: 'open',
    session_duration_days: '30',
    week_start_day: 'monday',
    maintenance_mode: 'disabled',
    activity_reminder_default: '15_min',
  });
  const [envInfo, setEnvInfo] = useState<any>(null);

  // Load all initial admin data
  const loadAdminData = async () => {
    if (!isUserAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Load analytics & users
      const [analyticsRes, usersRes, dataSummaryRes] = await Promise.all([
        fetch('/api/admin/analytics', { headers }),
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/data-summary', { headers }),
      ]);

      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData.users || []);
      }
      if (dataSummaryRes.ok) {
        setDataSummary(await dataSummaryRes.json());
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to connect to admin services.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [token, currentUser.role]);

  // Load specific tab data on demand
  useEffect(() => {
    if (!isUserAdmin) return;
    const headers = { Authorization: `Bearer ${token}` };

    if (activeTab === 'reports') {
      fetch('/api/admin/reports', { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && setReportData(data))
        .catch(() => {});
    } else if (activeTab === 'logs') {
      fetch(`/api/admin/logs?level=${logLevel}&query=${encodeURIComponent(logSearch)}`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && setLogs(data.logs || []))
        .catch(() => {});
    } else if (activeTab === 'settings') {
      fetch('/api/admin/settings', { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setAppSettings(data.settings || {});
            setEnvInfo(data.environment || {});
          }
        })
        .catch(() => {});
    } else if (activeTab === 'data') {
      fetch('/api/admin/data-summary', { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && setDataSummary(data))
        .catch(() => {});
    }
  }, [activeTab, logLevel, logSearch, isUserAdmin]);

  // Self Elevation handler
  const handleElevateSelf = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/elevate-me', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to elevate privileges');
      }

      setMessage({ text: 'Administrative access granted successfully.', type: 'success' });
      if (onElevateRole) {
        onElevateRole();
      }
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // User Management Actions
  const handleToggleStatus = async (user: AdminUserListItem) => {
    if (user.id === currentUser.id) {
      setMessage({ text: 'You cannot deactivate your own account.', type: 'error' });
      return;
    }

    const nextStatus = user.status === 'active' ? 'deactivated' : 'active';
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update user status');
      }

      setMessage({ text: `User ${user.email} updated to ${nextStatus}.`, type: 'success' });
      loadAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleToggleRole = async (user: AdminUserListItem) => {
    if (user.id === currentUser.id) {
      setMessage({ text: 'You cannot modify your own administrative role.', type: 'error' });
      return;
    }

    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update user role');
      }

      setMessage({ text: `User ${user.email} role changed to ${nextRole}.`, type: 'success' });
      loadAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newPassword) return;

    try {
      const res = await fetch(`/api/admin/users/${resetModalUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to reset user password');
      }

      setMessage({ text: `Password successfully updated for ${resetModalUser.email}.`, type: 'success' });
      setResetModalUser(null);
      setNewPassword('');
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create user');
      }

      setMessage({ text: `Account for ${newUserEmail} created successfully.`, type: 'success' });
      setIsAddUserOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      loadAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user: AdminUserListItem) => {
    if (user.id === currentUser.id) {
      setMessage({ text: 'You cannot delete your own account.', type: 'error' });
      return;
    }

    if (!window.confirm(`Permanently delete ${user.name} (${user.email}) and all related records?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete user');
      }

      setMessage({ text: `User ${user.email} removed permanently.`, type: 'success' });
      loadAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  // Data Operations
  const handleExportBackup = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/export-backup', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Backup generation failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FOCUS_OS_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage({ text: 'Database backup downloaded successfully.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleVacuumDatabase = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/vacuum', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Maintenance operation failed');
      const data = await res.json();
      setMessage({ text: data.message || 'Database optimized successfully.', type: 'success' });
      loadAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: appSettings }),
      });

      if (!res.ok) throw new Error('Failed to update system settings');
      setMessage({ text: 'System settings updated successfully.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Clear Audit Logs
  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear the audit logs?')) return;
    try {
      const res = await fetch('/api/admin/logs', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to clear logs');
      setMessage({ text: 'Audit logs cleared.', type: 'success' });
      setLogs([]);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  // Export CSV Report
  const handleExportReportCSV = () => {
    if (!reportData) return;
    let csv = 'Leaderboard Summary\nName,Email,Planned Activities,Completed Activities,Execution Rate,On-Time Rate\n';
    reportData.leaderboard.forEach((u) => {
      csv += `"${u.name}","${u.email}",${u.total},${u.completed},${u.rate}%,${u.onTimeRate}%\n`;
    });
    csv += '\nPriority Execution\nPriority,Total,Completed,Completion Rate\n';
    reportData.priorityStats.forEach((p) => {
      const rate = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
      csv += `"${p.priority.toUpperCase()}",${p.total},${p.completed},${rate}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FOCUS_OS_Execution_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUserQuery.toLowerCase());
    const matchesStatus = userStatusFilter === 'all' || u.status === userStatusFilter;
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  // Non-admin Elevation Prompt Screen
  if (!isUserAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="p-8 rounded-2xl bg-white border border-[#E5E5E5] shadow-xs text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#0C0D10] text-white flex items-center justify-center mx-auto mb-5 shadow-sm">
            <Shield className="w-8 h-8 text-[#EA580C]" />
          </div>

          <h2 className="text-2xl font-black text-[#0C0D10] tracking-tight mb-2">
            Administrator Access Verification
          </h2>

          <p className="text-sm text-[#71717A] max-w-lg mx-auto mb-6 leading-relaxed">
            You are currently signed in as{' '}
            <span className="font-bold text-[#0C0D10]">{currentUser.email}</span> with standard{' '}
            <span className="font-bold uppercase tracking-wider text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-800">
              {currentUser.role}
            </span>{' '}
            permissions. Full administrator privileges are required to access this portal.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleElevateSelf}
              disabled={actionLoading}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{actionLoading ? 'Promoting...' : 'Elevate Account to Administrator'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-[#0C0D10]">
              Administration & System Control
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-[#16A34A]/15 text-[#16A34A] border border-[#16A34A]/30">
              Live Control
            </span>
          </div>
          <p className="text-xs text-[#71717A] mt-1 font-medium">
            Manage users, data integrity, executive execution reports, audit logs, and system operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAdminData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-[#E5E5E5] text-xs font-semibold text-[#0C0D10] hover:bg-[#F4F4F5] transition-colors cursor-pointer"
            title="Refresh administrative metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#16A34A]' : 'text-[#71717A]'}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportBackup}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0C0D10] hover:bg-[#27272A] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Export Backup</span>
          </button>
        </div>
      </div>

      {/* Global Notifications */}
      {message && (
        <div
          className={`p-3.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-orange-50 text-orange-900 border border-orange-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#EA580C]" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="p-1 rounded hover:bg-black/5 text-[#71717A] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary Sub-Navigation Tab Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#E5E5E5]">
        {[
          { id: 'dashboard' as AdminTab, label: 'Admin Dashboard', icon: TrendingUp },
          { id: 'users' as AdminTab, label: 'User Management', icon: Users, badge: users.length },
          { id: 'data' as AdminTab, label: 'Data Management', icon: Database },
          { id: 'reports' as AdminTab, label: 'Reports', icon: FileText },
          { id: 'logs' as AdminTab, label: 'Activity/Logs', icon: Activity },
          { id: 'settings' as AdminTab, label: 'Application Settings', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#0C0D10] text-white shadow-xs'
                  : 'text-[#71717A] hover:text-[#0C0D10] hover:bg-[#F4F4F5]'
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 ${
                  isActive ? 'text-[#16A34A]' : 'text-[#71717A]'
                }`}
              />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#E5E5E5] text-[#0C0D10]'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ADMIN DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Executive Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white border border-[#E5E5E5] shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#71717A]">
                <span>Registered Users</span>
                <Users className="w-4 h-4 text-[#0C0D10]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#0C0D10] font-mono">
                  {analytics?.totalUsers ?? '—'}
                </span>
                <span className="text-xs font-bold text-[#16A34A]">
                  {analytics?.activeUsers ?? 0} active
                </span>
              </div>
              <div className="mt-2 text-[11px] text-[#71717A]">
                {analytics?.inactiveUsers ?? 0} deactivated
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#E5E5E5] shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#71717A]">
                <span>Activities Executed</span>
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#0C0D10] font-mono">
                  {analytics?.totalActivitiesCompleted ?? '—'}
                </span>
                <span className="text-xs text-[#71717A]">
                  of {analytics?.totalActivitiesCreated ?? 0} total
                </span>
              </div>
              <div className="mt-2 text-[11px] text-[#71717A]">
                Tasks across all users
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#E5E5E5] shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#71717A]">
                <span>Platform Execution Rate</span>
                <TrendingUp className="w-4 h-4 text-[#16A34A]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#0C0D10] font-mono">
                  {analytics?.averageCompletionRate ?? 0}%
                </span>
                <span className="text-xs font-bold text-[#16A34A]">Target 80%+</span>
              </div>
              <div className="w-full bg-[#F4F4F5] h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-[#16A34A] rounded-full transition-all duration-700"
                  style={{ width: `${analytics?.averageCompletionRate ?? 0}%` }}
                />
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#0C0D10] text-white border border-[#27272A] shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
                <span>System Status</span>
                <Server className="w-4 h-4 text-[#16A34A]" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
                <span className="text-lg font-black tracking-tight text-white">
                  Healthy & Operational
                </span>
              </div>
              <div className="mt-2 text-[11px] text-[#A1A1AA] flex items-center justify-between">
                <span>SQLite WAL Engine</span>
                <span className="text-white font-mono font-bold">Port 3000</span>
              </div>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="p-5 rounded-xl bg-white border border-[#E5E5E5] shadow-xs">
            <h3 className="text-sm font-black text-[#0C0D10] uppercase tracking-wider mb-3">
              Administrative Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={() => {
                  setActiveTab('users');
                  setIsAddUserOpen(true);
                }}
                className="p-3.5 rounded-lg border border-[#E5E5E5] hover:border-[#16A34A] bg-[#FAFAFA] hover:bg-white text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="w-4 h-4 text-[#16A34A]" />
                  <span className="text-xs font-bold text-[#0C0D10]">Add User Account</span>
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Create an employee or manager login.
                </p>
              </button>

              <button
                onClick={handleExportBackup}
                className="p-3.5 rounded-lg border border-[#E5E5E5] hover:border-[#0C0D10] bg-[#FAFAFA] hover:bg-white text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Download className="w-4 h-4 text-[#0C0D10]" />
                  <span className="text-xs font-bold text-[#0C0D10]">Download JSON Backup</span>
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Full snapshot of all database entities.
                </p>
              </button>

              <button
                onClick={handleVacuumDatabase}
                className="p-3.5 rounded-lg border border-[#E5E5E5] hover:border-[#EA580C] bg-[#FAFAFA] hover:bg-white text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="w-4 h-4 text-[#EA580C]" />
                  <span className="text-xs font-bold text-[#0C0D10]">Prune Stale Sessions</span>
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Optimize SQLite storage and vacuum.
                </p>
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className="p-3.5 rounded-lg border border-[#E5E5E5] hover:border-[#16A34A] bg-[#FAFAFA] hover:bg-white text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileSpreadsheet className="w-4 h-4 text-[#16A34A]" />
                  <span className="text-xs font-bold text-[#0C0D10]">View Execution Report</span>
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Aggregated team performance data.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#FAFAFA] border border-[#E5E5E5] text-xs text-[#0C0D10] focus:outline-none focus:border-[#16A34A]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status filter */}
              <select
                value={userStatusFilter}
                onChange={(e: any) => setUserStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white border border-[#E5E5E5] text-xs font-semibold text-[#0C0D10] focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="deactivated">Deactivated Only</option>
              </select>

              {/* Role filter */}
              <select
                value={userRoleFilter}
                onChange={(e: any) => setUserRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white border border-[#E5E5E5] text-xs font-semibold text-[#0C0D10] focus:outline-none"
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="user">Standard Users</option>
              </select>

              {/* Add User Button */}
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add User</span>
              </button>
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E5E5E5] text-[#71717A] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Planned Activities</th>
                    <th className="px-4 py-3">Execution Rate</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#71717A]">
                        No user accounts match your search filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-[#0C0D10]">{u.name}</div>
                          <div className="text-[11px] text-[#71717A] font-mono">{u.email}</div>
                        </td>

                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => handleToggleRole(u)}
                            disabled={u.id === currentUser.id}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold transition-colors ${
                              u.role === 'admin'
                                ? 'bg-[#EA580C] text-white'
                                : 'bg-[#F4F4F5] text-[#0C0D10] hover:bg-[#E5E5E5]'
                            } ${u.id === currentUser.id ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                            title={u.id === currentUser.id ? 'Self' : 'Click to toggle user/admin role'}
                          >
                            {u.role}
                          </button>
                        </td>

                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={u.id === currentUser.id || u.email === 'mgshabbas@gmail.com'}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                              u.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            } ${
                              u.id === currentUser.id || u.email === 'mgshabbas@gmail.com'
                                ? 'cursor-not-allowed opacity-90'
                                : 'cursor-pointer'
                            }`}
                            title="Click to toggle active / deactivated status"
                          >
                            {u.status}
                          </button>
                        </td>

                        <td className="px-4 py-3.5 font-mono">
                          <span className="font-bold text-[#0C0D10]">{u.completedActivityCount}</span>
                          <span className="text-[#71717A]"> / {u.activityCount}</span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono font-bold ${
                                u.completionRate >= 70
                                  ? 'text-[#16A34A]'
                                  : u.completionRate > 0
                                  ? 'text-[#EA580C]'
                                  : 'text-[#71717A]'
                              }`}
                            >
                              {u.completionRate}%
                            </span>
                            <div className="w-16 bg-[#F4F4F5] h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  u.completionRate >= 70 ? 'bg-[#16A34A]' : 'bg-[#EA580C]'
                                }`}
                                style={{ width: `${u.completionRate}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setResetModalUser(u)}
                              className="p-1.5 rounded text-[#71717A] hover:text-[#0C0D10] hover:bg-[#F4F4F5] cursor-pointer"
                              title="Reset Password"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            {u.id !== currentUser.id && u.email !== 'mgshabbas@gmail.com' && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 rounded text-[#71717A] hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DATA MANAGEMENT */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Database Inventory */}
            <div className="p-5 rounded-xl bg-white border border-[#E5E5E5] shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E5E5E5]">
                <div>
                  <h3 className="text-sm font-black text-[#0C0D10] uppercase tracking-wider">
                    Database Schema & Records
                  </h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Engine: <span className="font-mono text-[#0C0D10] font-bold">SQLite 3 (WAL Mode)</span>
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs text-[#71717A] block">Total Records</span>
                  <span className="text-lg font-black text-[#0C0D10]">
                    {dataSummary?.totalRecords ?? '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                {dataSummary?.tables.map((t) => (
                  <div
                    key={t.name}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFAFA] border border-[#F4F4F5] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-[#16A34A]" />
                      <span className="font-semibold text-[#0C0D10]">{t.label}</span>
                      <span className="text-[10px] text-[#71717A] font-mono">({t.name})</span>
                    </div>
                    <span className="font-mono font-bold text-[#0C0D10]">{t.count} records</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Operations */}
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-white border border-[#E5E5E5] shadow-xs">
                <h3 className="text-sm font-black text-[#0C0D10] uppercase tracking-wider mb-2">
                  Complete Data Backup
                </h3>
                <p className="text-xs text-[#71717A] mb-4 leading-relaxed">
                  Export the entire system state, users, activities, goals, and history as a structured JSON file for disaster recovery or offline archiving.
                </p>
                <button
                  onClick={handleExportBackup}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0C0D10] hover:bg-[#27272A] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#16A34A]" />
                  <span>Download Full JSON Backup</span>
                </button>
              </div>

              <div className="p-5 rounded-xl bg-white border border-[#E5E5E5] shadow-xs">
                <h3 className="text-sm font-black text-[#0C0D10] uppercase tracking-wider mb-2">
                  Database Optimization & Pruning
                </h3>
                <p className="text-xs text-[#71717A] mb-4 leading-relaxed">
                  Purge expired authentication session tokens, perform SQLite index analysis, and optimize disk footprint.
                </p>
                <button
                  onClick={handleVacuumDatabase}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#FAFAFA] hover:bg-[#F4F4F5] border border-[#E5E5E5] text-[#0C0D10] text-xs font-bold transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-[#EA580C]" />
                  <span>Optimize Database & Prune Sessions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-xs">
            <div>
              <h3 className="text-sm font-black text-[#0C0D10] uppercase tracking-wider">
                Platform Execution Report
              </h3>
              <p className="text-xs text-[#71717A]">
                Generated on {new Date().toLocaleDateString()}
              </p>
            </div>

            <button
              onClick={handleExportReportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV Report</span>
            </button>
          </div>

          {/* Priority Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportData?.priorityStats.map((p) => {
              const rate = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
              const isHigh = p.priority === 'high';
              return (
                <div
                  key={p.priority}
                  className={`p-5 rounded-xl border bg-white shadow-xs ${
                    isHigh ? 'border-l-4 border-l-[#EA580C] border-[#E5E5E5]' : 'border-[#E5E5E5]'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
                    {p.priority} Priority Execution
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-[#0C0D10] font-mono">
                      {rate}%
                    </span>
                    <span className="text-xs text-[#71717A] font-mono">
                      {p.completed} / {p.total} done
                    </span>
                  </div>
                  <div className="w-full bg-[#F4F4F5] h-1.5 rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${rate >= 70 ? 'bg-[#16A34A]' : 'bg-[#EA580C]'}`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* User Productivity Leaderboard */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E5E5E5]">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#0C0D10]">
                User Execution Leaderboard
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E5E5E5] text-[#71717A] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Team Member</th>
                    <th className="px-4 py-3">Planned Activities</th>
                    <th className="px-4 py-3">Completed</th>
                    <th className="px-4 py-3">Completion Rate</th>
                    <th className="px-4 py-3">On-Time Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {reportData?.leaderboard.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-[#0C0D10] text-white flex items-center justify-center font-mono text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-[#0C0D10]">{m.name}</span>
                            <span className="text-[10px] text-[#71717A] block font-mono">
                              {m.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[#71717A]">{m.total}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-[#0C0D10]">{m.completed}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-[#16A34A]">{m.rate}%</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-[#EA580C]">{m.onTimeRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ACTIVITY/LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter logs by event, user, or details..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#FAFAFA] border border-[#E5E5E5] text-xs text-[#0C0D10] focus:outline-none focus:border-[#16A34A]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white border border-[#E5E5E5] text-xs font-semibold text-[#0C0D10] focus:outline-none"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warn">Warnings</option>
                <option value="error">Errors</option>
              </select>

              <button
                onClick={handleClearLogs}
                className="px-3 py-2 rounded-lg border border-[#E5E5E5] text-xs font-bold text-[#71717A] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                Clear Logs
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E5E5E5] text-[#71717A] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Operator</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5] font-mono">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[#71717A]">
                        No audit logs available matching this criteria.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#FAFAFA]">
                        <td className="px-4 py-3 text-[#71717A] text-[11px] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                              log.level === 'error'
                                ? 'bg-red-100 text-red-800'
                                : log.level === 'warn'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {log.level}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-[#0C0D10]">{log.event}</td>
                        <td className="px-4 py-3 text-[#71717A]">{log.user_email}</td>
                        <td className="px-4 py-3 text-[#0C0D10] font-sans text-xs">{log.details || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: APPLICATION SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="p-6 rounded-xl bg-white border border-[#E5E5E5] shadow-xs space-y-6">
            <h3 className="text-sm font-black text-[#0C0D10] uppercase tracking-wider border-b border-[#E5E5E5] pb-3">
              System Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div>
                <label className="block font-bold text-[#0C0D10] mb-1">
                  User Registration Mode
                </label>
                <select
                  value={appSettings.registration_mode || 'open'}
                  onChange={(e) => setAppSettings({ ...appSettings, registration_mode: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] font-semibold text-[#0C0D10]"
                >
                  <option value="open">Open (Anyone can register an account)</option>
                  <option value="invite_only">Invite Only (Admins create accounts)</option>
                </select>
                <span className="text-[11px] text-[#71717A] mt-1 block">
                  Controls whether the public registration form is active.
                </span>
              </div>

              <div>
                <label className="block font-bold text-[#0C0D10] mb-1">
                  Session Token Duration (Days)
                </label>
                <select
                  value={appSettings.session_duration_days || '30'}
                  onChange={(e) => setAppSettings({ ...appSettings, session_duration_days: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] font-semibold text-[#0C0D10]"
                >
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days (Recommended)</option>
                  <option value="90">90 Days</option>
                </select>
                <span className="text-[11px] text-[#71717A] mt-1 block">
                  Inactive sessions automatically expire after this period.
                </span>
              </div>

              <div>
                <label className="block font-bold text-[#0C0D10] mb-1">
                  Default Week Start Day
                </label>
                <select
                  value={appSettings.week_start_day || 'monday'}
                  onChange={(e) => setAppSettings({ ...appSettings, week_start_day: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] font-semibold text-[#0C0D10]"
                >
                  <option value="monday">Monday (Focus OS Standard)</option>
                  <option value="sunday">Sunday</option>
                </select>
                <span className="text-[11px] text-[#71717A] mt-1 block">
                  Determines planning boundary calculation.
                </span>
              </div>

              <div>
                <label className="block font-bold text-[#0C0D10] mb-1">
                  Maintenance Mode
                </label>
                <select
                  value={appSettings.maintenance_mode || 'disabled'}
                  onChange={(e) => setAppSettings({ ...appSettings, maintenance_mode: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] font-semibold text-[#0C0D10]"
                >
                  <option value="disabled">Disabled (Normal Operations)</option>
                  <option value="enabled">Enabled (Restricted to Administrators)</option>
                </select>
                <span className="text-[11px] text-[#71717A] mt-1 block">
                  Used when running critical system migrations.
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E5E5] flex justify-end">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Save System Settings</span>
              </button>
            </div>
          </form>

          {/* System Diagnostics */}
          {envInfo && (
            <div className="p-5 rounded-xl bg-[#0C0D10] text-white border border-[#27272A] shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA] mb-3">
                Server Environment & Diagnostics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-[#A1A1AA] text-[10px] block">Node Version</span>
                  <span className="text-white font-bold">{envInfo.nodeVersion}</span>
                </div>
                <div>
                  <span className="text-[#A1A1AA] text-[10px] block">Bound Port</span>
                  <span className="text-[#16A34A] font-bold">{envInfo.port}</span>
                </div>
                <div>
                  <span className="text-[#A1A1AA] text-[10px] block">Database Mode</span>
                  <span className="text-white font-bold">{envInfo.databaseMode}</span>
                </div>
                <div>
                  <span className="text-[#A1A1AA] text-[10px] block">Server Uptime</span>
                  <span className="text-[#EA580C] font-bold">{envInfo.uptimeSeconds}s</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetModalUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-[#E5E5E5]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-[#0C0D10] uppercase tracking-wider">
                Reset Password
              </h3>
              <button
                onClick={() => setResetModalUser(null)}
                className="p-1 rounded hover:bg-[#F4F4F5] text-[#71717A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#71717A] mb-4">
              Assign a new temporary password for{' '}
              <span className="font-bold text-[#0C0D10]">{resetModalUser.email}</span>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0C0D10] mb-1">
                  New Password (min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full p-2.5 rounded-lg border border-[#E5E5E5] text-xs text-[#0C0D10] focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 rounded-lg border border-[#E5E5E5] text-xs font-bold text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold shadow-xs"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD USER */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-[#E5E5E5]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-[#0C0D10] uppercase tracking-wider">
                Create User Account
              </h3>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="p-1 rounded hover:bg-[#F4F4F5] text-[#71717A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#0C0D10] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full p-2.5 rounded-lg border border-[#E5E5E5] text-xs text-[#0C0D10] focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0C0D10] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full p-2.5 rounded-lg border border-[#E5E5E5] text-xs text-[#0C0D10] focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0C0D10] mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full p-2.5 rounded-lg border border-[#E5E5E5] text-xs text-[#0C0D10] focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0C0D10] mb-1">System Role</label>
                <select
                  value={newUserRole}
                  onChange={(e: any) => setNewUserRole(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] text-xs font-semibold text-[#0C0D10]"
                >
                  <option value="user">Standard User</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E5E5E5] text-xs font-bold text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
