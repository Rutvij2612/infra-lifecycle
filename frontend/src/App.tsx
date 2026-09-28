import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import LoginPage from './pages/LoginPage';
import { AppLayout, type NavTab } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { AssetsPage } from './pages/AssetsPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { UpdatesPage } from './pages/UpdatesPage';
import { UsersPage } from './pages/UsersPage';

function AuthenticatedApp() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Hash-based routing synchronization
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      if (hash.startsWith('assets/')) {
        const id = hash.split('/')[1];
        setSelectedAssetId(id);
        setCurrentTab('assets');
      } else {
        setSelectedAssetId(null);
        if (['dashboard', 'assets', 'activities', 'updates', 'users'].includes(hash)) {
          setCurrentTab(hash as NavTab);
        }
      }
    }

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function navigateTab(tab: NavTab) {
    setSelectedAssetId(null);
    setCurrentTab(tab);
    window.location.hash = tab;
  }

  function openAssetDetail(assetId: string) {
    setSelectedAssetId(assetId);
    setCurrentTab('assets');
    window.location.hash = `assets/${assetId}`;
  }

  function backToAssets() {
    setSelectedAssetId(null);
    setCurrentTab('assets');
    window.location.hash = 'assets';
  }

  return (
    <AppLayout currentTab={currentTab} onSelectTab={navigateTab}>
      {selectedAssetId ? (
        <AssetDetailPage assetId={selectedAssetId} onBack={backToAssets} />
      ) : (
        <>
          {currentTab === 'dashboard' && (
            <DashboardPage onOpenAsset={openAssetDetail} onNavigateTab={navigateTab} />
          )}
          {currentTab === 'assets' && <AssetsPage onOpenAsset={openAssetDetail} />}
          {currentTab === 'activities' && <ActivitiesPage onOpenAsset={openAssetDetail} />}
          {currentTab === 'updates' && <UpdatesPage onOpenAsset={openAssetDetail} />}
          {currentTab === 'users' && user?.role === 'ADMIN' && <UsersPage />}
        </>
      )}
    </AppLayout>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-700 border-t-amber-400 rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            Initializing Session...
          </span>
        </div>
      </main>
    );
  }
  return user ? <AuthenticatedApp /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
