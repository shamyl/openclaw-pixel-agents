import { useEffect, useRef, useState, useCallback } from 'react';
import { OfficeCanvas } from './components/OfficeCanvas';
import { AgentList } from './components/AgentList';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import type { Agent, OfficeConfig } from './types';

// Default office layout
const defaultLayout: OfficeConfig = {
  rows: 12,
  cols: 20,
  floorColor: '#2d3436',
  wallColor: '#636e72',
  desks: [
    { id: 'desk1', row: 2, col: 3, type: 'computer', facing: 'south' },
    { id: 'desk2', row: 2, col: 7, type: 'computer', facing: 'south' },
    { id: 'desk3', row: 2, col: 11, type: 'computer', facing: 'south' },
    { id: 'desk4', row: 2, col: 15, type: 'computer', facing: 'south' },
    { id: 'desk5', row: 6, col: 3, type: 'computer', facing: 'north' },
    { id: 'desk6', row: 6, col: 7, type: 'computer', facing: 'north' },
    { id: 'desk7', row: 6, col: 11, type: 'computer', facing: 'north' },
    { id: 'desk8', row: 6, col: 15, type: 'computer', facing: 'north' },
  ],
  walls: [
    // Top wall
    { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
    { row: 0, col: 3 }, { row: 0, col: 4 }, { row: 0, col: 5 },
    { row: 0, col: 6 }, { row: 0, col: 7 }, { row: 0, col: 8 },
    { row: 0, col: 9 }, { row: 0, col: 10 }, { row: 0, col: 11 },
    { row: 0, col: 12 }, { row: 0, col: 13 }, { row: 0, col: 14 },
    { row: 0, col: 15 }, { row: 0, col: 16 }, { row: 0, col: 17 },
    { row: 0, col: 18 }, { row: 0, col: 19 },
    // Bottom wall
    { row: 11, col: 0 }, { row: 11, col: 1 }, { row: 11, col: 2 },
    { row: 11, col: 3 }, { row: 11, col: 4 }, { row: 11, col: 5 },
    { row: 11, col: 6 }, { row: 11, col: 7 }, { row: 11, col: 8 },
    { row: 11, col: 9 }, { row: 11, col: 10 }, { row: 11, col: 11 },
    { row: 11, col: 12 }, { row: 11, col: 13 }, { row: 11, col: 14 },
    { row: 11, col: 15 }, { row: 11, col: 16 }, { row: 11, col: 17 },
    { row: 11, col: 18 }, { row: 11, col: 19 },
    // Left wall
    { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 },
    { row: 4, col: 0 }, { row: 5, col: 0 }, { row: 6, col: 0 },
    { row: 7, col: 0 }, { row: 8, col: 0 }, { row: 9, col: 0 },
    { row: 10, col: 0 },
    // Right wall
    { row: 1, col: 19 }, { row: 2, col: 19 }, { row: 3, col: 19 },
    { row: 4, col: 19 }, { row: 5, col: 19 }, { row: 6, col: 19 },
    { row: 7, col: 19 }, { row: 8, col: 19 }, { row: 9, col: 19 },
    { row: 10, col: 19 },
  ],
  decorations: [
    { row: 4, col: 9, type: 'plant' },
    { row: 4, col: 10, type: 'plant' },
    { row: 8, col: 9, type: 'watercooler' },
    { row: 8, col: 10, type: 'printer' },
  ],
};

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          status: 'idle',
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
            a.id === msg.id ? { ...a, status: msg.status as Agent['status'] } : a
          )
        );
        break;
      }
      case 'agentToolStart': {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === msg.id
              ? { ...a, status: 'active', currentTool: msg.toolName as string }
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
          agents={agents}
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
