import React, { useState, useEffect } from 'react';
import { useProjectStore, selectActiveSheet } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import type { ArcType } from '../../types/petri';

export default function PropertiesPanel() {
  const { selectedId, selectedType } = useUIStore();
  const sheet = useProjectStore(selectActiveSheet);
  const { updatePlace, updateTransition, updateArc } = useProjectStore();

  const [label, setLabel] = useState('');
  const [tokens, setTokens] = useState(0);
  const [capacity, setCapacity] = useState<string>('');
  const [weight, setWeight] = useState(1);
  const [arcType, setArcType] = useState<ArcType>('normal');
  const [priority, setPriority] = useState(0);

  useEffect(() => {
    if (!sheet || !selectedId) return;
    if (selectedType === 'place') {
      const p = sheet.net.places[selectedId];
      if (p) { setLabel(p.label); setTokens(p.tokens); setCapacity(p.capacity === null ? '' : String(p.capacity)); }
    } else if (selectedType === 'transition') {
      const t = sheet.net.transitions[selectedId];
      if (t) { setLabel(t.label); setPriority(t.priority); }
    } else if (selectedType === 'arc') {
      const a = sheet.net.arcs[selectedId];
      if (a) { setWeight(a.weight); setArcType(a.type); }
    }
  }, [selectedId, selectedType, sheet]);

  if (!selectedId || !sheet) {
    return (
      <div className="p-3 text-slate-500 text-sm">
        Select an element to edit its properties.
      </div>
    );
  }

  if (selectedType === 'place') {
    const place = sheet.net.places[selectedId];
    if (!place) return null;
    return (
      <div className="p-3 space-y-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Place</div>
        <Field label="Label">
          <input
            className="input-field"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={() => updatePlace(selectedId, { label })}
          />
        </Field>
        <Field label="Initial tokens">
          <input
            type="number" min={0}
            className="input-field"
            value={tokens}
            onChange={e => setTokens(Number(e.target.value))}
            onBlur={() => updatePlace(selectedId, { tokens })}
          />
        </Field>
        <Field label="Capacity (blank = ∞)">
          <input
            type="number" min={1}
            className="input-field"
            value={capacity}
            placeholder="∞"
            onChange={e => setCapacity(e.target.value)}
            onBlur={() => updatePlace(selectedId, { capacity: capacity === '' ? null : Number(capacity) })}
          />
        </Field>
        <div className="text-xs text-slate-500">
          Position: ({Math.round(place.x)}, {Math.round(place.y)})
        </div>
      </div>
    );
  }

  if (selectedType === 'transition') {
    return (
      <div className="p-3 space-y-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Transition</div>
        <Field label="Label">
          <input
            className="input-field"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={() => updateTransition(selectedId, { label })}
          />
        </Field>
        <Field label="Priority">
          <input
            type="number"
            className="input-field"
            value={priority}
            onChange={e => setPriority(Number(e.target.value))}
            onBlur={() => updateTransition(selectedId, { priority })}
          />
        </Field>
      </div>
    );
  }

  if (selectedType === 'arc') {
    return (
      <div className="p-3 space-y-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Arc</div>
        <Field label="Weight">
          <input
            type="number" min={1}
            className="input-field"
            value={weight}
            onChange={e => setWeight(Number(e.target.value))}
            onBlur={() => updateArc(selectedId, { weight })}
          />
        </Field>
        <Field label="Type">
          <select
            className="input-field"
            value={arcType}
            onChange={e => { const t = e.target.value as ArcType; setArcType(t); updateArc(selectedId, { type: t }); }}
          >
            <option value="normal">Normal</option>
            <option value="inhibitor">Inhibitor</option>
            <option value="reset">Reset</option>
          </select>
        </Field>
      </div>
    );
  }

  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
