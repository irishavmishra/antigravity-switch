// Main App Component - Antigravity Switch

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api';
import { save, open } from '@tauri-apps/api/dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';

import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { StatsCard } from '@/components/StatsCard';
import { AccountCard } from '@/components/AccountCard';
import { EmptyState } from '@/components/EmptyState';
import { AddAccountModal } from '@/components/AddAccountModal';
import { SettingsView } from '@/components/SettingsView';
import { AboutView } from '@/components/AboutView';
import { ToastProvider, useToast } from '@/hooks/use-toast';
import { getAccounts, exportAccounts, importAccounts } from '@/lib/tauri-api';
import type { Account } from '@/types';

// Accounts View Component
function AccountsView({
  accounts,
  isRefreshing,
  onRefresh,
  onAddAccount,
  onUpdate
}: {
  accounts: Account[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onAddAccount: () => void;
  onUpdate: () => void;
}) {
  const activeAccount = accounts.find(a => a.is_active);
  const lastUpdated = activeAccount?.last_checked
    ? new Date(activeAccount.last_checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '-';

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Accounts"
        onRefresh={onRefresh}
        onAddAccount={onAddAccount}
        isRefreshing={isRefreshing}
      />

      <div className="flex-1 overflow-y-auto p-8">
        <StatsCard
          totalAccounts={accounts.length}
          activeAccount={activeAccount?.name || 'None'}
          lastUpdated={lastUpdated}
        />

        {accounts.length === 0 ? (
          <EmptyState onAddAccount={onAddAccount} />
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Main App Content
function AppContent() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeView, setActiveView] = useState('accounts');
  const { showToast } = useToast();

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await getAccounts();
      setAccounts(data);
    } catch (error) {
      showToast('Failed to load accounts', 'error');
      console.error('Failed to load accounts:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadAccounts();
      showToast('Accounts refreshed', 'success');
    } catch (error) {
      showToast('Failed to refresh accounts', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = async () => {
    try {
      const json = await exportAccounts();

      // Use Tauri dialog to save file
      const savePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: 'antigravity-accounts.json',
      });

      if (savePath) {
        await writeTextFile(savePath, json);
        showToast('Accounts exported successfully', 'success');
      }
    } catch (error) {
      showToast('Failed to export accounts', 'error');
      console.error('Export error:', error);
    }
  };

  const handleImport = async () => {
    try {
      // Use Tauri dialog to open file
      const selected = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        const content = await readTextFile(selected);
        const result = await importAccounts(content);

        showToast(
          `Imported ${result.added} accounts, updated ${result.updated}`,
          'success'
        );

        await loadAccounts();
      }
    } catch (error) {
      showToast('Failed to import accounts', 'error');
      console.error('Import error:', error);
    }
  };

  const handleNewLogin = async () => {
    try {
      showToast('Opening browser for Google OAuth...', 'info');
      const response = await invoke<{
        success: boolean;
        account: Account | null;
      }>('start_oauth_flow');

      if (response.success && response.account) {
        showToast(`Successfully added account: ${response.account.email}`, 'success');
        await loadAccounts();
      } else {
        showToast('OAuth failed or was cancelled', 'error');
      }
    } catch (error) {
      // The backend returns the error message as a string
      const errorMessage = typeof error === 'string' ? error : 'Failed to complete OAuth flow';
      
      // Check for specific known errors to provide better formatting
      if (errorMessage.includes("GOOGLE_CLIENT_ID not set")) {
        showToast('Configuration Error: Missing Google OAuth Credentials. See console for details.', 'error');
      } else {
        showToast(errorMessage, 'error');
      }
      
      console.error('OAuth error:', error);
    }
  };

  const renderView = () => {
    switch (activeView) {
      case 'accounts':
        return (
          <AccountsView
            accounts={accounts}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            onAddAccount={() => setIsAddModalOpen(true)}
            onUpdate={loadAccounts}
          />
        );
      case 'settings':
        return <SettingsView />;
      case 'about':
        return <AboutView />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[var(--surface-primary)] grain-overlay">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        onImport={handleImport}
        onExport={handleExport}
        onNewLogin={handleNewLogin}
      />

      <main className="flex-1 overflow-hidden">
        {renderView()}
      </main>

      <AddAccountModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadAccounts}
      />
    </div>
  );
}

// App with Toast Provider
function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
