import React from 'react';
import type { Arc, Place, Transition } from '@/types/petri';
import { placeConnectionPoint, transitionConnectionPoint, arcControlPoint } from '@/engine/petri';

const PLACE_RADIUS = 28;
const TRANS_W = 48;
const TRANS_H = 64;

interface Props {
  arc: Arc;
  places: Record<string, Place>;
  transitions: Record<string, Transition>;
  selected: boolean;
  showHandle: boolean;
  /** arc is connected to an enabled transition in sim mode */
  active: boolean;
  /** the connected transition is currently in its firing animation phase */
  firing: boolean;
  animDurationMs: number;
  onClick: (e: React.MouseEvent) => void;
  onCpMouseDown: (e: React.MouseEvent) => void;
}

function getCenters(arc: Arc, places: Record<string, Place>, transitions: Record<string, Transition>) {
  const srcPlace = places[arc.source];
  const srcTrans = transitions[arc.source];
  const tgtPlace = places[arc.target];
  const tgtTrans = transitions[arc.target];

  if (srcPlace && tgtTrans) return { sx: srcPlace.x, sy: srcPlace.y, tx: tgtTrans.x, ty: tgtTrans.y, srcPlace, tgtTrans };
  if (srcTrans && tgtPlace) return { sx: srcTrans.x, sy: srcTrans.y, tx: tgtPlace.x, ty: tgtPlace.y, srcTrans, tgtPlace };
  return null;
}

export default function ArcEdge({
  arc, places, transitions, selected, showHandle, active, firing, animDurationMs, onClick, onCpMouseDown
}: Props) {
  const centers = getCenters(arc, places, transitions);
  if (!centers) return null;

  const { sx, sy, tx, ty } = centers;
  const cp = arcControlPoint(arc, sx, sy, tx, ty);

  let x1: number, y1: number, x2: number, y2: number;
  if ('srcPlace' in centers && centers.srcPlace && 'tgtTrans' in centers && centers.tgtTrans) {
    const p1 = placeConnectionPoint(centers.srcPlace, cp.x, cp.y, PLACE_RADIUS);
    const p2 = transitionConnectionPoint(centers.tgtTrans, cp.x, cp.y, TRANS_W, TRANS_H);
    x1 = p1.x; y1 = p1.y; x2 = p2.x; y2 = p2.y;
  } else if ('srcTrans' in centers && centers.srcTrans && 'tgtPlace' in centers && centers.tgtPlace) {
    const p1 = transitionConnectionPoint(centers.srcTrans, cp.x, cp.y, TRANS_W, TRANS_H);
    const p2 = placeConnectionPoint(centers.tgtPlace, cp.x, cp.y, PLACE_RADIUS);
    x1 = p1.x; y1 = p1.y; x2 = p2.x; y2 = p2.y;
  } else {
    return null;
  }

  const isInhibitor = arc.type === 'inhibitor';
  const color = selected ? '#6366f1' : firing ? '#15803d' : active ? '#16a34a' : '#94a3b8';
  const strokeWidth = selected ? 2.5 : firing || active ? 2.2 : 1.8;

  let ex = x2, ey = y2;
  if (isInhibitor) {
    const ddx = x2 - cp.x, ddy = y2 - cp.y;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    ex = x2 - (ddx / dist) * 7;
    ey = y2 - (ddy / dist) * 7;
  }

  const pathD = `M ${x1} ${y1} Q ${cp.x} ${cp.y} ${ex} ${ey}`;
  const labelX = 0.25 * x1 + 0.5 * cp.x + 0.25 * ex + 12;
  const labelY = 0.25 * y1 + 0.5 * cp.y + 0.25 * ey - 6;
  const markerEnd = isInhibitor ? undefined
    : firing ? 'url(#arrow-end-green)'
    : active ? 'url(#arrow-end-green)'
    : selected ? 'url(#arrow-end-indigo)'
    : 'url(#arrow-end)';

  // How many token dots to animate (capped at weight, max 3 visible)
  const tokenCount = arc.type === 'reset' ? 1 : Math.min(arc.weight, 3);

  return (
    <g>
      {/* Hit area */}
      <path d={pathD} fill="none" stroke="transparent" strokeWidth={16} onClick={onClick} className="cursor-pointer" />

      {/* Arc line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth={strokeWidth} markerEnd={markerEnd} onClick={onClick} className="cursor-pointer" />

      {isInhibitor && (
        <circle cx={x2} cy={y2} r={5} fill="none" stroke={color} strokeWidth={strokeWidth} onClick={onClick} />
      )}

      {/* Weight / type label */}
      {(arc.weight > 1 || arc.type === 'reset') && (
        <text x={labelX} y={labelY} fontSize={12} fontWeight="600" fill="#0f172a" textAnchor="middle" className="select-none pointer-events-none">
          {arc.type === 'reset' ? 'R' : arc.weight}
        </text>
      )}

      {/* Animated token dots when firing */}
      {firing && !isInhibitor && Array.from({ length: tokenCount }).map((_, i) => {
        const delay = (i / tokenCount) * (animDurationMs * 0.3);
        return (
          <circle key={i} r={5} fill="#16a34a" opacity={0.9} pointerEvents="none">
            <animateMotion
              dur={`${animDurationMs}ms`}
              begin={`${delay}ms`}
              path={pathD}
              fill="freeze"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.1;0.8;1"
              dur={`${animDurationMs}ms`}
              begin={`${delay}ms`}
              fill="freeze"
            />
          </circle>
        );
      })}

      {/* Control-point handle */}
      {showHandle && (
        <g transform={`translate(${cp.x},${cp.y})`} onMouseDown={onCpMouseDown} className="cursor-move">
          <line x1={x1 - cp.x} y1={y1 - cp.y} x2={0} y2={0} stroke="#c7d2fe" strokeWidth={1} strokeDasharray="4 3" pointerEvents="none" />
          <line x1={x2 - cp.x} y1={y2 - cp.y} x2={0} y2={0} stroke="#c7d2fe" strokeWidth={1} strokeDasharray="4 3" pointerEvents="none" />
          <rect x={-6} y={-6} width={12} height={12} transform="rotate(45)" fill="#6366f1" stroke="white" strokeWidth={1.5} />
        </g>
      )}
    </g>
  );
}

export function ArcDraftLine({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="#6366f1" strokeWidth={1.5} strokeDasharray="6 4"
      markerEnd="url(#arrow-end)" pointerEvents="none" />
  );
}

export function ArrowDefs() {
  return (
    <defs>
      <marker id="arrow-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
      </marker>
      <marker id="arrow-end-green" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#16a34a" />
      </marker>
      <marker id="arrow-end-indigo" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
      </marker>
    </defs>
  );
}
