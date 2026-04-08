import type { PetriNet, NodeId, CoverabilityTree } from '@/types/petri';

// ─── Rational arithmetic ────────────────────────────────────────────────────

type Rat = { n: number; d: number };

const Z: Rat = { n: 0, d: 1 };
const ONE: Rat = { n: 1, d: 1 };

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a || 1;
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

function norm(n: number, d: number): Rat {
  if (d === 0) throw new Error('division by zero');
  if (n === 0) return Z;
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

const rat = (n: number): Rat => ({ n, d: 1 });
const sub = (a: Rat, b: Rat): Rat => norm(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Rat, b: Rat): Rat => norm(a.n * b.n, a.d * b.d);
const div = (a: Rat, b: Rat): Rat => norm(a.n * b.d, a.d * b.n);
const neg = (a: Rat): Rat => ({ n: -a.n, d: a.d });
const isZero = (a: Rat): boolean => a.n === 0;

// ─── Matrix construction ───────────────────────────────────────────────────

export interface NetMatrices {
  placeIds: NodeId[];
  transitionIds: NodeId[];
  placeLabels: Record<NodeId, string>;
  transitionLabels: Record<NodeId, string>;
  /** F[i][j]: weight of arc from place i → transition j (preconditions). */
  F: number[][];
  /** H[j][i]: weight of arc from transition j → place i (consequences). */
  H: number[][];
  /** C[i][j] = H[j][i] − F[i][j] (incidence). */
  C: number[][];
  initialMarking: number[];
}

export function buildMatrices(net: PetriNet): NetMatrices {
  const placeIds = Object.keys(net.places).sort((a, b) =>
    (net.places[a].label || a).localeCompare(net.places[b].label || b),
  );
  const transitionIds = Object.keys(net.transitions).sort((a, b) =>
    (net.transitions[a].label || a).localeCompare(net.transitions[b].label || b),
  );

  const placeLabels: Record<NodeId, string> = {};
  for (const p of placeIds) placeLabels[p] = net.places[p].label || p;
  const transitionLabels: Record<NodeId, string> = {};
  for (const t of transitionIds) transitionLabels[t] = net.transitions[t].label || t;

  const np = placeIds.length;
  const nt = transitionIds.length;
  const placeIdx: Record<NodeId, number> = {};
  placeIds.forEach((p, i) => { placeIdx[p] = i; });
  const transitionIdx: Record<NodeId, number> = {};
  transitionIds.forEach((t, j) => { transitionIdx[t] = j; });

  const F: number[][] = Array.from({ length: np }, () => new Array(nt).fill(0));
  const H: number[][] = Array.from({ length: nt }, () => new Array(np).fill(0));

  for (const arc of Object.values(net.arcs)) {
    if (arc.type !== 'normal') continue;
    if (arc.source in net.places && arc.target in net.transitions) {
      const i = placeIdx[arc.source];
      const j = transitionIdx[arc.target];
      F[i][j] += arc.weight;
    } else if (arc.source in net.transitions && arc.target in net.places) {
      const j = transitionIdx[arc.source];
      const i = placeIdx[arc.target];
      H[j][i] += arc.weight;
    }
  }

  // C = H^T − F  (rows = places, cols = transitions)
  const C: number[][] = Array.from({ length: np }, () => new Array(nt).fill(0));
  for (let i = 0; i < np; i++) {
    for (let j = 0; j < nt; j++) {
      C[i][j] = H[j][i] - F[i][j];
    }
  }

  const initialMarking = placeIds.map(p => net.initialMarking[p] ?? 0);

  return { placeIds, transitionIds, placeLabels, transitionLabels, F, H, C, initialMarking };
}

// ─── Null space (integer basis) ─────────────────────────────────────────────

function ratMatrix(m: number[][]): Rat[][] {
  return m.map(r => r.map(rat));
}

function rrefRat(M: Rat[][]): { rref: Rat[][]; pivots: number[] } {
  const rows = M.length;
  if (rows === 0) return { rref: M, pivots: [] };
  const cols = M[0].length;
  const m = M.map(r => r.slice());
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let pivotRow = -1;
    for (let i = r; i < rows; i++) {
      if (!isZero(m[i][c])) { pivotRow = i; break; }
    }
    if (pivotRow === -1) continue;
    [m[r], m[pivotRow]] = [m[pivotRow], m[r]];
    const pv = m[r][c];
    for (let j = 0; j < cols; j++) m[r][j] = div(m[r][j], pv);
    for (let i = 0; i < rows; i++) {
      if (i !== r && !isZero(m[i][c])) {
        const f = m[i][c];
        for (let j = 0; j < cols; j++) m[i][j] = sub(m[i][j], mul(f, m[r][j]));
      }
    }
    pivots.push(c);
    r++;
  }
  return { rref: m, pivots };
}

