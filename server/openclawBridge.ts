/**
 * OpenClaw Bridge - Connects to OpenClaw's internal session/subagent data
 * 
 * This uses the sessions_list and subagents tools via a different mechanism.
 * In production, this could be replaced with:
 * 1. Direct OpenClaw API integration
 * 2. File-based communication
 * 3. Shared memory/state
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SessionInfo {
  sessionKey: string;
  label?: string;
  agentId?: string;
  runtime?: string;
  status: string;
}

// Cache for session data
let sessionCache: SessionInfo[] = [];
let subagentCache: SessionInfo[] = [];

/**
 * Get current sessions from OpenClaw
 * This reads from OpenClaw's session directory directly
 */
export async function getSessions(): Promise<SessionInfo[]> {
  try {
    // Try to read from OpenClaw's session files
    const { stdout } = await execAsync(
      `ls -la ~/.openclaw/agents/*/sessions/*.jsonl 2>/dev/null | wc -l`
    );
    const fileCount = parseInt(stdout.trim()) || 0;
    
    // For now, return mock data based on what we know exists
    // In a real implementation, this would parse the session files
    return [
      {
        sessionKey: 'agent:main:discord:channel:1498283683419787434',
        label: 'Discord Main',
        agentId: 'main',
        status: 'active'
      }
    ];
  } catch (e) {
    console.error('Error reading sessions:', e);
    return sessionCache;
  }
}

/**
 * Get current subagents from OpenClaw
 */
export async function getSubagents(): Promise<SessionInfo[]> {
  try {
    // Check for active subagent processes
    // This would be replaced with actual OpenClaw API calls
    const { stdout } = await execAsync(
      `ps aux | grep -i "openclaw" | grep -v grep | wc -l`
    );
    const processCount = parseInt(stdout.trim()) || 0;
    
    // Return empty for now - subagents would be detected when running
    return [];
  } catch (e) {
    console.error('Error reading subagents:', e);
    return subagentCache;
  }
}

/**
 * Simulate activity for demo purposes
 * Remove this when real activity tracking is implemented
 */
export function simulateActivity(sessions: SessionInfo[]): SessionInfo[] {
  return sessions.map(session => ({
    ...session,
    // Randomly assign activity status for demo
    status: Math.random() > 0.7 ? 'active' : 'idle'
  }));
}

/**
 * Watch for changes in OpenClaw's session directory
 */
export function watchSessions(callback: (sessions: SessionInfo[]) => void): () => void {
  const interval = setInterval(async () => {
    const sessions = await getSessions();
    const subagents = await getSubagents();
    callback([...sessions, ...subagents]);
  }, 2000);
  
  return () => clearInterval(interval);
}
