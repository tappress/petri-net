import type { Arc, ArcId, Marking, NodeId, PetriNet, Place, Transition } from '@/types/petri';

export function isEnabled(
  transition: Transition,
  arcs: Record<ArcId, Arc>,
  places: Record<NodeId, Place>,
  marking: Marking
): boolean {
  for (const arc of Object.values(arcs)) {
    if (arc.target !== transition.id) continue;
    const tokens = marking[arc.source] ?? 0;
    if (arc.type === 'inhibitor') {
      if (tokens >= arc.weight) return false;
    } else {
      if (tokens < arc.weight) return false;
    }
  }
  for (const arc of Object.values(arcs)) {
    if (arc.source !== transition.id) continue;
    if (arc.type === 'reset') continue;
    const place = places[arc.target];
    if (place && place.capacity !== null) {
      const after = (marking[arc.target] ?? 0) + arc.weight;
      if (after > place.capacity) return false;
    }
  }
  return true;
}

export function fire(
  transition: Transition,
  arcs: Record<ArcId, Arc>,
  marking: Marking
): Marking {
  const next = { ...marking };
  for (const arc of Object.values(arcs)) {
    if (arc.target === transition.id) {
      if (arc.type === 'reset') {
        next[arc.source] = 0;
      } else {
        next[arc.source] = (next[arc.source] ?? 0) - arc.weight;
      }
    }
    if (arc.source === transition.id) {
      next[arc.target] = (next[arc.target] ?? 0) + arc.weight;
    }
  }
  return next;
}

export function getEnabledTransitions(net: PetriNet, marking: Marking): Transition[] {
  return Object.values(net.transitions).filter(t =>
    isEnabled(t, net.arcs, net.places, marking)
  );
}

export function step(net: PetriNet, marking: Marking): {
  fired: NodeId | null;
  next: Marking;
} {
  const enabled = getEnabledTransitions(net, marking)
    .sort((a, b) => b.priority - a.priority);

  if (enabled.length === 0) return { fired: null, next: marking };

  const maxPriority = enabled[0].priority;
  const candidates = enabled.filter(t => t.priority === maxPriority);
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];

  return { fired: chosen.id, next: fire(chosen, net.arcs, marking) };
}

/** Connection point on place circle boundary, aimed toward (toX, toY) */
export function placeConnectionPoint(
  place: Place,
  toX: number,
  toY: number,
  radius: number
): { x: number; y: number } {
  const dx = toX - place.x;
  const dy = toY - place.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: place.x + (dx / dist) * radius, y: place.y + (dy / dist) * radius };
}

/** Connection point on (possibly rotated) transition rectangle boundary, aimed toward (toX, toY) */
export function transitionConnectionPoint(
  t: Transition,
  toX: number,
  toY: number,
  w: number,
  h: number
): { x: number; y: number } {
  const angle = ((t.rotation ?? 0) * Math.PI) / 180;
  const dx = toX - t.x;
  const dy = toY - t.y;

  // Transform direction into local (unrotated) space
  const cosNeg = Math.cos(-angle);
  const sinNeg = Math.sin(-angle);
  const lx = dx * cosNeg - dy * sinNeg;
  const ly = dx * sinNeg + dy * cosNeg;

  const hw = w / 2, hh = h / 2;
  if (lx === 0 && ly === 0) return { x: t.x, y: t.y };

  const tx = lx !== 0 ? hw / Math.abs(lx) : Infinity;
  const ty = ly !== 0 ? hh / Math.abs(ly) : Infinity;
  const s = Math.min(tx, ty);
  const localX = lx * s;
  const localY = ly * s;

  // Transform back to world space
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  return {
    x: t.x + localX * cosA - localY * sinA,
    y: t.y + localX * sinA + localY * cosA,
  };
}

/** World-space control point for a bent arc */
export function arcControlPoint(
  arc: Arc,
  srcX: number, srcY: number,
  tgtX: number, tgtY: number
): { x: number; y: number } {
  return {
    x: (srcX + tgtX) / 2 + (arc.cpDx ?? 0),
    y: (srcY + tgtY) / 2 + (arc.cpDy ?? 0),
  };
}
