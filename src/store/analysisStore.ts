import { create } from 'zustand';
import type { CoverabilityTree, NetProperties } from '@/types/petri';

interface AnalysisState {
  isVisible: boolean;
  tree: CoverabilityTree | null;
  properties: NetProperties | null;
  isComputing: boolean;

  show: () => void;
  hide: () => void;
  setResults: (tree: CoverabilityTree, properties: NetProperties) => void;
  setComputing: (v: boolean) => void;
  clear: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  isVisible: false,
  tree: null,
  properties: null,
  isComputing: false,

  show: () => set({ isVisible: true }),
  hide: () => set({ isVisible: false }),
  setResults: (tree, properties) => set({ tree, properties, isComputing: false }),
  setComputing: (v) => set({ isComputing: v }),
  clear: () => set({ tree: null, properties: null }),
}));
