import { useCallback } from 'react';
import { useProjectStore, selectActiveSheet } from '@/store/projectStore';
import { useSimulationStore } from '@/store/simulationStore';
import { step, fire } from '@/engine/petri';
import type { Marking } from '@/types/petri';

// Pure control hook – NO interval here. Interval lives in SimulationRunner (rendered once).
export function useSimulation() {
  const sheet = useProjectStore(selectActiveSheet);
  const { mode, currentMarking: rawMarking, speed, history, stepCount } = useSimulationStore();

  const getMarking = (): Marking =>
    rawMarking ?? sheet?.net.initialMarking ?? {};

  const enterSim = useCallback(() => {
    const s = useProjectStore.getState();
    const proj = s.activeProjectId ? s.projects[s.activeProjectId] : null;
    const sh = proj ? proj.sheets[proj.activeSheetId] : null;
    if (!sh) return;
    const state = useSimulationStore.getState();
    if (state.currentMarking === null) {
      state.setMarking({ ...sh.net.initialMarking });
    }
  }, []);

  const stepOnce = useCallback(() => {
    const s = useProjectStore.getState();
    const proj = s.activeProjectId ? s.projects[s.activeProjectId] : null;
    const sh = proj ? proj.sheets[proj.activeSheetId] : null;
    if (!sh) return;
    const state = useSimulationStore.getState();
    if (state.currentMarking === null) return; // must call enterSim first
    const marking = state.currentMarking;
    const result = step(sh.net, marking);
    if (result.fired === null) return;
    const t = sh.net.transitions[result.fired];
    const st = useSimulationStore.getState();
    st.pushHistory({
      step: st.stepCount + 1,
      transitionId: result.fired,
      transitionLabel: t?.label ?? result.fired,
      markingBefore: marking,
      markingAfter: result.next,
      timestamp: Date.now(),
    });
    useSimulationStore.getState().setMarking(result.next);
  }, []);

  const stepBack = useCallback(() => {
    const state = useSimulationStore.getState();
    if (state.mode === 'running') state.setMode('idle');
    state.popHistory();
  }, []);

  const startAuto = useCallback(() => {
    if (useSimulationStore.getState().currentMarking === null) return;
    useSimulationStore.getState().setMode('running');
  }, []);

  const pauseAuto = useCallback(() => {
    useSimulationStore.getState().setMode('idle');
  }, []);

  const resetSim = useCallback(() => {
    useSimulationStore.getState().reset();
  }, []);

  const fireTransition = useCallback((transitionId: string) => {
    const s = useProjectStore.getState();
    const proj = s.activeProjectId ? s.projects[s.activeProjectId] : null;
    const sh = proj ? proj.sheets[proj.activeSheetId] : null;
    if (!sh) return;
    const state = useSimulationStore.getState();
    const marking = state.currentMarking ?? sh.net.initialMarking;
    const t = sh.net.transitions[transitionId];
    if (!t) return;
    const next = fire(t, sh.net.arcs, marking);
    state.pushHistory({
      step: state.stepCount + 1,
      transitionId,
      transitionLabel: t.label,
      markingBefore: { ...marking },
      markingAfter: next,
      timestamp: Date.now(),
    });
    state.setMarking(next);
  }, []);

  return {
    mode,
    isSimActive: rawMarking !== null,
    currentMarking: getMarking(),
    history,
    stepCount,
    speed,
    enterSim,
    stepOnce,
    stepBack,
    startAuto,
    pauseAuto,
    resetSim,
    fireTransition,
    setSpeed: useSimulationStore.getState().setSpeed,
  };
}
