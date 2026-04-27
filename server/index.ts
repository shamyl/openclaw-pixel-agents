import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

const __dirname = path.dirname(process.argv[1]);

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
  trajectoryFile?: string;
  filePosition: number;
  isWatching: boolean;
  channel: string;
  context: string;
  recentActivities: ActivityEvent[];
}

interface ActivityEvent {
  type: 'tool' | 'status' | 'message';
  description: string;
  timestamp: number;
}

interface ClientMessage {
  type: string;
  [key: string]: unknown;
}

// State
const agents = new Map<string, AgentState>();
const clients = new Set<WebSocket>();
const fileWatchers = new Map<string, fs.FSWatcher>();
let pollInterval: NodeJS.Timeout | null = null;

// OpenClaw paths
const HOME = process.env.HOME || '/home/shamyl';
const OPENCLAW_AGENTS_DIR = path.join(HOME, '.openclaw', 'agents');

// Broadcast to all connected clients
function broadcast(message: Record<string, unknown>): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Add activity to agent's log
function addActivity(agent: AgentState, type: ActivityEvent['type'], description: string): void {
  const activity: ActivityEvent = {
    type,
    description,
    timestamp: Date.now(),
  };
  agent.recentActivities.unshift(activity);
  // Keep only last 10 activities
  if (agent.recentActivities.length > 10) {
    agent.recentActivities.pop();
  }
  
  // Broadcast activity update
  broadcast({
    type: 'agentActivity',
    id: agent.id,
    activities: agent.recentActivities,
  });
}

// Parse trajectory file for events
async function parseTrajectoryFile(filePath: string, agent: AgentState): Promise<void> {
  try {
    const stats = fs.statSync(filePath);
    const currentSize = stats.size;
    
    if (agent.filePosition >= currentSize) {
      return; // No new data
    }

    const stream = fs.createReadStream(filePath, {
      start: agent.filePosition,
      encoding: 'utf-8'
    });

    const rl = readline.createInterface({ input: stream });

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const record = JSON.parse(line);
        
        // Look for different event types in OpenClaw trajectory
        if (record.type === 'session.started') {
          agent.status = 'active';
          agent.lastActivity = Date.now();
          addActivity(agent, 'status', 'Session started');
          
          broadcast({
            type: 'agentStatus',
            id: agent.id,
            status: 'active',
          });
        }
        else if (record.type === 'session.ended') {
          agent.status = 'waiting';
          agent.currentTool = undefined;
          agent.toolStatus = undefined;
          addActivity(agent, 'status', `Session ended (${record.data?.status || 'unknown'})`);
          
          broadcast({
            type: 'agentStatus',
            id: agent.id,
            status: 'waiting',
          });
        }
        else if (record.type === 'prompt.submitted') {
          agent.status = 'active';
          agent.currentTool = 'Thinking';
          agent.toolStatus = 'Processing prompt...';
          agent.lastActivity = Date.now();
          addActivity(agent, 'message', 'Received message');
          
          broadcast({
            type: 'agentToolStart',
            id: agent.id,
            toolId: 'thinking',
            status: 'Processing...',
            toolName: 'LLM',
          });
        }
        else if (record.type === 'model.completed') {
          agent.currentTool = undefined;
          agent.toolStatus = undefined;
          agent.status = 'waiting';
          addActivity(agent, 'message', 'Response ready');
          
          broadcast({
            type: 'agentToolDone',
            id: agent.id,
            toolId: 'thinking',
          });
          broadcast({
            type: 'agentStatus',
            id: agent.id,
            status: 'waiting',
          });
        }
        // Check for tool calls in various formats
        else if (record.type?.includes('tool') || record.data?.tool) {
          const toolName = record.data?.tool || record.tool || record.type;
          const toolInput = record.data?.input || record.input || {};
          
          agent.currentTool = toolName;
          agent.toolStatus = formatToolStatus(toolName, toolInput);
          agent.status = 'active';
          agent.lastActivity = Date.now();
          
          const description = formatToolStatus(toolName, toolInput);
          addActivity(agent, 'tool', description);

          broadcast({
            type: 'agentToolStart',
            id: agent.id,
            toolId: `${toolName}-${Date.now()}`,
            status: agent.toolStatus,
            toolName: toolName,
          });

          // Simulate tool completion after a delay
          setTimeout(() => {
            if (agent.currentTool === toolName) {
              agent.currentTool = undefined;
              agent.toolStatus = undefined;
              agent.status = 'waiting';
              
              broadcast({
                type: 'agentToolDone',
                id: agent.id,
                toolId: `${toolName}-${Date.now()}`,
              });
              
              broadcast({
                type: 'agentStatus',
                id: agent.id,
                status: 'waiting',
              });
            }
          }, 2000 + Math.random() * 3000);
        }
      } catch (e) {
        // Skip malformed lines
      }
    }

    agent.filePosition = currentSize;
  } catch (error) {
    console.error(`[Bridge] Error parsing trajectory ${filePath}:`, error);
  }
}

