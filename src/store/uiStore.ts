import { create } from 'zustand';
import type { ToolMode } from '../types/petri';

interface ArcDraft {
  sourceId: string;
  sourceType: 'place' | 'transition';
  mouseX: number;
  mouseY: number;
}

interface UIState {
  tool: ToolMode;
  selectedId: string | null;
  selectedType: 'place' | 'transition' | 'arc' | null;
  arcDraft: ArcDraft | null;

  setTool: (tool: ToolMode) => void;
  setSelected: (id: string | null, type: 'place' | 'transition' | 'arc' | null) => void;
  setArcDraft: (draft: ArcDraft | null) => void;
  updateArcDraftMouse: (x: number, y: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  tool: 'select',
  selectedId: null,
  selectedType: null,
  arcDraft: null,

  setTool: (tool) => set({ tool, selectedId: null, selectedType: null, arcDraft: null }),
  setSelected: (id, type) => set({ selectedId: id, selectedType: type }),
  setArcDraft: (draft) => set({ arcDraft: draft }),
  updateArcDraftMouse: (x, y) => set(state => {
    if (!state.arcDraft) return state;
    return { arcDraft: { ...state.arcDraft, mouseX: x, mouseY: y } };
  }),
}));
