import React from 'react';
import type { Transition } from '../../types/petri';

const W = 48;
const H = 64;

interface Props {
  transition: Transition;
  enabled: boolean;
  selected: boolean;
  isArcSource: boolean;
  isSimMode: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

export const TRANS_W = W;
export const TRANS_H = H;

export default function TransitionNode({
  transition, enabled, selected, isArcSource, isSimMode, onMouseDown, onMouseUp, onClick
}: Props) {
  const fillColor = enabled && isSimMode ? '#14532d' : '#1e293b';
  const strokeColor = selected ? '#f59e0b'
    : isArcSource ? '#6366f1'
    : enabled && isSimMode ? '#22c55e'
    : '#475569';
  const strokeWidth = selected || isArcSource || (enabled && isSimMode) ? 2.5 : 1.5;

  return (
    <g
      transform={`translate(${transition.x},${transition.y})`}
      className="cursor-pointer"
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onClick={onClick}
    >
      <rect
        x={-W / 2} y={-H / 2}
        width={W} height={H}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        rx={3}
      />

      {/* Enabled indicator pulse */}
      {enabled && isSimMode && (
        <rect
          x={-W / 2} y={-H / 2}
          width={W} height={H}
          fill="none"
          stroke="#22c55e"
          strokeWidth={4}
          opacity={0.3}
          rx={3}
        />
      )}

      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fill="#e2e8f0"
        className="select-none pointer-events-none"
        style={{ writingMode: 'horizontal-tb' }}
      >
        {transition.label}
      </text>

      <text
        y={H / 2 + 14}
        textAnchor="middle"
        fontSize={11}
        fill="#94a3b8"
        className="select-none pointer-events-none"
      >
        {/* label below handled above, this is for sub-label if needed */}
      </text>
    </g>
  );
}
