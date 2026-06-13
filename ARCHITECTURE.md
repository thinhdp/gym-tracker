# Architecture

Technical reference for **Gym Tracker** — a client-only workout logger. This
document explains how the app is put together: the stack, the file layout, where
state lives, how data flows, and how it is persisted. For the exact on-disk
shapes see [docs/DATA-MODEL.md](docs/DATA-MODEL.md); for setup and contribution
workflow see [CONTRIBUTING.md](CONTRIBUTING.md).

## System overview

Gym Tracker is a **single-page application that runs entirely in the browser**.
There is no server, no API, and no account system. Everything is kept in the
browser's `localStorage`, so the app is local-first and works offline after the
initial load. Data never leaves the device unless you explicitly use the Data
menu to export a JSON backup.

The UI is a single column with six tabs — **Workouts**, **Calendar**,
**Exercises**, **Weight**, **Notepad**, and **Summary** — switched by buttons in
the header. There is no client-side router; the active tab is a piece of shared
state (and is itself persisted).

## Tech stack and the role of each tool

| Tool                     | Version (`package.json`) | Role                                                                                                                        |
| ------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **React**                | 18.2                     | UI library. Function components + hooks only; state shared via Context.                                                     |
| **react-dom**            | 18.2                     | Mounts the React tree into `#root` via `createRoot` (`src/main.jsx`).                                                       |
| **Vite**                 | 5.4                      | Dev server (HMR) and production bundler. Config in `vite.config.js`.                                                        |
| **@vitejs/plugin-react** | 4.3                      | JSX transform + Fast Refresh for Vite.                                                                                      |
| **Tailwind CSS**         | 3.4                      | Utility-first styling. All styling is inline `className` utilities; no component CSS files. Config in `tailwind.config.js`. |
| **PostCSS**              | 8.4                      | CSS pipeline Tailwind plugs into. Config in `postcss.config.js`.                                                            |
| **autoprefixer**         | 10.4                     | PostCSS plugin adding vendor prefixes at build time.                                                                        |

There is **no TypeScript, router, or data-fetching library**. Charts (weight
trend, muscle bars) are hand-rolled SVG — no charting dependency. Tests use
**Vitest + React Testing Library** (see [docs/TESTING.md](docs/TESTING.md));
ESLint + Prettier enforce style.

## Directory structure

```
gym-tracker/
├── index.html                 # HTML shell; loads /src/main.jsx
├── package.json               # Scripts + dependencies
├── vite.config.js             # Vite + React plugin
├── tailwind.config.js         # Tailwind content globs + theme tweaks
├── postcss.config.js          # Tailwind + autoprefixer
└── src/
    ├── main.jsx               # Entry: mounts <App/>
    ├── App.jsx                # Wraps AppProvider; renders header, tabs, active view
    ├── index.css              # Tailwind directives + a few base styles
    ├── context/
    │   └── AppContext.jsx     # Shared state (tab, unit, exercises, workouts) + persistence
    ├── data/
    │   └── exercises_seed.json   # 76 default exercises (first-run seed)
    ├── lib/                   # Framework-free helpers
    │   ├── storage.js            # localStorage keys + load/save + id/date helpers
    │   ├── backup.js             # Export/import normalize + merge logic
    │   ├── units.js              # kg <-> display-unit conversion
    │   ├── date.js               # ymd() / ymdFromDate() YYYY-MM-DD formatters
    │   ├── dateUtils.js          # Week/month boundary + key/label helpers
    │   ├── exerciseUtils.js      # createExerciseEntry, workoutsWithExercise, extractExerciseOptions
    │   ├── weightUtils.js        # averageWeightInRange for bodyweight logs
    │   ├── arrayUtils.js         # moveItem() reorder helper
    │   ├── constants.js          # MAX_SETS
    │   └── metrics.js            # Period bucketing + per-period metrics (reps/sets/PRs)
    └── components/
        ├── WorkoutPlanner.jsx       # "Plan / Log Workout" form (Workouts tab)
        ├── WorkoutHistory.jsx       # List of past workouts (Workouts tab)
        ├── WorkoutHistoryItem.jsx   # One history card: header + expanded editor
        ├── WorkoutExerciseEditor.jsx# Per-exercise set editor (planner)
        ├── WeightRepInputs.jsx      # Shared weight+reps input pair
        ├── CalendarView.jsx         # Month grid + per-day workouts (Calendar tab)
        ├── ExerciseManager.jsx      # Exercise database CRUD (Exercises tab)
        ├── NewExerciseInline.jsx    # Inline create-exercise form
        ├── ExerciseRow.jsx          # One exercise row: info + edit/delete/history
        ├── ExerciseHistoryModal.jsx # Modal: all past workouts for one exercise
        ├── WeightTracker.jsx        # Bodyweight calendar + trend (Weight tab)
        ├── WeightChart.jsx          # Scrollable SVG line chart of bodyweight
        ├── DashboardSummary.jsx     # Weekly/monthly analytics (Summary tab)
        ├── PeriodCard.jsx           # One week/month summary card
        ├── GroupedMuscleBar.jsx     # Now-vs-last reps/sets bars per muscle
        ├── Delta.jsx                # Signed, colored numeric delta
        ├── WeeklyNotes.jsx          # Per-week notes + per-week log export
        ├── Notepad.jsx              # Free-form global note (Notepad tab)
        ├── DataManagementMenu.jsx   # Export / Import (merge|replace) dropdown
        ├── AddExerciseInput.jsx     # Autocomplete "add exercise" combobox
        ├── NumberInputAutoClear.jsx # Numeric input that clears a leading 0
        ├── ConfirmDialog.jsx        # Promise-based confirm modal + context
        └── ui/                      # Presentational primitives
            ├── Button.jsx           # Variant/size button
            ├── Input.jsx            # Input + Textarea
            ├── Card.jsx             # Card + CardContent
            ├── Badge.jsx            # Pill label
            ├── ComboInput.jsx       # <datalist>-backed free-text + suggestions
            └── Icons.jsx            # Emoji icon components
```

