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
const SPRITE_SIZE = 16;
const MOVE_SPEED = 1.5;

// Agent colors by status
const AGENT_COLORS = {
  active: '#00ff88',
  waiting: '#ffd93d',
  idle: '#6c757d',
  selected: '#e94560',
};

// Sprite configurations
const SPRITE_SHEETS = [
  '/sprites/WorkerSheetBrownPurple.png',
  '/sprites/WorkerSheetBrownWhite.png',
  '/sprites/WorkerSheetYellowPurple.png',
  '/sprites/WorkerSheetYellowWhite.png',
];

// Office walkable areas (row, col) - hallways and open spaces
const WALKABLE_AREAS: Array<{row: number, col: number}> = [];
// Generate walkable areas - middle rows between desks
for (let row = 4; row <= 7; row++) {
  for (let col = 2; col <= 21; col++) {
    // Skip areas with desks
    if (!((row === 3 || row === 8) && (col >= 4 && col <= 20 && col % 4 === 0))) {
      WALKABLE_AREAS.push({row, col});
    }
  }
}

// Map agent ID to sprite index
function getSpriteIndex(agentId: string): number {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash) + agentId.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % SPRITE_SHEETS.length;
}

// Get a random walkable position
function getRandomWalkablePosition(): {x: number, y: number} {
  const area = WALKABLE_AREAS[Math.floor(Math.random() * WALKABLE_AREAS.length)];
  return {
    x: area.col * TILE_SIZE + TILE_SIZE / 2,
    y: area.row * TILE_SIZE + TILE_SIZE / 2 + 10,
  };
}

