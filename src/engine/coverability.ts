import { nanoid } from 'nanoid';
import type {
  PetriNet,
  NodeId,
  Marking,
  OmegaMarking,
  CoverabilityTree,
  CoverabilityNode,
  NetProperties,
} from '@/types/petri';

const ω = Infinity;

function isEnabledOmega(
  transitionId: string,
  arcs: PetriNet['arcs'],
  places: PetriNet['places'],
  marking: OmegaMarking,
): boolean {
  for (const arc of Object.values(arcs)) {
    if (arc.target !== transitionId) continue;
    const tokens = marking[arc.source] ?? 0;
    if (arc.type === 'inhibitor') {
      if (tokens >= arc.weight) return false; // Infinity >= anything → disabled
    } else {
      if (tokens < arc.weight) return false; // Infinity satisfies any finite weight
    }
  }
  for (const arc of Object.values(arcs)) {
    if (arc.source !== transitionId) continue;
    if (arc.type === 'reset') continue;
    const place = places[arc.target];
    if (place && place.capacity !== null) {
      const current = marking[arc.target] ?? 0;
      const after = current === ω ? ω : current + arc.weight;
      if (after > place.capacity) return false;
    }
  }
  return true;
}

function fireOmega(
  transitionId: string,
  arcs: PetriNet['arcs'],
  marking: OmegaMarking,
): OmegaMarking {
  const next = { ...marking };
  for (const arc of Object.values(arcs)) {
    if (arc.target === transitionId) {
      if (arc.type === 'normal') {
        const curr = next[arc.source] ?? 0;
        next[arc.source] = curr === ω ? ω : curr - arc.weight;
      } else if (arc.type === 'reset') {
        next[arc.source] = 0;
      }
    }
    if (arc.source === transitionId) {
      const curr = next[arc.target] ?? 0;
      next[arc.target] = curr === ω ? ω : curr + arc.weight;
    }
  }
  return next;
}

function markingsEqual(m1: OmegaMarking, m2: OmegaMarking, placeIds: NodeId[]): boolean {
  return placeIds.every(p => (m1[p] ?? 0) === (m2[p] ?? 0));
}

function getAncestorMarkings(
  nodes: Record<string, CoverabilityNode>,
  nodeId: string,
): OmegaMarking[] {
  const ancestors: OmegaMarking[] = [];
  let cur = nodes[nodeId];
  while (cur?.parentId) {
    const parent = nodes[cur.parentId];
    if (!parent) break;
    ancestors.push(parent.marking);
    cur = parent;
  }
  return ancestors;
}

export function buildCoverabilityTree(net: PetriNet, initialMarking: Marking): CoverabilityTree {
  // Sort places by label for consistent display order
  const placeIds = Object.keys(net.places).sort((a, b) =>
    (net.places[a].label || a).localeCompare(net.places[b].label || b),
  );

  const placeLabels: Record<NodeId, string> = {};
  for (const p of placeIds) placeLabels[p] = net.places[p].label || p;

  const MAX_NODES = 500;

  const initMarking: OmegaMarking = {};
  for (const p of placeIds) initMarking[p] = initialMarking[p] ?? 0;

  const rootId = nanoid(6);
  const rootNode: CoverabilityNode = {
    id: rootId,
    marking: initMarking,
    parentId: null,
    transitionId: null,
    transitionLabel: '',
    nodeType: 'root',
    duplicateOfId: null,
    children: [],
  };

  const nodes: Record<string, CoverabilityNode> = { [rootId]: rootNode };
  const queue: string[] = [rootId];

  while (queue.length > 0 && Object.keys(nodes).length < MAX_NODES) {
    const nodeId = queue.shift()!;
    const node = nodes[nodeId];

    if (node.nodeType === 'duplicate' || node.nodeType === 'terminal') continue;

    // Collect ancestor markings (path from root to current node, excluding current)
    const ancestors = getAncestorMarkings(nodes, nodeId);

    // Find enabled transitions, sorted by label for deterministic output
    const enabledTransitions = Object.values(net.transitions)
      .filter(t => isEnabledOmega(t.id, net.arcs, net.places, node.marking))
      .sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id));

    if (enabledTransitions.length === 0) {
      node.nodeType = 'terminal';
      continue;
    }

    for (const t of enabledTransitions) {
      let newMarking = fireOmega(t.id, net.arcs, node.marking);

      // Karp-Miller omega introduction: check current node and all ancestors
      const toCheck = [node.marking, ...ancestors];
      for (const ancestorMarking of toCheck) {
        let allLE = true;
        let someStrict = false;
        for (const p of placeIds) {
          const av = ancestorMarking[p] ?? 0;
          const nv = newMarking[p] ?? 0;
          if (av > nv) { allLE = false; break; }
          if (av < nv) someStrict = true;
        }
        if (allLE && someStrict) {
          // Promote all strictly-larger places to ω
          const promoted: OmegaMarking = { ...newMarking };
          for (const p of placeIds) {
            if ((newMarking[p] ?? 0) > (ancestorMarking[p] ?? 0)) promoted[p] = ω;
          }
          newMarking = promoted;
        }
      }

      // Check if this exact marking already exists anywhere in the tree
      const existingNode = Object.values(nodes).find(n =>
        markingsEqual(n.marking, newMarking, placeIds),
      );

      const newId = nanoid(6);
      const newNode: CoverabilityNode = {
        id: newId,
        marking: newMarking,
        parentId: nodeId,
        transitionId: t.id,
        transitionLabel: t.label || t.id,
        nodeType: existingNode ? 'duplicate' : 'normal',
        duplicateOfId: existingNode ? existingNode.id : null,
        children: [],
      };

      nodes[newId] = newNode;
      nodes[nodeId].children.push(newId);

      if (!existingNode) queue.push(newId);
    }
  }

  return { nodes, rootId, placeIds, placeLabels };
}

