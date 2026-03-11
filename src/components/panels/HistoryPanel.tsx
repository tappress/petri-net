import { useSimulationStore } from '../../store/simulationStore';

export default function HistoryPanel() {
  const { history } = useSimulationStore();

  if (history.length === 0) {
    return <div className="p-3 text-slate-500 text-sm">No firings yet.</div>;
  }

  return (
    <div className="overflow-y-auto max-h-64">
      {[...history].reverse().map(r => (
        <div key={r.step} className="px-3 py-1.5 border-b border-slate-800 text-xs">
          <span className="text-slate-500 mr-2">#{r.step}</span>
          <span className="text-green-400 font-mono">{r.transitionLabel}</span>
        </div>
      ))}
    </div>
  );
}
