import { useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Toolbar from './components/layout/Toolbar';
import RightPanel from './components/layout/RightPanel';
import PetriCanvas from './components/canvas/PetriCanvas';
import { useProjectStore } from './store/projectStore';
import { loadAllProjects } from './persistence/storage';

export default function App() {
  const { loadProjects, createProject } = useProjectStore();

  useEffect(() => {
    loadAllProjects().then(saved => {
      if (saved.length > 0) {
        loadProjects(saved);
      } else {
        createProject('My First Project');
      }
    });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
      {/* Top bar */}
      <div className="flex items-center px-3 py-1.5 bg-slate-900 border-b border-slate-800">
        <span className="text-sm font-bold text-slate-200 mr-2">Petri Net Editor</span>
        <span className="text-xs text-slate-600">v1.0</span>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex flex-col flex-1 overflow-hidden">
          <Toolbar />
          <div className="flex-1 overflow-hidden flex">
            <PetriCanvas />
          </div>
        </div>

        <RightPanel />
      </div>
    </div>
  );
}
