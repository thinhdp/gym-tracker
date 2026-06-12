# Data Model

The exact shape of everything Gym Tracker stores. Read this before building a
feature that touches saved data. For how the data flows through the UI, see
[../ARCHITECTURE.md](../ARCHITECTURE.md).

There is no database and no server — all state is JSON in the browser's
`localStorage`. There is no migration system; keys carry a `.v1` suffix where
versioned, and that is the only versioning.

## localStorage keys

| Key                        | Written by              | Holds                                   | Default when absent                              |
| -------------------------- | ----------------------- | --------------------------------------- | ------------------------------------------------ |
| `mgym.exercises.v1`        | `AppContext` (`K_EX`)   | `Exercise[]`                            | the 76-entry seed `src/data/exercises_seed.json` |
| `mgym.workouts.v1`         | `AppContext` (`K_WO`)   | `Workout[]`                             | `[]`                                             |
| `mgym.unit`                | `AppContext` (`K_UNIT`) | `"kg"` \| `"lb"`                        | `"kg"`                                           |
| `mgym.tab`                 | `AppContext` (`K_TAB`)  | active tab string                       | `"workouts"`                                     |
| `mgym.note.v1`             | `Notepad` (`K_NOTE`)    | `string` — global note                  | `""`                                             |
| `weightLogs`               | `WeightTracker`         | `{ [YYYY-MM-DD]: number }` — bodyweight | `{}`                                             |
| `weekly-note:<weekKey>`    | `WeeklyNotes`           | `string` — one note per ISO week        | `""`                                             |
| `summary-open:<periodKey>` | `PeriodCard`            | `boolean` — card collapse state         | card default                                     |

All values are stored with `JSON.stringify`. String values (the notes) are
stored as JSON strings (e.g. the literal `""`).

`<weekKey>` is a `YYYY-WW` ISO-ish week key (see `weekKey()` in
`src/lib/dateUtils.js`); `<periodKey>` is a week or month key from the same file.

## Object shapes

### Exercise

A row in the exercise database. `name` is the primary key — exercises are
referenced from workouts **by name**, and names are case-insensitive for
uniqueness/dedupe.

| Field              | Type                  | Purpose                                        | Default              |
| ------------------ | --------------------- | ---------------------------------------------- | -------------------- |
| `name`             | `string`              | Unique display name; the key used everywhere.  | required (non-empty) |
| `recommendRep`     | `string`              | Free-text rep recommendation, e.g. `"3x8-12"`. | `""`                 |
| `mainMuscle`       | `string`              | Primary muscle; used to group Summary metrics. | `""`                 |
| `secondaryMuscles` | `string`              | Secondary muscles; may be comma-separated.     | `""`                 |
| `type`             | `string`              | e.g. `"Compound"` / `"Isolation"`. Free text.  | `""`                 |
| `equipment`        | `string`              | e.g. `"Barbell"`, `"Machine"`. Free text.      | `""`                 |
| `force`            | `string`              | e.g. `"Push"` / `"Pull"`. Free text.           | `""`                 |
| `lastWorkout`      | `LastWorkout \| null` | **Derived** summary of most recent use.        | `null`               |

All metadata fields are free-form strings — no enums. The suggestion dropdowns
are built dynamically from values already present in the database.

#### LastWorkout

| Field  | Type                    | Purpose                                             |
| ------ | ----------------------- | --------------------------------------------------- |
| `date` | `string` (`YYYY-MM-DD`) | Date of the most recent workout with this exercise. |
| `sets` | `Set[]`                 | The sets logged for it in that workout.             |

`lastWorkout` is **not authored by the user**. `AppContext` recomputes it from
`workouts` whenever workouts change, then writes it back into the exercises
store. Treat it as a cache of `workouts`: don't write it directly, and don't
assume it's authoritative immediately after mutating workouts.

### Workout

One training session on a given date.

| Field       | Type                    | Purpose                                                                                                                 | Default    |
| ----------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------- |
| `id`        | `string`                | Unique id from `uuid()` (`crypto.randomUUID()` when available, else a random+timestamp fallback). The merge-import key. | generated  |
| `date`      | `string` (`YYYY-MM-DD`) | Day of the workout. Lists sort newest-first by this string.                                                             | required   |
| `name`      | `string`                | Display name; falls back to the date when left blank.                                                                   | the `date` |
| `exercises` | `WorkoutExercise[]`     | Exercises performed (user-controlled order).                                                                            | `[]`       |

A workout may have an empty `exercises` array — the Calendar tab can create an
empty workout for a day before exercises are added.

### WorkoutExercise

An exercise **inside** a workout — a name reference plus the logged sets. Distinct
from `Exercise`.

