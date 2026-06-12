# Contributing

Thanks for working on Gym Tracker. This guide covers local setup, the
conventions actually used in this codebase, and how to extend it without
breaking existing patterns. For the big picture read
[ARCHITECTURE.md](ARCHITECTURE.md); for data shapes read
[docs/DATA-MODEL.md](docs/DATA-MODEL.md).

## Prerequisites

- **Node.js** — Vite 5 requires **Node 18+** (Node 20+ recommended). No version
  is pinned in the repo, so install a current LTS.
- **npm** — ships with Node.

## Local setup

### Using an editor (GUI-friendly path)

If you prefer not to use a terminal, VS Code can run everything:

1. Open the project folder in **VS Code**.
2. Open the **npm Scripts** view in the Explorer sidebar (enable it via
   _Settings → "npm: Enable Script Explorer"_ if it isn't visible).
3. The `package.json` scripts (`dev`, `build`, `preview`) appear as clickable
   ▶ entries — run them with a click; no commands to type.
4. Run **install** first (click `package.json` in the Scripts panel, or use an
   npm extension's _"npm install"_), then **dev**.
5. Click the `http://localhost:5173` link Vite prints to open the app.

### Using a terminal

```bash
npm install      # one-time: install dependencies (also activates git hooks)
npm run dev      # dev server with hot reload
npm run build    # production build into dist/
npm run preview  # serve the built app on port 8080

npm run test         # run the Vitest suite once
npm run test:watch   # tests in watch mode
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run check        # full quality gate: lint + format check + tests + build
```

## Code style and conventions

Match the patterns the existing code follows.

- **Language:** plain JavaScript + JSX (`.jsx`). No TypeScript.
- **Formatting and linting:** Prettier (default settings) and ESLint are
  enforced by `npm run check` and the pre-push hook. Run `npm run format`
  before committing; fix lint findings rather than disabling rules (targeted
  `eslint-disable-next-line` with a comment is acceptable for intentional
  patterns).
- **Components:** function components with hooks only. Default-export the main
  component of a file; named-export shared primitives (`Button`, `Input`, …).
- **Styling:** Tailwind utility classes inline in `className`. No per-component
  CSS files. Reuse the `ui/` primitives (`Button`, `Input`, `Card`, `Badge`,
  `ComboInput`) and the shared `WeightRepInputs` / `NumberInputAutoClear` inputs
  instead of re-styling raw elements. Common rounding is `rounded-xl` /
  `rounded-2xl`.
- **Shared state lives in Context.** `src/context/AppContext.jsx` owns `tab`,
  `unit`, `exercises`, and `workouts`. New components that need this state should
  call `useApp()` rather than taking it as props:

  ```jsx
  import { useApp } from "../context/AppContext";
  const { exercises, setExercises, workouts, setWorkouts, unit } = useApp();
  ```

  All views follow this pattern; `AppContent` passes no data props.

- **Persistence:** never call `localStorage` directly for the core data; use
  `loadLS` / `saveLS` from `src/lib/storage.js` and keep key constants there.
  Self-contained features that own their own slice (notes, weight logs, summary
  collapse state) still go through `loadLS`/`saveLS` — see `Notepad`,
  `WeightTracker`, `WeeklyNotes`, `PeriodCard` for the pattern.
- **Workout weights are stored in kilograms.** Convert at the input/display
  boundary with `toDisplayWeight` / `fromDisplayWeight` from `src/lib/units.js`.
  Never persist a pounds value into a set. (Note: bodyweight logs in
  `WeightTracker` are intentionally stored as raw, unconverted numbers.)
- **Destructive actions:** use the `useConfirm()` hook (from `ConfirmDialog`) for
  delete/remove confirmations rather than `window.confirm`.
- **Adding an exercise from a workout:** reuse `createExerciseEntry()` from
  `src/lib/exerciseUtils.js` — it handles the "create if missing + prefill from
  last set" logic used by the planner, history, and calendar.
- **Comments:** components carry a top-of-file block (purpose, props, owned
  state); exported helpers in `src/lib` carry JSDoc. Keep these accurate and
  comment only non-obvious logic.

## How to add a new seed exercise

First-run defaults live in `src/data/exercises_seed.json` — a JSON array of
exercise objects. Append one with the same fields as the existing entries:

```json
{
  "name": "Pull-up",
  "recommendRep": "3x6-10",
  "mainMuscle": "Lats",
  "secondaryMuscles": "Biceps, Forearms",
  "type": "Compound",
  "equipment": "Bodyweight",
  "force": "Pull",
  "lastWorkout": null
}
```

- `name` must be unique (case-insensitive) and is the key used everywhere.
- Always set `"lastWorkout": null` — it is derived at runtime from workouts.
- Reuse existing values for `type`/`equipment`/etc. so the suggestion dropdowns
  stay tidy.
- The seed only applies on a fresh browser (when `mgym.exercises.v1` is absent);
  existing users won't get new seed exercises automatically.

See [docs/DATA-MODEL.md → Exercise](docs/DATA-MODEL.md#exercise) for the full
field reference.

## How to add a new component

Follow the shape of the existing components:

1. Create the file under `src/components/` (or `src/components/ui/` for a
   reusable presentational primitive).
2. Start with a top-of-file comment block: purpose, props it receives, and the
   key state it owns.
3. Build the UI from the `ui/` primitives and Tailwind classes; don't add a CSS
   file.
4. For shared app data, call `useApp()` instead of reading `localStorage` or
   threading props from far away. If the feature owns a private slice, persist it
   with `loadLS`/`saveLS` under a clearly-named key.
5. For any confirm/delete flow, use `useConfirm()`.
6. Default-export the component and render it where needed.

To add a whole new tab: add a tab `Button` in `AppContent` (`src/App.jsx`),
extend the `tab === "..."` render branches, and — if the tab should be the
remembered default — note that `tab` is already persisted to `mgym.tab` via
`AppContext`.

## Testing

The repo has an automated suite — **Vitest** unit tests for `src/lib/` and
**React Testing Library** tests for key components. See
[docs/TESTING.md](docs/TESTING.md) for how to run and write tests, conventions,
and what needs coverage.

```bash
npm run test     # run the suite once
npm run check    # the full pre-push quality gate
```

**Quality gate:** a husky **pre-push hook** runs `npm run check`
(lint + format check + tests + build) and blocks the push if anything fails.
Hooks are activated automatically by `npm install`. New `src/lib` helpers
require a co-located `*.test.js`; components with logic require an RTL test.

### Manual smoke test

Automated tests don't cover visual layout or mobile behavior. After UI changes,
also verify manually in the browser via `npm run dev`:

- Create, edit, reorder, and delete workouts; confirm they persist across a
  reload.
- Toggle kg/lb and confirm stored set weights are unchanged (display only).
- Log a few bodyweights on the Weight tab and check the weekly average / trend.
- Open the Summary tab and confirm weekly/monthly metrics and PRs look right.
- Export a backup, then Import it in both **merge** and **replace** modes.