// Format tool status
function formatToolStatus(toolName: string, input: Record<string, unknown>): string {
  const base = (p: unknown) => (typeof p === 'string' ? path.basename(p) : '');
  
  switch (toolName.toLowerCase()) {
    case 'read':
      return `Reading ${base(input.file_path || input.path)}`;
    case 'edit':
      return `Editing ${base(input.file_path || input.path)}`;
    case 'write':
      return `Writing ${base(input.file_path || input.path)}`;
    case 'bash':
    case 'exec': {
      const cmd = (input.command as string) || '';
      return cmd.length > 40 ? `Running: ${cmd.slice(0, 40)}...` : `Running: ${cmd}`;
    }
    case 'glob':
      return 'Searching files';
    case 'grep':
      return 'Searching code';
    case 'web_fetch':
      return 'Fetching web content';
    case 'web_search':
      return 'Searching the web';
    case 'task':
    case 'agent': {
      const desc = typeof input.description === 'string' ? input.description : '';
      return desc ? `Subtask: ${desc.slice(0, 40)}${desc.length > 40 ? '...' : ''}` : 'Running subtask';
    }
    default:
      return `Using ${toolName}`;
  }
}

// Watch trajectory file
function watchTrajectoryFile(agent: AgentState): void {
  if (!agent.trajectoryFile || agent.isWatching) return;

  const watcher = fs.watch(agent.trajectoryFile, (eventType) => {
    if (eventType === 'change') {
      parseTrajectoryFile(agent.trajectoryFile!, agent);
    }
  });

  fileWatchers.set(agent.id, watcher);
  agent.isWatching = true;
  
  parseTrajectoryFile(agent.trajectoryFile, agent);
}

// Stop watching file
function stopWatchingTrajectoryFile(agentId: string): void {
  const watcher = fileWatchers.get(agentId);
  if (watcher) {
    watcher.close();
    fileWatchers.delete(agentId);
  }
}

// Parse session key
function parseSessionKey(sessionKey: string): { label: string; channel: string; context: string } {
  const parts = sessionKey.split(':');
  
  if (parts.length >= 4 && parts[0] === 'agent') {
    const agentName = parts[1];
    const channelType = parts[2];
    const channelId = parts[3];
    
    const channelNames: Record<string, string> = {
      'discord': 'Discord',
      'whatsapp': 'WhatsApp',
      'imessage': 'iMessage',
      'slack': 'Slack',
      'telegram': 'Telegram',
      'signal': 'Signal',
    };
    
    const channelName = channelNames[channelType] || channelType;
    
    const knownChannels: Record<string, string> = {
      '1498224182117269586': '#general',
      '1498283683419787434': '#ui-for-ashbot', 
      '1498280506478039150': '#dev',
      '1498282151181811823': '#testing',
      '+923333276571': 'Personal',
    };
    
    const channelLabel = knownChannels[channelId] || channelId.slice(0, 8);
    
    return {
      label: `${agentName} • ${channelName} ${channelLabel}`,
      channel: channelName,
      context: channelLabel
    };
  }
  
  return { label: sessionKey, channel: 'unknown', context: '' };
}

