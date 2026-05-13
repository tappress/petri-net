import React, { useState, useEffect } from 'react';
import { useProjectStore, selectActiveSheet } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import type { ArcType, PlaceKind, TransitionKind } from '@/types/petri';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PLACE_KINDS: { value: PlaceKind | ''; label: string }[] = [
  { value: '',          label: '— не вказано —' },
  { value: 'state',     label: 'state — стан системи' },
  { value: 'resource',  label: 'resource — ресурс (агент, дев, токен)' },
  { value: 'buffer',    label: 'buffer — черга / накопичувач' },
  { value: 'counter',   label: 'counter — лічильник (retry, timeout)' },
  { value: 'condition', label: 'condition — умова / прапорець' },
];

const TRANSITION_KINDS: { value: TransitionKind | ''; label: string }[] = [
  { value: '',         label: '— не вказано —' },
  { value: 'event',    label: 'event — зовнішня подія' },
  { value: 'action',   label: 'action — внутрішня дія' },
  { value: 'decision', label: 'decision — гілкування / вибір' },
  { value: 'timeout',  label: 'timeout — спрацювання за часом' },
];

const TEXTAREA_CLS =
  'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs ' +
  'transition-colors outline-none placeholder:text-muted-foreground ' +
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y';

export default function PropertiesPanel() {
  const { selectedId, selectedType } = useUIStore();
  const sheet = useProjectStore(selectActiveSheet);
  const { updatePlace, updateTransition, updateArc, setSheetDescription } = useProjectStore();

  const [label, setLabel] = useState('');
  const [tokens, setTokens] = useState('');
  const [capacity, setCapacity] = useState('');
  const [weight, setWeight] = useState('');
  const [arcType, setArcType] = useState<ArcType>('normal');
  const [priority, setPriority] = useState('');
  const [placeKind, setPlaceKind] = useState<PlaceKind | ''>('');
  const [placeDesc, setPlaceDesc] = useState('');
  const [transKind, setTransKind] = useState<TransitionKind | ''>('');
  const [transDesc, setTransDesc] = useState('');
  const [transGuard, setTransGuard] = useState('');
  const [sheetDesc, setSheetDesc] = useState('');

  useEffect(() => {
    if (sheet) setSheetDesc(sheet.description ?? '');
  }, [sheet?.id, sheet?.description]);

  useEffect(() => {
    if (!sheet || !selectedId) return;
    if (selectedType === 'place') {
      const p = sheet.net.places[selectedId];
      if (p) {
        setLabel(p.label);
        setTokens(String(p.tokens));
        setCapacity(p.capacity === null ? '' : String(p.capacity));
        setPlaceKind(p.kind ?? '');
        setPlaceDesc(p.description ?? '');
      }
    } else if (selectedType === 'transition') {
      const t = sheet.net.transitions[selectedId];
      if (t) {
        setLabel(t.label);
        setPriority(String(t.priority));
        setTransKind(t.kind ?? '');
        setTransDesc(t.description ?? '');
        setTransGuard(t.guard ?? '');
      }
    } else if (selectedType === 'arc') {
      const a = sheet.net.arcs[selectedId];
      if (a) { setWeight(String(a.weight)); setArcType(a.type); }
    }
  }, [selectedId, selectedType, sheet]);

  if (!selectedId || !sheet) {
    if (!sheet) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Select an element to edit its properties.
        </div>
      );
    }
    return (
      <div className="p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Sheet — {sheet.name}
        </p>
        <Field label="Description (system being modeled)">
          <textarea
            className={TEXTAREA_CLS}
            rows={5}
            value={sheetDesc}
            placeholder="Опис обчислювальної системи, яку моделює ця мережа Петрі"
            onChange={e => setSheetDesc(e.target.value)}
            onBlur={() => setSheetDescription(sheet.id, sheetDesc)}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Натисни на елемент щоб редагувати його властивості.
        </p>
      </div>
    );
  }

  if (selectedType === 'place') {
    const place = sheet.net.places[selectedId];
    if (!place) return null;
    return (
      <div className="p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Place</p>
        <Field label="Label">
          <Input className="h-7 text-xs" value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={() => updatePlace(selectedId, { label })}
            onKeyDown={e => { if (e.key === 'Enter') updatePlace(selectedId, { label }); }} />
        </Field>
        <Field label="Initial tokens">
          <Input className="h-7 text-xs" value={tokens} placeholder="0"
            onChange={e => setTokens(e.target.value)}
            onBlur={() => { const n = parseInt(tokens, 10); if (!isNaN(n) && n >= 0) updatePlace(selectedId, { tokens: n }); else setTokens(String(place.tokens)); }} />
        </Field>
        <Field label="Capacity (blank = ∞)">
          <Input className="h-7 text-xs" value={capacity} placeholder="∞"
            onChange={e => setCapacity(e.target.value)}
            onBlur={() => {
              if (capacity === '') { updatePlace(selectedId, { capacity: null }); return; }
              const n = parseInt(capacity, 10);
              if (!isNaN(n) && n >= 1) updatePlace(selectedId, { capacity: n });
              else setCapacity(place.capacity === null ? '' : String(place.capacity));
            }} />
        </Field>
        <Field label="Kind (semantic role)">
          <Select
            value={placeKind === '' ? '__none__' : placeKind}
            onValueChange={v => {
              const k = v === '__none__' ? '' : (v as PlaceKind);
              setPlaceKind(k);
              updatePlace(selectedId, { kind: k === '' ? undefined : k });
            }}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLACE_KINDS.map(o => (
                <SelectItem key={o.value || '__none__'} value={o.value === '' ? '__none__' : o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Description">
          <textarea
            className={TEXTAREA_CLS}
            rows={2}
            value={placeDesc}
            placeholder="Що означає це місце в реальній системі"
            onChange={e => setPlaceDesc(e.target.value)}
            onBlur={() => updatePlace(selectedId, { description: placeDesc || undefined })}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Position: ({Math.round(place.x)}, {Math.round(place.y)})
        </p>
      </div>
    );
  }

  if (selectedType === 'transition') {
    const t = sheet.net.transitions[selectedId];
    if (!t) return null;
    return (
      <div className="p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transition</p>
        <Field label="Label">
          <Input className="h-7 text-xs" value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={() => updateTransition(selectedId, { label })}
            onKeyDown={e => { if (e.key === 'Enter') updateTransition(selectedId, { label }); }} />
        </Field>
        <Field label="Priority">
          <Input className="h-7 text-xs" value={priority} placeholder="0"
            onChange={e => setPriority(e.target.value)}
            onBlur={() => { const n = parseInt(priority, 10); if (!isNaN(n)) updateTransition(selectedId, { priority: n }); else setPriority(String(t.priority)); }} />
        </Field>
        <Field label="Kind (semantic role)">
          <Select
            value={transKind === '' ? '__none__' : transKind}
            onValueChange={v => {
              const k = v === '__none__' ? '' : (v as TransitionKind);
              setTransKind(k);
              updateTransition(selectedId, { kind: k === '' ? undefined : k });
            }}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRANSITION_KINDS.map(o => (
                <SelectItem key={o.value || '__none__'} value={o.value === '' ? '__none__' : o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Guard / умова">
          <Input className="h-7 text-xs" value={transGuard}
            placeholder="напр.: tests == passed"
            onChange={e => setTransGuard(e.target.value)}
            onBlur={() => updateTransition(selectedId, { guard: transGuard || undefined })}
            onKeyDown={e => { if (e.key === 'Enter') updateTransition(selectedId, { guard: transGuard || undefined }); }} />
        </Field>
        <Field label="Description">
          <textarea
            className={TEXTAREA_CLS}
            rows={2}
            value={transDesc}
            placeholder="Що означає ця подія/дія в реальній системі"
            onChange={e => setTransDesc(e.target.value)}
            onBlur={() => updateTransition(selectedId, { description: transDesc || undefined })}
          />
        </Field>
      </div>
    );
  }

  if (selectedType === 'arc') {
    const arc = sheet.net.arcs[selectedId];
    if (!arc) return null;
    return (
      <div className="p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Arc</p>
        <Field label="Weight">
          <Input className="h-7 text-xs" value={weight} placeholder="1"
            onChange={e => setWeight(e.target.value)}
            onBlur={() => { const n = parseInt(weight, 10); if (!isNaN(n) && n >= 1) updateArc(selectedId, { weight: n }); else setWeight(String(arc.weight)); }} />
        </Field>
        <Field label="Type">
          <Select value={arcType} onValueChange={v => { const t = v as ArcType; setArcType(t); updateArc(selectedId, { type: t }); }}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="inhibitor">Inhibitor</SelectItem>
              <SelectItem value="reset">Reset</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    );
  }

  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
