import { useSimulationStore } from '@/store/simulationStore';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function HistoryPanel() {
  const { history } = useSimulationStore();

  if (history.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No firings yet.</div>;
  }

  return (
    <ScrollArea className="h-full">
      {[...history].reverse().map(r => (
        <div key={r.step} className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 text-xs">
          <span className="text-muted-foreground tabular-nums w-6 text-right">#{r.step}</span>
          <span className="text-primary font-mono font-medium">{r.transitionLabel}</span>
        </div>
      ))}
    </ScrollArea>
  );
}
