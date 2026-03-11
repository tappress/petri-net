/**
 * Tests for "My First Project / Sheet 1" (exported JSON).
 *
 * Topology:
 *   P1 --[2]--> T1 --[1]--> P2 --[1]--> T2 --[1]--> P3
 *   P3 --[1]--> T3 --[1]--> P2          (T3 recycles P3 into P2)
 *   P3 --[1]--> T4 --[3]--> P1          (T4 amplifies: 1+1 in → 3 out)
 *   P1 --[1]--> T4
 *
 * Initial marking M0: P1=3, P2=0, P3=1
 *
 * Key properties derived by hand:
 *   - Enabled at M0:  T1 (P1≥2), T3 (P3≥1), T4 (P1≥1 ∧ P3≥1)
 *   - Disabled at M0: T2 (P2=0)
 *   - T4 is a token amplifier: consumes P1+P3 (1+1=2), produces P1 (3) → net +1
 *   - T1 is lossy: consumes P1 (2), produces P2 (1) → net -1
 *   - Cycle A: T3 → T2 → M0
 *   - Cycle B: T4 → T1 → T2 → M0 (but with P1=5 after T4, two T1-firings possible)
 */

import { describe, it, expect } from 'vitest';
import { isEnabled, fire, getEnabledTransitions, step } from './petri';
import type { Marking, PetriNet } from '@/types/petri';

// ---------------------------------------------------------------------------
// Fixture — pasted verbatim from exported JSON (+ rotation:0 for TypeScript)
// ---------------------------------------------------------------------------

const P1 = 'xYqxoqu5ZxVC0gwU1nOpk';
const P2 = 'VuqLxdFLE20t_JBeYs_M8';
const P3 = 'syDKHoC9UGynp2SsPMQki';
const T1 = 'NRBo3lwYwPhzd-fQZgamF';
const T2 = 'SL4LNRRk3ul9Yb5jtj8pt';
const T3 = 'ztBHat3qvNmtzaL3sQnWG';
const T4 = 'XysQbSTZ_-jLxdNyRpxGU';

const net: PetriNet = {
  places: {
    [P1]: { id: P1, label: 'P1', x: -193.65, y: -178.92, tokens: 3, capacity: null },
    [P2]: { id: P2, label: 'P2', x:  227.22, y: -182.04, tokens: 0, capacity: null },
    [P3]: { id: P3, label: 'P3', x:  228.63, y:  129.35, tokens: 1, capacity: null },
  },
  transitions: {
    [T1]: { id: T1, label: 'T1', x:   6.35, y: -178.92, priority: 0, rotation: 0 },
    [T2]: { id: T2, label: 'T2', x: 346.03, y: -182.16, priority: 0, rotation: 0 },
    [T3]: { id: T3, label: 'T3', x: 228.63, y:  -36.68, priority: 0, rotation: 0 },
    [T4]: { id: T4, label: 'T4', x: -197.62, y: 127.03, priority: 0, rotation: 0 },
  },
  arcs: {
    // P1 -[2]-> T1 -[1]-> P2 -[1]-> T2 -[1]-> P3
    'cSLmbnz7eZtgwJHuoXJtc': { id: 'cSLmbnz7eZtgwJHuoXJtc', source: P1, target: T1, weight: 2, type: 'normal', cpDx: 0,      cpDy: 0 },
    'tvY9rBG5ig49uWRi2Em31': { id: 'tvY9rBG5ig49uWRi2Em31', source: T1, target: P2, weight: 1, type: 'normal', cpDx: 0,      cpDy: 0 },
    'TToX8Bx5rHhCQcC8rf9dO': { id: 'TToX8Bx5rHhCQcC8rf9dO', source: P2, target: T2, weight: 1, type: 'normal', cpDx: 0,      cpDy: 0 },
    '39dOM-pWorxn1h0tLuLCR':  { id: '39dOM-pWorxn1h0tLuLCR',  source: T2, target: P3, weight: 1, type: 'normal', cpDx: 163.72, cpDy: 35.41 },
    // P3 -[1]-> T3 -[1]-> P2  (recycle)
    'VsGp4K-cVVHkTZtK5edJN': { id: 'VsGp4K-cVVHkTZtK5edJN', source: P3, target: T3, weight: 1, type: 'normal', cpDx: 0,       cpDy: 0 },
    'sajVRi4EQQYgqUADrK_7e': { id: 'sajVRi4EQQYgqUADrK_7e', source: T3, target: P2, weight: 1, type: 'normal', cpDx: 0,       cpDy: 0 },
    // P3 -[1]-> T4 -[3]-> P1  (amplifier)
    'P4NkoJtDnENhACc--dbDS':  { id: 'P4NkoJtDnENhACc--dbDS',  source: P3, target: T4, weight: 1, type: 'normal', cpDx: 0,       cpDy: 0 },
    'veP1ngQqL4Bmd68N_wafJ':  { id: 'veP1ngQqL4Bmd68N_wafJ',  source: P1, target: T4, weight: 1, type: 'normal', cpDx: 201.59,  cpDy: -34.59 },
    'bqy5yaOrDv7sUbDp6G4xz':  { id: 'bqy5yaOrDv7sUbDp6G4xz',  source: T4, target: P1, weight: 3, type: 'normal', cpDx: -211.90, cpDy: -27.03 },
  },
  initialMarking: { [P1]: 3, [P2]: 0, [P3]: 1 },
};

