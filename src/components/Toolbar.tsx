interface ToolbarProps {
  connected: boolean;
  agentCount: number;
  onRefresh: () => void;
}

export function Toolbar({ connected, agentCount, onRefresh }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <h1>🔥 OpenClaw Agents</h1>
        <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>
      <div className="toolbar-right">
        <span className="agent-count">
          👥 {agentCount} agent{agentCount !== 1 ? 's' : ''}
        </span>
        <button className="refresh-btn" onClick={onRefresh} title="Refresh agent list">
          🔄 Refresh
        </button>
        <button className="settings-btn" title="Settings (coming soon)">
          ⚙️
        </button>
      </div>
    </div>
  );
}