// Read sessions
async function readOpenClawSessions(): Promise<Array<{
  sessionKey: string;
  label: string;
  agentId: string;
  isSubagent: boolean;
  trajectoryFile?: string;
  channel: string;
  context: string;
}>> {
  const sessions: Array<{
    sessionKey: string;
    label: string;
    agentId: string;
    isSubagent: boolean;
    trajectoryFile?: string;
    channel: string;
    context: string;
  }> = [];

  try {
    if (!fs.existsSync(OPENCLAW_AGENTS_DIR)) {
      console.log(`[Bridge] OpenClaw agents dir not found: ${OPENCLAW_AGENTS_DIR}`);
      return sessions;
    }

    const agentDirs = fs.readdirSync(OPENCLAW_AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const agentId of agentDirs) {
      const sessionsDir = path.join(OPENCLAW_AGENTS_DIR, agentId, 'sessions');
      if (!fs.existsSync(sessionsDir)) continue;

      const sessionFiles = fs.readdirSync(sessionsDir)
        .filter(f => f.endsWith('.jsonl') && !f.includes('.trajectory'));

      for (const sessionFile of sessionFiles) {
        const sessionPath = path.join(sessionsDir, sessionFile);
        const trajectoryPath = sessionPath.replace('.jsonl', '.trajectory.jsonl');
        
        try {
          let sessionKey: string | undefined;
          if (fs.existsSync(trajectoryPath)) {
            const trajContent = fs.readFileSync(trajectoryPath, 'utf-8');
            const trajLines = trajContent.trim().split('\n').filter(l => l.trim());
            if (trajLines.length > 0) {
              const trajRecord = JSON.parse(trajLines[0]);
              sessionKey = trajRecord.sessionKey || trajRecord.session_key;
            }
          }
          
          if (!sessionKey) {
            sessionKey = `agent:${agentId}:session:${sessionFile.replace('.jsonl', '')}`;
          }
          
          let sessionCwd = 'Unknown';
          try {
            const content = fs.readFileSync(sessionPath, 'utf-8');
            const lines = content.trim().split('\n').filter(l => l.trim());
            if (lines.length > 0) {
              const record = JSON.parse(lines[0]);
              sessionCwd = record.cwd || 'Unknown';
            }
          } catch { /* ignore */ }
          
          const sessionInfo = parseSessionKey(sessionKey);
          
          if (sessionInfo.context === sessionInfo.channel) {
            sessionInfo.context = path.basename(sessionCwd) || 'Workspace';
          }
          
          sessions.push({
            sessionKey,
            label: sessionInfo.label,
            agentId,
            isSubagent: agentId !== 'main',
            trajectoryFile: fs.existsSync(trajectoryPath) ? trajectoryPath : undefined,
            channel: sessionInfo.channel,
            context: sessionInfo.context
          });
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

async function pollOpenClawAgents(): Promise<void> {
  try {
    const activeSessions = await readOpenClawSessions();
    const currentKeys = new Set<string>();

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
          trajectoryFile: session.trajectoryFile,
          filePosition: 0,
          isWatching: false,
          channel: session.channel,
          context: session.context,
          recentActivities: [],
        };
        
        if (session.trajectoryFile && fs.existsSync(session.trajectoryFile)) {
          const stats = fs.statSync(session.trajectoryFile);
          newAgent.filePosition = stats.size;
        }
        
        agents.set(key, newAgent);
        
        if (session.trajectoryFile) {
          watchTrajectoryFile(newAgent);
        }
        
        broadcast({
          type: 'agentCreated',
          id: key,
          label: session.label,
          folderName: session.agentId,
          channel: session.channel,
          context: session.context,
          isSubagent: session.isSubagent,
        });
        console.log(`[Bridge] New agent: ${session.label}`);
      }
    }

    for (const [key, agent] of agents) {
      if (!currentKeys.has(key)) {
        stopWatchingTrajectoryFile(key);
        agents.delete(key);
        broadcast({
          type: 'agentClosed',
          id: key,
        });
        console.log(`[Bridge] Agent removed: ${agent.label}`);
      }
    }

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
          filePosition: 0,
          isWatching: false,
          channel: 'Demo',
          context: 'Local',
          recentActivities: [
            { type: 'status', description: 'Demo agent initialized', timestamp: Date.now() }
          ],
        };
        agents.set(demoKey, demoAgent);
        broadcast({
          type: 'agentCreated',
          id: demoKey,
          label: 'Ash (Main)',
          folderName: 'main',
          channel: 'Demo',
          context: 'Local',
          isSubagent: false,
        });
        console.log(`[Bridge] Demo agent added`);
      }
    }
  } catch (error) {
    console.error('[Bridge] Error polling:', error);
  }
}

// Setup Express
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, '../client')));

app.get('/api/agents', (_req, res) => {
  res.json(Array.from(agents.values()));
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', agents: agents.size });
});

wss.on('connection', (ws) => {
  console.log('[Bridge] Client connected');
  clients.add(ws);

  for (const [id, agent] of agents) {
    ws.send(JSON.stringify({
      type: 'agentCreated',
      id,
      label: agent.label,
      folderName: agent.agentId,
      channel: agent.channel,
      context: agent.context,
      isSubagent: agent.isSubagent,
    }));
    
    if (agent.currentTool) {
      ws.send(JSON.stringify({
        type: 'agentToolStart',
        id,
        toolId: agent.currentTool,
        status: agent.toolStatus,
        toolName: agent.currentTool,
      }));
    }
    
    if (agent.recentActivities.length > 0) {
      ws.send(JSON.stringify({
        type: 'agentActivity',
        id,
        activities: agent.recentActivities,
      }));
    }
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientMessage;
      if (msg.type === 'focusAgent') {
        console.log('[Bridge] Focus:', msg.id);
      } else if (msg.type === 'closeAgent') {
        console.log('[Bridge] Close:', msg.id);
      } else if (msg.type === 'requestRefresh') {
        pollOpenClawAgents();
      }
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

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;

server.listen(PORT, () => {
  console.log(`🚀 OpenClaw Pixel UI Server running on port ${PORT}`);
  console.log(`📊 Web UI: http://localhost:${PORT}`);
  console.log(`🔍 Watching: ${OPENCLAW_AGENTS_DIR}`);

  pollOpenClawAgents();
  pollInterval = setInterval(pollOpenClawAgents, 5000);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (pollInterval) clearInterval(pollInterval);
  
  for (const [agentId, watcher] of fileWatchers) {
    watcher.close();
    console.log(`[Bridge] Stopped watching: ${agentId}`);
  }
  fileWatchers.clear();
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
