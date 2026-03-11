import React from 'react';
import type { Transition } from '@/types/petri';

const W = 48;
const H = 64;
export const TRANS_W = W;
export const TRANS_H = H;

// Distance from top edge to rotation handle
const ROT_HANDLE_DIST = 22;

interface Props {
  transition: Transition;
  enabled: boolean;
  selected: boolean;
  isArcSource: boolean;
  isSimMode: boolean;
  showRotationHandle: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onRotationHandleMouseDown: (e: React.MouseEvent) => void;
}

export default function TransitionNode({
  transition, enabled, selected, isArcSource, isSimMode,
  showRotationHandle, onMouseDown, onMouseUp, onClick, onRotationHandleMouseDown
}: Props) {
  const isEnabledActive = enabled && isSimMode;
  const fill = isEnabledActive ? '#f0fdf4' : selected ? '#eef2ff' : '#ffffff';
  const strokeColor = selected ? '#6366f1'
    : isArcSource ? '#818cf8'
    : isEnabledActive ? '#16a34a'
    : '#94a3b8';
  const strokeWidth = selected || isArcSource || isEnabledActive ? 2.5 : 1.5;

  const rotation = transition.rotation ?? 0;

  return (
    <g transform={`translate(${transition.x},${transition.y}) rotate(${rotation})`}>
      {/* Enabled glow */}
      {isEnabledActive && (
        <rect x={-W / 2 - 3} y={-H / 2 - 3} width={W + 6} height={H + 6} fill="#bbf7d0" rx={5} opacity={0.6} />
      )}

      {/* Main rectangle – captures drag/click */}
      <rect
        x={-W / 2} y={-H / 2} width={W} height={H}
        fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} rx={3}
        className="cursor-pointer"
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onClick={onClick}
      />

      <text
        textAnchor="middle" dominantBaseline="central"
        fontSize={11} fill="#1e293b"
        className="select-none pointer-events-none"
      >
        {transition.label}
      </text>

      {/* Rotation handle (shown when selected in select mode) */}
      {showRotationHandle && (
        <g>
          {/* Stem line */}
          <line
            x1={0} y1={-H / 2}
            x2={0} y2={-(H / 2 + ROT_HANDLE_DIST)}
            stroke="#6366f1" strokeWidth={1.5}
            pointerEvents="none"
          />
          {/* Handle circle */}
          <circle
            cx={0} cy={-(H / 2 + ROT_HANDLE_DIST)}
            r={6}
            fill="#6366f1" stroke="white" strokeWidth={1.5}
            className="cursor-crosshair"
            onMouseDown={onRotationHandleMouseDown}
          />
          {/* Rotation angle label */}
          <text
            x={10} y={-(H / 2 + ROT_HANDLE_DIST)}
            fontSize={9} fill="#6366f1"
            dominantBaseline="central"
            className="select-none pointer-events-none"
          >
            {Math.round(rotation)}°
          </text>
        </g>
      )}
    </g>
  );
}
