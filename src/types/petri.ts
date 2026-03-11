export type NodeId = string;
export type ArcId = string;

export interface Place {
  id: NodeId;
  label: string;
  x: number;
  y: number;
  tokens: number;
  capacity: number | null;
}

export interface Transition {
  id: NodeId;
  label: string;
  x: number;
  y: number;
  priority: number;
}

export type ArcType = 'normal' | 'inhibitor' | 'reset';

export interface Arc {
  id: ArcId;
  source: NodeId;
  target: NodeId;
  weight: number;
  type: ArcType;
}

export interface Marking {
  [placeId: NodeId]: number;
}

export interface PetriNet {
  places: Record<NodeId, Place>;
  transitions: Record<NodeId, Transition>;
  arcs: Record<ArcId, Arc>;
  initialMarking: Marking;
}

export interface Sheet {
  id: string;
  name: string;
  net: PetriNet;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  sheets: Record<string, Sheet>;
  activeSheetId: string;
  createdAt: number;
  updatedAt: number;
}

export interface FiringRecord {
  step: number;
  transitionId: NodeId;
  transitionLabel: string;
  markingBefore: Marking;
  markingAfter: Marking;
  timestamp: number;
}

export type SimulationMode = 'idle' | 'running';
export type ToolMode = 'select' | 'addPlace' | 'addTransition' | 'addArc' | 'delete';