## Component hierarchy

```
main.jsx
└── ConfirmProvider                 (single provider for all useConfirm() consumers)
    └── App
        └── AppProvider             (Context: tab, unit, exercises, workouts)
            └── AppContent          (consumes useApp())
                ├── DataManagementMenu        (header)
                ├── Button (unit toggle, tab buttons)
                │
                ├── [tab="workouts"]
                │   ├── WorkoutPlanner
                │   │   ├── AddExerciseInput
                │   │   ├── WorkoutExerciseEditor → WeightRepInputs / NumberInputAutoClear
                │   │   └── ExerciseHistoryModal
                │   └── WorkoutHistory
                │       ├── WorkoutHistoryItem
                │       │   ├── AddExerciseInput
                │       │   └── WeightRepInputs / NumberInputAutoClear
                │       └── ExerciseHistoryModal
                │
                ├── [tab="calendar"]  CalendarView → AddExerciseInput
                │
                ├── [tab="exercises"] ExerciseManager
                │   ├── NewExerciseInline → ComboInput
                │   ├── ExerciseRow → ComboInput
                │   └── ExerciseHistoryModal
                │
                ├── [tab="weight"]    WeightTracker → WeightChart
                │
                ├── [tab="notepad"]   Notepad
                │
                └── [tab="summary"]   DashboardSummary
                    └── PeriodCard
                        ├── GroupedMuscleBar
                        ├── Delta
                        └── WeeklyNotes   (weekly periods only)
```

## State-management model

Shared application state lives in **`src/context/AppContext.jsx`** and is exposed
through the `useApp()` hook. `App` wraps everything in `<AppProvider>`; any
component can read or update state by calling `useApp()` instead of receiving
props.

### State owned by `AppProvider`

| State       | Initial value                 | Purpose                         | Persisted to        |
| ----------- | ----------------------------- | ------------------------------- | ------------------- |
| `tab`       | `loadLS(K_TAB, "workouts")`   | Active tab                      | `mgym.tab`          |
| `unit`      | `loadLS(K_UNIT, "kg")`        | Display unit (`"kg"` \| `"lb"`) | `mgym.unit`         |
| `exercises` | `loadLS(K_EX, seedExercises)` | Exercise database               | `mgym.exercises.v1` |
| `workouts`  | `loadLS(K_WO, [])`            | All logged/planned workouts     | `mgym.workouts.v1`  |

All four are persisted by `useEffect`s in `AppProvider` that run whenever the
value changes. (Unlike the earlier version of the app, **`unit` and `tab` are now
persisted** too.)

### How components get state

