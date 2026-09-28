import React, { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { formatRole } from '../../lib/formatters';

export type NavTab = 'dashboard' | 'assets' | 'activities' | 'updates' | 'users';

interface AppLayoutProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: React.ReactNode;
  activeAssetId?: string | null;
}

export function AppLayout({ currentTab, onSelectTab, children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const isOfficer = user?.role === 'GOVERNMENT_OFFICER';
  const isField = user?.role === 'FIELD_USER';

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      description: 'Operations & Alerts Overview',
    },
    {
      id: 'assets' as NavTab,
      label: isField ? 'My Responsible Assets' : 'Infrastructure Assets',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      description: isField ? 'Assigned Project Lifecycles' : 'Inventory & Project Lifecycles',
    },
    {
      id: 'activities' as NavTab,
      label: 'Activities & Tasks',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      description: 'Assigned Work & Milestones',
    },
    {
      id: 'updates' as NavTab,
      label: 'Operational Updates',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      description: 'In-app Notifications Stream',
    },
    ...(isAdmin
      ? [
          {
            id: 'users' as NavTab,
            label: 'User Directory',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ),
            description: 'Staff & Role Management',
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-800">
      {/* Top National Portal Bar */}
      <header className="bg-slate-900 text-white shadow-md z-30 sticky top-0 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Portal Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
                aria-label="Toggle navigation"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex items-center gap-2.5">
                {/* Emblem / Badge */}
                <div className="w-9 h-9 rounded-md bg-gradient-to-br from-amber-600 via-orange-600 to-slate-800 flex items-center justify-center font-bold text-white shadow-inner border border-amber-400/30 text-sm">
                  🏛️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold tracking-tight text-white">
                      PM GatiShakti • InfraLifecycle
                    </span>
                    <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-800/80 text-emerald-200 border border-emerald-600/40">
                      GOV INTERNAL
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    National Infrastructure Asset Lifecycle & Inventory Management System
                  </p>
                </div>
              </div>
            </div>

            {/* User details & logout */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-100 flex items-center justify-end gap-1.5">
                  <span>{user?.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isAdmin
                        ? 'bg-purple-900 text-purple-200 border border-purple-700'
                        : isOfficer
                        ? 'bg-blue-900 text-blue-200 border border-blue-700'
                        : 'bg-emerald-900 text-emerald-200 border border-emerald-700'
                    }`}
                  >
                    {user?.role === 'ADMIN' ? 'ADMIN' : user?.role === 'GOVERNMENT_OFFICER' ? 'OFFICER' : 'FIELD'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {user?.department?.name || 'Central Administration'}
                </div>
              </div>

              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 bg-slate-800 hover:bg-rose-900 hover:text-rose-100 border border-slate-700 transition-colors"
                title="Sign out of government session"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3 space-y-1 sticky top-22">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Navigation Menu
            </div>
            {navItems.map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-semibold transition-colors text-left ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className={active ? 'text-amber-400' : 'text-slate-500'}>{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{item.label}</div>
                    <div className={`text-[10px] font-normal truncate ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-slate-100 px-3">
              <div className="rounded-md bg-slate-50 p-2.5 border border-slate-200 text-[11px] text-slate-600">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Low-Bandwidth Mode</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Optimized for state and field offices across Bharat.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex">
            <div className="w-72 bg-white h-full p-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="font-bold text-slate-900 text-sm">System Menu</span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 rounded text-slate-500 hover:bg-slate-100"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-2 mb-3 bg-slate-50 rounded border border-slate-200 text-xs">
                  <div className="font-bold text-slate-800">{user?.name}</div>
                  <div className="text-slate-500 text-[11px]">{formatRole(user?.role)}</div>
                </div>
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-semibold ${
                      currentTab === item.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={logout}
                className="w-full py-2 px-3 bg-rose-50 text-rose-700 rounded text-xs font-semibold border border-rose-200"
              >
                Sign Out
              </button>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Infrastructure Asset Lifecycle Platform (C05 Core UI)</span>
          <span>Build for Billions • Internal Operational Framework</span>
        </div>
      </footer>
    </div>
  );
}
