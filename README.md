# Antigravity Switch


**One-click account switcher for Antigravity AI.**  
Developer: **Rishav Mishra** (`onlyrishavmishra@gmail.com`)

## Product Description
**Antigravity Switch** is a professional-grade utility designed to streamline workflow for power users of Antigravity AI. By eliminating the manual logout/login friction, it enables seamless transitions between multiple workspaces, real-time quota monitoring across all organization tiers (including Claude Sonnet and Gemini Pro), and precise renewal tracking—all from a native, low-latency desktop interface.

## Features
- 🚀 **One-Click Switch**: Instantly swap between multiple Antigravity accounts.
- 📊 **Quota Tracking**: View "4.5 Thinking", "Claude Sonnet", and "Gemini Pro" quotas in real-time.
- ⏳ **Renewal Schedule**: Live countdown and precise renewal times (local timezone).
- 💾 **Native**: Runs as a standalone Windows App (Electron).

## How to Build (Windows)

### Option 1: GitHub Actions (Recommended)
This method avoids installing complex C++ build tools on your laptop.
1.  **Push** this code to a GitHub repository.
2.  Go to the **Actions** tab.
3.  Wait for the **Build Electron App** workflow to finish.
4.  Download the `.exe` from the **Artifacts** section.

### Option 2: Manual Build
Prerequisities: Node.js, Python, Visual Studio Build Tools (C++).

```bash
# Install dependencies
npm install

# Build the EXE
npm run dist
```


