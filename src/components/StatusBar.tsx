interface StatusBarProps {
  connected: boolean;
  agentCount: number;
}

export function StatusBar({ connected, agentCount }: StatusBarProps) {
  const activeAgents = 0; // TODO: track from agent data
  
  return (
    <div className="status-bar">
      <div className="status-left">
        <span>OpenClaw Pixel UI v1.0.0</span>
        <span className="divider">|</span>
        <span>WebSocket: {connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      <div className="status-right">
        <span>⚡ {activeAgents} active</span>
        <span className="divider">|</span>
        <span>⏳ {agentCount - activeAgents} waiting</span>
      </div>
    </div>
  );
}
