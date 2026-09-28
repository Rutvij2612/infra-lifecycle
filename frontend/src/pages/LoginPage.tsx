import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../features/auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(userEmail: string, userPass: string) {
    setError(null);
    setSubmitting(true);
    try {
      await login(userEmail, userPass);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please verify and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await handleLogin(email, password);
  }

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans antialiased text-slate-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        {/* Emblem & Portal Branding */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-amber-600 via-orange-600 to-slate-800 text-white shadow-lg border border-amber-400/40 text-2xl mb-3">
          🏛️
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
          PM GatiShakti • InfraLifecycle
        </h1>
        <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
          National Infrastructure Asset Lifecycle & Inventory Management System
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Internal Government Operations Gateway
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-6 px-6 sm:px-8 shadow-2xl rounded-xl border border-slate-200">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Official Email
              </label>
              <input
                type="email"
                required
                autoComplete="username"
                placeholder="name@infra.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 focus:outline-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 focus:outline-slate-900"
              />
            </div>

            {error && (
              <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-start gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-md text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-colors disabled:opacity-60 shadow-xs"
            >
              {submitting ? 'Authenticating Session...' : 'Sign In to Government Portal'}
            </button>
          </form>

          {/* 1-Click Demo Evaluation Shortcut Buttons */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center mb-2.5">
              Quick Role Test Logins (Demo Data)
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@demo.local');
                  setPassword('Demo@12345');
                  handleLogin('admin@demo.local', 'Demo@12345');
                }}
                disabled={submitting}
                className="p-2 text-left rounded border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                <div className="font-bold text-purple-900 text-[11px]">System Admin</div>
                <div className="text-[10px] text-purple-700 font-mono truncate">admin@demo.local</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('officer@demo.local');
                  setPassword('Demo@12345');
                  handleLogin('officer@demo.local', 'Demo@12345');
                }}
                disabled={submitting}
                className="p-2 text-left rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <div className="font-bold text-blue-900 text-[11px]">Govt Officer</div>
                <div className="text-[10px] text-blue-700 font-mono truncate">officer@demo.local</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('field@demo.local');
                  setPassword('Demo@12345');
                  handleLogin('field@demo.local', 'Demo@12345');
                }}
                disabled={submitting}
                className="p-2 text-left rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                <div className="font-bold text-emerald-900 text-[11px]">Field Officer 1</div>
                <div className="text-[10px] text-emerald-700 font-mono truncate">Surat Trauma Block</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('field2@demo.local');
                  setPassword('Demo@12345');
                  handleLogin('field2@demo.local', 'Demo@12345');
                }}
                disabled={submitting}
                className="p-2 text-left rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                <div className="font-bold text-emerald-900 text-[11px]">Field Officer 2</div>
                <div className="text-[10px] text-emerald-700 font-mono truncate">Ahmedabad Hospital</div>
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          Build for Billions • Low-bandwidth Optimized Infrastructure Portal
        </p>
      </div>
    </main>
  );
}
