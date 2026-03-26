import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { useAnalysisStore } from '@/store/analysisStore';
import Toolbar from '@/components/layout/Toolbar';
import RightPanel from '@/components/layout/RightPanel';
import PetriCanvas from '@/components/canvas/PetriCanvas';
import AnalysisPanel from '@/components/panels/AnalysisPanel';
import { useProjectStore } from '@/store/projectStore';
import { loadAllProjects } from '@/persistence/storage';
import { TooltipProvider } from '@/components/ui/tooltip';
import SimulationRunner from '@/components/SimulationRunner';

const PETRI_JSON_DOCS = `# Petri Net JSON Format

Generate a valid project JSON for the Petri Net Editor (https://github.com/tappress/petri-net).

## Top-level structure
\`\`\`json
{
  "id": "<nanoid>",
  "name": "Project Name",
  "activeSheetId": "<sheet-id>",
  "createdAt": 0,
  "updatedAt": 0,
  "sheets": {
    "<sheet-id>": { ...Sheet }
  }
}
\`\`\`

## Sheet
\`\`\`json
{
  "id": "<sheet-id>",
  "name": "Sheet 1",
  "createdAt": 0,
  "updatedAt": 0,
  "net": { ...PetriNet }
}
\`\`\`

## PetriNet
\`\`\`json
{
  "places":      { "<id>": Place, ... },
  "transitions": { "<id>": Transition, ... },
  "arcs":        { "<id>": Arc, ... },
  "initialMarking": { "<place-id>": <token-count>, ... }
}
\`\`\`

## Place
\`\`\`json
{
  "id": "<nanoid>",
  "label": "P1",
  "x": 100,
  "y": 200,
  "tokens": 1,
  "capacity": null
}
\`\`\`
- \`tokens\`: initial token count (must match \`initialMarking\`)
- \`capacity\`: max tokens allowed, or \`null\` for unlimited

## Transition
\`\`\`json
{
  "id": "<nanoid>",
  "label": "T1",
  "x": 300,
  "y": 200,
  "priority": 0,
  "rotation": 0
}
\`\`\`
- \`priority\`: higher value fires first in conflicts (default 0)
- \`rotation\`: visual rotation in degrees (default 0)

## Arc
\`\`\`json
{
  "id": "<nanoid>",
  "source": "<place-or-transition-id>",
  "target": "<place-or-transition-id>",
  "weight": 1,
  "type": "normal",
  "cpDx": 0,
  "cpDy": 0
}
\`\`\`
- \`source\`/\`target\`: MUST connect Place↔Transition (never P→P or T→T)
- \`weight\`: arc weight ≥ 1 (default 1)
- \`type\`:
  - \`"normal"\`   — standard arc, consumes/produces tokens
  - \`"inhibitor"\` — disables transition when place has ≥ weight tokens (circle-headed)
  - \`"read"\`     — checks tokens but does NOT consume them (test arc)
  - \`"reset"\`    — zeroes the source place on fire (ignores weight for consumption)
- \`cpDx\`/\`cpDy\`: visual bend offset from midpoint (default 0, 0)

## Enabling rule
Transition T is enabled when ALL input places have ≥ weight tokens (inhibitor arcs invert this).

## Firing rule
M'(p) = M(p) − w(p,T) + w(T,p) — atomic consume + produce.
Read arcs: tokens checked but not consumed.
Reset arcs: source place zeroed.

## Canvas coordinates
- Use x in roughly −600..600, y in −400..400 for good layout
- Spread nodes so they don't overlap (places: r=28, transitions: 48×64)
- Use \`cpDx\`/\`cpDy\` on arcs that would visually cross to bend them apart

## IDs
Use short random alphanumeric strings (nanoid style), e.g. \`"xYq3oqu5Zx"\`. All IDs must be unique within the document.

## Example — simple producer/consumer
\`\`\`json
{
  "id": "proj1",
  "name": "Producer-Consumer",
  "activeSheetId": "sheet1",
  "createdAt": 0, "updatedAt": 0,
  "sheets": {
    "sheet1": {
      "id": "sheet1", "name": "Sheet 1", "createdAt": 0, "updatedAt": 0,
      "net": {
        "places": {
          "p_buf": { "id": "p_buf", "label": "Buffer", "x": 0, "y": 0, "tokens": 0, "capacity": null }
        },
        "transitions": {
          "t_prod": { "id": "t_prod", "label": "Produce", "x": -200, "y": 0, "priority": 0, "rotation": 0 },
          "t_cons": { "id": "t_cons", "label": "Consume", "x":  200, "y": 0, "priority": 0, "rotation": 0 }
        },
        "arcs": {
          "a1": { "id": "a1", "source": "t_prod", "target": "p_buf", "weight": 1, "type": "normal", "cpDx": 0, "cpDy": 0 },
          "a2": { "id": "a2", "source": "p_buf",  "target": "t_cons", "weight": 1, "type": "normal", "cpDx": 0, "cpDy": 0 }
        },
        "initialMarking": { "p_buf": 0 }
      }
    }
  }
}
\`\`\`
`;

export default function App() {
  const { loadProjects, createProject } = useProjectStore();
  const analysisVisible = useAnalysisStore(s => s.isVisible);
  const [docsCopied, setDocsCopied] = useState(false);

  useEffect(() => {
    loadAllProjects().then(saved => {
      if (saved.length > 0) {
        loadProjects(saved);
      } else {
        createProject('My First Project');
      }
    });
  }, []);

  const handleCopyDocs = async () => {
    await navigator.clipboard.writeText(PETRI_JSON_DOCS);
    setDocsCopied(true);
    setTimeout(() => setDocsCopied(false), 1800);
  };

  return (
    <TooltipProvider delay={400}>
      <SimulationRunner />
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-2 bg-card border-b border-border shadow-sm">
          <span className="text-sm font-bold text-foreground">Petri Net Editor</span>
          <span className="text-xs text-muted-foreground mr-auto">v1.0</span>

          <button
            onClick={handleCopyDocs}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2.5 py-1 transition-colors hover:bg-accent flex items-center gap-1.5"
            title="Copy JSON format docs for AI — paste alongside a screenshot to generate a net"
          >
            {docsCopied ? '✓ Copied!' : '⎘ Copy JSON docs'}
          </button>

          <a
            href="https://github.com/tappress/petri-net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            tappress/petri-net
          </a>
        </header>

        {/* Main layout */}
        <div className="flex flex-1 overflow-hidden">
          {!analysisVisible && <Sidebar />}

          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <Toolbar />
            <div className="flex-1 overflow-hidden flex bg-slate-50 min-h-0">
              <div className={analysisVisible ? 'w-1/2 overflow-hidden' : 'flex-1 overflow-hidden'}>
                <PetriCanvas />
              </div>
              <AnalysisPanel />
            </div>
          </div>

          {!analysisVisible && <RightPanel />}
        </div>
      </div>
    </TooltipProvider>
  );
}
