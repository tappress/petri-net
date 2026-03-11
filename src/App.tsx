import { useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Toolbar from '@/components/layout/Toolbar';
import RightPanel from '@/components/layout/RightPanel';
import PetriCanvas from '@/components/canvas/PetriCanvas';
import { useProjectStore } from '@/store/projectStore';
import { loadAllProjects } from '@/persistence/storage';
import { TooltipProvider } from '@/components/ui/tooltip';
import SimulationRunner from '@/components/SimulationRunner';

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
    <TooltipProvider delay={400}>
      <SimulationRunner />
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
        {/* Top bar */}
        <header className="flex items-center px-4 py-2 bg-card border-b border-border shadow-sm">
          <span className="text-sm font-bold text-foreground mr-2">Petri Net Editor</span>
          <span className="text-xs text-muted-foreground">v1.0</span>
        </header>

        {/* Main layout */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />

          <div className="flex flex-col flex-1 overflow-hidden">
            <Toolbar />
            <div className="flex-1 overflow-hidden flex bg-slate-50">
              <PetriCanvas />
            </div>
          </div>

          <RightPanel />
        </div>
      </div>
    </TooltipProvider>
  );
}
