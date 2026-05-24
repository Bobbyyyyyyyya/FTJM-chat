#!/bin/bash

echo "🚀 Starting FTJM Chat Dev Server..."
echo "Building projects..."

npm run build > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ Build complete"
echo ""
echo "Starting servers..."
echo "  📱 React dev server on http://localhost:5173"
echo "  🖥️  Electron app (starting in 5 seconds)..."
echo ""

# Start Vite in background
cd packages/web && npm run dev > /tmp/vite.log 2>&1 &
VITE_PID=$!

# Wait for Vite to start
sleep 5

# Start Electron
cd "../../"
NODE_ENV=development npx electron packages/main/dist/main.js

# Kill Vite when Electron closes
kill $VITE_PID 2>/dev/null
wait $VITE_PID 2>/dev/null
