import PropertiesPanel from '@/components/panels/PropertiesPanel';
import HistoryPanel from '@/components/panels/HistoryPanel';
import { useSimulationStore } from '@/store/simulationStore';
import { Separator } from '@/components/ui/separator';

export default function RightPanel() {
  const { history } = useSimulationStore();

  return (
    <div className="w-52 flex flex-col bg-sidebar border-l border-sidebar-border">
      <div className="px-3 py-2.5 border-b border-sidebar-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Properties</span>
      </div>
      <PropertiesPanel />

      <Separator />
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-sidebar-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Firing History</span>
        {history.length > 0 && (
          <span className="text-xs text-muted-foreground">{history.length}</span>
        )}
      </div>
      <HistoryPanel />
    </div>
  );
}
