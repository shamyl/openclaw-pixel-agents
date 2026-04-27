export interface Agent {
  id: string;
  label?: string;
  folderName?: string;
  isSubagent?: boolean;
  parentAgentId?: string;
  status: 'active' | 'waiting' | 'idle';
  currentTool?: string;
  channel?: string;
  context?: string;
  x: number;
  y: number;
}

export interface Desk {
  id: string;
  row: number;
  col: number;
  type: 'computer' | 'laptop' | 'standing';
  facing: 'north' | 'south' | 'east' | 'west';
}

export interface Wall {
  row: number;
  col: number;
}

export interface Decoration {
  row: number;
  col: number;
  type: 'plant' | 'watercooler' | 'printer' | 'couch' | 'table';
}

export interface OfficeConfig {
  rows: number;
  cols: number;
  floorColor: string;
  wallColor: string;
  desks: Desk[];
  walls: Wall[];
  decorations: Decoration[];
}

export interface TilePosition {
  row: number;
  col: number;
}

export interface AgentAnimation {
  frame: number;
  state: 'idle' | 'walking' | 'typing' | 'reading' | 'running';
  direction: 'up' | 'down' | 'left' | 'right';
}
