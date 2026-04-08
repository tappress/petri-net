import { create } from 'zustand';
import type { CoverabilityTree, NetProperties } from '@/types/petri';
import type { NetMatrices, FiringPath, SolveSteps } from '@/engine/matrix';

export interface MatrixAnalysisResult {
  matrices: NetMatrices;
  tree: CoverabilityTree;
  treeProperties: NetProperties;
  firingPath: FiringPath;
  tSteps: SolveSteps;
  pSteps: SolveSteps;
}

interface MatrixAnalysisState {
  isVisible: boolean;
  result: MatrixAnalysisResult | null;
  isComputing: boolean;

  show: () => void;
  hide: () => void;
  setResult: (result: MatrixAnalysisResult) => void;
  setComputing: (v: boolean) => void;
  clear: () => void;
}

export const useMatrixAnalysisStore = create<MatrixAnalysisState>((set) => ({
  isVisible: false,
  result: null,
  isComputing: false,

  show: () => set({ isVisible: true }),
  hide: () => set({ isVisible: false }),
  setResult: (result) => set({ result, isComputing: false }),
  setComputing: (v) => set({ isComputing: v }),
  clear: () => set({ result: null }),
}));