| Field          | Type     | Purpose                                               | Default                         |
| -------------- | -------- | ----------------------------------------------------- | ------------------------------- |
| `exerciseName` | `string` | Reference to an `Exercise` by its `name` (not an id). | required                        |
| `sets`         | `Set[]`  | Sets performed; 1–5 entries.                          | `[{ set:1, weight:0, reps:0 }]` |

Because the link is by name, renaming or deleting an exercise does **not** rewrite
historical `exerciseName` values; past workouts keep the original name.

### Set

One set within a `WorkoutExercise`.

| Field    | Type     | Purpose                                                     | Default    |
| -------- | -------- | ----------------------------------------------------------- | ---------- |
| `set`    | `number` | 1-based index; renumbered on add/delete to stay contiguous. | sequential |
| `weight` | `number` | **Always kilograms**, regardless of the kg/lb toggle.       | `0`        |
| `reps`   | `number` | Repetitions.                                                | `0`        |

Constraints enforced in code:

- **Max 5 sets per exercise** — add-set disables at 5; import truncates with
  `slice(0, 5)`.
- **At least 1 set** — delete-set disabled at one remaining; import guarantees a
  default set.
- **Weight stored in kg** — converted at the input boundary via
  `toDisplayWeight`/`fromDisplayWeight` (`src/lib/units.js`). See
  [ARCHITECTURE.md → Unit handling](../ARCHITECTURE.md#unit-handling-kg--lb).

### Bodyweight log (`weightLogs`)

A flat map used by the Weight tab:

```json
{ "2026-06-01": 70.2, "2026-06-02": 70.0 }
```

| Part  | Type                    | Purpose                |
| ----- | ----------------------- | ---------------------- |
| key   | `string` (`YYYY-MM-DD`) | The day.               |
| value | `number`                | Bodyweight as entered. |

> **Not unit-converted.** Unlike workout `weight`, these are the raw numbers the
> user typed; the kg/lb toggle only relabels them. Weekly averages and the
> Summary "Avg Weight" KPI are computed directly from these numbers.

### Notes

- **Global notepad** (`mgym.note.v1`) — a single free-form `string`.
- **Weekly notes** (`weekly-note:<weekKey>`) — one `string` per ISO week, shown
  inside each weekly `PeriodCard` on the Summary tab.

## Derived / computed (not stored)

The Summary tab computes these on the fly from `workouts` (+ `weightLogs`); they
are **not** persisted. See `src/lib/metrics.js` and `src/lib/dateUtils.js`.

- **Period buckets** — `buildWeeks` / `buildMonths` group workouts into
  `{ key, label, from, to, items[] }`, sorted most-recent first.
- **Period metrics** (`computePeriodMetrics`) — `frequency` (workout count),
  `totalReps`, `totalSets`, `repsByMuscle`, `setsByMuscle` (keyed by the
  exercise's `mainMuscle`, defaulting to `"Unknown"`), and `prs` (a new PR is a
  max-weight beating the best from _before_ the period, only when a prior best
  `> 0` existed).

## Backup / export payload

`DataManagementMenu` exports this envelope (see `src/components/DataManagementMenu.jsx`):

```json
{
  "schema": "mgym.v1",
  "exportedAt": "2026-06-12T10:00:00.000Z",
  "exercises": [
    /* Exercise[] */
  ],
  "workouts": [
    /* Workout[] */
  ],
  "unit": "kg",
  "tab": "workouts",
  "note": "…",
  "weightLogs": { "2026-06-01": 70.2 },
  "weeklyNotes": { "weekly-note:2026-24": "…" }
}
```

| Field                                                  | Type                | Purpose                                                                  |
| ------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------ |
| `schema`                                               | `string`            | Format tag `"mgym.v1"`. Not validated on import.                         |
| `exportedAt`                                           | `string` (ISO 8601) | When generated.                                                          |
| `exercises` / `workouts`                               | arrays              | Validated via `normalizeData()` on import.                               |
| `unit` / `tab` / `note` / `weightLogs` / `weeklyNotes` | misc                | Restored **directly** to localStorage on import, **without** validation. |

On import, exercises/workouts go through `normalizeData()` then **merge** or
**replace** (rules in
[ARCHITECTURE.md → Export / import](../ARCHITECTURE.md#export--import-backup));
the remaining fields are written straight back to their keys.

## Worth knowing before building on this

Documented behaviors (see ARCHITECTURE.md → OPEN QUESTIONS for items that may
change):

- `lastWorkout` is **derived and persisted** — the stored copy can lag `workouts`
  until the recompute effect runs. Prefer deriving from `workouts`.
- Exercise identity is its **name** (case-insensitive), not an id.
- `weightLogs` values are **not** unit-converted.
- Imported `note`/`weightLogs`/`weeklyNotes`/`unit`/`tab` are **not** validated.