export function OfficeCanvas({
  layout,
  agents,
  selectedAgent,
  onAgentClick,
}: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const agentAnimations = useRef<Map<string, AgentAnimation>>(new Map());
  const agentTargets = useRef<Map<string, {x: number, y: number}>>(new Map());
  const spriteImages = useRef<Map<string, HTMLImageElement>>(new Map());
  const spritesLoaded = useRef<boolean>(false);

  const canvasWidth = layout.cols * TILE_SIZE;
  const canvasHeight = layout.rows * TILE_SIZE;

  // Load sprite images
  useEffect(() => {
    const loadPromises = SPRITE_SHEETS.map((src) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          spriteImages.current.set(src, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = src;
      });
    });

    Promise.all(loadPromises).then(() => {
      spritesLoaded.current = true;
    });
  }, []);

  // Initialize agent positions and targets
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
          state: agent.status === 'active' ? 'walking' : 'idle',
          direction: 'down',
        });

        // Store home desk position
        agentTargets.current.set(agent.id + '_home', {x, y});
      }
    });
  }, [agents, layout.desks]);

  // Update movement based on status
  useEffect(() => {
    agents.forEach((agent) => {
      const anim = agentAnimations.current.get(agent.id);
      if (!anim) return;

      // When agent becomes active, give them a target to walk to
      if (agent.status === 'active' && anim.state !== 'walking') {
        const target = getRandomWalkablePosition();
        agentTargets.current.set(agent.id, target);
        anim.state = 'walking';
      }
      // When agent becomes idle/waiting, return to desk
      else if ((agent.status === 'idle' || agent.status === 'waiting') && anim.state === 'walking') {
        const home = agentTargets.current.get(agent.id + '_home');
        if (home) {
          agentTargets.current.set(agent.id, home);
          anim.state = 'returning';
        }
      }
    });
  }, [agents]);

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
        ctx.fillStyle = (row + col) % 2 === 0 ? '#3d2914' : '#4a3420';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#2d1f0e';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }

    // Draw walls
    ctx.fillStyle = '#2c3e50';
    for (let col = 0; col < layout.cols; col++) {
      ctx.fillRect(col * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillRect(col * TILE_SIZE, (layout.rows - 1) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    for (let row = 1; row < layout.rows - 1; row++) {
      ctx.fillRect(0, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.fillRect((layout.cols - 1) * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Draw bookshelves
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(TILE_SIZE * 2, TILE_SIZE * 1, TILE_SIZE * 3, TILE_SIZE);
    ctx.fillRect(TILE_SIZE * 2, TILE_SIZE * 2, TILE_SIZE * 3, TILE_SIZE);
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
    layout.desks.forEach((desk) => {
      const x = desk.col * TILE_SIZE;
      const y = desk.row * TILE_SIZE;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 4, y + TILE_SIZE - 8, TILE_SIZE - 8, 4);
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(x + 10, y + 6, TILE_SIZE - 20, 8);
      ctx.fillStyle = '#3498db';
      ctx.fillRect(x + 12, y + 7, TILE_SIZE - 24, 6);
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(x + 10, y + 18, TILE_SIZE - 20, 4);
    });

    // Update and draw agents
    agents.forEach((agent) => {
      const anim = agentAnimations.current.get(agent.id);
      const isSelected = agent.id === selectedAgent;
      let x = agent.x;
      let y = agent.y;

      // Handle movement
      const target = agentTargets.current.get(agent.id);
      if (target && anim && (anim.state === 'walking' || anim.state === 'returning')) {
        const dx = target.x - x;
        const dy = target.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > MOVE_SPEED) {
          // Move towards target
          x += (dx / dist) * MOVE_SPEED;
          y += (dy / dist) * MOVE_SPEED;

          // Update direction based on movement
          if (Math.abs(dx) > Math.abs(dy)) {
            anim.direction = dx > 0 ? 'right' : 'left';
          } else {
            anim.direction = dy > 0 ? 'down' : 'up';
          }

          // Update frame for walking animation
          anim.frame = Math.floor(Date.now() / 150) % 4;
        } else {
          // Reached target
          x = target.x;
          y = target.y;

          if (anim.state === 'walking') {
            // If still active, pick a new target
            if (agent.status === 'active') {
              const newTarget = getRandomWalkablePosition();
              agentTargets.current.set(agent.id, newTarget);
            } else {
              anim.state = 'idle';
            }
          } else if (anim.state === 'returning') {
            anim.state = 'idle';
          }
        }

        // Update agent position
        agent.x = x;
        agent.y = y;
      } else if (anim && anim.state === 'idle') {
        // Idle animation - just bob in place
        anim.frame = Math.floor(Date.now() / 300) % 2;
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y + AGENT_SIZE/2 + 4, AGENT_SIZE/2, AGENT_SIZE/4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw sprite
      const spriteIndex = getSpriteIndex(agent.id);
      const spriteSrc = SPRITE_SHEETS[spriteIndex];
      const spriteImg = spriteImages.current.get(spriteSrc);

      if (spriteImg && spritesLoaded.current) {
        // Determine sprite row based on direction and state
        let sy = 0;
        if (anim?.state === 'walking' || anim?.state === 'returning') {
          // Walking animation row
          sy = anim.frame * SPRITE_SIZE;
        } else {
          // Idle - use first frame
          sy = 0;
        }
        const sx = 0; // First column

        // Flip sprite if facing left
        ctx.save();
        if (anim?.direction === 'left') {
          ctx.translate(x + AGENT_SIZE/2 + 4, 0);
          ctx.scale(-1, 1);
          ctx.translate(-(x - AGENT_SIZE/2 - 4), 0);
        }

        ctx.drawImage(
          spriteImg,
          sx, sy, SPRITE_SIZE, SPRITE_SIZE,
          x - AGENT_SIZE/2 - 4, y - AGENT_SIZE/2 - 8, AGENT_SIZE + 8, AGENT_SIZE + 8
        );
        ctx.restore();
      } else {
        // Fallback
        if (isSelected) {
          ctx.shadowColor = AGENT_COLORS.selected;
          ctx.shadowBlur = 15;
        }
        ctx.fillStyle = agent.isSubagent ? '#9b59b6' : '#3498db';
        ctx.fillRect(x - AGENT_SIZE/2, y - AGENT_SIZE/2, AGENT_SIZE, AGENT_SIZE);
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(x - AGENT_SIZE/2 + 2, y - AGENT_SIZE/2 - 6, AGENT_SIZE - 4, 6);
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 4, y - AGENT_SIZE/2 - 4, 2, 2);
        ctx.fillRect(x + 2, y - AGENT_SIZE/2 - 4, 2, 2);
        ctx.shadowBlur = 0;
      }

      // Status indicator
      const statusColor = AGENT_COLORS[agent.status];
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + AGENT_SIZE/2 + 2, y - AGENT_SIZE/2 - 2, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = statusColor;
      ctx.beginPath();
      ctx.arc(x + AGENT_SIZE/2 + 2, y - AGENT_SIZE/2 - 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Status label
      let statusLabel = '';
      if (agent.status === 'active') {
        statusLabel = 'WORKING';
      } else if (agent.status === 'waiting') {
        statusLabel = 'IDLE';
      }

      if (statusLabel) {
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        const labelWidth = ctx.measureText(statusLabel).width;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(x - labelWidth/2 - 2, y - AGENT_SIZE/2 - 26, labelWidth + 4, 12);
        ctx.fillStyle = agent.status === 'active' ? AGENT_COLORS.active : AGENT_COLORS.waiting;
        ctx.fillText(statusLabel, x, y - AGENT_SIZE/2 - 18);
      }

      // Current tool
      if (agent.currentTool) {
        const toolText = agent.currentTool.slice(0, 12);
        ctx.font = '7px monospace';
        const toolWidth = ctx.measureText(toolText).width;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(x - toolWidth/2 - 2, y - AGENT_SIZE/2 - 40, toolWidth + 4, 12);
        ctx.fillStyle = '#ffd93d';
        ctx.fillText(toolText, x, y - AGENT_SIZE/2 - 32);
      }

      // Agent name
      const nameLabel = agent.label || agent.id.slice(0, 8);
      ctx.font = 'bold 9px monospace';
      const nameWidth = ctx.measureText(nameLabel).width;
      const nameY = y + AGENT_SIZE/2 + 18;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(x - nameWidth/2 - 4, nameY - 9, nameWidth + 8, 16);
      ctx.fillStyle = isSelected ? '#e94560' : '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(nameLabel, x, nameY + 3);
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
