import React, { useRef, useState, useCallback } from 'react';
import { useProjectStore, selectActiveSheet } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { useSimulationStore } from '../../store/simulationStore';
import { isEnabled, placeConnectionPoint, transitionConnectionPoint } from '../../engine/petri';
import { useSimulation } from '../../hooks/useSimulation';
import PlaceNode, { PLACE_RADIUS } from './PlaceNode';
import TransitionNode, { TRANS_W, TRANS_H } from './TransitionNode';
import ArcEdge, { ArcDraftLine, ArrowDefs } from './ArcEdge';

interface ViewBox { x: number; y: number; w: number; h: number }

export default function PetriCanvas() {
  const sheet = useProjectStore(selectActiveSheet);
  const { tool, selectedId, selectedType, arcDraft, setSelected, setArcDraft, updateArcDraftMouse } = useUIStore();
  const { addPlace, addTransition, addArc, updatePlace, updateTransition, deleteNode, deleteArc } = useProjectStore();
  const { currentMarking, mode: simMode } = useSimulationStore();
  const { fireTransition } = useSimulation();
  const isInSimMode = currentMarking !== null;

  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<ViewBox>({ x: -400, y: -300, w: 800, h: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ mx: 0, my: 0, vx: 0, vy: 0 });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  const svgToWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;
    return {
      x: viewBox.x + rx * viewBox.w,
      y: viewBox.y + ry * viewBox.h,
    };
  }, [viewBox]);

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
    if (e.target !== svgRef.current && !(e.target as Element).closest('svg') ) return;
    if (e.button === 1 || (e.button === 0 && tool === 'select' && e.target === svgRef.current)) {
      setIsPanning(true);
      panStart.current = { mx: e.clientX, my: e.clientY, vx: viewBox.x, vy: viewBox.y };
      return;
    }
  }, [tool, viewBox]);

  const onSvgClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== svgRef.current) return;
    const { x, y } = svgToWorld(e.clientX, e.clientY);

    if (tool === 'addPlace') {
      addPlace(x, y);
    } else if (tool === 'addTransition') {
      addTransition(x, y);
    } else if (tool === 'addArc') {
      if (arcDraft) setArcDraft(null);
    } else if (tool === 'select') {
      setSelected(null, null);
    }
  }, [tool, arcDraft, svgToWorld, addPlace, addTransition, setArcDraft, setSelected]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = (e.clientX - panStart.current.mx) / svgRef.current!.getBoundingClientRect().width * viewBox.w;
      const dy = (e.clientY - panStart.current.my) / svgRef.current!.getBoundingClientRect().height * viewBox.h;
      setViewBox(vb => ({ ...vb, x: panStart.current.vx - dx, y: panStart.current.vy - dy }));
      return;
    }

    if (draggingId && tool === 'select') {
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

    if (arcDraft) {
      const { x, y } = svgToWorld(e.clientX, e.clientY);
      updateArcDraftMouse(x, y);
    }
  }, [isPanning, draggingId, arcDraft, tool, viewBox, svgToWorld, sheet, updatePlace, updateTransition, updateArcDraftMouse]);

  const onMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingId(null);
  }, []);

  const handleNodeMouseDown = useCallback((id: string, type: 'place' | 'transition', e: React.MouseEvent) => {
    e.stopPropagation();
    if (tool === 'select') {
      const { x, y } = svgToWorld(e.clientX, e.clientY);
      const node = type === 'place' ? sheet?.net.places[id] : sheet?.net.transitions[id];
      if (node) {
        dragOffset.current = { dx: x - node.x, dy: y - node.y };
        setDraggingId(id);
      }
    }
  }, [tool, svgToWorld, sheet]);

  const handleNodeClick = useCallback((id: string, type: 'place' | 'transition', e: React.MouseEvent) => {
    e.stopPropagation();

    if (tool === 'delete') {
      deleteNode(id);
      setSelected(null, null);
      return;
    }

    if (tool === 'addArc') {
      if (!arcDraft) {
        const { x, y } = svgToWorld(e.clientX, e.clientY);
        setArcDraft({ sourceId: id, sourceType: type, mouseX: x, mouseY: y });
      } else {
        // Complete arc
        if (arcDraft.sourceId !== id) {
          addArc(arcDraft.sourceId, id);
        }
        setArcDraft(null);
      }
      return;
    }

    // Simulation: fire transition
    if (simMode !== 'idle' || tool === 'select') {
      if (type === 'transition' && currentMarking && sheet) {
        const t = sheet.net.transitions[id];
        if (t && isEnabled(t, sheet.net.arcs, sheet.net.places, currentMarking)) {
          // handled by sim controls; just select
        }
      }
      setSelected(id, type);
    }
  }, [tool, arcDraft, simMode, currentMarking, sheet, svgToWorld, deleteNode, setSelected, setArcDraft, addArc]);

  const handleArcClick = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tool === 'delete') {
      deleteArc(id);
      setSelected(null, null);
    } else {
      setSelected(id, 'arc');
    }
  }, [tool, deleteArc, setSelected]);

  const handleTransitionSimClick = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tool !== 'select' && tool !== 'addArc') return;
    if (tool === 'addArc') {
      handleNodeClick(id, 'transition', e);
      return;
    }
    // In select mode during simulation, clicking an enabled transition fires it manually
    if (currentMarking && sheet) {
      const t = sheet.net.transitions[id];
      if (t && isEnabled(t, sheet.net.arcs, sheet.net.places, currentMarking)) {
        fireTransition(id);
        return;
      }
    }
    setSelected(id, 'transition');
  }, [tool, currentMarking, sheet, handleNodeClick, setSelected, fireTransition]);

  if (!sheet) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        No sheet selected. Create or open a project.
      </div>
    );
  }

  const net = sheet.net;
  const marking = currentMarking ?? net.initialMarking;

  // Compute arc draft endpoints
  let draftStart: { x: number; y: number } | null = null;
  if (arcDraft) {
    const srcPlace = net.places[arcDraft.sourceId];
    const srcTrans = net.transitions[arcDraft.sourceId];
    if (srcPlace) {
      draftStart = placeConnectionPoint(srcPlace, arcDraft.mouseX, arcDraft.mouseY, PLACE_RADIUS);
    } else if (srcTrans) {
      draftStart = transitionConnectionPoint(srcTrans, arcDraft.mouseX, arcDraft.mouseY, TRANS_W, TRANS_H);
    }
  }

  return (
    <svg
      ref={svgRef}
      className="flex-1 w-full h-full"
      style={{ cursor: tool === 'addPlace' || tool === 'addTransition' ? 'crosshair' : tool === 'delete' ? 'no-drop' : 'default' }}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      onWheel={onWheel}
      onMouseDown={onSvgMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClick={onSvgClick}
    >
      <ArrowDefs />

      {/* Grid */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x={viewBox.x - 10000} y={viewBox.y - 10000} width={40000} height={40000} fill="url(#grid)" />

      {/* Arcs */}
      {Object.values(net.arcs).map(arc => (
        <ArcEdge
          key={arc.id}
          arc={arc}
          places={net.places}
          transitions={net.transitions}
          selected={selectedId === arc.id && selectedType === 'arc'}
          onClick={(e: React.MouseEvent) => handleArcClick(arc.id, e)}
        />
      ))}

      {/* Arc draft */}
      {arcDraft && draftStart && (
        <ArcDraftLine
          x1={draftStart.x} y1={draftStart.y}
          x2={arcDraft.mouseX} y2={arcDraft.mouseY}
        />
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
        return (
          <TransitionNode
            key={t.id}
            transition={t}
            enabled={enabled}
            selected={selectedId === t.id && selectedType === 'transition'}
            isArcSource={arcDraft?.sourceId === t.id}
            isSimMode={isInSimMode}
            onMouseDown={(e) => handleNodeMouseDown(t.id, 'transition', e)}
            onMouseUp={onMouseUp}
            onClick={(e) => handleTransitionSimClick(t.id, e)}
          />
        );
      })}
    </svg>
  );
}