/** Rational number for display: numerator and denominator (denominator ≥ 1). */
export interface DisplayRat { n: number; d: number }

/** Per–free-variable substitution case: shows how a basis vector is constructed. */
export interface SolveCase {
  freeVar: number;                              // column index of the free variable set to 1
  rationalVector: DisplayRat[];                 // rational solution before integer scaling
  scale: number;                                // multiplier (LCM of denominators) used to integerize
  intVector: number[];                          // integer basis vector after scaling + gcd-reduce
}

/** Full solver output for Ax = 0, including intermediate Gauss-elimination steps. */
export interface SolveSteps {
  rref: DisplayRat[][];                         // RREF of A as exact rationals
  pivots: number[];                             // pivot column indices (length = rank)
  free: number[];                               // free column indices
  cases: SolveCase[];                           // one per free variable
  basis: number[][];                            // final integer basis vectors
}

function ratToDisplay(r: Rat): DisplayRat { return { n: r.n, d: r.d }; }

/** Solve Ax = 0; return RREF, pivot/free decomposition, and integer basis. */
export function solveNullSpaceSteps(A: number[][], cols: number): SolveSteps {
  if (cols === 0) {
    return { rref: [], pivots: [], free: [], cases: [], basis: [] };
  }
  if (A.length === 0 || A[0].length === 0) {
    // No constraints — every standard basis vector is in the null space.
    const basis: number[][] = [];
    const cases: SolveCase[] = [];
    for (let i = 0; i < cols; i++) {
      const v = new Array(cols).fill(0);
      v[i] = 1;
      basis.push(v);
      cases.push({
        freeVar: i,
        rationalVector: v.map(x => ({ n: x, d: 1 })),
        scale: 1,
        intVector: v,
      });
    }
    return {
      rref: [],
      pivots: [],
      free: Array.from({ length: cols }, (_, i) => i),
      cases,
      basis,
    };
  }

  const { rref, pivots } = rrefRat(ratMatrix(A));
  const pivotSet = new Set(pivots);
  const free: number[] = [];
  for (let c = 0; c < cols; c++) if (!pivotSet.has(c)) free.push(c);

  const basis: number[][] = [];
  const cases: SolveCase[] = [];

  for (const f of free) {
    const v: Rat[] = new Array(cols).fill(Z);
    v[f] = ONE;
    for (let i = 0; i < pivots.length; i++) {
      v[pivots[i]] = neg(rref[i][f]);
    }
    // Convert rationals to integers via LCM of denominators
    let L = 1;
    for (const r of v) L = lcm(L, r.d);
    let intV = v.map(r => Math.round((r.n * L) / r.d));
    // Reduce by gcd
    let g = 0;
    for (const x of intV) g = gcd(g, x);
    if (g > 1) intV = intV.map(x => x / g);
    // Prefer leading nonzero positive when entire vector is non-positive (cosmetic)
    const firstNonZero = intV.find(x => x !== 0) ?? 0;
    let flipped = false;
    if (firstNonZero < 0 && intV.every(x => x <= 0)) {
      intV = intV.map(x => -x);
      flipped = true;
    }
    basis.push(intV);
    cases.push({
      freeVar: f,
      rationalVector: v.map(ratToDisplay),
      scale: (L / (g || 1)) * (flipped ? -1 : 1),
      intVector: intV,
    });
  }

  return {
    rref: rref.map(row => row.map(ratToDisplay)),
    pivots,
    free,
    cases,
    basis,
  };
}

/** T-invariants: solve C·x = 0 (x is a transition firing vector). */
export function tInvariantsBasis(C: number[][], nt: number): number[][] {
  return solveNullSpaceSteps(C, nt).basis;
}

