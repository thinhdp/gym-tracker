---
name: add-feature
description: Scaffold a new feature, component, or tab in the gym-tracker React app following its established conventions (AppContext/useApp, ui/ primitives, loadLS/saveLS persistence, useConfirm, kg-storage unit boundary). Use whenever adding a new component, view, tab, or UI feature to this repo so the code matches existing patterns instead of inventing new ones.
---

# Add a feature to Gym Tracker

Gym Tracker is a client-only React 18 + Vite + Tailwind SPA with no router, no
TypeScript, and no test framework. All state lives in `localStorage` via a thin
`loadLS`/`saveLS` layer. When adding a feature, **match the existing patterns** —
do not introduce new libraries, CSS files, or state mechanisms.

Follow this checklist in order.

## 1. Read first

Before writing code, skim:

- [ARCHITECTURE.md](../../../ARCHITECTURE.md) — state model, persistence, component hierarchy, data flow.
- [docs/DATA-MODEL.md](../../../docs/DATA-MODEL.md) — exact localStorage keys and object shapes.
- [CONTRIBUTING.md](../../../CONTRIBUTING.md) — conventions and the manual test checklist.

## 2. Component conventions

- Plain `.jsx` — **no TypeScript**. Function components + hooks only.
- **Default-export** the main component of a file; **named-export** shared
  primitives (like `Button`, `Input`).
- Start each component file with a top-of-file comment block: purpose, props it
  receives, and the key state it owns. (See any existing component.)
- Styling is **Tailwind utility classes inline** in `className`. Never add a CSS
  file. Reuse the `ui/` primitives instead of restyling raw elements:
  - `Button`, `Input` (+ `Textarea`), `Card` (+ `CardContent`), `Badge`,
    `ComboInput` — in `src/components/ui/`.
  - Shared inputs: `WeightRepInputs`, `NumberInputAutoClear`.
  - Common rounding is `rounded-xl` / `rounded-2xl`.

## 3. Shared state — use `useApp()`, do not prop-drill

For the core shared state, call the context hook — never thread it down as props
or read `localStorage` directly:

```jsx
import { useApp } from "../context/AppContext";
const { exercises, setExercises, workouts, setWorkouts, unit, setUnit, tab, setTab } = useApp();
```

All existing views follow this pattern — `AppContent` passes no data props.
Presentational children (e.g. `ExerciseRow`, `WorkoutHistoryItem`) receive what
they render as plain props from their owning view.

## 4. Self-owned persistence

If the feature owns a private slice of data (not part of the core
exercises/workouts/unit/tab state), persist it yourself via `loadLS`/`saveLS`
from `src/lib/storage.js` under a clearly-named `mgym.*` key. **Never call
`localStorage` directly.** Pattern (from `Notepad.jsx`):

```jsx
import { loadLS, saveLS } from "../lib/storage";
const K_NOTE = "mgym.note.v1";

const [content, setContent] = useState(() => loadLS(K_NOTE, ""));   // lazy read
useEffect(() => saveLS(K_NOTE, content), [content]);                 // reactive write
```

Existing self-owned keys for reference: `mgym.note.v1` (Notepad), `weightLogs`
(WeightTracker), `weekly-note:<weekKey>` (WeeklyNotes), `summary-open:<periodKey>`
(PeriodCard). Use `uuid()` from `storage.js` for ids and `todayStr()` for
`YYYY-MM-DD` dates.

## 5. Units (kg / lb)

Workout weights are **always stored in kilograms**. The `unit` toggle is
display-only. Convert at the input/display boundary with helpers from
`src/lib/units.js`:

- Display: `toDisplayWeight(kg, unit)`
- Input: `fromDisplayWeight(value, unit)` → back to kg before storing.

Never persist a pounds value into a set. (Exception, by design: bodyweight logs
in `WeightTracker` are stored raw and only relabeled.)

## 6. Destructive actions

For any delete/remove confirmation use the `useConfirm()` hook from
`src/components/ConfirmDialog.jsx` — **not** `window.confirm`.

## 7. Reuse existing helpers

- `createExerciseEntry()` (`src/lib/exerciseUtils.js`) — "create if missing +
  prefill from last set" logic for add-exercise flows (used by planner, history,
  calendar).
- Dates: `src/lib/date.js` (`ymd`) and `src/lib/dateUtils.js` (week/month
  boundaries, keys, labels).
- Metrics/bucketing for analytics: `src/lib/metrics.js`.

## 8. Adding a whole new tab

The active `tab` is a string in `AppContext`, already persisted to `mgym.tab`.
To add one, edit `src/App.jsx` (`AppContent`) in two places:

1. **Tab button row** (the `inline-flex` group of `<Button>`s) — add:
   ```jsx
   <Button
     variant={tab === "goals" ? "primary" : "ghost"}
     onClick={() => setTab("goals")}
   >
     Goals
   </Button>
   ```
2. **Render branch** (alongside the other `tab === "..."` blocks) — add:
   ```jsx
   {tab === "goals" && <GoalsView />}
   ```

Import the new component at the top of `App.jsx`. Prefer having the new
component read `useApp()` directly rather than passing props from `AppContent`.

## 9. Verify

There is no automated test suite. Run the app and check manually:

```bash
npm run dev      # Vite dev server, http://localhost:5173
```

- The feature works, and its data **persists across a page reload**.
- Toggle kg/lb and confirm stored set weights are unchanged (display only).
- See the manual checklist in [CONTRIBUTING.md](../../../CONTRIBUTING.md#testing).
