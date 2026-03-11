import { useEffect, useRef, useCallback } from 'react';
import { useProjectStore, selectActiveSheet } from '@/store/projectStore';
import { useSimulationStore } from '@/store/simulationStore';
import { step, fire } from '@/engine/petri';
import type { Marking } from '@/types/petri';

export function useSimulation() {
  const sheet = useProjectStore(selectActiveSheet);
  const simStore = useSimulationStore();
  const { mode, currentMarking, speed, history, stepCount, reset } = simStore;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getMarking = (): Marking =>
    currentMarking ?? sheet?.net.initialMarking ?? {};

  const doStep = useCallback(() => {
    if (!sheet) return false;
    const state = useSimulationStore.getState();
    const marking = state.currentMarking ?? sheet.net.initialMarking;
    const result = step(sheet.net, marking);
    if (result.fired === null) {
      useSimulationStore.getState().setMode('idle');
      return false;
    }
    const transition = sheet.net.transitions[result.fired];
    useSimulationStore.getState().pushHistory({
      step: state.stepCount + 1,
      transitionId: result.fired,
      transitionLabel: transition?.label ?? result.fired,
      markingBefore: marking,
      markingAfter: result.next,
      timestamp: Date.now(),
    });
    useSimulationStore.getState().setMarking(result.next);
    return true;
  }, [sheet]);

  const stepOnce = useCallback(() => {
    if (!sheet) return;
    if (useSimulationStore.getState().currentMarking === null) {
      useSimulationStore.getState().setMarking({ ...sheet.net.initialMarking });
    }
    doStep();
  }, [sheet, doStep]);

  const startAuto = useCallback(() => {
    if (!sheet) return;
    if (useSimulationStore.getState().currentMarking === null) {
      useSimulationStore.getState().setMarking({ ...sheet.net.initialMarking });
    }
    useSimulationStore.getState().setMode('running');
  }, [sheet]);

  const pauseAuto = useCallback(() => {
    useSimulationStore.getState().setMode('idle');
  }, []);

  const resetSim = useCallback(() => {
    reset();
  }, [reset]);

  // Manual transition fire (used by canvas click)
  const fireTransition = useCallback((transitionId: string) => {
    if (!sheet) return;
    const state = useSimulationStore.getState();
    const marking = state.currentMarking ?? sheet.net.initialMarking;
    const t = sheet.net.transitions[transitionId];
    if (!t) return;
    const next = fire(t, sheet.net.arcs, marking);
    state.pushHistory({
      step: state.stepCount + 1,
      transitionId,
      transitionLabel: t.label,
      markingBefore: { ...marking },
      markingAfter: next,
      timestamp: Date.now(),
    });
    state.setMarking(next);
  }, [sheet]);

  // Auto-step interval
  useEffect(() => {
    if (mode === 'running') {
      intervalRef.current = setInterval(() => {
        const ok = doStep();
        if (!ok && intervalRef.current) clearInterval(intervalRef.current);
      }, speed);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [mode, speed, doStep]);

  return {
    mode,
    currentMarking: getMarking(),
    history,
    stepCount,
    speed,
    stepOnce,
    startAuto,
    pauseAuto,
    resetSim,
    fireTransition,
    clearHistory: useSimulationStore.getState().clearHistory,
    setSpeed: useSimulationStore.getState().setSpeed,
  };
}
