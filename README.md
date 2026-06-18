# FTJM Chat - Cross-platform Chat Application

A modern, cross-platform chat application built with Electron, React, and Supabase.

**Status:** Development 🚀

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Start development
npm run dev
```

The dev script will:
- Build all packages
- Start React dev server (`http://localhost:5173`)
- Launch Electron app with DevTools

## Features

- 💬 Real-time messaging (1-on-1 and group chats)
- 👤 User profiles with avatar and bio
- 🔔 In-app and OS notifications
- ⌨️ Typing indicators
- 🔄 Auto-updates (electron-updater)
- 🖥️ Cross-platform (macOS, Windows, Linux)
- 🎨 Dark theme UI
- 🔐 Email + password auth (Supabase)

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Desktop:** Electron
- **Backend:** Supabase (PostgreSQL + real-time)
- **Auth:** Supabase Email/Password
- **State:** Zustand
- **Build:** npm workspaces

## Project Structure

```
ftjm-chat/
├── packages/
│   ├── web/          # React + Vite app
│   ├── main/         # Electron main process
│   └── shared/       # Shared TypeScript types
├── .env.local        # Environment variables (create this)
├── dev.sh            # Dev server startup script
└── package.json      # Workspace root
```

## Available Scripts

```bash
npm run dev           # Start dev server
npm run build         # Build all packages
npm run build:web     # Build React app only
npm run build:main    # Build Electron main only
npm run package       # Create distributable (.dmg, .exe, .AppImage)
npm run type-check    # TypeScript validation
```

## Development

See [DEV_GUIDE.md](DEV_GUIDE.md) for detailed development guide.

## Database Setup

See [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md) for Supabase schema and SQL setup.

## Environment Variables

Create `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Get these from your Supabase project dashboard → Settings → API.

## Building for Distribution

```bash
# macOS
npm run package:mac   # Creates .dmg, .zip

# Windows
npm run package:win   # Creates .exe, .msi

# Linux
npm run package:linux # Creates .AppImage, .deb

# All platforms
npm run package
```

## Troubleshooting

**"npm: command not found"**
```bash
# Install Node.js from nodejs.org or use homebrew
brew install node
```

**Port 5173 already in use**
```bash
# Kill the process
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

**Build failing**
```bash
# Clean rebuild
rm -rf node_modules packages/*/dist
npm install
npm run build
```

See [DEV_GUIDE.md](DEV_GUIDE.md) for more troubleshooting.

## Project Status
Open beta
## License

MIT

---

**Start developing:** `npm run dev`

