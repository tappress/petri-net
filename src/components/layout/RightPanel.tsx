import PropertiesPanel from '../panels/PropertiesPanel';
import HistoryPanel from '../panels/HistoryPanel';
import { useSimulationStore } from '../../store/simulationStore';

export default function RightPanel() {
  const { history } = useSimulationStore();

  return (
    <div className="w-52 flex flex-col bg-slate-900 border-l border-slate-800 text-sm overflow-hidden">
      <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
        Properties
      </div>
      <PropertiesPanel />

      <div className="border-t border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center justify-between">
        <span>Firing History</span>
        {history.length > 0 && (
          <span className="text-slate-600">{history.length}</span>
        )}
      </div>
      <HistoryPanel />
    </div>
  );
}
