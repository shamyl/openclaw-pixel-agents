import type { Agent } from '../types';

interface AgentListProps {
  agents: Agent[];
  selectedAgent: string | null;
  onSelect: (agentId: string) => void;
  onClose: (agentId: string) => void;
}

const statusIcons = {
  active: '⚡',
  waiting: '⏳',
  idle: '😴',
};

const statusColors = {
  active: '#00ff88',
  waiting: '#ffd93d',
  idle: '#6c757d',
};

export function AgentList({ agents, selectedAgent, onSelect, onClose }: AgentListProps) {
  return (
    <div className="agent-list">
      <h3>Agents ({agents.length})</h3>
      <div className="agent-list-content">
        {agents.length === 0 ? (
          <div className="no-agents">No active agents</div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.id}
              className={`agent-item ${selectedAgent === agent.id ? 'selected' : ''}`}
              onClick={() => onSelect(agent.id)}
            >
              <div className="agent-header">
                <span className="agent-type">
                  {agent.isSubagent ? '🔀' : '🤖'}
                </span>
                <span className="agent-name">
                  {agent.label || agent.id.slice(0, 16)}
                </span>
                <span
                  className="agent-status"
                  style={{ color: statusColors[agent.status] }}
                >
                  {statusIcons[agent.status]}
                </span>
              </div>
              <div className="agent-details">
                {agent.folderName && (
                  <span className="agent-folder">📁 {agent.folderName}</span>
                )}
                {agent.currentTool && (
                  <span className="agent-tool">🔧 {agent.currentTool}</span>
                )}
              </div>
              {selectedAgent === agent.id && (
                <button
                  className="close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(agent.id);
                  }}
                >
                  ✕ Close
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
