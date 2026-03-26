import { useState, useMemo, useEffect, useRef } from 'react';
import { useAnalysisStore } from '@/store/analysisStore';
import { useProjectStore } from '@/store/projectStore';
import { checkReachability, fmtOmegaMarking } from '@/engine/coverability';
import type { CoverabilityTree, Marking, NodeId } from '@/types/petri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

// ─── SVG tree graph ───────────────────────────────────────────────────────────

const RX = 44;   // ellipse x-radius
const RY = 14;   // ellipse y-radius
const H_GAP = 6;
const V_GAP = 88;

function subtreeW(nodeId: string, nodes: CoverabilityTree['nodes']): number {
  const node = nodes[nodeId];
  if (!node || node.children.length === 0) return RX * 2 + H_GAP;
  return node.children.reduce((s, c) => s + subtreeW(c, nodes), 0);
}

function placeLayout(
  nodeId: string,
  nodes: CoverabilityTree['nodes'],
  ox: number, depth: number, sw: number,
  out: Map<string, { x: number; y: number }>,
) {
  out.set(nodeId, { x: ox + sw / 2, y: depth * V_GAP + RY + 10 });
  const node = nodes[nodeId];
  if (!node) return;
  let cx = ox;
  for (const cid of node.children) {
    const w = subtreeW(cid, nodes);
    placeLayout(cid, nodes, cx, depth + 1, w, out);
    cx += w;
  }
}

function ellipseBorder(cx: number, cy: number, tx: number, ty: number) {
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy + RY };
  const t = 1 / Math.sqrt((dx / RX) ** 2 + (dy / RY) ** 2);
  return { x: cx + t * dx, y: cy + t * dy };
}

