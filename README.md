# OpenClaw Pixel Agents UI 🔥

A web-based visualization dashboard for OpenClaw agents and sub-agents, inspired by [Pixel Agents](https://github.com/pablodelucca/pixel-agents).

OpenClaw Pixel Agents UI
<img width="967" height="564" alt="image" src="https://github.com/user-attachments/assets/401edbea-de6e-4e44-a698-6ebd61d80965" />


## Features

- 🎨 **Pixel Art Office** - Agents appear as animated pixel characters at their desks
- 📡 **Real-time Status** - Live updates via WebSocket showing what agents are doing
- 🖥️ **10 Workstations** - Office layout with desks, computers, and furniture
- 📊 **Activity Log** - Click any agent to see recent tool usage and events
- 🎯 **Status Indicators**:
  - 🟢 **Green dot** = Active (working on tasks)
  - 🟡 **Yellow dot** = Waiting (idle, waiting for input)
  - ⚫ **Gray dot** = Idle (no current activity)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/shamyl/openclaw-pixel-agents.git
cd openclaw-pixel-agents

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

Open http://localhost:3002 in your browser.

## Status Legend

| Indicator | Meaning |
|-----------|---------|
| **● Green** | Agent is active - currently processing or using tools |
| **● Yellow** | Agent is waiting - completed task, waiting for next input |
| **● Gray** | Agent is idle - no recent activity |
| **WORKING** | Animated text appears when agent is actively typing/processing |
| **IDLE** | Shows when agent is in waiting state |

## How It Works

The UI connects to OpenClaw by:

1. **Reading session files** from `~/.openclaw/agents/{agent}/sessions/`
2. **Watching trajectory files** for real-time events (tool calls, session status)
3. **Broadcasting via WebSocket** to update the browser instantly

```
OpenClaw → Trajectory Files → File Watcher → WebSocket → Browser UI
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production server
npm start
```

## Office Elements

- 🖥️ **Desks with computers** - Each agent has their own workstation
- 📚 **Bookshelves** - Office decor with colored books
- 🥤 **Vending machine** - Break room appliance
- 💧 **Water cooler** - Office amenities
- 🌿 **Plants** - Decoration in corners

## Architecture

- **Frontend**: React + TypeScript + Vite + HTML5 Canvas
- **Backend**: Node.js + Express + WebSocket (ws)
- **File Watching**: `fs.watch()` on OpenClaw trajectory files

## Session Types

The UI automatically detects:
- **Discord channels** - Shows as "Discord #channel-name"
- **WhatsApp chats** - Shows as "WhatsApp direct"
- **Other channels** - Shows platform and context

## Credits

- Inspired by: [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents)
- Built for: [OpenClaw](https://github.com/openclaw/openclaw)
- License: MIT
