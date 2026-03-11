import { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { useProjectStore } from '@/store/projectStore';
import { step } from '@/engine/petri';

export default function SimulationRunner() {
  const mode = useSimulationStore(s => s.mode);
  const speed = useSimulationStore(s => s.speed);

  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (t1.current) { clearTimeout(t1.current); t1.current = null; }
    if (t2.current) { clearTimeout(t2.current); t2.current = null; }
  };

  const runStep = useCallback(() => {
    const sim = useSimulationStore.getState();
    const proj = useProjectStore.getState();
    const p = proj.activeProjectId ? proj.projects[proj.activeProjectId] : null;
    const sh = p ? p.sheets[p.activeSheetId] : null;

    if (!sh || sim.mode !== 'running' || sim.currentMarking === null) return;

    const marking = sim.currentMarking;
    const result = step(sh.net, marking);

    if (result.fired === null) {
      useSimulationStore.getState().setMode('idle');
      useSimulationStore.getState().setFiringTransition(null);
      return;
    }

    const animMs = Math.max(80, speed * 0.55);
    const pauseMs = Math.max(40, speed - animMs);

    // Phase 1: show firing highlight
    useSimulationStore.getState().setFiringTransition(result.fired);

    // Phase 2: commit marking, clear highlight
    t1.current = setTimeout(() => {
      const s = useSimulationStore.getState();
      const t = sh.net.transitions[result.fired!];
      s.pushHistory({
        step: s.stepCount + 1,
        transitionId: result.fired!,
        transitionLabel: t?.label ?? result.fired!,
        markingBefore: marking,
        markingAfter: result.next,
        timestamp: Date.now(),
      });
      s.setMarking(result.next);
      s.setFiringTransition(null);

      // Schedule next step
      t2.current = setTimeout(runStep, pauseMs);
    }, animMs);
  }, [speed]);

  useEffect(() => {
    clearTimers();
    if (mode === 'running') runStep();
    return clearTimers;
  }, [mode, speed, runStep]);

  return null;
}
