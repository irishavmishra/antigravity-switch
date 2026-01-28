// Settings View Component - SwiftUI-inspired

import { useState, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getDataDir, openUrl } from '@/lib/tauri-api';

export function SettingsView() {
  const [dataDir, setDataDir] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    loadDataDir();
  }, []);

  const loadDataDir = async () => {
    try {
      const dir = await getDataDir();
      setDataDir(dir);
    } catch (error) {
      console.error('Failed to get data directory:', error);
    }
  };

  const handleOpenDataDir = async () => {
    try {
      // Open the data directory in file explorer
      await openUrl(`file://${dataDir}`);
    } catch (error) {
      showToast('Failed to open data directory', 'error');
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        Settings
      </h2>

      <div className="space-y-6">
        {/* Data Directory */}
        <div className="swift-card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            Data Directory
          </h3>
          
          <div className="flex items-center gap-3">
            <code className="flex-1 px-4 py-3 rounded-xl bg-[var(--surface-tertiary)] text-[var(--text-secondary)] text-sm font-mono truncate">
              {dataDir}
            </code>
            <button
              onClick={handleOpenDataDir}
              className="p-3 rounded-xl bg-[var(--surface-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
              title="Open in Finder/Explorer"
            >
              <FolderOpen className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-[12px] text-[var(--text-tertiary)] mt-3">
            Your account data and tokens are stored locally in this directory.
          </p>
        </div>

        {/* About Section */}
        <div className="swift-card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            About
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--text-secondary)]">Version</span>
              <span className="text-sm text-[var(--text-primary)] font-medium">1.0.0</span>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--text-secondary)]">Built with</span>
              <span className="text-sm text-[var(--text-primary)] font-medium">Tauri + React</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
