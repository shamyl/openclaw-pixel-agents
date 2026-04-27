import { useEffect, useRef, useCallback } from 'react';
import type { Agent, OfficeConfig, AgentAnimation } from '../types';

interface OfficeCanvasProps {
  layout: OfficeConfig;
  agents: Agent[];
  selectedAgent: string | null;
  onAgentClick: (agentId: string) => void;
}

const TILE_SIZE = 32;
const AGENT_SIZE = 20;

// Agent colors by status
const AGENT_COLORS = {
  active: '#00ff88',
  waiting: '#ffd93d', 
  idle: '#6c757d',
  selected: '#e94560',
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

  const canvasWidth = layout.cols * TILE_SIZE;
  const canvasHeight = layout.rows * TILE_SIZE;

  // Initialize agent positions
  useEffect(() => {
    agents.forEach((agent, index) => {
      if (!agentAnimations.current.has(agent.id)) {
        const desk = layout.desks[index % layout.desks.length];
        const x = desk.col * TILE_SIZE + TILE_SIZE / 2;
        const y = desk.row * TILE_SIZE + TILE_SIZE / 2 + 20;
        
        agent.x = x;
        agent.y = y;
        
        agentAnimations.current.set(agent.id, {
          frame: 0,
          state: agent.status === 'active' ? 'typing' : 'idle',
          direction: 'down',
        });
      }
    });
  }, [agents, layout.desks]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw floor tiles
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        
        // Wood floor pattern
        ctx.fillStyle = (row + col) % 2 === 0 ? '#3d2914' : '#4a3420';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        
        // Tile border
        ctx.strokeStyle = '#2d1f0e';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }

    // Draw walls (top and bottom borders)
    ctx.fillStyle = '#2c3e50';
    for (let col = 0; col < layout.cols; col++) {
      // Top wall
      ctx.fillRect(col * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
      // Bottom wall  
      ctx.fillRect(col * TILE_SIZE, (layout.rows - 1) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    for (let row = 1; row < layout.rows - 1; row++) {
      // Left wall
      ctx.fillRect(0, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      // Right wall
      ctx.fillRect((layout.cols - 1) * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Draw bookshelves
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(TILE_SIZE * 2, TILE_SIZE * 1, TILE_SIZE * 3, TILE_SIZE);
    ctx.fillRect(TILE_SIZE * 2, TILE_SIZE * 2, TILE_SIZE * 3, TILE_SIZE);
    // Books
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(TILE_SIZE * 2.2, TILE_SIZE * 1.2, TILE_SIZE * 0.15, TILE_SIZE * 0.6);
    ctx.fillStyle = '#3498db'; ctx.fillRect(TILE_SIZE * 2.4, TILE_SIZE * 1.2, TILE_SIZE * 0.15, TILE_SIZE * 0.6);
    ctx.fillStyle = '#2ecc71'; ctx.fillRect(TILE_SIZE * 2.6, TILE_SIZE * 1.2, TILE_SIZE * 0.15, TILE_SIZE * 0.6);

    // Draw vending machine
    ctx.fillStyle = '#34495e';
    ctx.fillRect(TILE_SIZE * 14, TILE_SIZE * 1, TILE_SIZE * 1.5, TILE_SIZE * 2);
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(TILE_SIZE * 14.1, TILE_SIZE * 1.2, TILE_SIZE * 1.3, TILE_SIZE * 1.5);

    // Draw water cooler
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();
    ctx.arc(TILE_SIZE * 10, TILE_SIZE * 1.5, TILE_SIZE * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3498db';
    ctx.fillRect(TILE_SIZE * 9.7, TILE_SIZE * 1.2, TILE_SIZE * 0.6, TILE_SIZE * 0.4);

    // Draw desks
    layout.desks.forEach((desk, index) => {
      const x = desk.col * TILE_SIZE;
      const y = desk.row * TILE_SIZE;
      
      // Desk shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 4, y + TILE_SIZE - 8, TILE_SIZE - 8, 4);
      
      // Desk
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      
      // Computer monitor
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(x + 10, y + 6, TILE_SIZE - 20, 8);
      ctx.fillStyle = '#3498db';
      ctx.fillRect(x + 12, y + 7, TILE_SIZE - 24, 6);
      
      // Keyboard
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(x + 10, y + 18, TILE_SIZE - 20, 4);
    });

    // Draw agents
    agents.forEach((agent) => {
      const anim = agentAnimations.current.get(agent.id);
      const isSelected = agent.id === selectedAgent;
      const x = agent.x;
      const y = agent.y;
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y + AGENT_SIZE/2 + 4, AGENT_SIZE/2, AGENT_SIZE/4, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Selection glow
      if (isSelected) {
        ctx.shadowColor = AGENT_COLORS.selected;
        ctx.shadowBlur = 15;
      }
      
      // Body (pixel style rectangle)
      ctx.fillStyle = agent.isSubagent ? '#9b59b6' : '#3498db';
      ctx.fillRect(x - AGENT_SIZE/2, y - AGENT_SIZE/2, AGENT_SIZE, AGENT_SIZE);
      
      // Head
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(x - AGENT_SIZE/2 + 2, y - AGENT_SIZE/2 - 6, AGENT_SIZE - 4, 6);
      
      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(x - 4, y - AGENT_SIZE/2 - 4, 2, 2);
      ctx.fillRect(x + 2, y - AGENT_SIZE/2 - 4, 2, 2);
      
      ctx.shadowBlur = 0;
      
      // Status indicator (small dot)
      const statusColor = AGENT_COLORS[agent.status];
      ctx.fillStyle = statusColor;
      ctx.beginPath();
      ctx.arc(x + AGENT_SIZE/2 - 2, y - AGENT_SIZE/2 - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Activity indicator
      if (agent.status === 'active') {
        const bounce = Math.sin(Date.now() / 150) * 2;
        ctx.fillStyle = AGENT_COLORS.active;
        ctx.fillRect(x - 2, y - AGENT_SIZE/2 - 12 + bounce, 4, 4);
      }
      
      // Label background (for readability)
      const label = agent.context || agent.label?.slice(0, 12) || agent.id.slice(0, 8);
      ctx.font = 'bold 9px monospace';
      const textWidth = ctx.measureText(label).width;
      
      // Draw label below agent with background
      const labelY = y + AGENT_SIZE/2 + 14;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x - textWidth/2 - 4, labelY - 8, textWidth + 8, 14);
      
      ctx.fillStyle = isSelected ? '#e94560' : '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, labelY + 2);
      
      // Current tool indicator (small text above)
      if (agent.currentTool) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const toolText = agent.currentTool.slice(0, 15);
        const toolWidth = ctx.measureText(toolText).width;
        ctx.fillRect(x - toolWidth/2 - 2, y - AGENT_SIZE/2 - 22, toolWidth + 4, 12);
        
        ctx.fillStyle = '#ffd93d';
        ctx.font = '8px monospace';
        ctx.fillText(toolText, x, y - AGENT_SIZE/2 - 14);
      }
    });

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
        borderRadius: '4px',
      }}
    />
  );
}
