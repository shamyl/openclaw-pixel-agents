import { useEffect, useRef, useState, useCallback } from 'react';
import { OfficeCanvas } from './components/OfficeCanvas';
import { AgentList } from './components/AgentList';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import type { Agent, OfficeConfig } from './types';

// Default office layout - similar to Pixel Agents reference
const defaultLayout: OfficeConfig = {
  rows: 14,
  cols: 24,
  floorColor: '#3d2914',
  wallColor: '#2c3e50',
  desks: [
    // Top row
    { id: 'desk1', row: 3, col: 4, type: 'computer', facing: 'south' },
    { id: 'desk2', row: 3, col: 8, type: 'computer', facing: 'south' },
    { id: 'desk3', row: 3, col: 12, type: 'computer', facing: 'south' },
    { id: 'desk4', row: 3, col: 16, type: 'computer', facing: 'south' },
    { id: 'desk5', row: 3, col: 20, type: 'computer', facing: 'south' },
    // Bottom row
    { id: 'desk6', row: 8, col: 4, type: 'computer', facing: 'north' },
    { id: 'desk7', row: 8, col: 8, type: 'computer', facing: 'north' },
    { id: 'desk8', row: 8, col: 12, type: 'computer', facing: 'north' },
    { id: 'desk9', row: 8, col: 16, type: 'computer', facing: 'north' },
    { id: 'desk10', row: 8, col: 20, type: 'computer', facing: 'north' },
  ],
  walls: [
    // Border walls
    ...Array.from({ length: 24 }, (_, i) => ({ row: 0, col: i })),
    ...Array.from({ length: 24 }, (_, i) => ({ row: 13, col: i })),
    ...Array.from({ length: 12 }, (_, i) => ({ row: i + 1, col: 0 })),
    ...Array.from({ length: 12 }, (_, i) => ({ row: i + 1, col: 23 })),
  ],
  decorations: [
    // Plants
    { row: 2, col: 2, type: 'plant' },
    { row: 2, col: 22, type: 'plant' },
    { row: 11, col: 2, type: 'plant' },
    { row: 11, col: 22, type: 'plant' },
    // Water cooler
    { row: 6, col: 2, type: 'watercooler' },
    // Printer area
    { row: 6, col: 21, type: 'printer' },
  ],
};

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sort agents by last activity (newest first) whenever agents change
  const sortedAgents = [...agents].sort((a, b) => {
    const aTime = a.lastActivity || 0;
    const bTime = b.lastActivity || 0;
    return bTime - aTime;
  });

  const connectWebSocket = useCallback(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setConnected(false);
      wsRef.current = null;
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const handleMessage = useCallback((msg: { type: string; [key: string]: unknown }) => {
    switch (msg.type) {
      case 'agentCreated': {
        const newAgent: Agent = {
          id: msg.id as string,
          label: msg.label as string | undefined,
          folderName: msg.folderName as string | undefined,
          isSubagent: msg.isSubagent as boolean | undefined,
          parentAgentId: msg.parentAgentId as string | undefined,
          channel: msg.channel as string | undefined,
          context: msg.context as string | undefined,
          icon: msg.icon as string | undefined,
          status: 'idle',
          lastActivity: Date.now(), // Set to now when agent is created
          x: 0,
          y: 0,
        };
        setAgents((prev) => [...prev.filter(a => a.id !== newAgent.id), newAgent]);
        break;
      }
      case 'agentClosed': {
        setAgents((prev) => prev.filter(a => a.id !== msg.id));
        break;
      }
      case 'agentStatus': {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === msg.id ? { ...a, status: msg.status as Agent['status'], lastActivity: Date.now() } : a
          )
        );
        break;
      }
      case 'agentToolStart': {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === msg.id
              ? { ...a, status: 'active', currentTool: msg.toolName as string, lastActivity: Date.now() }
              : a
          )
        );
        break;
      }
      case 'agentToolDone': {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === msg.id ? { ...a, status: 'waiting', currentTool: undefined } : a
          )
        );
        break;
      }
      case 'agentActivity': {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === msg.id
              ? { ...a, recentActivities: msg.activities as Agent['recentActivities'] }
              : a
          )
        );
        break;
      }
    }
  }, []);

  const handleAgentClick = useCallback((agentId: string) => {
    setSelectedAgent(agentId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'focusAgent', id: agentId }));
    }
  }, []);

  const handleCloseAgent = useCallback((agentId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'closeAgent', id: agentId }));
    }
  }, []);

  const handleRefresh = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'requestRefresh' }));
    }
  }, []);

  return (
    <div className="app">
      <Toolbar
        connected={connected}
        agentCount={agents.length}
        onRefresh={handleRefresh}
      />
      <div className="main-content">
        <div className="canvas-container">
          <OfficeCanvas
            layout={defaultLayout}
            agents={agents}
            selectedAgent={selectedAgent}
            onAgentClick={handleAgentClick}
          />
        </div>
        <AgentList
          agents={sortedAgents}
          selectedAgent={selectedAgent}
          onSelect={handleAgentClick}
          onClose={handleCloseAgent}
        />
      </div>
      <StatusBar connected={connected} agentCount={agents.length} />
    </div>
  );
}

export default App;
