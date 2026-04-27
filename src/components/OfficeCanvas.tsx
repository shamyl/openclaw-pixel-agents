import { useEffect, useRef, useCallback } from 'react';
import type { Agent, OfficeConfig, AgentAnimation } from '../types';

interface OfficeCanvasProps {
  layout: OfficeConfig;
  agents: Agent[];
  selectedAgent: string | null;
  onAgentClick: (agentId: string) => void;
}

const TILE_SIZE = 32;
const AGENT_SIZE = 24;

// Simple agent colors based on status
const AGENT_COLORS = {
  active: '#00ff88',
  waiting: '#ffd93d',
  idle: '#6c757d',
  selected: '#e94560',
};

// Agent status emojis
const AGENT_EMOJIS = {
  idle: '😴',
  waiting: '⏳',
  active: '⚡',
};

export function OfficeCanvas({
  layout,
  agents,
  selectedAgent,
  onAgentClick,
}: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const agentAnimations = useRef<Map<string, AgentAnimation>>(new Map());

  // Calculate canvas dimensions
  const canvasWidth = layout.cols * TILE_SIZE;
  const canvasHeight = layout.rows * TILE_SIZE;

  // Initialize agent positions
  useEffect(() => {
    agents.forEach((agent, index) => {
      if (!agentAnimations.current.has(agent.id)) {
        // Assign a desk position based on index
        const desk = layout.desks[index % layout.desks.length];
        const x = desk.col * TILE_SIZE + TILE_SIZE / 2;
        const y = desk.row * TILE_SIZE + TILE_SIZE / 2 + 16; // Offset to stand in front of desk
        
        agent.x = x;
        agent.y = y;
        
        agentAnimations.current.set(agent.id, {
          frame: 0,
          state: agent.status === 'active' ? 'typing' : 'idle',
          direction: desk.facing === 'south' ? 'down' : 'up',
        });
      }
    });
  }, [agents, layout.desks]);

  // Update agent animations based on status
  useEffect(() => {
    agents.forEach((agent) => {
      const anim = agentAnimations.current.get(agent.id);
      if (anim) {
        if (agent.status === 'active') {
          anim.state = agent.currentTool?.toLowerCase().includes('write') ? 'typing' : 'reading';
        } else if (agent.status === 'waiting') {
          anim.state = 'idle';
        } else {
          anim.state = 'idle';
        }
      }
    });
  }, [agents]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw floor
    ctx.fillStyle = layout.floorColor;
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }
    }

    // Draw walls
    ctx.fillStyle = layout.wallColor;
    layout.walls.forEach((wall) => {
      const x = wall.col * TILE_SIZE;
      const y = wall.row * TILE_SIZE;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      // Add 3D effect
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
      ctx.fillStyle = layout.wallColor;
    });

    // Draw desks
    layout.desks.forEach((desk) => {
      const x = desk.col * TILE_SIZE;
      const y = desk.row * TILE_SIZE;
      
      // Desk surface
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(x + 2, y + 8, TILE_SIZE - 4, TILE_SIZE - 10);
      
      // Computer
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(x + 8, y + 4, TILE_SIZE - 16, 8);
      
      // Screen glow
      ctx.fillStyle = '#3498db';
      ctx.fillRect(x + 10, y + 5, TILE_SIZE - 20, 6);
      
      // Chair position indicator
      const chairOffsets = {
        north: { x: TILE_SIZE / 2, y: TILE_SIZE - 4 },
        south: { x: TILE_SIZE / 2, y: 4 },
        east: { x: 4, y: TILE_SIZE / 2 },
        west: { x: TILE_SIZE - 4, y: TILE_SIZE / 2 },
      };
      const chair = chairOffsets[desk.facing];
      ctx.fillStyle = '#34495e';
      ctx.beginPath();
      ctx.arc(x + chair.x, y + chair.y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw decorations
    layout.decorations.forEach((deco) => {
      const x = deco.col * TILE_SIZE + TILE_SIZE / 2;
      const y = deco.row * TILE_SIZE + TILE_SIZE / 2;
      
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const emojiMap: Record<string, string> = {
        plant: '🌿',
        watercooler: '💧',
        printer: '🖨️',
        couch: '🛋️',
        table: '🪑',
      };
      ctx.fillText(emojiMap[deco.type] || '❓', x, y);
    });

    // Draw agents
    agents.forEach((agent) => {
      const anim = agentAnimations.current.get(agent.id);
      const isSelected = agent.id === selectedAgent;
      
      // Agent position
      const x = agent.x;
      const y = agent.y;
      
      // Selection glow
      if (isSelected) {
        ctx.shadowColor = AGENT_COLORS.selected;
        ctx.shadowBlur = 20;
      }
      
      // Agent body (simple pixel circle)
      ctx.fillStyle = agent.isSubagent ? '#9b59b6' : '#3498db';
      ctx.beginPath();
      ctx.arc(x, y, AGENT_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Status indicator ring
      const statusColor = AGENT_COLORS[agent.status];
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.arc(x, y, AGENT_SIZE / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      
      // Agent emoji based on status
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(AGENT_EMOJIS[agent.status], x, y);
      
      // Activity indicator animation
      if (anim?.state === 'typing' || anim?.state === 'reading') {
        const bounce = Math.sin(Date.now() / 200) * 3;
        ctx.fillStyle = AGENT_COLORS.active;
        ctx.beginPath();
        ctx.arc(x + 14, y - 14 + bounce, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Label
      ctx.fillStyle = '#fff';
      ctx.font = '10px Arial';
      ctx.fillText(agent.label || agent.id.slice(0, 8), x, y + AGENT_SIZE / 2 + 12);
      
      // Tool status
      if (agent.currentTool) {
        ctx.fillStyle = '#ffd93d';
        ctx.font = '9px Arial';
        ctx.fillText(agent.currentTool, x, y - AGENT_SIZE / 2 - 8);
      }
    });

    // Animation loop
    animationRef.current = requestAnimationFrame(draw);
  }, [layout, agents, selectedAgent]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Find clicked agent
      for (const agent of agents) {
        const dx = clickX - agent.x;
        const dy = clickY - agent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < AGENT_SIZE) {
          onAgentClick(agent.id);
          return;
        }
      }
    },
    [agents, onAgentClick]
  );

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      onClick={handleCanvasClick}
      style={{
        cursor: 'pointer',
        display: 'block',
        margin: '0 auto',
      }}
    />
  );
}
