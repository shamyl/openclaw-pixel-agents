#!/bin/bash
# OpenClaw Pixel UI Starter Script

echo "🔥 Starting OpenClaw Pixel UI..."
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the client first
echo "🏗️  Building client..."
npm run build

# Start the server
echo ""
echo "🚀 Starting server on http://localhost:3001"
echo ""
node dist/server/index.js
