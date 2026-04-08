import React from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSimulation } from '@/hooks/useSimulation';
import { useSimulationStore } from '@/store/simulationStore';
import { useProjectStore, selectActiveSheet } from '@/store/projectStore';
import { useAnalysisStore } from '@/store/analysisStore';
import { useMatrixAnalysisStore } from '@/store/matrixAnalysisStore';
import { buildCoverabilityTree, analyzeNet } from '@/engine/coverability';
import {
  buildMatrices,
  computeFiringPath,
  tInvariantsSteps,
  solvePInvariantsSteps,
} from '@/engine/matrix';
import type { ToolMode } from '@/types/petri';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const tools: { mode: ToolMode; label: string; icon: string; tip: string }[] = [
  { mode: 'select',        label: 'Select',     icon: '↖', tip: 'Select & move (V)' },
  { mode: 'addPlace',      label: 'Place',      icon: '○', tip: 'Add place – circle (P)' },
  { mode: 'addTransition', label: 'Transition', icon: '▬', tip: 'Add transition – rectangle (T)' },
  { mode: 'addArc',        label: 'Arc',        icon: '→', tip: 'Draw arc (A)' },
];

export default function Toolbar() {
  const { tool, setTool, setSelected } = useUIStore();
  const { mode: simMode, isSimActive, stepOnce, stepBack, enterSim, startAuto, pauseAuto, resetSim, speed, history } = useSimulation();
  const setSpeed = useSimulationStore(s => s.setSpeed);
  const { deleteNode, deleteArc } = useProjectStore();
  const sheet = useProjectStore(selectActiveSheet);
  const { isVisible: analysisVisible, show: showAnalysis, hide: hideAnalysis, setResults, setComputing } = useAnalysisStore();
  const {
    isVisible: matrixVisible,
    show: showMatrix,
    hide: hideMatrix,
    setResult: setMatrixResult,
    setComputing: setMatrixComputing,
  } = useMatrixAnalysisStore();

  const handleAnalyze = React.useCallback(() => {
    if (!sheet) return;
    if (analysisVisible) { hideAnalysis(); return; }
    if (matrixVisible) hideMatrix();
    setComputing(true);
    showAnalysis();
    // Run in a microtask so the panel opens before computing
    setTimeout(() => {
      const tree = buildCoverabilityTree(sheet.net, sheet.net.initialMarking);
      const props = analyzeNet(tree, sheet.net);
      setResults(tree, props);
    }, 0);
  }, [sheet, analysisVisible, matrixVisible, showAnalysis, hideAnalysis, hideMatrix, setResults, setComputing]);

  const handleMatrixAnalyze = React.useCallback(() => {
    if (!sheet) return;
    if (matrixVisible) { hideMatrix(); return; }
    if (analysisVisible) hideAnalysis();
    setMatrixComputing(true);
    showMatrix();
    setTimeout(() => {
      const matrices = buildMatrices(sheet.net);
      const tree = buildCoverabilityTree(sheet.net, sheet.net.initialMarking);
      const treeProperties = analyzeNet(tree, sheet.net);
      const firingPath = computeFiringPath(tree, matrices, 5);
      const tSteps = tInvariantsSteps(matrices.C, matrices.transitionIds.length);
      const pSteps = solvePInvariantsSteps(matrices.C, matrices.placeIds.length);
      setMatrixResult({ matrices, tree, treeProperties, firingPath, tSteps, pSteps });
    }, 0);
  }, [sheet, matrixVisible, analysisVisible, showMatrix, hideMatrix, hideAnalysis, setMatrixResult, setMatrixComputing]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const sim = useSimulationStore.getState();
      switch (e.key) {
        case 'v': case 'V': if (!isSimActive) setTool('select'); break;
        case 'p': case 'P': if (!isSimActive) setTool('addPlace'); break;
        case 't': case 'T': if (!isSimActive) setTool('addTransition'); break;
        case 'a': case 'A': if (!isSimActive) setTool('addArc'); break;
        case 'Escape':
          if (isSimActive) resetSim();
          else setTool('select');
          break;
        case ' ':
          e.preventDefault();
          if (isSimActive && sim.mode !== 'running') stepOnce();
          break;
        case 'ArrowLeft':
          if (isSimActive) { e.preventDefault(); stepBack(); }
          break;
        case 'Delete':
        case 'Backspace': {
          if (isSimActive) break;
          e.preventDefault();
          const { selectedId: sid, selectedType: stype } = useUIStore.getState();
          if (!sid) break;
          if (stype === 'arc') deleteArc(sid);
          else deleteNode(sid);
          setSelected(null, null);
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTool, stepOnce, stepBack, enterSim, resetSim, deleteNode, deleteArc, setSelected, isSimActive]);

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-card border-b border-border flex-wrap">
      {!isSimActive ? (
        // ── Edit mode ──────────────────────────────────────────────────────
        <>
          {tools.map(t => (
            <Tooltip key={t.mode}>
              <TooltipTrigger render={<span />}>
                <Button
                  variant={tool === t.mode ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTool(t.mode)}
                  className="h-8 px-2.5 text-xs gap-1.5"
                >
                  <span>{t.icon}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.tip}</TooltipContent>
            </Tooltip>
          ))}

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={enterSim}>
                ▶ Start Simulation
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enter simulation mode</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                variant={analysisVisible ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={handleAnalyze}
                disabled={!sheet || Object.keys(sheet.net.places).length === 0}
              >
                ◈ Analyze
              </Button>
            </TooltipTrigger>
            <TooltipContent>Build coverability tree &amp; analyze properties</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                variant={matrixVisible ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={handleMatrixAnalyze}
                disabled={!sheet || Object.keys(sheet.net.places).length === 0}
              >
                ⊞ Matrices
              </Button>
            </TooltipTrigger>
            <TooltipContent>Матричний аналіз: F, H, C, T- та P-інваріанти</TooltipContent>
          </Tooltip>

          <div className="ml-auto">
            <span className="text-xs text-muted-foreground hidden md:block">V P T A · Del=Delete</span>
          </div>
        </>
      ) : (
        // ── Simulation mode ────────────────────────────────────────────────
        <>
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                variant="outline" size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={stepBack}
                disabled={simMode === 'running' || history.length === 0}
              >
                ⏮ Back
              </Button>
            </TooltipTrigger>
            <TooltipContent>Step back (←)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                variant="outline" size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={stepOnce}
                disabled={simMode === 'running'}
              >
                ⏭ Step
              </Button>
            </TooltipTrigger>
            <TooltipContent>Step forward (Space)</TooltipContent>
          </Tooltip>

          {simMode === 'running' ? (
            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs border-green-500 text-green-700 hover:bg-green-50" onClick={pauseAuto}>
              ⏸ Pause
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={startAuto}>
              ▶ Auto
            </Button>
          )}

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Select value={String(speed)} onValueChange={v => setSpeed(Number(v))}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="200">Fast</SelectItem>
              <SelectItem value="800">Normal</SelectItem>
              <SelectItem value="2000">Slow</SelectItem>
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={resetSim}>
                ✕ Stop
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop simulation (Esc)</TooltipContent>
          </Tooltip>

          <div className="ml-auto flex items-center gap-2">
            {simMode === 'running' && (
              <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50 gap-1.5 text-xs">
                <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Running
              </Badge>
            )}
            <span className="text-xs text-muted-foreground hidden md:block">Space=Step · ←=Back · Esc=Stop</span>
          </div>
        </>
      )}
    </div>
  );
}