Every view that needs shared state reads it from `useApp()` directly:
`WorkoutPlanner`, `WorkoutHistory`, `ExerciseManager`, `CalendarView`,
`DataManagementMenu`, `WeightTracker`, `DashboardSummary`, `WeeklyNotes`.
`AppContent` passes no data props. Presentational children (e.g.
`WorkoutHistoryItem`, `ExerciseRow`, `WorkoutExerciseEditor`) receive what they
render as props from their view.

### Locally-owned / self-persisting state

Several components persist their own slice directly via `loadLS`/`saveLS`,
independent of `AppContext`:

- **`Notepad`** → `mgym.note.v1` (a single string).
- **`WeightTracker`** → `weightLogs` (a `{ "YYYY-MM-DD": number }` map).
- **`WeeklyNotes`** → `weekly-note:<weekKey>` (one string per ISO week).
- **`PeriodCard`** → `summary-open:<periodKey>` (collapse state per card).
- **`ConfirmProvider`** holds modal state and exposes `confirm()`; UI-only.

### Derived state: `lastWorkout`

Each exercise carries a `lastWorkout` summary (date + sets of its most recent
use). It is **derived from `workouts`**, not authored. An effect in
`AppProvider` recomputes it whenever `workouts` changes and writes it back onto
`exercises` — so the derived value is also persisted into `mgym.exercises.v1`.
Treat it as a cache of `workouts`; it can briefly lag until the effect runs.

## Data model

The app works with these shapes (full field tables in
**[docs/DATA-MODEL.md](docs/DATA-MODEL.md)**):

- **Exercise** — exercise-database row keyed by `name`; metadata + derived
  `lastWorkout`.
- **Workout** — a session: `id`, `date` (`YYYY-MM-DD`), `name`, `exercises[]`.
- **WorkoutExercise** — `exerciseName` (a by-name reference) + `sets[]`.
- **Set** — `set`, `weight` (**always kg**), `reps`; capped at **10 sets/exercise** (`MAX_SETS`).
- **Bodyweight log** — `weightLogs` map of date → number.
- **Notes** — global notepad string + per-week note strings.

Exercises link to workout-exercises **by name**, not id; renaming/deleting an
exercise does not rewrite historical `exerciseName` values.

## Persistence layer

Reads/writes go through `loadLS`/`saveLS` in `src/lib/storage.js`
(`JSON.parse`/`stringify` with a try/catch fallback). The full localStorage key
inventory is documented in
[docs/DATA-MODEL.md → localStorage keys](docs/DATA-MODEL.md#localstorage-keys).

### Read/write flow

- **Read** is lazy, in each owner's `useState` initializer
  (`useState(() => loadLS(key, fallback))`). On first run nothing exists, so the
  fallback is used (the 76-exercise seed, `[]`, `""`, `{}`, etc.).
- **Write** is reactive via `useEffect`s keyed on the state, flushing each change
  to `localStorage` immediately.

### Export / import (backup)

`DataManagementMenu` + `src/lib/backup.js` move data in and out as JSON.

**Export** gathers _everything_ — not just exercises/workouts — into one payload:

```json
{
  "schema": "mgym.v1",
  "exportedAt": "<ISO>",
  "exercises": [...], "workouts": [...],
  "unit": "kg", "tab": "workouts",
  "note": "...",
  "weightLogs": { "2026-06-01": 70.2, ... },
  "weeklyNotes": { "weekly-note:2026-24": "..." }
}
```

Downloaded as `gym-tracker-backup-<YYYY-MM-DD>.json`.

**Import** parses the file, runs exercises/workouts through `normalizeData()`
(coerces/validates, drops invalid rows), then applies them in one of two modes:

| Mode        | Exercises                                                                                                                  | Workouts                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **merge**   | `mergeExercises`: key by lowercased name; new names added, existing rows only get blank fields filled (never overwritten). | `mergeWorkouts`: key by `id`; new ids appended; an incoming workout whose id already exists is kept but re-assigned a fresh `uuid()`. Re-sorted newest-first. |
| **replace** | Overwrites the whole exercises array.                                                                                      | Overwrites the whole workouts array.                                                                                                                          |

The extra fields (`unit`, `tab`, `note`, `weightLogs`, `weeklyNotes`) are
restored directly to their localStorage keys **without** going through
`normalizeData` (only exercises/workouts are validated).

## Data flow: one full lifecycle

Tracing a workout from the planner to History, Calendar, and Summary:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. CREATE (Workouts tab → WorkoutPlanner, reads useApp())             │
│    Pick date(s), optional name, add exercises (createExerciseEntry    │
│    auto-creates unknown ones + prefills last set), edit sets.         │
│    Local state: { dates, name, items[] }                             │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │ "Save Workouts"
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 2. SAVE (WorkoutPlanner.saveWorkout)                                 │
│    Build one workout per date {id, date, name, exercises[sets≤5]};    │
│    setWorkouts(prev => [...created, ...prev].sort(newest)).          │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │ workouts changes in AppProvider
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 3. PERSIST + DERIVE (AppContext effects)                             │
│    a) saveLS(K_WO, workouts) → mgym.workouts.v1                       │
│    b) recompute each exercise.lastWorkout → setExercises → saveLS(K_EX)│
└───────────────────────────────┬──────────────────────────────────────┘
                                 │ same workouts via useApp()
          ┌──────────────────────┼──────────────────────┬───────────────┐
          ▼                      ▼                      ▼               ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
