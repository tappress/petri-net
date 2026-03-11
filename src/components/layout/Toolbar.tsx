import React from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSimulation } from '@/hooks/useSimulation';
import { useSimulationStore } from '@/store/simulationStore';
import { useProjectStore } from '@/store/projectStore';
import type { ToolMode } from '@/types/petri';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const tools: { mode: ToolMode; label: string; icon: string; tip: string }[] = [
  { mode: 'select',        label: 'Select',     icon: '↖', tip: 'Select & move (V)' },
  { mode: 'addPlace',      label: 'Place',      icon: '○', tip: 'Add place – circle (P)' },
  { mode: 'addTransition', label: 'Transition', icon: '▬', tip: 'Add transition – rectangle (T)' },
  { mode: 'addArc',        label: 'Arc',        icon: '→', tip: 'Draw arc (A)' },
];

export default function Toolbar() {
  const { tool, setTool, setSelected } = useUIStore();
  const { mode: simMode, stepOnce, startAuto, pauseAuto, resetSim, speed } = useSimulation();
  const setSpeed = useSimulationStore(s => s.setSpeed);
  const { deleteNode, deleteArc } = useProjectStore();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key) {
        case 'v': case 'V': setTool('select'); break;
        case 'p': case 'P': setTool('addPlace'); break;
        case 't': case 'T': setTool('addTransition'); break;
        case 'a': case 'A': setTool('addArc'); break;
        case 'Escape': setTool('select'); break;
        case ' ': e.preventDefault(); stepOnce(); break;
        case 'Delete':
        case 'Backspace': {
          e.preventDefault();
          const { selectedId: sid, selectedType: stype } = useUIStore.getState();
          if (!sid) break;
          if (stype === 'arc') {
            deleteArc(sid);
          } else {
            deleteNode(sid);
          }
          setSelected(null, null);
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTool, stepOnce, deleteNode, deleteArc, setSelected]);

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-card border-b border-border flex-wrap">
      {tools.map(t => (
        <Tooltip key={t.mode}>
          <TooltipTrigger render={<span />}>
            <Button
              variant={tool === t.mode ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTool(t.mode)}
              className="h-8 px-2.5 text-xs gap-1.5"
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.tip}</TooltipContent>
        </Tooltip>
      ))}

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Tooltip>
        <TooltipTrigger render={<span />}>
          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={stepOnce} disabled={simMode === 'running'}>
            ⏭ Step
          </Button>
        </TooltipTrigger>
        <TooltipContent>Step once (Space)</TooltipContent>
      </Tooltip>

      {simMode === 'running' ? (
        <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs border-green-500 text-green-700 hover:bg-green-50" onClick={pauseAuto}>
          ⏸ Pause
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={startAuto}>
          ▶ Run
        </Button>
      )}

      <Tooltip>
        <TooltipTrigger render={<span />}>
          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={resetSim}>
            ↺ Reset
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset to initial marking</TooltipContent>
      </Tooltip>

      <Select value={String(speed)} onValueChange={v => setSpeed(Number(v))}>
        <SelectTrigger className="h-8 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="200">Fast</SelectItem>
          <SelectItem value="800">Normal</SelectItem>
          <SelectItem value="2000">Slow</SelectItem>
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-2">
        {simMode === 'running' && (
          <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50 gap-1.5 text-xs">
            <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Running
          </Badge>
        )}
        <span className="text-xs text-muted-foreground hidden md:block">V P T A · Space=Step · Del=Delete</span>
      </div>
    </div>
  );
}
