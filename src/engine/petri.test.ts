import { describe, it, expect } from 'vitest';
import { isEnabled, fire, getEnabledTransitions, step } from './petri';
import type { Arc, ArcId, Marking, NodeId, Place, PetriNet, Transition } from '@/types/petri';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function place(id: NodeId, tokens = 0, capacity: number | null = null): Place {
  return { id, label: id, x: 0, y: 0, tokens, capacity };
}

function transition(id: NodeId, priority = 0): Transition {
  return { id, label: id, x: 0, y: 0, priority, rotation: 0 };
}

type ArcOpts = { weight?: number; type?: Arc['type'] };

function arc(id: ArcId, source: NodeId, target: NodeId, opts: ArcOpts = {}): Arc {
  return { id, source, target, weight: opts.weight ?? 1, type: opts.type ?? 'normal', cpDx: 0, cpDy: 0 };
}

function arcsMap(...arcs: Arc[]): Record<ArcId, Arc> {
  return Object.fromEntries(arcs.map(a => [a.id, a]));
}

function placesMap(...places: Place[]): Record<NodeId, Place> {
  return Object.fromEntries(places.map(p => [p.id, p]));
}

function transitionsMap(...transitions: Transition[]): Record<NodeId, Transition> {
  return Object.fromEntries(transitions.map(t => [t.id, t]));
}

// ---------------------------------------------------------------------------
// I. Enabling Rule
// ---------------------------------------------------------------------------

describe('isEnabled – normal arcs', () => {
  const p1 = place('p1');
  const t1 = transition('t1');
  const a1 = arc('a1', 'p1', 't1');
  const places = placesMap(p1);

  it('disabled when input place has 0 tokens', () => {
    expect(isEnabled(t1, arcsMap(a1), places, {})).toBe(false);
  });

  it('enabled when input place has exactly w tokens', () => {
    expect(isEnabled(t1, arcsMap(a1), places, { p1: 1 })).toBe(true);
  });

  it('enabled when input place has more than w tokens', () => {
    expect(isEnabled(t1, arcsMap(a1), places, { p1: 5 })).toBe(true);
  });

  it('respects arc weight (w=3): disabled with 2 tokens', () => {
    const a = arc('a', 'p1', 't1', { weight: 3 });
    expect(isEnabled(t1, arcsMap(a), places, { p1: 2 })).toBe(false);
  });

  it('respects arc weight (w=3): enabled with 3 tokens', () => {
    const a = arc('a', 'p1', 't1', { weight: 3 });
    expect(isEnabled(t1, arcsMap(a), places, { p1: 3 })).toBe(true);
  });

  it('disabled when ANY input place lacks tokens (multiple inputs)', () => {
    const p2 = place('p2');
    const a2 = arc('a2', 'p2', 't1');
    expect(isEnabled(t1, arcsMap(a1, a2), placesMap(p1, p2), { p1: 1, p2: 0 })).toBe(false);
  });

  it('enabled when ALL input places have enough tokens', () => {
    const p2 = place('p2');
    const a2 = arc('a2', 'p2', 't1');
    expect(isEnabled(t1, arcsMap(a1, a2), placesMap(p1, p2), { p1: 1, p2: 1 })).toBe(true);
  });
});

describe('isEnabled – inhibitor arcs', () => {
  const t1 = transition('t1');
  const p1 = place('p1');

  it('enabled when inhibitor place is empty', () => {
    const a = arc('a', 'p1', 't1', { type: 'inhibitor' });
    expect(isEnabled(t1, arcsMap(a), placesMap(p1), {})).toBe(true);
  });

  it('disabled when inhibitor place has >= weight tokens', () => {
    const a = arc('a', 'p1', 't1', { type: 'inhibitor', weight: 1 });
    expect(isEnabled(t1, arcsMap(a), placesMap(p1), { p1: 1 })).toBe(false);
  });

  it('enabled when inhibitor place has fewer tokens than weight', () => {
    const a = arc('a', 'p1', 't1', { type: 'inhibitor', weight: 3 });
    expect(isEnabled(t1, arcsMap(a), placesMap(p1), { p1: 2 })).toBe(true);
  });
});

