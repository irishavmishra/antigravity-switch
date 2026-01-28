// Header Component - SwiftUI-inspired

import { RefreshCw, Plus } from 'lucide-react';

interface HeaderProps {
  title: string;
  onRefresh: () => void;
  onAddAccount: () => void;
  isRefreshing: boolean;
}

export function Header({ title, onRefresh, onAddAccount, isRefreshing }: HeaderProps) {
  return (
    <header className="flex items-center justify-between py-6 px-8 border-b border-white/[0.06] bg-[var(--surface-primary)]/80 backdrop-blur-xl sticky top-0 z-10">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
        {title}
      </h1>
      
      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2.5 rounded-xl bg-[var(--surface-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
        
        <button
          onClick={onAddAccount}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>
    </header>
  );
}
