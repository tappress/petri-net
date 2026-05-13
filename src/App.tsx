import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { useAnalysisStore } from '@/store/analysisStore';
import { useMatrixAnalysisStore } from '@/store/matrixAnalysisStore';
import Toolbar from '@/components/layout/Toolbar';
import RightPanel from '@/components/layout/RightPanel';
import PetriCanvas from '@/components/canvas/PetriCanvas';
import AnalysisPanel from '@/components/panels/AnalysisPanel';
import MatrixAnalysisPanel from '@/components/panels/MatrixAnalysisPanel';
import { useProjectStore } from '@/store/projectStore';
import { loadAllProjects } from '@/persistence/storage';
import { TooltipProvider } from '@/components/ui/tooltip';
import SimulationRunner from '@/components/SimulationRunner';

const PETRI_JSON_DOCS = `# Petri Net JSON Format

Generate a valid project JSON for the Petri Net Editor (https://github.com/tappress/petri-net).
This format is suitable for Lab 1-4 (modeling computational systems).

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
  "description": "Domain-level description of the modeled system (Lab 4)",
  "createdAt": 0,
  "updatedAt": 0,
  "net": { ...PetriNet }
}
\`\`\`
- \`description\` (optional): textual summary of what the net models. Use it for Lab 4 to record the system's purpose, key entities (resources/objects/users/services) and the high-level behavior.

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
  "label": "Bug registered",
  "x": 100,
  "y": 200,
  "tokens": 1,
  "capacity": null,
  "kind": "state",
  "description": "Bug-report has been logged and waits for triage"
}
\`\`\`
- \`tokens\`: initial token count (must match \`initialMarking\`)
- \`capacity\`: max tokens allowed, or \`null\` for unlimited
- \`kind\` (optional): semantic role — one of:
  - \`"state"\`     — system state / phase (e.g. "Bug registered", "In review")
  - \`"resource"\`  — resource pool (e.g. "Free developer", "Available agent")
  - \`"buffer"\`    — queue / accumulator (e.g. "Pending requests")
  - \`"counter"\`   — bounded counter, typically for retry / timeout
  - \`"condition"\` — boolean flag / guard token
- \`description\` (optional): plain-language explanation, surfaces in Properties panel.

## Transition
\`\`\`json
{
  "id": "<nanoid>",
  "label": "Confirm bug",
  "x": 300,
  "y": 200,
  "priority": 0,
  "rotation": 0,
  "kind": "decision",
  "description": "Triage decided the report is a real bug",
  "guard": "logs.contain_error == true"
}
\`\`\`
- \`priority\`: higher value fires first in conflicts (default 0)
- \`rotation\`: visual rotation in degrees (default 0)
- \`kind\` (optional): semantic role — one of:
  - \`"event"\`    — externally triggered (commit, login, request arrives)
  - \`"action"\`   — internal action (start build, run tests)
  - \`"decision"\` — branching choice (confirm/reject, success/failure)
  - \`"timeout"\`  — fires when bounded time passes (often paired with a counter place)
- \`description\` (optional): plain-language explanation
- \`guard\` (optional): human-readable predicate — purely informational, NOT enforced by the simulator. Use to document under what condition this branch is intended to fire.

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
  - \`"normal"\`    — standard arc, consumes/produces tokens
  - \`"inhibitor"\` — disables transition when place has ≥ weight tokens (circle-headed)
  - \`"read"\`      — checks tokens but does NOT consume them (test arc)
  - \`"reset"\`     — zeroes the source place on fire (ignores weight for consumption)
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
- Lay out left-to-right by causal order: initial states on the left, terminal states on the right
- Use \`cpDx\`/\`cpDy\` on arcs that would visually cross to bend them apart

## IDs
Use short random alphanumeric strings (nanoid style), e.g. \`"xYq3oqu5Zx"\`. All IDs must be unique within the document.

---

# Modeling computational systems (Lab 4)

When given a verbal description of a workflow ("registration", "CI/CD", "support
ticket", etc.), translate it using these patterns.

## Pattern: extracting entities
1. **States (places, kind: "state")** — every distinct phase the process can be in
   ("Bug registered", "In development", "Testing", "Closed", "Failed").
2. **Resources (places, kind: "resource")** — pools of agents/devs/slots that get
   acquired and released. A resource pool starts with N tokens (N = available count),
   gets consumed by an "acquire" transition, returned by a "release" transition.
3. **Counters (places, kind: "counter")** — for "retry once" or bounded-attempt logic.
   Start with the allowed number of attempts (e.g. 1 token), consumed by the retry
   transition, exhaustion blocks further retries via inhibitor arc or simple lack of tokens.
4. **Events (transitions, kind: "event")** — external triggers (commit pushed, request
   arrived, user submitted form).
5. **Actions/decisions (transitions, kind: "action" / "decision")** — internal steps
   and branching points.

## Pattern: parallel branches (fork/join)
"After registration, **in parallel** validate data and send email."

\`\`\`
                ┌─→ [validating] ─→ T_done_validate ─┐
T_register ─┤                                         ├─→ T_join ─→ [activated]
                └─→ [emailing]   ─→ T_done_email    ─┘
\`\`\`

- One **fork transition** with multiple output arcs (puts a token in each parallel branch place).
- Each branch is its own pipeline of places and transitions.
- One **join transition** with input arcs from each branch's terminal place
  (only enabled when ALL branches finished).

## Pattern: alternative branches (if/else)
"If bug confirmed → development, else → closed."

Two transitions consuming the SAME input place but going to DIFFERENT outputs:
\`\`\`
[triaged] ─→ T_confirm  ─→ [in_development]
[triaged] ─→ T_reject   ─→ [closed]
\`\`\`
- Use \`guard\` field on each transition to document the branching condition.
- The simulator chooses non-deterministically; use \`priority\` if one branch must dominate.

## Pattern: retry-once
"On test failure, return to development; on second failure — fail permanently."

Use a **counter place** initialized with 1 token (one retry allowed):
\`\`\`
[testing] ─→ T_fail (also consumes from [retries_left]) ─→ [in_development]
[testing] ─→ T_fail_final (inhibitor on [retries_left])  ─→ [failed]
\`\`\`
- \`retries_left\` is a Place with \`kind: "counter"\`, \`tokens: 1\`.
- The "retry" transition consumes 1 token from it (so second time around it's empty).
- The "give up" transition has an **inhibitor arc** from \`retries_left\` (fires only when retries are exhausted).

## Pattern: timeout
"If email not confirmed within time — registration cancelled."

Two competing transitions from the "waiting" state — one normal (success), one
\`kind: "timeout"\` (failure). The timeout transition has higher \`priority\` is
optional; the model captures the *possibility* of timeout regardless.

## Pattern: resource pool
"N agents available, request reserves one and releases it on close."

\`\`\`
[free_agents] (kind: resource, tokens: N)
       │
       ├─→ T_acquire ─→ [in_progress] ─→ T_close ─→ [free_agents] (return)
\`\`\`

## Naming guidelines
- **Place labels**: noun phrases describing a state ("Bug registered", "Tests running", "Free dev").
  Avoid imperatives ("Run tests" — that's a transition).
- **Transition labels**: verb phrases ("Register bug", "Run tests", "Reject").
- Stay in the language of the variant description (Ukrainian / English / mixed is fine —
  match the user's verbal description).

---

# Worked example — Variant 1, "Bug-report processing"

> Bug is registered. In parallel, logs are checked and a developer is assigned.
> If bug is confirmed — it goes to development; if not — it's closed. After
> implementation, testing happens; on failure, task returns once for rework, then
> either closes or is recorded as a failure.

\`\`\`json
{
  "id": "proj_bug",
  "name": "Bug-report processing (Variant 1)",
  "activeSheetId": "sh1",
  "createdAt": 0, "updatedAt": 0,
  "sheets": {
    "sh1": {
      "id": "sh1",
      "name": "Bug flow",
      "description": "Variant 1: Bug-report processing. Entities: bug (object), developer (resource), retries_left (counter). Logs and developer assignment happen in parallel after registration; confirmation gates entry into development; one retry allowed on test failure.",
      "createdAt": 0, "updatedAt": 0,
      "net": {
        "places": {
          "p_new":     { "id": "p_new",     "label": "New bug",          "x": -500, "y":   0, "tokens": 1, "capacity": null, "kind": "state",    "description": "Bug-report submitted, awaiting registration" },
          "p_logs":    { "id": "p_logs",    "label": "Logs checking",    "x": -250, "y": -120, "tokens": 0, "capacity": null, "kind": "state" },
          "p_assign":  { "id": "p_assign",  "label": "Assigning dev",    "x": -250, "y":  120, "tokens": 0, "capacity": null, "kind": "state" },
          "p_logs_ok": { "id": "p_logs_ok", "label": "Logs analysed",    "x":  -50, "y": -120, "tokens": 0, "capacity": null, "kind": "state" },
          "p_dev_set": { "id": "p_dev_set", "label": "Dev assigned",     "x":  -50, "y":  120, "tokens": 0, "capacity": null, "kind": "state" },
          "p_triage":  { "id": "p_triage",  "label": "Triaged",          "x":  150, "y":   0, "tokens": 0, "capacity": null, "kind": "state",    "description": "Both branches finished; ready for confirm/reject decision" },
          "p_dev":     { "id": "p_dev",     "label": "In development",   "x":  300, "y":  -90, "tokens": 0, "capacity": null, "kind": "state" },
          "p_test":    { "id": "p_test",    "label": "Testing",          "x":  450, "y":  -90, "tokens": 0, "capacity": null, "kind": "state" },
          "p_retries": { "id": "p_retries", "label": "Retries left",     "x":  450, "y":  150, "tokens": 1, "capacity": 1,    "kind": "counter", "description": "One retry allowed on test failure" },
          "p_closed":  { "id": "p_closed",  "label": "Closed",           "x":  650, "y":  -90, "tokens": 0, "capacity": null, "kind": "state" },
          "p_failed":  { "id": "p_failed",  "label": "Failed",           "x":  650, "y":  150, "tokens": 0, "capacity": null, "kind": "state" }
        },
        "transitions": {
          "t_register": { "id": "t_register", "label": "Register",     "x": -380, "y":   0, "priority": 0, "rotation": 0, "kind": "event",    "description": "Bug-report logged into the system, forks parallel work" },
          "t_logs":     { "id": "t_logs",     "label": "Check logs",   "x": -150, "y": -120, "priority": 0, "rotation": 0, "kind": "action" },
          "t_assign":   { "id": "t_assign",   "label": "Assign dev",   "x": -150, "y":  120, "priority": 0, "rotation": 0, "kind": "action" },
          "t_join":     { "id": "t_join",     "label": "Join triage",  "x":   50, "y":   0, "priority": 0, "rotation": 0, "kind": "action",   "description": "Both branches done — ready for decision" },
          "t_confirm":  { "id": "t_confirm",  "label": "Confirm",      "x":  230, "y":  -50, "priority": 0, "rotation": 0, "kind": "decision", "guard": "bug confirmed" },
          "t_reject":   { "id": "t_reject",   "label": "Reject",       "x":  230, "y":   80, "priority": 0, "rotation": 0, "kind": "decision", "guard": "bug NOT confirmed", "description": "Closes triaged bug as not-a-bug" },
          "t_implement":{ "id": "t_implement","label": "Implement",    "x":  380, "y":  -90, "priority": 0, "rotation": 0, "kind": "action" },
          "t_pass":     { "id": "t_pass",     "label": "Tests pass",   "x":  560, "y": -150, "priority": 0, "rotation": 0, "kind": "decision", "guard": "tests == passed" },
          "t_retry":    { "id": "t_retry",    "label": "Retry rework", "x":  560, "y":   30, "priority": 0, "rotation": 0, "kind": "decision", "guard": "tests failed AND retries_left > 0", "description": "First failure — back to dev; consumes 1 retry" },
          "t_fail":     { "id": "t_fail",     "label": "Final fail",   "x":  560, "y":  150, "priority": 0, "rotation": 0, "kind": "decision", "guard": "tests failed AND retries_left == 0" }
        },
        "arcs": {
          "a01": { "id": "a01", "source": "p_new",     "target": "t_register", "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a02": { "id": "a02", "source": "t_register","target": "p_logs",     "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a03": { "id": "a03", "source": "t_register","target": "p_assign",   "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a04": { "id": "a04", "source": "p_logs",    "target": "t_logs",     "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a05": { "id": "a05", "source": "t_logs",    "target": "p_logs_ok",  "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a06": { "id": "a06", "source": "p_assign",  "target": "t_assign",   "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a07": { "id": "a07", "source": "t_assign",  "target": "p_dev_set",  "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a08": { "id": "a08", "source": "p_logs_ok", "target": "t_join",     "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a09": { "id": "a09", "source": "p_dev_set", "target": "t_join",     "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a10": { "id": "a10", "source": "t_join",    "target": "p_triage",   "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a11": { "id": "a11", "source": "p_triage",  "target": "t_confirm",  "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a12": { "id": "a12", "source": "p_triage",  "target": "t_reject",   "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a13": { "id": "a13", "source": "t_reject",  "target": "p_closed",   "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a14": { "id": "a14", "source": "t_confirm", "target": "p_dev",      "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a15": { "id": "a15", "source": "p_dev",     "target": "t_implement","weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a16": { "id": "a16", "source": "t_implement","target":"p_test",     "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a17": { "id": "a17", "source": "p_test",    "target": "t_pass",     "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a18": { "id": "a18", "source": "t_pass",    "target": "p_closed",   "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a19": { "id": "a19", "source": "p_test",    "target": "t_retry",    "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a20": { "id": "a20", "source": "p_retries", "target": "t_retry",    "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a21": { "id": "a21", "source": "t_retry",   "target": "p_dev",      "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a22": { "id": "a22", "source": "p_test",    "target": "t_fail",     "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 },
          "a23": { "id": "a23", "source": "p_retries", "target": "t_fail",     "weight": 1, "type": "inhibitor", "cpDx": 0, "cpDy": 0 },
          "a24": { "id": "a24", "source": "t_fail",    "target": "p_failed",   "weight": 1, "type": "normal",    "cpDx": 0, "cpDy": 0 }
        },
        "initialMarking": {
          "p_new": 1, "p_logs": 0, "p_assign": 0, "p_logs_ok": 0, "p_dev_set": 0,
          "p_triage": 0, "p_dev": 0, "p_test": 0, "p_retries": 1,
          "p_closed": 0, "p_failed": 0
        }
      }
    }
  }
}
\`\`\`

## How to use this with an AI
1. Copy this whole document.
2. Paste into your AI chat together with your variant description (e.g. "Variant 4 — User registration").
3. Ask: "Generate a project JSON for this variant following the format and the modeling patterns above. Use semantic \`kind\` and \`description\` fields. Lay out left-to-right."
4. Paste the resulting JSON into the editor's "Paste JSON here…" box (left sidebar).
`;

export default function App() {
  const { loadProjects, createProject } = useProjectStore();
  const analysisVisible = useAnalysisStore(s => s.isVisible);
  const matrixVisible = useMatrixAnalysisStore(s => s.isVisible);
  const sidePanelVisible = analysisVisible || matrixVisible;
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
          {!sidePanelVisible && <Sidebar />}

          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <Toolbar />
            <div className="flex-1 overflow-hidden flex bg-slate-50 min-h-0">
              <div className={sidePanelVisible ? 'w-1/2 overflow-hidden' : 'flex-1 overflow-hidden'}>
                <PetriCanvas />
              </div>
              <AnalysisPanel />
              <MatrixAnalysisPanel />
            </div>
          </div>

          {!sidePanelVisible && <RightPanel />}
        </div>
      </div>
    </TooltipProvider>
  );
}
