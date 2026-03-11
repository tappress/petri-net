import React from 'react';
import type { Arc, Place, Transition } from '../../types/petri';
import { placeConnectionPoint, transitionConnectionPoint } from '../../engine/petri';

const PLACE_RADIUS = 28;
const TRANS_W = 48;
const TRANS_H = 64;

interface Props {
  arc: Arc;
  places: Record<string, Place>;
  transitions: Record<string, Transition>;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  draftTarget?: { x: number; y: number };
}

function getEndpoints(arc: Arc, places: Record<string, Place>, transitions: Record<string, Transition>) {
  const srcPlace = places[arc.source];
  const srcTrans = transitions[arc.source];
  const tgtPlace = places[arc.target];
  const tgtTrans = transitions[arc.target];

  let x1: number, y1: number, x2: number, y2: number;

  if (srcPlace && tgtTrans) {
    x2 = tgtTrans.x; y2 = tgtTrans.y;
    const tp = placeConnectionPoint(srcPlace, x2, y2, PLACE_RADIUS);
    x1 = tp.x; y1 = tp.y;
    const tt = transitionConnectionPoint(tgtTrans, srcPlace.x, srcPlace.y, TRANS_W, TRANS_H);
    x2 = tt.x; y2 = tt.y;
  } else if (srcTrans && tgtPlace) {
    x1 = srcTrans.x; y1 = srcTrans.y;
    const tt = transitionConnectionPoint(srcTrans, tgtPlace.x, tgtPlace.y, TRANS_W, TRANS_H);
    x1 = tt.x; y1 = tt.y;
    const tp = placeConnectionPoint(tgtPlace, srcTrans.x, srcTrans.y, PLACE_RADIUS);
    x2 = tp.x; y2 = tp.y;
  } else {
    return null;
  }

  return { x1, y1, x2, y2 };
}

export default function ArcEdge({ arc, places, transitions, selected, onClick }: Props) {
  const endpoints = getEndpoints(arc, places, transitions);
  if (!endpoints) return null;

  const { x1, y1, x2, y2 } = endpoints;

  const color = selected ? '#f59e0b' : '#94a3b8';
  const strokeWidth = selected ? 2.5 : 1.8;

  const isInhibitor = arc.type === 'inhibitor';
  const markerId = isInhibitor ? 'inhibitor-end' : 'arrow-end';

  // Shorten line for inhibitor circle
  let lx2 = x2, ly2 = y2;
  if (isInhibitor) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    lx2 = x2 - (dx / dist) * 7;
    ly2 = y2 - (dy / dist) * 7;
  }

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <g onClick={onClick} className="cursor-pointer">
      {/* Wide invisible hit area */}
      <line x1={x1} y1={y1} x2={lx2} y2={ly2} stroke="transparent" strokeWidth={16} onClick={onClick} />
      <line
        x1={x1} y1={y1} x2={lx2} y2={ly2}
        stroke={color}
        strokeWidth={strokeWidth}
        markerEnd={`url(#${markerId})`}
      />
      {isInhibitor && (
        <circle cx={x2} cy={y2} r={5} fill="none" stroke={color} strokeWidth={strokeWidth} />
      )}
      {arc.weight > 1 && (
        <text
          x={midX + 8} y={midY - 8}
          fontSize={11}
          fill={color}
          textAnchor="middle"
          className="select-none pointer-events-none"
        >
          {arc.weight}
        </text>
      )}
    </g>
  );
}

export function ArcDraftLine({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="#6366f1"
      strokeWidth={1.5}
      strokeDasharray="6 4"
      markerEnd="url(#arrow-end)"
      pointerEvents="none"
    />
  );
}

export function ArrowDefs() {
  return (
    <defs>
      <marker id="arrow-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
      </marker>
      <marker id="arrow-end-enabled" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
      </marker>
      <marker id="inhibitor-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
      </marker>
    </defs>
  );
}
