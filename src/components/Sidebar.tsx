// Sidebar Navigation Component - SwiftUI-inspired

import { Users, Download, Upload, Settings, Info } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onImport: () => void;
  onExport: () => void;
  onNewLogin: () => void;
}

// Google Logo Icon Component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function MenuItem({ icon, label, active, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
        text-sm font-medium transition-all duration-200
        ${active
          ? 'bg-[var(--neon-lime)] text-[var(--surface-primary)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
        }
      `}
    >
      <span className={active ? 'text-[var(--surface-primary)]' : ''}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

interface MenuGroupProps {
  title: string;
  children: React.ReactNode;
}

function MenuGroup({ title, children }: MenuGroupProps) {
  return (
    <div className="mb-6">
      <div className="px-3 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {title}
        </span>
      </div>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

export function Sidebar({
  activeView,
  onViewChange,
  onImport,
  onExport,
  onNewLogin
}: SidebarProps) {
  return (
    <aside className="w-[260px] h-full bg-[var(--surface-secondary)]/60 backdrop-blur-xl border-r border-white/[0.06] flex flex-col">
      {/* Header */}
      <div className="p-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--neon-lime)] to-[var(--neon-purple)] flex items-center justify-center shadow-lg">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--surface-primary)]"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h1 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">
            Antigravity
          </h1>
          <p className="text-[11px] text-[var(--text-tertiary)]">Switch</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        <MenuGroup title="My Accounts">
          <MenuItem
            icon={<Users className="w-[18px] h-[18px]" />}
            label="Accounts"
            active={activeView === 'accounts'}
            onClick={() => onViewChange('accounts')}
          />
        </MenuGroup>

        <MenuGroup title="Management">
          <MenuItem
            icon={<Upload className="w-[18px] h-[18px]" />}
            label="Import JSON"
            onClick={onImport}
          />
          <MenuItem
            icon={<Download className="w-[18px] h-[18px]" />}
            label="Export JSON"
            onClick={onExport}
          />
        </MenuGroup>

        <MenuGroup title="System">
          <MenuItem
            icon={<GoogleIcon className="w-[18px] h-[18px]" />}
            label="Login with Google"
            onClick={onNewLogin}
          />
          <MenuItem
            icon={<Settings className="w-[18px] h-[18px]" />}
            label="Settings"
            active={activeView === 'settings'}
            onClick={() => onViewChange('settings')}
          />
          <MenuItem
            icon={<Info className="w-[18px] h-[18px]" />}
            label="About"
            active={activeView === 'about'}
            onClick={() => onViewChange('about')}
          />
        </MenuGroup>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02]">
          <div className="w-2 h-2 rounded-full bg-[var(--neon-lime)] animate-pulse" />
          <span className="text-[11px] text-[var(--text-secondary)]">
            Ready to switch
          </span>
        </div>
      </div>
    </aside>
  );
}
