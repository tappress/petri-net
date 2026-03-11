import type { Arc, ArcId, Marking, NodeId, PetriNet, Place, Transition } from '../types/petri';

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
  // Check output capacity
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

/** Compute connection point on circle boundary */
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

/** Compute connection point on rectangle boundary */
export function transitionConnectionPoint(
  t: Transition,
  toX: number,
  toY: number,
  w: number,
  h: number
): { x: number; y: number } {
  const dx = toX - t.x;
  const dy = toY - t.y;
  const hw = w / 2;
  const hh = h / 2;
  if (dx === 0 && dy === 0) return { x: t.x, y: t.y };

  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;

  const t2 = Math.min(tx, ty);
  return { x: t.x + dx * t2, y: t.y + dy * t2 };
}
