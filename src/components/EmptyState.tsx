// Empty State Component - SwiftUI-inspired

import { Users } from 'lucide-react';

interface EmptyStateProps {
  onAddAccount: () => void;
}

export function EmptyState({ onAddAccount }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface-tertiary)] flex items-center justify-center mb-5">
        <Users className="w-8 h-8 text-[var(--text-tertiary)]" />
      </div>
      
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        No Accounts
      </h3>
      
      <p className="text-sm text-[var(--text-secondary)] text-center max-w-xs mb-6">
        Add an account to get started with Antigravity Switch
      </p>
      
      <button
        onClick={onAddAccount}
        className="btn-primary"
      >
        Add Your First Account
      </button>
    </div>
  );
}
