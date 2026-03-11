import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { Project, Sheet, PetriNet, Marking, Arc, Place, Transition } from '../types/petri';
import { saveProject, deleteProject as dbDeleteProject } from '../persistence/storage';

function emptyNet(): PetriNet {
  return { places: {}, transitions: {}, arcs: {}, initialMarking: {} };
}

function newSheet(name: string): Sheet {
  return {
    id: nanoid(),
    name,
    net: emptyNet(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function newProject(name: string): Project {
  const sheet = newSheet('Sheet 1');
  return {
    id: nanoid(),
    name,
    sheets: { [sheet.id]: sheet },
    activeSheetId: sheet.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

interface ProjectState {
  projects: Record<string, Project>;
  activeProjectId: string | null;

  // Project CRUD
  createProject: (name: string) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  setActiveProject: (id: string) => void;
  loadProjects: (projects: Project[]) => void;

  // Sheet CRUD
  createSheet: (name: string) => void;
  deleteSheet: (sheetId: string) => void;
  renameSheet: (sheetId: string, name: string) => void;
  setActiveSheet: (sheetId: string) => void;

  // Net mutations
  addPlace: (x: number, y: number) => string;
  addTransition: (x: number, y: number) => string;
  addArc: (source: string, target: string) => void;
  updatePlace: (id: string, patch: Partial<Place>) => void;
  updateTransition: (id: string, patch: Partial<Transition>) => void;
  updateArc: (id: string, patch: Partial<Arc>) => void;
  deleteNode: (id: string) => void;
  deleteArc: (id: string) => void;

  // Marking
  setInitialMarking: (marking: Marking) => void;

  // Import
  importProject: (project: Project) => void;
}

export const useProjectStore = create<ProjectState>()(
  immer((set, get) => {
    function persist(state: ProjectState, projectId?: string) {
      const pid = projectId ?? state.activeProjectId;
      if (pid && state.projects[pid]) {
        saveProject(state.projects[pid]);
      }
    }

    function activeSheet(state: ProjectState) {
      const proj = state.projects[state.activeProjectId ?? ''];
      if (!proj) return null;
      return proj.sheets[proj.activeSheetId] ?? null;
    }

    return {
      projects: {},
      activeProjectId: null,

      createProject: (name) => {
        const proj = newProject(name);
        set(state => { state.projects[proj.id] = proj; state.activeProjectId = proj.id; });
        saveProject(proj);
        return proj.id;
      },

      deleteProject: (id) => {
        set(state => {
          delete state.projects[id];
          if (state.activeProjectId === id) {
            const ids = Object.keys(state.projects);
            state.activeProjectId = ids[0] ?? null;
          }
        });
        dbDeleteProject(id);
      },

      renameProject: (id, name) => {
        set(state => { state.projects[id].name = name; state.projects[id].updatedAt = Date.now(); });
        persist(get(), id);
      },

      setActiveProject: (id) => set(state => { state.activeProjectId = id; }),

      loadProjects: (projects) => {
        set(state => {
          for (const p of projects) state.projects[p.id] = p;
          if (!state.activeProjectId && projects.length > 0) {
            state.activeProjectId = projects[0].id;
          }
        });
      },

      createSheet: (name) => {
        const sheet = newSheet(name);
        set(state => {
          const proj = state.projects[state.activeProjectId ?? ''];
          if (!proj) return;
          proj.sheets[sheet.id] = sheet;
          proj.activeSheetId = sheet.id;
          proj.updatedAt = Date.now();
        });
        persist(get());
      },

      deleteSheet: (sheetId) => {
        set(state => {
          const proj = state.projects[state.activeProjectId ?? ''];
          if (!proj) return;
          const sheetIds = Object.keys(proj.sheets);
          if (sheetIds.length <= 1) return;
          delete proj.sheets[sheetId];
          if (proj.activeSheetId === sheetId) {
            proj.activeSheetId = Object.keys(proj.sheets)[0];
          }
          proj.updatedAt = Date.now();
        });
        persist(get());
      },

      renameSheet: (sheetId, name) => {
        set(state => {
          const proj = state.projects[state.activeProjectId ?? ''];
          if (!proj || !proj.sheets[sheetId]) return;
          proj.sheets[sheetId].name = name;
          proj.updatedAt = Date.now();
        });
        persist(get());
      },

      setActiveSheet: (sheetId) => {
        set(state => {
          const proj = state.projects[state.activeProjectId ?? ''];
          if (proj) proj.activeSheetId = sheetId;
        });
      },

      addPlace: (x, y) => {
        const id = nanoid();
        set(state => {
          const sheet = activeSheet(state);
          if (!sheet) return;
          const count = Object.keys(sheet.net.places).length + 1;
          sheet.net.places[id] = { id, label: `P${count}`, x, y, tokens: 0, capacity: null };
          sheet.net.initialMarking[id] = 0;
          sheet.updatedAt = Date.now();
        });
        persist(get());
        return id;
      },

      addTransition: (x, y) => {
        const id = nanoid();
        set(state => {
          const sheet = activeSheet(state);
          if (!sheet) return;
          const count = Object.keys(sheet.net.transitions).length + 1;
          sheet.net.transitions[id] = { id, label: `T${count}`, x, y, priority: 0 };
          sheet.updatedAt = Date.now();
        });
        persist(get());
        return id;
      },

      addArc: (source, target) => {
        const id = nanoid();
        set(state => {
          const sheet = activeSheet(state);
          if (!sheet) return;
          // Validate: one end must be place, other must be transition
          const isSourcePlace = !!sheet.net.places[source];
          const isTargetPlace = !!sheet.net.places[target];
          if (isSourcePlace === isTargetPlace) return; // same type, invalid
          // Prevent duplicate
          const exists = Object.values(sheet.net.arcs).some(
            a => a.source === source && a.target === target
          );
          if (exists) return;
          sheet.net.arcs[id] = { id, source, target, weight: 1, type: 'normal' };
          sheet.updatedAt = Date.now();
        });
        persist(get());
      },

      updatePlace: (id, patch) => {
        set(state => {
          const sheet = activeSheet(state);
          if (!sheet || !sheet.net.places[id]) return;
          Object.assign(sheet.net.places[id], patch);
          // Sync initial marking if tokens changed
          if (patch.tokens !== undefined) {
            sheet.net.initialMarking[id] = patch.tokens;
          }
          sheet.updatedAt = Date.now();
        });
        persist(get());
      },

      updateTransition: (id, patch) => {
        set(state => {
          const sheet = activeSheet(state);
          if (!sheet || !sheet.net.transitions[id]) return;
          Object.assign(sheet.net.transitions[id], patch);
          sheet.updatedAt = Date.now();
        });
        persist(get());
      },

      updateArc: (id, patch) => {
        set(state => {
          const sheet = activeSheet(state);
          if (!sheet || !sheet.net.arcs[id]) return;
          Object.assign(sheet.net.arcs[id], patch);
          sheet.updatedAt = Date.now();
        });
        persist(get());
      },

      deleteNode: (id) => {
        set(state => {
          const sheet = activeSheet(state);
          if (!sheet) return;
          delete sheet.net.places[id];
          delete sheet.net.transitions[id];
          delete sheet.net.initialMarking[id];
          // Remove connected arcs
          for (const arcId of Object.keys(sheet.net.arcs)) {
            const arc = sheet.net.arcs[arcId];
            if (arc.source === id || arc.target === id) delete sheet.net.arcs[arcId];
          }
          sheet.updatedAt = Date.now();
        });
        persist(get());
      },

      deleteArc: (id) => {
        set(state => {
          const sheet = activeSheet(state);
          if (!sheet) return;
          delete sheet.net.arcs[id];
          sheet.updatedAt = Date.now();
        });
        persist(get());
      },

      setInitialMarking: (marking) => {
        set(state => {
          const sheet = activeSheet(state);
          if (!sheet) return;
          sheet.net.initialMarking = { ...marking };
          // Apply to places too
          for (const [id, tokens] of Object.entries(marking)) {
            if (sheet.net.places[id]) sheet.net.places[id].tokens = tokens;
          }
          sheet.updatedAt = Date.now();
        });
        persist(get());
      },

      importProject: (project) => {
        set(state => { state.projects[project.id] = project; state.activeProjectId = project.id; });
        saveProject(project);
      },
    };
  })
);

// Selectors
export const selectActiveProject = (state: ProjectState) =>
  state.activeProjectId ? state.projects[state.activeProjectId] ?? null : null;

export const selectActiveSheet = (state: ProjectState) => {
  const proj = selectActiveProject(state);
  if (!proj) return null;
  return proj.sheets[proj.activeSheetId] ?? null;
};
