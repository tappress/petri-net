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
  rotation: number; // degrees
}

export type ArcType = 'normal' | 'inhibitor' | 'reset' | 'read';

export interface Arc {
  id: ArcId;
  source: NodeId;
  target: NodeId;
  weight: number;
  type: ArcType;
  cpDx: number; // control-point offset from straight-line midpoint
  cpDy: number;
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
export type ToolMode = 'select' | 'addPlace' | 'addTransition' | 'addArc';

// ω (omega) is represented as Infinity — used in coverability tree markings
export type OmegaMarking = Record<NodeId, number>; // Infinity = ω

export interface CoverabilityNode {
  id: string;
  marking: OmegaMarking;
  parentId: string | null;
  transitionId: string | null;
  transitionLabel: string;
  nodeType: 'root' | 'normal' | 'terminal' | 'duplicate';
  duplicateOfId: string | null;
  children: string[];
}

export interface CoverabilityTree {
  nodes: Record<string, CoverabilityNode>;
  rootId: string;
  placeIds: NodeId[];           // sorted by label
  placeLabels: Record<NodeId, string>;
}

export interface NetProperties {
  bounded: boolean;
  safe: boolean;
  conservative: boolean;
  live: boolean;
  potentiallyLive: boolean;
  deadlockFree: boolean;
  stable: boolean;
  boundedness: Record<NodeId, number>; // max tokens per place (Infinity = unbounded)
  deadTransitions: string[];
  unstableExample?: { markingNodeId: string; t1Label: string; t2Label: string };
}
