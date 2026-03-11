import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Project } from '@/types/petri';

interface PetriDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
}

let db: IDBPDatabase<PetriDB> | null = null;

async function getDB(): Promise<IDBPDatabase<PetriDB>> {
  if (!db) {
    db = await openDB<PetriDB>('petri-net-db', 1, {
      upgrade(database) {
        database.createObjectStore('projects', { keyPath: 'id' });
      },
    });
  }
  return db;
}

const LS_KEY = 'petri-net-projects';

// localStorage fallback
function lsLoad(): Project[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSave(projects: Project[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(projects));
  } catch {
    // quota exceeded - ignore
  }
}

export async function saveProject(project: Project): Promise<void> {
  try {
    const database = await getDB();
    await database.put('projects', project);
  } catch {
    const all = lsLoad().filter(p => p.id !== project.id);
    lsSave([...all, project]);
  }
}

export async function loadAllProjects(): Promise<Project[]> {
  try {
    const database = await getDB();
    return await database.getAll('projects');
  } catch {
    return lsLoad();
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const database = await getDB();
    await database.delete('projects', id);
  } catch {
    lsSave(lsLoad().filter(p => p.id !== id));
  }
}
