// Sidebar Navigation Component - SwiftUI-inspired

import { Users, Download, Upload, LogIn, Settings, Info } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onImport: () => void;
  onExport: () => void;
  onNewLogin: () => void;
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
            icon={<LogIn className="w-[18px] h-[18px]" />}
            label="New Login"
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