const M0: Marking = { [P1]: 3, [P2]: 0, [P3]: 1 };

const total = (m: Marking) => (m[P1] ?? 0) + (m[P2] ?? 0) + (m[P3] ?? 0);

function enabledLabels(m: Marking) {
  return getEnabledTransitions(net, m).map(t => t.label).sort();
}

function fireT(id: string, m: Marking): Marking {
  return fire(net.transitions[id], net.arcs, m);
}

// ---------------------------------------------------------------------------
// 1. Initial enabling
// ---------------------------------------------------------------------------

describe('initial marking M0 = {P1:3, P2:0, P3:1}', () => {
  it('T1 enabled — P1=3 ≥ w=2', () => {
    expect(isEnabled(net.transitions[T1], net.arcs, net.places, M0)).toBe(true);
  });

  it('T2 disabled — P2=0 < w=1', () => {
    expect(isEnabled(net.transitions[T2], net.arcs, net.places, M0)).toBe(false);
  });

  it('T3 enabled — P3=1 ≥ w=1', () => {
    expect(isEnabled(net.transitions[T3], net.arcs, net.places, M0)).toBe(true);
  });

  it('T4 enabled — P1=3 ≥ w=1 AND P3=1 ≥ w=1', () => {
    expect(isEnabled(net.transitions[T4], net.arcs, net.places, M0)).toBe(true);
  });

  it('exactly {T1, T3, T4} enabled', () => {
    expect(enabledLabels(M0)).toEqual(['T1', 'T3', 'T4']);
  });
});

// ---------------------------------------------------------------------------
// 2. T1 fires: P1 -2, P2 +1
// ---------------------------------------------------------------------------

describe('T1 fires from M0', () => {
  const m = fireT(T1, M0);

  it('P1 = 1 (3 - 2)', () => { expect(m[P1]).toBe(1); });
  it('P2 = 1 (0 + 1)', () => { expect(m[P2]).toBe(1); });
  it('P3 = 1 (unchanged)', () => { expect(m[P3]).toBe(1); });

  it('T1 disabled after fire (P1=1 < w=2)', () => {
    expect(isEnabled(net.transitions[T1], net.arcs, net.places, m)).toBe(false);
  });

  it('{T2, T3, T4} enabled — T4 still on since P1=1 ≥ w=1', () => {
    expect(enabledLabels(m)).toEqual(['T2', 'T3', 'T4']);
  });

  it('T1 is lossy: total tokens = M0 - 1', () => {
    expect(total(m)).toBe(total(M0) - 1);
  });
});

// ---------------------------------------------------------------------------
// 3. T3 fires from M0: P3→T3→P2 recycle
// ---------------------------------------------------------------------------

describe('T3 fires from M0', () => {
  const m = fireT(T3, M0);

  it('P3 = 0 (1 - 1)', () => { expect(m[P3]).toBe(0); });
  it('P2 = 1 (0 + 1)', () => { expect(m[P2]).toBe(1); });
  it('P1 = 3 (unchanged)', () => { expect(m[P1]).toBe(3); });

  it('{T1, T2} enabled; T3 and T4 disabled (P3=0)', () => {
    expect(enabledLabels(m)).toEqual(['T1', 'T2']);
  });

  it('T3 conserves total tokens (1 in, 1 out)', () => {
    expect(total(m)).toBe(total(M0));
  });
});

// ---------------------------------------------------------------------------
// 4. T4 fires from M0: token amplifier P1+P3 → 3×P1
// ---------------------------------------------------------------------------