/** P-invariants: solve y·C = 0 → y is in null space of Cᵀ. */
export function pInvariantsBasis(C: number[][], np: number): number[][] {
  return solvePInvariantsSteps(C, np).basis;
}

/** Returns full solve steps for T-invariants (system C·x = 0). */
export function tInvariantsSteps(C: number[][], nt: number): SolveSteps {
  return solveNullSpaceSteps(C, nt);
}

/** Returns full solve steps for P-invariants (system y·C = 0). */
export function solvePInvariantsSteps(C: number[][], np: number): SolveSteps {
  if (C.length === 0) {
    return solveNullSpaceSteps([], np);
  }
  const nt = C[0].length;
  const Ct: number[][] = Array.from({ length: nt }, () => new Array(np).fill(0));
  for (let i = 0; i < np; i++) {
    for (let j = 0; j < nt; j++) {
      Ct[j][i] = C[i][j];
    }
  }
  return solveNullSpaceSteps(Ct, np);
}

// ─── Firing path through coverability tree ─────────────────────────────────

export interface FiringPath {
  /** Path of node IDs from root to chosen node. */
  nodeIds: string[];
  /** Labels of fired transitions, in order. */
  firedLabels: string[];
  /** Count per transition (in transitionIds order). */
  firingVector: number[];
  /** Start (root) marking, in placeIds order. */
  startMarking: number[];
  /** End marking at chosen node, in placeIds order (Infinity = ω). */
  endMarking: number[];
}

/** DFS for the first node at depth ≥ minLen; falls back to deepest node found. */
function findPathAtLeastLen(tree: CoverabilityTree, minLen: number): string[] {
  const { nodes, rootId } = tree;
  let bestPath: string[] = [rootId];

  const stack: { id: string; path: string[] }[] = [{ id: rootId, path: [rootId] }];
  while (stack.length > 0) {
    const { id, path } = stack.pop()!;
    if (path.length - 1 >= minLen) return path;
    if (path.length > bestPath.length) bestPath = path;
    const node = nodes[id];
    if (!node) continue;
    if (node.nodeType === 'duplicate' || node.nodeType === 'terminal') continue;
    for (const cid of node.children) {
      stack.push({ id: cid, path: [...path, cid] });
    }
  }
  return bestPath;
}

export function computeFiringPath(
  tree: CoverabilityTree,
  matrices: NetMatrices,
  minLen = 5,
): FiringPath {
  const nodeIds = findPathAtLeastLen(tree, minLen);
  const firedLabels: string[] = [];
  const firingVector = new Array(matrices.transitionIds.length).fill(0);

  for (let i = 1; i < nodeIds.length; i++) {
    const node = tree.nodes[nodeIds[i]];
    if (!node?.transitionId) continue;
    firedLabels.push(node.transitionLabel);
    const idx = matrices.transitionIds.indexOf(node.transitionId);
    if (idx !== -1) firingVector[idx]++;
  }

  const startMarking = matrices.placeIds.map(p => {
    const v = tree.nodes[nodeIds[0]].marking[p] ?? 0;
    return v === Infinity ? Infinity : v;
  });
  const endMarking = matrices.placeIds.map(p => {
    const v = tree.nodes[nodeIds[nodeIds.length - 1]].marking[p] ?? 0;
    return v === Infinity ? Infinity : v;
  });

  return { nodeIds, firedLabels, firingVector, startMarking, endMarking };
}

// ─── Matrix / vector helpers ───────────────────────────────────────────────

export function matVecMul(M: number[][], v: number[]): number[] {
  return M.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
}

export function vecAdd(a: number[], b: number[]): number[] {
  return a.map((x, i) => {
    if (x === Infinity || b[i] === Infinity) return Infinity;
    return x + b[i];
  });
}

export function vecEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ─── Invariant property checks ─────────────────────────────────────────────

/** Positive: all entries ≥ 0 and at least one > 0. */
export function isPositiveInv(v: number[]): boolean {
  return v.every(x => x >= 0) && v.some(x => x > 0);
}

/** Complete: every entry is non-zero (covers all elements of its kind). */
export function isCompleteInv(v: number[]): boolean {
  return v.length > 0 && v.every(x => x !== 0);
}
