import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { FiringRecord, Marking, SimulationMode } from '@/types/petri';

interface SimulationState {
  mode: SimulationMode;
  currentMarking: Marking | null;
  history: FiringRecord[];
  stepCount: number;
  speed: number; // ms between auto steps

  setMode: (mode: SimulationMode) => void;
  setMarking: (marking: Marking) => void;
  pushHistory: (record: FiringRecord) => void;
  clearHistory: () => void;
  setSpeed: (ms: number) => void;
  reset: () => void;
}

export const useSimulationStore = create<SimulationState>()(
  immer((set) => ({
    mode: 'idle',
    currentMarking: null,
    history: [],
    stepCount: 0,
    speed: 800,

    setMode: (mode) => set(state => { state.mode = mode; }),
    setMarking: (marking) => set(state => { state.currentMarking = marking; }),

    pushHistory: (record) => set(state => {
      state.history.push(record);
      state.stepCount = record.step;
    }),

    clearHistory: () => set(state => {
      state.history = [];
      state.stepCount = 0;
    }),

    setSpeed: (ms) => set(state => { state.speed = ms; }),

    reset: () => set(state => {
      state.mode = 'idle';
      state.currentMarking = null;
      state.history = [];
      state.stepCount = 0;
    }),
  }))
);