describe('isEnabled – read (test) arcs', () => {
  const t1 = transition('t1');
  const p1 = place('p1');

  it('disabled when read place has fewer tokens than weight', () => {
    const a = arc('a', 'p1', 't1', { type: 'read', weight: 2 });
    expect(isEnabled(t1, arcsMap(a), placesMap(p1), { p1: 1 })).toBe(false);
  });

  it('enabled when read place has exactly weight tokens', () => {
    const a = arc('a', 'p1', 't1', { type: 'read', weight: 2 });
    expect(isEnabled(t1, arcsMap(a), placesMap(p1), { p1: 2 })).toBe(true);
  });
});

describe('isEnabled – place capacity', () => {
  const t1 = transition('t1');
  const p_in = place('p_in');

  it('disabled when firing would overflow output place capacity', () => {
    const p_out = place('p_out', 0, 3);
    const a_in = arc('a_in', 'p_in', 't1');
    const a_out = arc('a_out', 't1', 'p_out');
    const places = placesMap(p_in, p_out);
    // p_out currently has 3 tokens = at capacity; firing adds 1 → overflow
    expect(isEnabled(t1, arcsMap(a_in, a_out), places, { p_in: 1, p_out: 3 })).toBe(false);
  });

  it('enabled when firing stays within output place capacity', () => {
    const p_out = place('p_out', 0, 3);
    const a_in = arc('a_in', 'p_in', 't1');
    const a_out = arc('a_out', 't1', 'p_out');
    const places = placesMap(p_in, p_out);
    expect(isEnabled(t1, arcsMap(a_in, a_out), places, { p_in: 1, p_out: 2 })).toBe(true);
  });

  it('ignores capacity when place has no limit (null)', () => {
    const p_out = place('p_out', 0, null);
    const a_in = arc('a_in', 'p_in', 't1');
    const a_out = arc('a_out', 't1', 'p_out');
    const places = placesMap(p_in, p_out);
    expect(isEnabled(t1, arcsMap(a_in, a_out), places, { p_in: 1, p_out: 9999 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// II. Firing Rule
// ---------------------------------------------------------------------------

describe('fire – normal arcs', () => {
  const t1 = transition('t1');

  it('consumes tokens from input place', () => {
    const a = arc('a', 'p1', 't1');
    const next = fire(t1, arcsMap(a), { p1: 3 });
    expect(next.p1).toBe(2);
  });

  it('produces tokens in output place', () => {
    const a = arc('a', 't1', 'p2');
    const next = fire(t1, arcsMap(a), {});
    expect(next.p2).toBe(1);
  });

  it('consumes and produces atomically (M\'(p) = M(p) - w(p,t) + w(t,p))', () => {
    const a_in = arc('a_in', 'p1', 't1', { weight: 2 });
    const a_out = arc('a_out', 't1', 'p2', { weight: 3 });
    const next = fire(t1, arcsMap(a_in, a_out), { p1: 5, p2: 1 });
    expect(next.p1).toBe(3);
    expect(next.p2).toBe(4);
  });

  it('does not mutate the original marking', () => {
    const a = arc('a', 'p1', 't1');
    const marking: Marking = { p1: 2 };
    fire(t1, arcsMap(a), marking);
    expect(marking.p1).toBe(2);
  });

  it('handles place with no tokens entry (defaults to 0)', () => {
    const a = arc('a', 't1', 'p_new');
    const next = fire(t1, arcsMap(a), {});
    expect(next.p_new).toBe(1);
  });
});

describe('fire – inhibitor arcs', () => {
  const t1 = transition('t1');

  it('does not consume tokens from inhibitor input place', () => {
    // Inhibitor arc goes TO transition — it is an input arc that does NOT consume
    // (inhibitor just blocks enabling; it has no firing effect)
    const a_inh = arc('a_inh', 'p_inh', 't1', { type: 'inhibitor' });
    const a_out = arc('a_out', 't1', 'p_out');
    const next = fire(t1, arcsMap(a_inh, a_out), { p_inh: 0, p_out: 0 });
    expect(next.p_inh).toBe(0); // unchanged
    expect(next.p_out).toBe(1);
  });
});

describe('fire – reset arcs', () => {
  const t1 = transition('t1');

  it('zeroes the source place regardless of token count', () => {
    const a = arc('a', 'p1', 't1', { type: 'reset', weight: 1 });
    const next = fire(t1, arcsMap(a), { p1: 99 });
    expect(next.p1).toBe(0);
  });

  it('reset and output together', () => {
    const a_reset = arc('a_reset', 'p1', 't1', { type: 'reset' });
    const a_out = arc('a_out', 't1', 'p2');
    const next = fire(t1, arcsMap(a_reset, a_out), { p1: 5, p2: 0 });
    expect(next.p1).toBe(0);
    expect(next.p2).toBe(1);
  });
});

describe('fire – read (test) arcs', () => {
  const t1 = transition('t1');

  it('does not consume tokens from read input place', () => {
    const a_read = arc('a_read', 'p1', 't1', { type: 'read', weight: 2 });
    const a_out = arc('a_out', 't1', 'p2');
    const next = fire(t1, arcsMap(a_read, a_out), { p1: 5 });
    expect(next.p1).toBe(5); // unchanged
    expect(next.p2).toBe(1);
  });

  it('read arc with weight: tokens preserved', () => {
    const a_read = arc('a_read', 'p1', 't1', { type: 'read', weight: 3 });
    const next = fire(t1, arcsMap(a_read), { p1: 3 });
    expect(next.p1).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// III. Conflict, Priority, Deadlock
// ---------------------------------------------------------------------------

describe('conflict resolution', () => {
  it('chooses one transition when two compete for the same tokens', () => {
    // p1 has 1 token; both t1 and t2 need it
    const p1 = place('p1');
    const t1 = transition('t1');
    const t2 = transition('t2');
    const a1 = arc('a1', 'p1', 't1');
    const a2 = arc('a2', 'p1', 't2');
    const net: PetriNet = {
      places: placesMap(p1),
      transitions: transitionsMap(t1, t2),
      arcs: arcsMap(a1, a2),
      initialMarking: { p1: 1 },
    };
    const { fired } = step(net, { p1: 1 });
    expect(fired === 't1' || fired === 't2').toBe(true);
  });

  it('higher priority transition always wins', () => {
    const p1 = place('p1');
    const t_low = transition('t_low', 1);
    const t_high = transition('t_high', 10);
    const a1 = arc('a1', 'p1', 't_low');
    const a2 = arc('a2', 'p1', 't_high');
    const net: PetriNet = {
      places: placesMap(p1),
      transitions: transitionsMap(t_low, t_high),
      arcs: arcsMap(a1, a2),
      initialMarking: {},
    };
    // Run 100 times to be statistically certain
    for (let i = 0; i < 100; i++) {
      const { fired } = step(net, { p1: 1 });
      expect(fired).toBe('t_high');
    }
  });
});

describe('deadlock', () => {
  it('returns fired: null when no transitions are enabled', () => {
    const p1 = place('p1');
    const t1 = transition('t1');
    const a = arc('a', 'p1', 't1');
    const net: PetriNet = {
      places: placesMap(p1),
      transitions: transitionsMap(t1),
      arcs: arcsMap(a),
      initialMarking: {},
    };
    const { fired, next } = step(net, {});
    expect(fired).toBeNull();
    expect(next).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// IV. Classic Petri Net Patterns
// ---------------------------------------------------------------------------

describe('producer-consumer pattern', () => {
  // p_buf -> t_consume; t_produce -> p_buf
  const p_buf = place('p_buf');
  const t_produce = transition('t_produce');
  const t_consume = transition('t_consume');
  const a_prod = arc('a_prod', 't_produce', 'p_buf');
  const a_cons = arc('a_cons', 'p_buf', 't_consume');
  const net: PetriNet = {
    places: placesMap(p_buf),
    transitions: transitionsMap(t_produce, t_consume),
    arcs: arcsMap(a_prod, a_cons),
    initialMarking: { p_buf: 1 },
  };

  it('consume fires when buffer has a token', () => {
    const enabled = getEnabledTransitions(net, { p_buf: 1 });
    expect(enabled.map(t => t.id)).toContain('t_consume');
  });

  it('buffer is empty after consuming', () => {
    const next = fire(t_consume, arcsMap(a_cons), { p_buf: 1 });
    expect(next.p_buf).toBe(0);
  });

  it('produce is always enabled (no inputs)', () => {
    expect(isEnabled(t_produce, arcsMap(a_prod), placesMap(p_buf), {})).toBe(true);
  });
});

describe('mutual exclusion (mutex semaphore)', () => {
  // p_sem has 1 token (semaphore). t1 and t2 both need it.
  const p_sem = place('p_sem');
  const p_cs1 = place('p_cs1'); // critical section for t_enter1
  const p_cs2 = place('p_cs2');
  const t_enter1 = transition('t_enter1');
  const t_enter2 = transition('t_enter2');
  const a1_in = arc('a1_in', 'p_sem', 't_enter1');
  const a2_in = arc('a2_in', 'p_sem', 't_enter2');
  const a1_out = arc('a1_out', 't_enter1', 'p_cs1');
  const a2_out = arc('a2_out', 't_enter2', 'p_cs2');
  const places = placesMap(p_sem, p_cs1, p_cs2);
  const arcs_ = arcsMap(a1_in, a2_in, a1_out, a2_out);

  it('both transitions enabled when semaphore = 1', () => {
    const enabled = getEnabledTransitions(
      { places, transitions: transitionsMap(t_enter1, t_enter2), arcs: arcs_, initialMarking: {} },
      { p_sem: 1 }
    );
    expect(enabled).toHaveLength(2);
  });

  it('after one enters, the other is disabled (semaphore consumed)', () => {
    const next = fire(t_enter1, arcs_, { p_sem: 1 });
    expect(next.p_sem).toBe(0);
    expect(isEnabled(t_enter2, arcs_, places, next)).toBe(false);
  });
});

describe('inhibitor arc prevents firing when place is occupied', () => {
  const p_data = place('p_data');
  const p_busy = place('p_busy');
  const t_process = transition('t_process');
  const a_data = arc('a_data', 'p_data', 't_process');
  const a_inh = arc('a_inh', 'p_busy', 't_process', { type: 'inhibitor' });
  const places = placesMap(p_data, p_busy);
  const arcs_ = arcsMap(a_data, a_inh);

  it('enabled when data present and not busy', () => {
    expect(isEnabled(t_process, arcs_, places, { p_data: 1, p_busy: 0 })).toBe(true);
  });

  it('disabled when busy (inhibitor fires)', () => {
    expect(isEnabled(t_process, arcs_, places, { p_data: 1, p_busy: 1 })).toBe(false);
  });
});

describe('read arc – transition enabled without consuming tokens', () => {
  const p_key = place('p_key');
  const p_data = place('p_data');
  const p_out = place('p_out');
  const t1 = transition('t1');
  const a_read = arc('a_read', 'p_key', 't1', { type: 'read' });
  const a_in = arc('a_in', 'p_data', 't1');
  const a_out = arc('a_out', 't1', 'p_out');
  const places = placesMap(p_key, p_data, p_out);
  const arcs_ = arcsMap(a_read, a_in, a_out);

  it('enabled when key and data present', () => {
    expect(isEnabled(t1, arcs_, places, { p_key: 1, p_data: 1 })).toBe(true);
  });

  it('disabled when key absent', () => {
    expect(isEnabled(t1, arcs_, places, { p_key: 0, p_data: 1 })).toBe(false);
  });

  it('key tokens not consumed after firing', () => {
    const next = fire(t1, arcs_, { p_key: 1, p_data: 1 });
    expect(next.p_key).toBe(1); // preserved
    expect(next.p_data).toBe(0); // consumed
    expect(next.p_out).toBe(1);
  });

  it('key can be used by multiple consecutive firings', () => {
    let m: Marking = { p_key: 1, p_data: 3, p_out: 0 };
    for (let i = 0; i < 3; i++) {
      expect(isEnabled(t1, arcs_, places, m)).toBe(true);
      m = fire(t1, arcs_, m);
    }
    expect(m.p_key).toBe(1);
    expect(m.p_data).toBe(0);
    expect(m.p_out).toBe(3);
  });
});

describe('reset arc empties place on fire', () => {
  const t1 = transition('t1');
  const a_trig = arc('a_trig', 'p_trigger', 't1');
  const a_reset = arc('a_reset', 'p_flush', 't1', { type: 'reset', weight: 1 });
  const a_out = arc('a_out', 't1', 'p_out');
  const arcs_ = arcsMap(a_trig, a_reset, a_out);

  it('zeroes flushed place even with many tokens', () => {
    const next = fire(t1, arcs_, { p_trigger: 1, p_flush: 42 });
    expect(next.p_flush).toBe(0);
    expect(next.p_trigger).toBe(0);
    expect(next.p_out).toBe(1);
  });
});

describe('weighted arc token flow', () => {
  const t1 = transition('t1');
  const a_in = arc('a_in', 'p1', 't1', { weight: 3 });
  const a_out = arc('a_out', 't1', 'p2', { weight: 2 });

  it('fires correctly with weighted arcs', () => {
    const next = fire(t1, arcsMap(a_in, a_out), { p1: 5, p2: 0 });
    expect(next.p1).toBe(2);
    expect(next.p2).toBe(2);
  });
});
