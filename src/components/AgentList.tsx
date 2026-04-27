import type { Agent } from '../types';

interface AgentListProps {
  agents: Agent[];
  selectedAgent: string | null;
  onSelect: (agentId: string) => void;
  onClose: (agentId: string) => void;
}

const statusColors = {
  active: '#00ff88',
  waiting: '#ffd93d',
  idle: '#6c757d',
};

// Platform icons
const iconMap: Record<string, string> = {
  'discord': '💬',
  'whatsapp': '📱',
  'imessage': '💬',
  'slack': '💬',
  'telegram': '✈️',
  'signal': '🔒',
  'default': '🤖',
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
}

export function AgentList({ agents, selectedAgent, onSelect, onClose }: AgentListProps) {
  const selectedAgentData = selectedAgent ? agents.find(a => a.id === selectedAgent) : null;

  return (
    <div className="agent-list">
      <h3>Agents ({agents.length})</h3>
      
      {/* Status Legend */}
      <div className="status-legend">
        <div className="legend-title">Status:</div>
        <div className="legend-item">
          <span className="legend-dot" style={{ color: statusColors.active }}>●</span>
          <span>Active</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ color: statusColors.waiting }}>●</span>
          <span>Waiting</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ color: statusColors.idle }}>●</span>
          <span>Idle</span>
        </div>
      </div>
      
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
                <span className="agent-icon">
                  {iconMap[agent.icon || 'default']}
                </span>
                <span className="agent-name" title={agent.id}>
                  {agent.label || agent.id.slice(0, 16)}
                </span>
                <span
                  className="agent-status"
                  style={{ color: statusColors[agent.status] }}
                >
                  ●
                </span>
              </div>
              <div className="agent-details">
                {agent.currentTool && (
                  <span className="agent-tool">{agent.currentTool}</span>
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
                  Close
                </button>
              )}
            </div>
          ))
        )}
        
        {/* Activity Log for Selected Agent */}
        {selectedAgentData && (
          <div className="activity-log">
            <h4>Recent Activity</h4>
            {selectedAgentData.recentActivities && selectedAgentData.recentActivities.length > 0 ? (
              <div className="activity-list">
                {selectedAgentData.recentActivities.map((activity, index) => (
                  <div key={index} className="activity-item">
                    <span className="activity-time">{formatTime(activity.timestamp)}</span>
                    <span className="activity-desc">{activity.description}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-activity">No recent activity</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
