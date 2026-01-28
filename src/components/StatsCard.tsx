// Stats Dashboard Component - SwiftUI-inspired

import { Users, Zap } from 'lucide-react';

interface StatsCardProps {
  totalAccounts: number;
  activeAccount: string;
  lastUpdated: string;
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
}

function StatItem({ icon, label, value, subtext }: StatItemProps) {
  return (
    <div className="swift-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-[var(--neon-lime)]/10">
          {icon}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {label}
        </span>
      </div>
      
      <div>
        <div className="text-2xl font-bold text-[var(--text-primary)]">
          {value}
        </div>
        {subtext && (
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

export function StatsCard({ totalAccounts, activeAccount, lastUpdated }: StatsCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <StatItem
        icon={<Users className="w-4 h-4 text-[var(--neon-lime)]" />}
        label="Total Accounts"
        value={totalAccounts.toString()}
      />
      
      <StatItem
        icon={<Zap className="w-4 h-4 text-[var(--neon-lime)]" />}
        label="Active Now"
        value={activeAccount}
        subtext={lastUpdated !== '-' ? `Last updated: ${lastUpdated}` : undefined}
      />
    </div>
  );
}
