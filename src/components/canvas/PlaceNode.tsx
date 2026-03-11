import React from 'react';
import type { Place } from '@/types/petri';

const RADIUS = 28;
export const PLACE_RADIUS = RADIUS;

interface Props {
  place: Place;
  tokens: number;
  selected: boolean;
  isArcSource: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

export default function PlaceNode({ place, tokens, selected, isArcSource, onMouseDown, onMouseUp, onClick }: Props) {
  const strokeColor = selected ? '#6366f1' : isArcSource ? '#818cf8' : '#94a3b8';
  const strokeWidth = selected || isArcSource ? 2.5 : 1.5;
  const fill = selected ? '#eef2ff' : '#ffffff';

  return (
    <g
      transform={`translate(${place.x},${place.y})`}
      className="cursor-pointer"
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onClick={onClick}
    >
      <circle r={RADIUS} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
      <TokenDisplay count={tokens} />
      <text y={RADIUS + 14} textAnchor="middle" fontSize={11} fill="#64748b" className="select-none pointer-events-none">
        {place.label}
      </text>
      {place.capacity !== null && (
        <text y={RADIUS + 25} textAnchor="middle" fontSize={9} fill="#94a3b8" className="select-none pointer-events-none">
          cap:{place.capacity}
        </text>
      )}
    </g>
  );
}

function TokenDisplay({ count }: { count: number }) {
  if (count === 0) return null;
  if (count === 1) return <circle r={6} fill="#334155" />;
  if (count === 2) return (
    <>{[-9, 9].map((cx, i) => <circle key={i} cx={cx} r={5} fill="#334155" />)}</>
  );
  if (count === 3) return (
    <>
      <circle cx={-9} cy={6} r={5} fill="#334155" />
      <circle cx={9} cy={6} r={5} fill="#334155" />
      <circle cy={-6} r={5} fill="#334155" />
    </>
  );
  if (count <= 5) {
    const positions: [number, number][] = [[-8, -8], [8, -8], [-8, 8], [8, 8], [0, 0]];
    return <>{positions.slice(0, count).map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={4} fill="#334155" />)}</>;
  }
  return (
    <text textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight="bold" fill="#1e293b" className="select-none pointer-events-none">
      {count}
    </text>
  );
}
