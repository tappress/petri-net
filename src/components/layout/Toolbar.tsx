import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { useSimulation } from '../../hooks/useSimulation';
import { useSimulationStore } from '../../store/simulationStore';
import type { ToolMode } from '../../types/petri';

const tools: { mode: ToolMode; label: string; icon: string; tip: string }[] = [
  { mode: 'select', label: 'Select', icon: '↖', tip: 'Select & move (V)' },
  { mode: 'addPlace', label: 'Place', icon: '○', tip: 'Add place (P)' },
  { mode: 'addTransition', label: 'Trans', icon: '▬', tip: 'Add transition (T)' },
  { mode: 'addArc', label: 'Arc', icon: '→', tip: 'Draw arc (A)' },
  { mode: 'delete', label: 'Delete', icon: '✕', tip: 'Delete element (Del)' },
];

export default function Toolbar() {
  const { tool, setTool } = useUIStore();
  const { mode: simMode, stepOnce, startAuto, pauseAuto, resetSim, speed } = useSimulation();
  const { setSpeed } = useSimulationStore();

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key) {
        case 'v': case 'V': setTool('select'); break;
        case 'p': case 'P': setTool('addPlace'); break;
        case 't': case 'T': setTool('addTransition'); break;
        case 'a': case 'A': setTool('addArc'); break;
        case 'Delete': case 'Backspace': setTool('delete'); break;
        case 'Escape': setTool('select'); break;
        case ' ': e.preventDefault(); stepOnce(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTool, stepOnce]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 flex-wrap">
      {/* Drawing tools */}
      <div className="flex items-center gap-1 border-r border-slate-700 pr-3 mr-1">
        {tools.map(t => (
          <button
            key={t.mode}
            title={t.tip}
            onClick={() => setTool(t.mode)}
            className={`px-2.5 py-1.5 rounded text-sm font-mono transition-colors ${
              tool === t.mode
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="mr-1">{t.icon}</span>
            <span className="text-xs">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Simulation controls */}
      <div className="flex items-center gap-1.5 border-r border-slate-700 pr-3 mr-1">
        <span className="text-xs text-slate-500 mr-1">Sim:</span>

        <button
          title="Step once (Space)"
          onClick={stepOnce}
          disabled={simMode === 'running'}
          className="sim-btn"
        >
          ⏭ Step
        </button>

        {simMode === 'running' ? (
          <button title="Pause" onClick={pauseAuto} className="sim-btn sim-btn-active">
            ⏸ Pause
          </button>
        ) : (
          <button title="Auto run" onClick={startAuto} className="sim-btn">
            ▶ Run
          </button>
        )}

        <button title="Reset to initial marking" onClick={resetSim} className="sim-btn">
          ↺ Reset
        </button>

        {simMode === 'running' && (
          <div className="flex items-center gap-1 ml-1">
            <span className="text-xs text-slate-500">Speed:</span>
            <select
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="text-xs bg-slate-800 text-slate-300 rounded px-1 py-0.5 border border-slate-700"
            >
              <option value={200}>Fast</option>
              <option value={800}>Normal</option>
              <option value={2000}>Slow</option>
            </select>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
        {simMode === 'running' && (
          <span className="flex items-center gap-1 text-green-400">
            <span className="animate-pulse">●</span> Running
          </span>
        )}
        <span className="text-slate-600">Space=Step · V/P/T/A/Del = tools</span>
      </div>
    </div>
  );
}