describe('T4 fires from M0 — token amplifier', () => {
  const m = fireT(T4, M0);

  it('P1 = 5 (3 - 1 + 3)', () => { expect(m[P1]).toBe(5); });
  it('P3 = 0 (1 - 1)', ()     => { expect(m[P3]).toBe(0); });
  it('P2 = 0 (unchanged)', ()  => { expect(m[P2]).toBe(0); });

  it('T4 is a net token source: total +1', () => {
    expect(total(m)).toBe(total(M0) + 1); // consumes 2, produces 3
  });

  it('only T1 enabled (P1=5 ≥ 2; P2=0, P3=0)', () => {
    expect(enabledLabels(m)).toEqual(['T1']);
  });

  it('no deadlock after T4 (T1 still fires)', () => {
    const { fired } = step(net, m);
    expect(fired).toBe(T1);
  });
});

// ---------------------------------------------------------------------------
// 5. Cycle A: T3 → T2 → M0
// ---------------------------------------------------------------------------

describe('cycle A: T3 → T2 returns to M0', () => {
  it('M0 → T3 → T2 = M0', () => {
    const m1 = fireT(T3, M0); // {P1:3, P2:1, P3:0}
    const m2 = fireT(T2, m1); // {P1:3, P2:0, P3:1}
    expect(m2[P1]).toBe(M0[P1]);
    expect(m2[P2]).toBe(M0[P2]);
    expect(m2[P3]).toBe(M0[P3]);
  });
});

// ---------------------------------------------------------------------------
// 6. Cycle B: T4 → T1 → T2 → M0
// ---------------------------------------------------------------------------

describe('cycle B: T4 → T1 → T2 returns to M0', () => {
  // T4: {P1:3,P2:0,P3:1} → {P1:5,P2:0,P3:0}
  // T1: {P1:5,P2:0,P3:0} → {P1:3,P2:1,P3:0}
  // T2: {P1:3,P2:1,P3:0} → {P1:3,P2:0,P3:1} = M0

  it('after T4→T1: P1=3, P2=1, P3=0', () => {
    const m = fireT(T1, fireT(T4, M0));
    expect(m[P1]).toBe(3);
    expect(m[P2]).toBe(1);
    expect(m[P3]).toBe(0);
  });

  it('after T4→T1→T2: back to M0', () => {
    const m = fireT(T2, fireT(T1, fireT(T4, M0)));
    expect(m[P1]).toBe(M0[P1]);
    expect(m[P2]).toBe(M0[P2]);
    expect(m[P3]).toBe(M0[P3]);
  });

  it('P1=5 after T4 allows two T1-firings before P1 runs out', () => {
    const mAfterT4 = fireT(T4, M0); // P1=5
    const m1 = fireT(T1, mAfterT4); // P1=3
    const m2 = fireT(T1, m1);       // P1=1
    expect(m2[P1]).toBe(1);
    expect(m2[P2]).toBe(2);
    // Third T1-firing impossible (P1=1 < w=2)
    expect(isEnabled(net.transitions[T1], net.arcs, net.places, m2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Conflict: T3 and T4 share P3
// ---------------------------------------------------------------------------

describe('conflict: T3 and T4 both need P3=1', () => {
  it('once T3 fires, T4 disabled (P3=0)', () => {
    const m = fireT(T3, M0);
    expect(isEnabled(net.transitions[T4], net.arcs, net.places, m)).toBe(false);
  });

  it('once T4 fires, T3 disabled (P3=0)', () => {
    const m = fireT(T4, M0);
    expect(isEnabled(net.transitions[T3], net.arcs, net.places, m)).toBe(false);
  });

  it('step() from M0 picks one of the enabled transitions', () => {
    const { fired } = step(net, M0);
    expect([T1, T3, T4]).toContain(fired);
  });
});

// ---------------------------------------------------------------------------
// 8. Reachability: T2 is unreachable without T1 or T3 firing first
// ---------------------------------------------------------------------------

describe('T2 reachability', () => {
  it('T2 disabled at M0 (P2=0)', () => {
    expect(isEnabled(net.transitions[T2], net.arcs, net.places, M0)).toBe(false);
  });

  it('T2 reachable via T1 (P2 gets a token)', () => {
    const m = fireT(T1, M0);
    expect(isEnabled(net.transitions[T2], net.arcs, net.places, m)).toBe(true);
  });

  it('T2 reachable via T3 (P3 token cycled into P2)', () => {
    const m = fireT(T3, M0);
    expect(isEnabled(net.transitions[T2], net.arcs, net.places, m)).toBe(true);
  });
});
