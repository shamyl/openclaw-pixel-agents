import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

// Types
interface AgentState {
  id: string;
  sessionKey: string;
  label?: string;
  agentId?: string;
  runtime?: string;
  status: 'active' | 'waiting' | 'idle';
  currentTool?: string;
  toolStatus?: string;
  lastActivity: number;
  isSubagent: boolean;
  parentSessionKey?: string;
}

interface ClientMessage {
  type: string;
  [key: string]: unknown;
}

// State
const agents = new Map<string, AgentState>();
const clients = new Set<WebSocket>();
let pollInterval: NodeJS.Timeout | null = null;

// OpenClaw paths
const OPENCLAW_AGENTS_DIR = path.join(process.env.HOME || '/home/shamyl', '.openclaw', 'agents');

// Read OpenClaw sessions directly from filesystem
async function readOpenClawSessions(): Promise<Array<{
  sessionKey: string;
  label: string;
  agentId: string;
  isSubagent: boolean;
}>> {
  const sessions: Array<{
    sessionKey: string;
    label: string;
    agentId: string;
    isSubagent: boolean;
  }> = [];

  try {
    if (!fs.existsSync(OPENCLAW_AGENTS_DIR)) {
      console.log(`[Bridge] OpenClaw agents dir not found: ${OPENCLAW_AGENTS_DIR}`);
      return sessions;
    }

    // Read agent directories
    const agentDirs = fs.readdirSync(OPENCLAW_AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    console.log(`[Bridge] Found agents: ${agentDirs.join(', ')}`);

    for (const agentId of agentDirs) {
      const sessionsDir = path.join(OPENCLAW_AGENTS_DIR, agentId, 'sessions');
      if (!fs.existsSync(sessionsDir)) continue;

      // Read session files
      const sessionFiles = fs.readdirSync(sessionsDir)
        .filter(f => f.endsWith('.jsonl'));

      for (const sessionFile of sessionFiles) {
        const sessionPath = path.join(sessionsDir, sessionFile);
        try {
          // Read first line to get session info
          const content = fs.readFileSync(sessionPath, 'utf-8');
          const lines = content.trim().split('\n').filter(l => l.trim());
          
          if (lines.length > 0) {
            const firstRecord = JSON.parse(lines[0]);
            const sessionKey = firstRecord.session_key || 
                              `agent:${agentId}:session:${sessionFile.replace('.jsonl', '')}`;
            
            sessions.push({
              sessionKey,
              label: firstRecord.label || `${agentId} session`,
              agentId,
              isSubagent: agentId !== 'main'
            });
          }
        } catch (e) {
          // Skip malformed files
        }
      }
    }
  } catch (error) {
    console.error('[Bridge] Error reading sessions:', error);
  }

  return sessions;
}

// Check for active sessions by looking at file modification times
async function getActiveSessions(): Promise<Array<{
  sessionKey: string;
  label: string;
  agentId: string;
  isSubagent: boolean;
  lastActivity: number;
}>> {
  const sessions = await readOpenClawSessions();
  const now = Date.now();
  
  return sessions.map(s => ({
    ...s,
    lastActivity: now
  }));
}

async function pollOpenClawAgents(): Promise<void> {
  try {
    const activeSessions = await getActiveSessions();
    const currentKeys = new Set<string>();

    // Process sessions
    for (const session of activeSessions) {
      const key = session.sessionKey;
      currentKeys.add(key);

      if (!agents.has(key)) {
        const newAgent: AgentState = {
          id: key,
          sessionKey: key,
          label: session.label,
          agentId: session.agentId,
          status: 'idle',
          lastActivity: Date.now(),
          isSubagent: session.isSubagent,
        };
        agents.set(key, newAgent);
        broadcast({
          type: 'agentCreated',
          id: key,
          label: session.label,
          folderName: session.agentId,
          isSubagent: session.isSubagent,
        });
        console.log(`[Bridge] New agent detected: ${key} (${session.label})`);
      }
    }

    // Remove stale agents
    for (const [key, _agent] of agents) {
      if (!currentKeys.has(key)) {
        agents.delete(key);
        broadcast({
          type: 'agentClosed',
          id: key,
        });
        console.log(`[Bridge] Agent removed: ${key}`);
      }
    }

    // If no agents found, add a demo agent
    if (agents.size === 0) {
      const demoKey = 'demo-agent-1';
      if (!agents.has(demoKey)) {
        const demoAgent: AgentState = {
          id: demoKey,
          sessionKey: demoKey,
          label: 'Ash (Main)',
          agentId: 'main',
          status: 'active',
          lastActivity: Date.now(),
          isSubagent: false,
        };
        agents.set(demoKey, demoAgent);
        broadcast({
          type: 'agentCreated',
          id: demoKey,
          label: 'Ash (Main)',
          folderName: 'main',
          isSubagent: false,
        });
        console.log(`[Bridge] Added demo agent`);
      }
    }
  } catch (error) {
    console.error('[Bridge] Error polling:', error);
  }
}

function extractParentId(sessionKey: string): string | undefined {
  const parts = sessionKey.split(':');
  if (parts.length >= 2) {
    return parts.slice(0, 2).join(':');
  }
  return undefined;
}

function broadcast(message: Record<string, unknown>): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function _broadcastAgentStatuses(): void {
  for (const [id, ag] of agents) {
    broadcast({
      type: 'agentStatus',
      id,
      status: ag.status,
    });

    if (ag.currentTool) {
      broadcast({
        type: 'agentToolStart',
        id,
        toolId: ag.currentTool,
        status: ag.toolStatus || 'Working...',
        toolName: ag.currentTool,
      });
    }
  }
}

// Setup Express + WebSocket
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../client')));

// API endpoints
app.get('/api/agents', (_req, res) => {
  res.json(Array.from(agents.values()));
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', agents: agents.size });
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('[Bridge] Client connected');
  clients.add(ws);

  // Send current agents
  for (const [id, agent] of agents) {
    ws.send(JSON.stringify({
      type: 'agentCreated',
      id,
      label: agent.label,
      folderName: agent.agentId,
      isSubagent: agent.isSubagent,
    }));
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientMessage;
      handleClientMessage(ws, msg);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    console.log('[Bridge] Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    clients.delete(ws);
  });
});

function handleClientMessage(_ws: WebSocket, msg: ClientMessage): void {
  switch (msg.type) {
    case 'focusAgent': {
      const agentId = msg.id as string;
      console.log('[Bridge] Focus agent:', agentId);
      break;
    }
    case 'closeAgent': {
      const agentId = msg.id as string;
      console.log('[Bridge] Close agent:', agentId);
      break;
    }
    case 'requestRefresh': {
      pollOpenClawAgents();
      break;
    }
  }
}

// Simulate activity updates
function simulateActivity(): void {
  for (const [id, agent] of agents) {
    if (Math.random() < 0.1) {
      const tools = ['Read', 'Write', 'Bash', 'WebSearch', 'Task'];
      const tool = tools[Math.floor(Math.random() * tools.length)];
      agent.currentTool = tool;
      agent.toolStatus = `${tool}ing...`;
      agent.status = 'active';
      agent.lastActivity = Date.now();

      broadcast({
        type: 'agentToolStart',
        id,
        toolId: tool,
        status: agent.toolStatus,
        toolName: tool,
      });

      setTimeout(() => {
        agent.currentTool = undefined;
        agent.toolStatus = undefined;
        agent.status = 'waiting';
        broadcast({
          type: 'agentToolDone',
          id,
          toolId: tool,
        });
        broadcast({
          type: 'agentStatus',
          id,
          status: 'waiting',
        });
      }, 2000 + Math.random() * 3000);
    }
  }
}

// Start server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;

server.listen(PORT, () => {
  console.log(`🚀 OpenClaw Pixel UI Server running on port ${PORT}`);
  console.log(`📊 Web UI available at http://localhost:${PORT}`);

  // Initial poll
  pollOpenClawAgents();
  
  // Start polling every 5 seconds
  pollInterval = setInterval(pollOpenClawAgents, 5000);

  // Simulate activity for demo
  setInterval(simulateActivity, 5000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (pollInterval) clearInterval(pollInterval);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
