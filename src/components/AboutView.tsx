// About View Component - SwiftUI-inspired

import { Github, Twitter, Mail, Heart } from 'lucide-react';
import { openUrl } from '@/lib/tauri-api';

export function AboutView() {
  const handleOpenLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch (error) {
      console.error('Failed to open link:', error);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--neon-lime)] to-[var(--neon-purple)] flex items-center justify-center mx-auto mb-5 shadow-lg">
          <svg 
            width="40" 
            height="40" 
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
        
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Antigravity Switch
        </h2>
        
        <p className="text-[var(--text-secondary)]">
          One-click account switcher for Antigravity AI
        </p>
      </div>

      <div className="swift-card p-6 mb-6">
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
          Antigravity Switch is a professional-grade utility designed to streamline workflow 
          for power users of Antigravity AI. By eliminating the manual logout/login friction, 
          it enables seamless transitions between multiple workspaces.
        </p>
        
        <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-tertiary)]">
          <span>Made with</span>
          <Heart className="w-4 h-4 text-red-400 fill-red-400" />
          <span>for power users</span>
        </div>
      </div>

      {/* Links */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => handleOpenLink('https://github.com')}
          className="p-3 rounded-xl bg-[var(--surface-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
          title="GitHub"
        >
          <Github className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => handleOpenLink('https://twitter.com')}
          className="p-3 rounded-xl bg-[var(--surface-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
          title="Twitter"
        >
          <Twitter className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => handleOpenLink('mailto:support@antigravity.switch')}
          className="p-3 rounded-xl bg-[var(--surface-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
          title="Email"
        >
          <Mail className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
