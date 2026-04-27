# OpenClaw Pixel Agents UI 🔥

A web-based visualization dashboard for OpenClaw agents and sub-agents, inspired by [Pixel Agents](https://github.com/pablodelucca/pixel-agents).

## What is this?

This UI shows your OpenClaw agents as animated pixel art characters working in an office. Each agent gets a desk, and you can see:
- Which agents are active (typing animations)
- Which agents are waiting for user input
- What tools each agent is currently using
- Sub-agents spawned from parent sessions

![Office Screenshot](./docs/screenshot.png)

## Quick Start

```bash
cd openclaw-pixel-ui

# Install dependencies (first time only)
npm install

# Build everything
npm run build

# Start the server
npm start
```

Then open http://localhost:3001 in your browser.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Browser (UI)                         │
│  ┌─────────────────────────────────────────────────────┐      │
│  │  React + Canvas Office View                         │      │
│  │  - Pixel characters for each agent                 │      │
│  │  - Real-time status animations                      │      │
│  └─────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenClaw Agent Bridge Server                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  - Polls `openclaw subagents list`                  │  │
│  │  - Polls `openclaw sessions list`                   │  │
│  │  - Broadcasts agent state via WebSocket             │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaw Daemon                           │
└─────────────────────────────────────────────────────────────┘
```

## Development Mode

For development with hot reload:

```bash
# Terminal 1: Start the server
npm run dev:server

# Terminal 2: Start the client dev server
npm run dev:client
```

## Features

- ✅ Real-time WebSocket updates
- ✅ Visual office layout with desks, walls, decorations
- ✅ Agent status animations (idle/waiting/active)
- ✅ Tool usage indicators
- ✅ Sub-agent visualization (linked to parents)
- ✅ Click agents to focus/select
- ✅ Auto-reconnect on disconnect

## Architecture Decisions

### Why WebSocket instead of file polling?
Pixel Agents watches JSONL files. OpenClaw doesn't currently write JSONL transcripts, so we use:
1. **Polling**: `subagents list` and `sessions list` via CLI
2. **WebSocket**: Push updates to browser in real-time

### Future Improvements
1. **Hook into OpenClaw events**: If OpenClaw adds event streaming, we can replace polling
2. **Activity simulation**: Currently simulates tool activity for demo purposes
3. **Better sub-agent linking**: Parent-child relationships from session keys
4. **Persistent layouts**: Save custom office configurations
5. **Character sprites**: Replace emojis with pixel art characters

## File Structure

```
openclaw-pixel-ui/
├── server/           # Express + WebSocket server
│   └── index.ts      # Main server code
├── src/              # React frontend
│   ├── components/   # UI components
│   ├── types.ts      # TypeScript definitions
│   ├── App.tsx       # Main app
│   └── index.css     # Styles
├── dist/             # Built output
│   ├── server/       # Compiled server
│   └── client/       # Compiled client
└── README.md
```

## Technologies

- **Frontend**: React, TypeScript, Vite, Canvas API
- **Backend**: Express, WebSocket (ws), TypeScript
- **Dev Tools**: tsx, concurrently

## Credits

- Original concept: [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents)
- Built for [OpenClaw](https://github.com/openclaw/openclaw)

## License

MIT (same as Pixel Agents)
