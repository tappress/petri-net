import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { FiringRecord, Marking, SimulationMode } from '@/types/petri';

interface SimulationState {
  mode: SimulationMode;
  currentMarking: Marking | null;
  firingTransitionId: string | null; // set during animation phase
  history: FiringRecord[];
  stepCount: number;
  speed: number;

  setMode: (mode: SimulationMode) => void;
  setMarking: (marking: Marking) => void;
  setFiringTransition: (id: string | null) => void;
  pushHistory: (record: FiringRecord) => void;
  popHistory: () => void;
  clearHistory: () => void;
  setSpeed: (ms: number) => void;
  reset: () => void;
}

export const useSimulationStore = create<SimulationState>()(
  immer((set) => ({
    mode: 'idle',
    currentMarking: null,
    firingTransitionId: null,
    history: [],
    stepCount: 0,
    speed: 800,

    setMode: (mode) => set(state => { state.mode = mode; }),
    setMarking: (marking) => set(state => { state.currentMarking = marking; }),
    setFiringTransition: (id) => set(state => { state.firingTransitionId = id; }),

    pushHistory: (record) => set(state => {
      state.history.push(record);
      state.stepCount = record.step;
    }),

    popHistory: () => set(state => {
      const last = state.history[state.history.length - 1];
      if (!last) return;
      state.history.pop();
      state.currentMarking = last.markingBefore;
      state.stepCount = last.step - 1;
    }),

    clearHistory: () => set(state => { state.history = []; state.stepCount = 0; }),
    setSpeed: (ms) => set(state => { state.speed = ms; }),

    reset: () => set(state => {
      state.mode = 'idle';
      state.currentMarking = null;
      state.firingTransitionId = null;
      state.history = [];
      state.stepCount = 0;
    }),
  }))
);
