import React, { useRef, useState, useCallback } from 'react';
import { useProjectStore, selectActiveSheet } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { useSimulationStore } from '@/store/simulationStore';
import { isEnabled, placeConnectionPoint, transitionConnectionPoint } from '@/engine/petri';
import { useSimulation } from '@/hooks/useSimulation';
import PlaceNode, { PLACE_RADIUS } from './PlaceNode';
import TransitionNode, { TRANS_W, TRANS_H } from './TransitionNode';
import ArcEdge, { ArcDraftLine, ArrowDefs } from './ArcEdge';

interface ViewBox { x: number; y: number; w: number; h: number }

const BG_ID = 'canvas-bg';

export default function PetriCanvas() {
  const sheet = useProjectStore(selectActiveSheet);
  const { tool, selectedId, selectedType, arcDraft, setTool, setSelected, setArcDraft, updateArcDraftMouse } = useUIStore();
  const { addPlace, addTransition, addArc, updatePlace, updateTransition, updateArc, deleteNode } = useProjectStore();
  const { currentMarking } = useSimulationStore();
  const { fireTransition } = useSimulation();
  const isInSimMode = currentMarking !== null;

  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<ViewBox>({ x: -400, y: -300, w: 800, h: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ mx: 0, my: 0, vx: 0, vy: 0 });

  // Node dragging
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragMoved = useRef(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  // Arc control-point dragging (ref so no extra re-render cycle)
  const arcCpDrag = useRef<{ arcId: string; startMx: number; startMy: number; origDx: number; origDy: number } | null>(null);

  // Transition rotation dragging
  const rotDrag = useRef<{ transId: string } | null>(null);

  const svgToWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: viewBox.x + (clientX - rect.left) / rect.width * viewBox.w,
      y: viewBox.y + (clientY - rect.top) / rect.height * viewBox.h,
    };
  }, [viewBox]);

  const isBackground = (target: EventTarget) => {
    const el = target as Element;
    return el === svgRef.current || el.id === BG_ID;
  };

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    const { x: wx, y: wy } = svgToWorld(e.clientX, e.clientY);
    setViewBox(vb => ({
      x: wx - (wx - vb.x) * factor,
      y: wy - (wy - vb.y) * factor,
      w: vb.w * factor,
      h: vb.h * factor,
    }));
  }, [svgToWorld]);

  const onSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isBackground(e.target)) return;
    if (e.button === 1 || (e.button === 0 && tool === 'select')) {
      setIsPanning(true);
      panStart.current = { mx: e.clientX, my: e.clientY, vx: viewBox.x, vy: viewBox.y };
    }
  }, [tool, viewBox]);

  const onSvgClick = useCallback((e: React.MouseEvent) => {
    if (!isBackground(e.target)) return;
    const { x, y } = svgToWorld(e.clientX, e.clientY);

    if (tool === 'addPlace') {
      const id = addPlace(x, y);
      setTool('select');
      setSelected(id, 'place');
    } else if (tool === 'addTransition') {
      const id = addTransition(x, y);
      setTool('select');
      setSelected(id, 'transition');
    } else if (tool === 'addArc') {
      if (arcDraft) setArcDraft(null);
    } else if (tool === 'select') {
      setSelected(null, null);
    }
  }, [tool, arcDraft, svgToWorld, addPlace, addTransition, setArcDraft, setSelected, setTool]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    // Arc control-point drag
    if (arcCpDrag.current) {
      const { x, y } = svgToWorld(e.clientX, e.clientY);
      const { arcId, startMx, startMy, origDx, origDy } = arcCpDrag.current;
      updateArc(arcId, { cpDx: origDx + (x - startMx), cpDy: origDy + (y - startMy) });
      return;
    }

    // Rotation drag
    if (rotDrag.current) {
      const t = sheet?.net.transitions[rotDrag.current.transId];
      if (t) {
        const { x, y } = svgToWorld(e.clientX, e.clientY);
        const angle = Math.atan2(y - t.y, x - t.x) * 180 / Math.PI + 90;
        updateTransition(rotDrag.current.transId, { rotation: angle });
      }
      return;
    }

    // Pan
    if (isPanning) {
      const rect = svgRef.current!.getBoundingClientRect();
      const dx = (e.clientX - panStart.current.mx) / rect.width * viewBox.w;
      const dy = (e.clientY - panStart.current.my) / rect.height * viewBox.h;
      setViewBox(vb => ({ ...vb, x: panStart.current.vx - dx, y: panStart.current.vy - dy }));
      return;
    }

    // Node drag
    if (draggingId) {
      dragMoved.current = true;
      const { x, y } = svgToWorld(e.clientX, e.clientY);
      const nx = x - dragOffset.current.dx;
      const ny = y - dragOffset.current.dy;
      if (sheet?.net.places[draggingId]) {
        updatePlace(draggingId, { x: nx, y: ny });
      } else if (sheet?.net.transitions[draggingId]) {
        updateTransition(draggingId, { x: nx, y: ny });
      }
      return;
    }

    // Arc draft preview
    if (arcDraft) {
      const { x, y } = svgToWorld(e.clientX, e.clientY);
      updateArcDraftMouse(x, y);
    }
  }, [arcDraft, isPanning, draggingId, viewBox, svgToWorld, sheet, updateArc, updatePlace, updateTransition, updateArcDraftMouse]);

  const onMouseUp = useCallback(() => {
    arcCpDrag.current = null;
    rotDrag.current = null;
    setIsPanning(false);
    setDraggingId(null);
    dragMoved.current = false;
  }, []);

  const handleNodeMouseDown = useCallback((id: string, type: 'place' | 'transition', e: React.MouseEvent) => {
    e.stopPropagation();
    if (tool === 'select') {
      const { x, y } = svgToWorld(e.clientX, e.clientY);
      const node = type === 'place' ? sheet?.net.places[id] : sheet?.net.transitions[id];
      if (node) {
        dragOffset.current = { dx: x - node.x, dy: y - node.y };
        dragMoved.current = false;
        setDraggingId(id);
      }
    }
  }, [tool, svgToWorld, sheet]);

  const handleNodeClick = useCallback((id: string, type: 'place' | 'transition', e: React.MouseEvent) => {
    e.stopPropagation();
    if (dragMoved.current) return;

    if (tool === 'addArc') {
      if (!arcDraft) {
        const { x, y } = svgToWorld(e.clientX, e.clientY);
        setArcDraft({ sourceId: id, sourceType: type, mouseX: x, mouseY: y });
      } else {
        if (arcDraft.sourceId !== id) addArc(arcDraft.sourceId, id);
        setArcDraft(null);
      }
      return;
    }

    if (tool === 'select') {
      if (type === 'transition' && currentMarking && sheet) {
        const t = sheet.net.transitions[id];
        if (t && isEnabled(t, sheet.net.arcs, sheet.net.places, currentMarking)) {
          fireTransition(id);
          return;
        }
      }
      setSelected(id, type);
    }
  }, [tool, arcDraft, currentMarking, sheet, svgToWorld, deleteNode, setSelected, setArcDraft, addArc, fireTransition]);

  const handleArcClick = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(id, 'arc');
  }, [setSelected]);

  const handleArcCpMouseDown = useCallback((arcId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { x, y } = svgToWorld(e.clientX, e.clientY);
    const arc = sheet?.net.arcs[arcId];
    if (!arc) return;
    arcCpDrag.current = {
      arcId,
      startMx: x, startMy: y,
      origDx: arc.cpDx ?? 0, origDy: arc.cpDy ?? 0,
    };
  }, [svgToWorld, sheet]);

  const handleRotationMouseDown = useCallback((transId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    rotDrag.current = { transId };
  }, []);

  if (!sheet) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No sheet selected. Create or open a project.
      </div>
    );
  }

  const net = sheet.net;
  const marking = currentMarking ?? net.initialMarking;

  // Arc draft source point
  let draftStart: { x: number; y: number } | null = null;
  if (arcDraft) {
    const srcPlace = net.places[arcDraft.sourceId];
    const srcTrans = net.transitions[arcDraft.sourceId];
    if (srcPlace) draftStart = placeConnectionPoint(srcPlace, arcDraft.mouseX, arcDraft.mouseY, PLACE_RADIUS);
    else if (srcTrans) draftStart = transitionConnectionPoint(srcTrans, arcDraft.mouseX, arcDraft.mouseY, TRANS_W, TRANS_H);
  }

  const cursorStyle =
    tool === 'addPlace' || tool === 'addTransition' ? 'crosshair'
    : tool === 'addArc' ? 'cell'
    : 'default';

  const zoom = (factor: number) => {
    setViewBox(vb => {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      return {
        x: cx - (vb.w * factor) / 2,
        y: cy - (vb.h * factor) / 2,
        w: vb.w * factor,
        h: vb.h * factor,
      };
    });
  };

  const zoomPct = Math.round(800 / viewBox.w * 100);

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-white border border-border rounded-lg shadow-sm px-1 py-1">
        <button
          onClick={() => zoom(1 / 0.8)}
          className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground text-base leading-none"
          title="Zoom out"
        >−</button>
        <span className="text-xs text-muted-foreground tabular-nums w-10 text-center select-none">{zoomPct}%</span>
        <button
          onClick={() => zoom(0.8)}
          className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground text-base leading-none"
          title="Zoom in"
        >+</button>
      </div>

    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ cursor: cursorStyle }}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      onWheel={onWheel}
      onMouseDown={onSvgMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClick={onSvgClick}
    >
      <ArrowDefs />

      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect
        id={BG_ID}
        x={viewBox.x - 10000} y={viewBox.y - 10000}
        width={40000} height={40000}
        fill="url(#grid)"
      />

      {/* Arcs (render before nodes so nodes appear on top) */}
      {Object.values(net.arcs).map(arc => {
        const isArcSelected = selectedId === arc.id && selectedType === 'arc';
        return (
          <ArcEdge
            key={arc.id}
            arc={arc}
            places={net.places}
            transitions={net.transitions}
            selected={isArcSelected}
            showHandle={isArcSelected && tool === 'select'}
            onClick={(e) => handleArcClick(arc.id, e)}
            onCpMouseDown={(e) => handleArcCpMouseDown(arc.id, e)}
          />
        );
      })}

      {/* Arc draft preview */}
      {arcDraft && draftStart && (
        <ArcDraftLine x1={draftStart.x} y1={draftStart.y} x2={arcDraft.mouseX} y2={arcDraft.mouseY} />
      )}

      {/* Places */}
      {Object.values(net.places).map(place => (
        <PlaceNode
          key={place.id}
          place={place}
          tokens={marking[place.id] ?? 0}
          selected={selectedId === place.id && selectedType === 'place'}
          isArcSource={arcDraft?.sourceId === place.id}
          onMouseDown={(e) => handleNodeMouseDown(place.id, 'place', e)}
          onMouseUp={onMouseUp}
          onClick={(e) => handleNodeClick(place.id, 'place', e)}
        />
      ))}

      {/* Transitions */}
      {Object.values(net.transitions).map(t => {
        const enabled = isEnabled(t, net.arcs, net.places, marking);
        const isTransSelected = selectedId === t.id && selectedType === 'transition';
        return (
          <TransitionNode
            key={t.id}
            transition={t}
            enabled={enabled}
            selected={isTransSelected}
            isArcSource={arcDraft?.sourceId === t.id}
            isSimMode={isInSimMode}
            showRotationHandle={isTransSelected && tool === 'select'}
            onMouseDown={(e) => handleNodeMouseDown(t.id, 'transition', e)}
            onMouseUp={onMouseUp}
            onClick={(e) => handleNodeClick(t.id, 'transition', e)}
            onRotationHandleMouseDown={(e) => handleRotationMouseDown(t.id, e)}
          />
        );
      })}
    </svg>
    </div>
  );
}