export function analyzeNet(tree: CoverabilityTree, net: PetriNet): NetProperties {
  const { nodes, placeIds } = tree;
  const allNodes = Object.values(nodes);

  // Bounded: no ω anywhere in the tree
  const bounded = allNodes.every(n => placeIds.every(p => (n.marking[p] ?? 0) !== ω));

  // Per-place max token count (Infinity if unbounded)
  const boundedness: Record<NodeId, number> = {};
  for (const p of placeIds) {
    let max = 0;
    for (const n of allNodes) {
      const v = n.marking[p] ?? 0;
      if (v === ω) { max = ω; break; }
      if (v > max) max = v;
    }
    boundedness[p] = max;
  }

  const safe = Object.values(boundedness).every(v => v <= 1);

  // Conservative: every transition preserves total token count (normal arcs only)
  const conservative = Object.values(net.transitions).every(t => {
    let inSum = 0, outSum = 0;
    for (const arc of Object.values(net.arcs)) {
      if (arc.type !== 'normal') continue;
      if (arc.target === t.id) inSum += arc.weight;
      if (arc.source === t.id) outSum += arc.weight;
    }
    return inSum === outSum;
  });

  // Deadlock-free: no terminal nodes
  const deadlockFree = allNodes.every(n => n.nodeType !== 'terminal');

  // Potentially live: every transition appears at least once in the tree
  const transitionIds = Object.keys(net.transitions);
  const firedSet = new Set(allNodes.filter(n => n.transitionId).map(n => n.transitionId!));
  const deadTransitions = transitionIds.filter(id => !firedSet.has(id));
  const potentiallyLive = deadTransitions.length === 0;

  // Live: potentially live AND deadlock-free
  const live = deadlockFree && potentiallyLive;

  // Stable: at every reachable marking, any firing of an enabled transition
  // leaves all other simultaneously-enabled transitions still enabled
  let stable = true;
  let unstableExample: NetProperties['unstableExample'];

  outer: for (const node of allNodes) {
    if (node.nodeType === 'terminal' || node.nodeType === 'duplicate') continue;
    const enabledHere = Object.values(net.transitions).filter(t =>
      isEnabledOmega(t.id, net.arcs, net.places, node.marking),
    );
    if (enabledHere.length < 2) continue;
    for (const t1 of enabledHere) {
      const afterFire = fireOmega(t1.id, net.arcs, node.marking);
      for (const t2 of enabledHere) {
        if (t1.id === t2.id) continue;
        if (!isEnabledOmega(t2.id, net.arcs, net.places, afterFire)) {
          stable = false;
          unstableExample = {
            markingNodeId: node.id,
            t1Label: t1.label || t1.id,
            t2Label: t2.label || t2.id,
          };
          break outer;
        }
      }
    }
  }

  return {
    bounded,
    safe,
    conservative,
    live,
    potentiallyLive,
    deadlockFree,
    stable,
    boundedness,
    deadTransitions,
    unstableExample,
  };
}

export function checkReachability(
  tree: CoverabilityTree,
  targetMarking: Marking,
): { reachable: boolean; coveringNodeId: string | null } {
  const { nodes, placeIds } = tree;

  for (const node of Object.values(nodes)) {
    let covers = true;
    for (const p of placeIds) {
      const tv = node.marking[p] ?? 0;
      const mv = targetMarking[p] ?? 0;
      if (tv === ω) continue;   // ω covers any value
      if (tv !== mv) { covers = false; break; }
    }
    if (covers) return { reachable: true, coveringNodeId: node.id };
  }

  return { reachable: false, coveringNodeId: null };
}

export function fmtOmegaMarking(marking: OmegaMarking, placeIds: NodeId[]): string {
  return '(' + placeIds.map(p => {
    const v = marking[p] ?? 0;
    return v === ω ? 'ω' : String(v);
  }).join(', ') + ')';
}