function TreeGraph({ tree }: { tree: CoverabilityTree }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  viewRef.current = view;

  const { positions, totalW, totalH } = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const sw = subtreeW(tree.rootId, tree.nodes);
    placeLayout(tree.rootId, tree.nodes, 0, 0, sw, map);
    let maxY = 0;
    for (const p of map.values()) if (p.y > maxY) maxY = p.y;
    return { positions: map, totalW: sw, totalH: maxY + RY + 24 };
  }, [tree]);

  // Auto-fit when tree changes
  useEffect(() => {
    const el = containerRef.current;
    const cw = el?.clientWidth ?? 296;
    const ch = el?.clientHeight ?? 300;
    const scale = Math.min(1, Math.min((cw - 8) / totalW, (ch - 8) / totalH));
    const v = { x: (cw - totalW * scale) / 2, y: 8, scale };
    setView(v);
    viewRef.current = v;
  }, [tree, totalW, totalH]);

  // Non-passive wheel for zooming (so preventDefault works)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const v = viewRef.current;
      const newScale = Math.max(0.15, Math.min(4, v.scale * factor));
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const next = {
        x: mx - (mx - v.x) * (newScale / v.scale),
        y: my - (my - v.y) * (newScale / v.scale),
        scale: newScale,
      };
      setView(next);
      viewRef.current = next;
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { mx: e.clientX, my: e.clientY, tx: view.x, ty: view.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const v = {
      ...viewRef.current,
      x: dragRef.current.tx + (e.clientX - dragRef.current.mx),
      y: dragRef.current.ty + (e.clientY - dragRef.current.my),
    };
    setView(v);
    viewRef.current = v;
  };
  const stopDrag = () => { dragRef.current = null; };

  const PAD = 8;

  return (
    <div
      ref={containerRef}
      className="border border-border rounded bg-white cursor-grab active:cursor-grabbing select-none overflow-hidden relative"
      style={{ height: 460 }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      {/* Reset view button */}
      <button
        className="absolute top-1.5 right-1.5 z-10 text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 bg-white/80"
        onMouseDown={e => e.stopPropagation()}
        onClick={() => {
          const el = containerRef.current;
          const cw = el?.clientWidth ?? 296;
          const ch = el?.clientHeight ?? 300;
          const scale = Math.min(1, Math.min((cw - 8) / totalW, (ch - 8) / totalH));
          setView({ x: (cw - totalW * scale) / 2, y: 8, scale });
        }}
      >
        fit
      </button>

      <svg
        width={totalW + PAD * 2}
        height={totalH}
        style={{
          transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})`,
          transformOrigin: '0 0',
          display: 'block',
        }}
      >
        <defs>
          <marker id="ct-arr" markerWidth="8" markerHeight="7" refX="7" refY="3.5" orient="auto">
            <polygon points="0 0, 8 3.5, 0 7" fill="#94a3b8" />
          </marker>
        </defs>
        <g transform={`translate(${PAD},0)`}>
          {/* Edges */}
          {Object.values(tree.nodes).map(node => {
            if (!node.parentId) return null;
            const pPos = positions.get(node.parentId);
            const cPos = positions.get(node.id);
            if (!pPos || !cPos) return null;
            const from = ellipseBorder(pPos.x, pPos.y, cPos.x, cPos.y);
            const to   = ellipseBorder(cPos.x, cPos.y, pPos.x, pPos.y);
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const isVertical = Math.abs(from.x - to.x) < 8;
            return (
              <g key={`e-${node.id}`}>
                <line
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke="#94a3b8" strokeWidth={1.5}
                  markerEnd="url(#ct-arr)"
                />
                <text
                  x={isVertical ? mx + 6 : mx}
                  y={isVertical ? my : my - 5}
                  fontSize={10}
                  fontFamily="monospace"
                  textAnchor={isVertical ? 'start' : 'middle'}
                  fill="#6366f1"
                >
                  {node.transitionLabel}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {Object.values(tree.nodes).map(node => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const label = fmtOmegaMarking(node.marking, tree.placeIds);
            const isT = node.nodeType === 'terminal';
            const isD = node.nodeType === 'duplicate';
            return (
              <g key={`n-${node.id}`}>
                {/* Double ellipse for duplicates */}
                {isD && (
                  <ellipse
                    cx={pos.x} cy={pos.y}
                    rx={RX + 4} ry={RY + 4}
                    fill="none"
                    stroke="#3b82f6" strokeWidth={1}
                  />
                )}
                <ellipse
                  cx={pos.x} cy={pos.y}
                  rx={RX} ry={RY}
                  fill={isT ? '#fee2e2' : '#f8fafc'}
                  stroke={isT ? '#ef4444' : isD ? '#3b82f6' : '#64748b'}
                  strokeWidth={isT || isD ? 2 : 1.5}
                />
                <text
                  x={pos.x} y={pos.y}
                  fontSize={10} fontFamily="monospace"
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#0f172a"
                >
                  {label}
                </text>
                {/* Т / Д badge below node */}
                {(isT || isD) && (
                  <text
                    x={pos.x} y={pos.y + RY + 11}
                    fontSize={9} textAnchor="middle"
                    fontWeight="bold"
                    fill={isT ? '#ef4444' : '#3b82f6'}
                  >
                    {isT ? 'Т' : 'Д'}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

// ─── Property row ─────────────────────────────────────────────────────────────

function PropRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`shrink-0 font-bold text-sm ${ok ? 'text-green-600' : 'text-red-500'}`}>
        {ok ? '✓' : '✗'}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium">{label}</span>
        {detail && <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

// ─── Reachability checker (Task 3) ───────────────────────────────────────────

function ReachabilityChecker({ tree }: { tree: CoverabilityTree }) {
  const { updatePlace } = useProjectStore();
  const hide = useAnalysisStore(s => s.hide);
  const [values, setValues] = useState<Record<NodeId, string>>(() => {
    const init: Record<NodeId, string> = {};
    for (const p of tree.placeIds) init[p] = '0';
    return init;
  });
  const [result, setResult] = useState<{ reachable: boolean; detail: string } | null>(null);

  const check = () => {
    const target: Marking = {};
    for (const p of tree.placeIds) {
      const v = parseInt(values[p] ?? '0', 10);
      target[p] = isNaN(v) || v < 0 ? 0 : v;
    }
    const { reachable, coveringNodeId } = checkReachability(tree, target);
    if (reachable && coveringNodeId) {
      for (const p of tree.placeIds) {
        updatePlace(p, { tokens: target[p] ?? 0 });
      }
      hide();
    } else {
      const markingStr = '(' + tree.placeIds.map(p => target[p] ?? 0).join(', ') + ')';
      setResult({
        reachable: false,
        detail: `Marking ${markingStr} is NOT reachable — no covering node found in the tree.`,
      });
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Enter a target marking to check reachability via the coverability tree.
      </p>
      <div className="text-[10px] text-muted-foreground font-mono mb-1">
        ({tree.placeIds.map(p => tree.placeLabels[p]).join(', ')})
      </div>
      <div className="grid gap-1.5">
        {tree.placeIds.map(p => (
          <div key={p} className="flex items-center gap-2">
            <span className="text-xs font-mono w-10 shrink-0 text-right text-muted-foreground">
              {tree.placeLabels[p]}
            </span>
            <Input
              type="number"
              min={0}
              value={values[p] ?? '0'}
              onChange={e => setValues(prev => ({ ...prev, [p]: e.target.value }))}
              className="h-6 text-xs w-16 px-2"
            />
          </div>
        ))}
      </div>
      <Button size="sm" className="h-7 text-xs w-full mt-1" onClick={check}>
        Check Reachability
      </Button>
      {result && (
        <div className="text-xs rounded px-2 py-1.5 mt-1 leading-snug bg-red-50 border border-red-200 text-red-800">
          {result.detail}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function AnalysisPanel() {
  const { isVisible, tree, properties, hide } = useAnalysisStore();

  if (!isVisible) return null;

  return (
    <div className="flex flex-col bg-card border-l border-border w-1/2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <span className="text-sm font-semibold">Net Analysis</span>
        <button
          onClick={hide}
          className="text-muted-foreground hover:text-foreground text-lg leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {!tree || !properties ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
          Click <strong className="mx-1">Analyze</strong> in the toolbar to build the coverability tree.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-3 space-y-4">

            {/* ── Task 1: Coverability tree ──────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Task 1 — Coverability Tree
                </h3>
                <span className="text-[10px] text-muted-foreground">
                  {Object.keys(tree.nodes).length} nodes
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mb-1.5">
                ({tree.placeIds.map(p => tree.placeLabels[p]).join(', ')})
                {' · '}
                <span className="text-red-500 font-bold">Т</span>=terminal{' '}
                <span className="text-blue-500 font-bold">Д</span>=duplicate
                {' · scroll/drag/pinch'}
              </div>
              <TreeGraph tree={tree} />
            </section>

            <Separator />

            {/* ── Task 2: Properties ─────────────────────────────── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Task 2 — Properties
              </h3>
              <div className="divide-y divide-border">
                <PropRow
                  label="Bounded"
                  ok={properties.bounded}
                  detail={
                    properties.bounded
                      ? 'No ω symbols in the tree — all places have finite bounds.'
                      : 'Tree contains ω symbols — the net is unbounded.'
                  }
                />
                <PropRow
                  label="Safe (1-bounded)"
                  ok={properties.safe}
                  detail={properties.safe ? 'Every place holds at most 1 token.' : undefined}
                />
                <PropRow
                  label="Conservative"
                  ok={properties.conservative}
                  detail={
                    properties.conservative
                      ? 'Every transition preserves the total token count.'
                      : 'Some transition changes the total token count.'
                  }
                />
                <PropRow
                  label="Potentially live"
                  ok={properties.potentiallyLive}
                  detail={
                    properties.potentiallyLive
                      ? 'Every transition fires at least once in the tree.'
                      : `Dead transitions: ${properties.deadTransitions.join(', ') || '—'}`
                  }
                />
                <PropRow
                  label="Live"
                  ok={properties.live}
                  detail={
                    properties.live
                      ? 'Potentially live and no deadlock nodes.'
                      : 'Tree contains terminal (deadlock) nodes.'
                  }
                />
                <PropRow
                  label="Deadlock-free"
                  ok={properties.deadlockFree}
                  detail={
                    properties.deadlockFree
                      ? 'No terminal nodes in the tree.'
                      : 'Tree has terminal nodes (deadlocks exist).'
                  }
                />
                <PropRow
                  label="Stable"
                  ok={properties.stable}
                  detail={
                    properties.stable
                      ? 'No two simultaneously-enabled transitions disable each other.'
                      : properties.unstableExample
                        ? `Firing ${properties.unstableExample.t1Label} in ${
                            fmtOmegaMarking(
                              tree.nodes[properties.unstableExample.markingNodeId].marking,
                              tree.placeIds,
                            )
                          } disables ${properties.unstableExample.t2Label}.`
                        : 'Some firing disables another simultaneously-enabled transition.'
                  }
                />
              </div>

              {/* Per-place boundedness */}
              <div className="mt-2">
                <p className="text-[11px] text-muted-foreground mb-1">Place bounds:</p>
                <div className="flex flex-wrap gap-1">
                  {tree.placeIds.map(p => (
                    <Badge key={p} variant="outline" className="text-[10px] font-mono">
                      {tree.placeLabels[p]}:{' '}
                      {properties.boundedness[p] === Infinity ? 'ω' : properties.boundedness[p]}
                    </Badge>
                  ))}
                </div>
              </div>
            </section>

            <Separator />

            {/* ── Task 3: Reachability ───────────────────────────── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Task 3 — Reachability Check
              </h3>
              <ReachabilityChecker tree={tree} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
