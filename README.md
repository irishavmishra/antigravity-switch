# Antigravity Switch

A professional-grade, SwiftUI-inspired desktop application for managing and switching between multiple Antigravity AI accounts. Built with **Tauri** (Rust backend) and **React + TypeScript** (frontend).

![Design](Design.md)

## Features

- **One-Click Account Switching** - Instantly switch between Antigravity accounts without logging out
- **Real-Time Quota Tracking** - Monitor usage across all your workspaces with visual progress bars
- **Secure Token Storage** - All tokens are stored locally in your system keychain
- **Import/Export** - Backup and restore your account configurations
- **OAuth Integration** - Easy account addition via Google OAuth
- **System Tray** - Minimize to system tray for quick access

## Tech Stack

- **Backend**: Rust (Tauri)
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS with custom SwiftUI-inspired design system
- **UI Components**: shadcn/ui + Radix UI primitives
- **Icons**: Lucide React

## Design Philosophy

The UI follows **Apple's SwiftUI design principles**:
- **Soft surfaces** with layered depth
- **Subtle translucency** and backdrop blur effects
- **Calm typography** with Inter font family
- **Minimal visual noise** with high-contrast dark theme
- **Neon accent colors** (lime, purple, cyan) for key interactions

## Project Structure

```
app/
├── src/
│   ├── components/          # React components
│   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   ├── AccountCard.tsx  # Account display with quota
│   │   ├── StatsCard.tsx    # Dashboard statistics
│   │   ├── AddAccountModal.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Header.tsx
│   │   ├── SettingsView.tsx
│   │   └── AboutView.tsx
│   ├── hooks/
│   │   └── use-toast.tsx    # Toast notification system
│   ├── lib/
│   │   └── tauri-api.ts     # Tauri command wrappers
│   ├── types/
│   │   └── index.ts         # TypeScript type definitions
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles + design system
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Main Tauri application
│   │   ├── account.rs       # Account management
│   │   ├── oauth.rs         # OAuth token handling
│   │   ├── quota.rs         # Quota fetching from APIs
│   │   ├── switch.rs        # Account switching logic (FIXED)
│   │   └── db.rs            # Database utilities
│   ├── Cargo.toml           # Rust dependencies
│   └── tauri.conf.json      # Tauri configuration
├── dist/                    # Build output
└── Design.md                # Design specification
```

## Key Improvements

### Account Switch Fix
The account switching functionality has been completely rewritten with:
- Better error handling and recovery
- Proper process termination before switching
- Lock file cleanup to prevent database corruption
- Retry logic for database injection
- Graceful fallback if Antigravity restart fails

### SwiftUI-Inspired Design
- **Glass morphism** effects with backdrop blur
- **Neon glow** accents for interactive elements
- **Soft shadows** and layered depth
- **Smooth animations** for all state transitions
- **Custom scrollbar** styling
- **Grain texture** overlay for tactile feel

## Development

### Prerequisites
- Node.js 18+
- Rust 1.70+
- Tauri CLI

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run tauri dev
```

### Build for Production
```bash
npm run tauri build
```

## Configuration

### OAuth Setup
To use OAuth authentication, you need to:
1. Create a Google OAuth 2.0 client
2. Update `CLIENT_ID` and `CLIENT_SECRET` in `src-tauri/src/oauth.rs`
3. Rebuild the application

### Data Storage
Account data is stored in:
- **macOS**: `~/.antigravity-manager/accounts.json`
- **Windows**: `%USERPROFILE%\.antigravity-manager\accounts.json`
- **Linux**: `~/.antigravity-manager/accounts.json`

## License

MIT License - See LICENSE file for details.

## Credits

Built with ❤️ for Antigravity AI power users.
