# Petri Net Editor

A browser-based Place/Transition (P/T) Petri net editor and simulator built with React, TypeScript, and Vite.

![Petri Net Editor](public/petri.png)

**Repo:** [github.com/tappress/petri-net](https://github.com/tappress/petri-net)

---

## Features

### Editor
- Draw **places** (circles), **transitions** (rectangles), and **arcs**
- Drag nodes to reposition; bend arcs via draggable control points
- Rotate transitions freely with an on-canvas handle
- Auto-select and move newly spawned elements without switching tools
- Delete selected element with `Del` / `Backspace`
- Pan with middle-click or select-drag; zoom with scroll wheel or ± buttons
- Properties panel: edit labels, token counts, arc weights, place capacity, transition priority

### Arc Types

| Type | Semantics |
|---|---|
| **Normal** | Consumes tokens from input place, produces to output place |
| **Inhibitor** | Disables transition when source place has ≥ weight tokens |
| **Read (Test)** | Checks token count without consuming — transition reads shared resource |
| **Reset** | Zeroes the source place on fire, regardless of token count |

### Simulation
- **Start Simulation** — enter sim mode showing initial enabling state before any step
- **Step** — fire one enabled transition (`Space`)
- **Step Back** — undo last step, restore previous marking (`←`)
- **Auto** — continuous stepping at configurable speed (Fast / Normal / Slow)
- Enabled transitions highlighted green; last fired transition highlighted amber
- Token dots animate along arcs during firing
- Full firing history with step-back support
- Nondeterministic conflict resolution (standard P/T semantics); optional priority extension to bias firing order
- Deadlock detection (auto-mode stops automatically)

### Projects & Persistence
- Multiple projects, each with multiple sheets
- Auto-saved to **IndexedDB** (localStorage fallback)
- Rename, duplicate, delete projects and sheets

### Export / Import

| Action | How |
|---|---|
| Download `.petri.json` | ↓ JSON button next to active project |
| Copy JSON to clipboard | ⎘ Copy button |
| Import from file | ↑ File button at top of sidebar |
| Import by pasting | Paste JSON text in sidebar textarea → ⎘ Paste |
| AI-assisted generation | ⎘ Copy JSON docs in header — paste alongside a net screenshot into any LLM |

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build

```bash
npm run build
```

### Tests

```bash
npm test            # run once
npm run test:watch  # watch mode
```

The test suite covers the full simulation engine: enabling rules, firing rules, all arc types, conflict resolution, priority, deadlock detection, place capacity, and token conservation. Includes fixture tests against a real exported net.

---

## JSON Format

Projects are stored and exported as plain JSON:

```
Project
└── sheets[]
    └── net
        ├── places[]       — id, label, x, y, tokens, capacity
        ├── transitions[]  — id, label, x, y, priority, rotation
        ├── arcs[]         — id, source, target, weight, type, cpDx, cpDy
        └── initialMarking — { placeId: tokenCount }
```

Arcs must connect a Place to a Transition (or vice versa) — never P→P or T→T.

Use the **⎘ Copy JSON docs** button in the header to copy the full format specification, then paste it alongside a Petri net diagram into an LLM to generate valid JSON automatically.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `V` | Select tool |
| `P` | Add place |
| `T` | Add transition |
| `A` | Add arc |
| `Esc` | Select tool / Stop simulation |
| `Space` | Step (sim mode) |
| `←` | Step back (sim mode) |
| `Del` / `Backspace` | Delete selected element |

---

## Tech Stack

| | |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| State | Zustand + Immer |
| UI | shadcn/ui (Base UI), Tailwind CSS 4 |
| Persistence | IndexedDB (idb), localStorage fallback |
| Testing | Vitest |
| Font | Geist Variable |

---

## Formal Semantics

Implements standard P/T net semantics:

**Enabling:** transition *t* is enabled at marking *M* iff `∀ input place p: M(p) ≥ w(p,t)`

**Firing:** `M'(p) = M(p) − w(p,t) + w(t,p)` — atomic, non-interruptible

**Conflict:** when multiple transitions are enabled simultaneously, one is chosen **nondeterministically** (uniform random) — this is standard P/T net behaviour.

**Extensions** (non-standard): inhibitor arcs, read/test arcs, reset arcs, place capacity constraints, transition priority (higher priority biases conflict resolution away from pure randomness).

---

## License

MIT