│ HISTORY          │  │ CALENDAR         │  │ SUMMARY          │  │ EXERCISES    │
│ (WorkoutHistory) │  │ (CalendarView)   │  │ (DashboardSummary│  │ lastWorkout +│
│ edit/reorder/    │  │ buckets workouts │  │ → metrics.js     │  │ usage counts │
│ add via          │  │ by date, badges  │  │ buildWeeks/Months│  │ reflect the  │
│ setWorkouts      │  │ per day          │  │ + PR detection)  │  │ new workout  │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────┘
```

Every view reads the **same `workouts`** via Context, so a save in the planner
is reflected everywhere immediately. The
Summary tab additionally runs `workouts` through `src/lib/metrics.js` to bucket
by week/month and compute reps/sets-per-muscle, workout frequency, and PRs.

## Unit handling (kg / lb)

**Workout weights are always stored in kilograms.** The `unit` toggle only
affects display, converted in `src/lib/units.js`:

- **Display:** `toDisplayWeight(kg, unit)` → kg (2-dp) or lb (1-dp).
- **Input:** `fromDisplayWeight(value, unit)` → back to kg (2-dp) before storing.

So lb is purely presentational for workout sets, and `unit` is now persisted to
`mgym.unit`.

> **Caveat:** the **Weight tab's bodyweight logs are NOT converted.**
> `WeightTracker` stores the raw number you type into `weightLogs` and just
> relabels it with the current unit. Switching kg↔lb changes the label, not the
> stored values. See OPEN QUESTIONS.

## Build & dev pipeline

| Command           | What it does                              |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Vite dev server with hot-module reload.   |
| `npm run build`   | Optimized production build into `dist/`.  |
| `npm run preview` | Serve the built `dist/` on **port 8080**. |

```
index.html → src/main.jsx → src/App.jsx (+ context/components/lib)
        ├─ @vitejs/plugin-react: JSX + Fast Refresh
        └─ index.css → PostCSS → Tailwind (scans tailwind.config.js content
                                  globs) → autoprefixer → bundled CSS
```

Quality tooling: **ESLint** (flat config in `eslint.config.js`) + **Prettier**
for style, **Vitest + React Testing Library** for tests (config in the `test`
block of `vite.config.js`, setup in `src/test/setup.js`). A husky **pre-push
hook** runs `npm run check` (lint + format check + tests + build). See
[docs/TESTING.md](docs/TESTING.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## OPEN QUESTIONS / known cleanup candidates

These reflect the code as it stands; documented here for a future refactor, not
fixed by this documentation pass.

1. **Bodyweight logs aren't unit-converted** — `weightLogs` store raw numbers;
   the kg/lb toggle only relabels them.
2. **Import restores extra fields unvalidated** — `note`/`weightLogs`/
   `weeklyNotes`/`unit`/`tab` bypass `normalizeData`.
3. **`normalizeWorkout` dead guard** — `if (!date || !normExercises)`;
   `normExercises` is always an array (truthy), so that half never fires.
4. **`package.json` version is `1.1.0`** despite substantial feature growth.
5. **README claims an MIT `LICENSE` file** that does not exist in the repo.
6. **`window.prompt`/`window.alert` UX** — exercise rename in History uses
   `prompt()`; import/export and weekly-log export report via `alert()`.
   Candidates for in-app dialogs/toasts.
