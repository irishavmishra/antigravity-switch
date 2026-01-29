// Account Card Component - SwiftUI-inspired

import { useState } from 'react';
import { Check, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import type { Account } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { switchAccount, deleteAccount } from '@/lib/tauri-api';

interface AccountCardProps {
  account: Account;
  onUpdate: () => void;
}

export function AccountCard({ account, onUpdate }: AccountCardProps) {
  const [isSwitching, setIsSwitching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  const initial = account.name?.charAt(0).toUpperCase() || account.email.charAt(0).toUpperCase();
  const isActive = account.is_active;

  const handleSwitch = async () => {
    if (isSwitching || isActive) return;

    setIsSwitching(true);
    try {
      const email = await switchAccount(account.id);
      showToast(`Switched to ${email}`, 'success');
      onUpdate();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Switch failed', 'error');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    const confirmed = await confirm(`Delete account for ${account.email}?`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteAccount(account.id);
      showToast('Account deleted', 'success');
      onUpdate();
    } catch {
      showToast('Failed to delete account', 'error');
      setIsDeleting(false);
    }
  };

  const getQuotaColor = (percentage: number) => {
    if (percentage < 30) return 'quota-low';
    if (percentage < 60) return 'quota-medium';
    return 'quota-high';
  };

  const formatResetTime = (resetTime?: string) => {
    if (!resetTime) return null;
    try {
      const date = new Date(resetTime);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const maxResetTime = account.quota?.models
    ?.map(m => m.reset_time)
    .filter(Boolean)
    .sort()
    .pop();

  const resetTimeFormatted = formatResetTime(maxResetTime);

  return (
    <div
      className={`
        swift-card overflow-hidden transition-all duration-300
        ${isActive ? 'ring-1 ring-[var(--neon-lime)]/50' : ''}
      `}
    >
      {/* Account Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div
            className={`
              w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold
              ${isActive
                ? 'bg-gradient-to-br from-[var(--neon-lime)] to-[var(--neon-cyan)] text-[var(--surface-primary)]'
                : 'bg-gradient-to-br from-[var(--neon-purple)] to-blue-500 text-white'
              }
            `}
          >
            {initial}
          </div>

          {/* Info */}
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
              {account.name}
            </h3>
            <p className="text-[13px] text-[var(--text-secondary)]">
              {account.email}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--neon-lime)]/10 text-[var(--neon-lime)] text-xs font-semibold">
              <Check className="w-3.5 h-3.5" />
              Active
            </span>
          )}

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 rounded-xl text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quota Section */}
      {account.quota?.error ? (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">
              {account.quota.error === 'forbidden' ? 'Access Denied (403)' : 'Quota Error'}
            </span>
          </div>
        </div>
      ) : account.quota?.models && account.quota.models.length > 0 ? (
        <div className="px-5 pb-4 space-y-3">
          {account.quota.models.map((model, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">
                    {model.display_name}
                  </span>
                  {model.badge && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        backgroundColor: `${model.badge.color}20`,
                        color: model.badge.color
                      }}
                    >
                      {model.badge.text}
                    </span>
                  )}
                </div>
                <span className="text-[13px] text-[var(--text-secondary)]">
                  {model.percentage}%
                </span>
              </div>

              <div className="quota-bar">
                <div
                  className={`quota-fill ${getQuotaColor(model.percentage)}`}
                  style={{ width: `${model.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Switch Button */}
      <button
        onClick={handleSwitch}
        disabled={isSwitching || isActive}
        className={`
          w-full py-3.5 px-5 flex items-center justify-center gap-2
          text-sm font-semibold transition-all duration-200
          border-t border-white/[0.06]
          ${isActive
            ? 'text-[var(--neon-lime)] cursor-default'
            : 'text-[var(--neon-lime)] hover:bg-[var(--neon-lime)]/5'
          }
        `}
      >
        {isSwitching ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Switching...
          </>
        ) : isActive ? (
          <>
            <Check className="w-4 h-4" />
            Active Account
          </>
        ) : (
          'Switch to this Account'
        )}
      </button>

      {/* Reset Time */}
      {resetTimeFormatted && (
        <div className="px-5 py-2 bg-white/[0.02] border-t border-white/[0.04]">
          <p className="text-[11px] text-[var(--text-tertiary)] text-center">
            Resets at {resetTimeFormatted}
          </p>
        </div>
      )}
    </div>
  );
}
