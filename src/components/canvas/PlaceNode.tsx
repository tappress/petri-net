import React from 'react';
import type { Place } from '../../types/petri';

const RADIUS = 28;

interface Props {
  place: Place;
  tokens: number;
  selected: boolean;
  isArcSource: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

export const PLACE_RADIUS = RADIUS;

export default function PlaceNode({ place, tokens, selected, isArcSource, onMouseDown, onMouseUp, onClick }: Props) {
  const strokeColor = selected ? '#f59e0b'
    : isArcSource ? '#6366f1'
    : '#475569';
  const strokeWidth = selected || isArcSource ? 2.5 : 1.5;

  return (
    <g
      transform={`translate(${place.x},${place.y})`}
      className="cursor-pointer"
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onClick={onClick}
    >
      <circle r={RADIUS} fill="#1e293b" stroke={strokeColor} strokeWidth={strokeWidth} />

      {/* Tokens */}
      <TokenDisplay count={tokens} />

      {/* Label */}
      <text
        y={RADIUS + 14}
        textAnchor="middle"
        fontSize={11}
        fill="#94a3b8"
        className="select-none pointer-events-none"
      >
        {place.label}
      </text>

      {/* Capacity indicator */}
      {place.capacity !== null && (
        <text
          y={RADIUS + 26}
          textAnchor="middle"
          fontSize={9}
          fill="#64748b"
          className="select-none pointer-events-none"
        >
          cap:{place.capacity}
        </text>
      )}
    </g>
  );
}

function TokenDisplay({ count }: { count: number }) {
  if (count === 0) return null;

  if (count === 1) {
    return <circle r={6} fill="#e2e8f0" />;
  }

  if (count === 2) {
    return (
      <>
        <circle cx={-9} r={5} fill="#e2e8f0" />
        <circle cx={9} r={5} fill="#e2e8f0" />
      </>
    );
  }

  if (count === 3) {
    return (
      <>
        <circle cx={-9} cy={6} r={5} fill="#e2e8f0" />
        <circle cx={9} cy={6} r={5} fill="#e2e8f0" />
        <circle cy={-6} r={5} fill="#e2e8f0" />
      </>
    );
  }

  if (count <= 5) {
    // Dot pattern like a die
    const positions = [
      [[-8, -8], [8, -8], [-8, 8], [8, 8], [0, 0]].slice(0, count)
    ][0];
    return (
      <>
        {positions.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={4} fill="#e2e8f0" />
        ))}
      </>
    );
  }

  // Show number for larger counts
  return (
    <text
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={14}
      fontWeight="bold"
      fill="#e2e8f0"
      className="select-none pointer-events-none"
    >
      {count}
    </text>
  );
}
