# FTJM Chat - Development Guide

## Quick Start

### 1. First Time Setup

```bash
cd /Users/thijmen/ftjm-chat

# Ensure .env.local exists with Supabase credentials
cat .env.local
# Should contain:
# VITE_SUPABASE_URL=https://lahoorkdcopypnubnosl.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...
```

### 2. Run Dev Server

```bash
npm run dev
```

This will:
1. ✅ Build all packages (shared types, web, main)
2. ✅ Start React dev server on `http://localhost:5173`
3. ✅ Launch Electron app (with DevTools open)

### 3. Alternative: Separate Terminals

**Terminal 1 - React Dev Server:**
```bash
npm run dev:web
```
This starts Vite dev server with hot reload on port 5173.

**Terminal 2 - Electron:**
```bash
npm run build:main && npm run dev:electron
```
This starts Electron pointing to the local dev server.

---

## Build Commands

```bash
# Build everything
npm run build

# Build specific package
npm run build:web        # React app only
npm run build:main       # Electron main process
npm run build:shared     # Shared types

# Package for distribution (creates .dmg, .exe, .AppImage)
npm run package
npm run package:mac      # macOS only
npm run package:win      # Windows only
npm run package:linux    # Linux only

# Type checking
npm run type-check
```

---

## Troubleshooting

### "Build failed" or "Something doesn't look right"

1. **Clean rebuild:**
   ```bash
   rm -rf node_modules packages/*/node_modules packages/*/dist
   npm install
   npm run build
   ```

2. **Check environment variables:**
   ```bash
   cat .env.local
   # Must have:
   # VITE_SUPABASE_URL=...
   # VITE_SUPABASE_ANON_KEY=...
   ```

3. **Port conflict (5173):**
   ```bash
   # Kill process on port 5173
   lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill -9
   
   # Then try again
   npm run dev:web
   ```

4. **Electron won't start:**
   ```bash
   # Rebuild main process
   npm run build:main
   
   # Try running Electron directly
   npx electron packages/main/dist/main.js
   ```

---

## Project Structure

```
ftjm-chat/
├── packages/
│   ├── web/           # React + Vite app
│   │   ├── src/       # React components
│   │   ├── dist/      # Built output
│   │   └── package.json
│   │
│   ├── main/          # Electron main process
│   │   ├── src/       # main.ts, preload.ts
│   │   ├── dist/      # Built output
│   │   └── package.json
│   │
│   └── shared/        # Shared TypeScript types
│       ├── src/
│       └── package.json
│
├── .env.local         # ✅ Add your Supabase keys here
├── .env.example       # Template
├── dev.sh             # Dev server startup script
└── package.json       # Root workspace
```

---

## Environment Variables

**`.env.local` (create this file):**
```
VITE_SUPABASE_URL=https://lahoorkdcopypnubnosl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhaG9vcmtkY29weXBudWJub3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjIwMjcsImV4cCI6MjA5MDc5ODAyN30.mrALbqHWYCXOqFuUj80MTNg0R3zoSbYihBRbxL238EU
```

---

## Features Currently Implemented

✅ Monorepo with pnpm/npm  
✅ React + Vite (dev server on 5173)  
✅ Electron with IPC bridge  
✅ TypeScript across all packages  
✅ Tailwind CSS for styling  
✅ Zustand for state management (auth)  
✅ Supabase integration ready  
✅ Login/Signup UI  
✅ Chat UI (placeholder)  

---

## Next Steps

1. **Setup Supabase Database** (see SUPABASE_SCHEMA.md)
2. **Connect conversations** - fetch from Supabase
3. **Real-time messaging** - subscribe to messages table
4. **Notifications** - in-app and OS notifications
5. **Auto-update** - release builds to GitHub

---

## Hot Reload During Dev

- **React code changes**: Auto-reload via Vite HMR
- **Electron main changes**: Manually reload app (Cmd+R)
- **Shared types changes**: Rebuild and reload

---

## Testing Builds

```bash
# Production build
npm run build

# Test production app
npm run package
# Creates: packages/main/dist/FTJM Chat-0.1.0.dmg (macOS)
```

---

**Ready to code? Start with `npm run dev`** 🚀
