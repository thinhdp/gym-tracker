# Data Model

The exact shape of everything Gym Tracker stores. Read this before building a
feature that touches saved data. For how the data flows through the UI, see
[../ARCHITECTURE.md](../ARCHITECTURE.md).

There is no database and no server — all state is JSON in the browser's
`localStorage`. There is no migration system; keys carry a `.v1` suffix where
versioned, and that is the only versioning.

## localStorage keys

| Key                        | Written by                 | Holds                                                                                    | Default when absent                              |
| -------------------------- | -------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `mgym.exercises.v1`        | `AppContext` (`K_EX`)      | `Exercise[]`                                                                             | the 76-entry seed `src/data/exercises_seed.json` |
| `mgym.workouts.v1`         | `AppContext` (`K_WO`)      | `Workout[]`                                                                              | `[]`                                             |
| `mgym.unit`                | `AppContext` (`K_UNIT`)    | `"kg"` \| `"lb"` (toggle UI hidden; effectively `"kg"`)                                  | `"kg"`                                           |
| `mgym.tab`                 | `AppContext` (`K_TAB`)     | active tab: `home`/`workouts`/`progress`/`exercises`/`more` (legacy values remapped)     | `"workouts"`                                     |
| `mgym.theme`               | `AppContext` (`K_THEME`)   | `"system"` \| `"light"` \| `"dark"`                                                      | `"system"`                                       |
| `mgym.session.v1`          | `AppContext` (`K_SESSION`) | live-logging session object, or `null`                                                   | `null`                                           |
| `mgym.note.v1`             | `Notepad` (`K_NOTE`)       | `string` — global note                                                                   | `""`                                             |
| `weightLogs`               | `WeightTracker`            | `{ [YYYY-MM-DD]: number }` — bodyweight                                                  | `{}`                                             |
| `mgym.profile.v1`          | `MoreMenu`                 | `{ sex?: "male"\|"female", birthYear?: number }` — lifter profile for strength standards | `{}`                                             |
| `mgym.fvCache.v1`          | `fvApi`                    | cache of FitnessVolt percentile + standards responses (see below)                        | `{}`                                             |
| `weekly-note:<weekKey>`    | _legacy_ (no longer used)  | `string` — one note per ISO week (written by the removed `WeeklyNotes`)                  | `""`                                             |
| `summary-open:<periodKey>` | _legacy_ (no longer used)  | `boolean` — card collapse state (written by the removed `PeriodCard`)                    | card default                                     |

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

A workout may have an empty `exercises` array — the Calendar view can create an
empty workout for a day, and "Start empty workout" creates one to log into. An
empty workout left after a live session is finished is discarded (see
[Live session](#live-session-mgymsessionv1)).

### WorkoutExercise

An exercise **inside** a workout — a name reference plus the logged sets. Distinct
from `Exercise`.

| Field          | Type             | Purpose                                                 | Default                         |
| -------------- | ---------------- | ------------------------------------------------------- | ------------------------------- |
| `exerciseName` | `string`         | Reference to an `Exercise` by its `name` (not an id).   | required                        |
| `sets`         | `Set[]`          | Sets performed; 1–`MAX_SETS` (10) entries.              | `[{ set:1, weight:0, reps:0 }]` |
| `rpe`          | `number \| null` | Optional rate of perceived exertion, 6–10 in 0.5 steps. | `null`                          |
| `feedback`     | `string`         | Optional free-text note reviewing the exercise.         | `""`                            |

Because the link is by name, renaming or deleting an exercise does **not** rewrite
historical `exerciseName` values; past workouts keep the original name.

`rpe` and `feedback` are both **optional** and authored by the user after a set.
On import they pass through `normalizeRpe` / `normalizeFeedback` (`src/lib/rpe.js`):
`rpe` is coerced to a number snapped to the nearest 0.5 within `[6, 10]` (anything
else becomes `null`); `feedback` is coerced to a string capped at 2000 chars. Free
text is safe because all storage and export round-trips through
`JSON.stringify`/`JSON.parse` — no manual escaping is involved.

### Set

One set within a `WorkoutExercise`.

| Field    | Type     | Purpose                                                     | Default    |
| -------- | -------- | ----------------------------------------------------------- | ---------- |
| `set`    | `number` | 1-based index; renumbered on add/delete to stay contiguous. | sequential |
| `weight` | `number` | **Always kilograms**, regardless of the kg/lb toggle.       | `0`        |
| `reps`   | `number` | Repetitions.                                                | `0`        |

Constraints enforced in code:

- **Max `MAX_SETS` (10) sets per exercise** — add-set disables at the limit;
  import truncates with `slice(0, MAX_SETS)`. The cap is defined in
  `src/lib/constants.js` and gates new sets only; stored workouts with more
  sets (e.g. from older data) are never mutated except on re-import.
- **At least 1 set** — delete-set disabled at one remaining; import guarantees a
  default set.
- **Weight stored in kg** — converted at the input boundary via
  `toDisplayWeight`/`fromDisplayWeight` (`src/lib/units.js`). See
  [ARCHITECTURE.md → Unit handling](../ARCHITECTURE.md#unit-handling-kg--lb).

### Live session (`mgym.session.v1`)

The in-progress live-logging session, or `null` when not logging. It points at a
workout (which lives in `workouts`) and tracks transient logging UI state.

```json
{
  "workoutId": "…",
  "startedAt": 1718275200000,
  "currentIdx": 0
}
```

| Field        | Type     | Purpose                                                     |
| ------------ | -------- | ----------------------------------------------------------- |
| `workoutId`  | `string` | `Workout.id` being logged; live edits write through to it.  |
| `startedAt`  | `number` | Epoch ms when the session began (drives the elapsed clock). |
| `currentIdx` | `number` | Index of the exercise currently on screen.                  |

There is **no done-flag map**: a set is treated as logged once it has `reps > 0`,
so completion lives on the `Set` itself (and follows it when exercises are
reordered). The session only tracks which workout, when it started, and which
exercise is on screen. Helpers in `src/lib/liveSession.js`. Not included in
backups.

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
> user typed; the kg/lb toggle only relabels them. Because that mislabels
> bodyweight in lb, the **toggle UI is currently hidden** and the app shows kg
> only. Weekly averages and the Progress "Avg Weight" KPI are computed directly
> from these numbers.

### Lifter profile (`mgym.profile.v1`)

Optional self-reported data the **Progress → Symmetry** view needs to score
lifts against the FitnessVolt Strength Standards API. Authored in **More →
Profile**, self-persisted (not part of the backup payload, not in `AppContext`).

| Field        | Type                   | Purpose                                          |
| ------------ | ---------------------- | ------------------------------------------------ |
| `sex`        | `"male"` \| `"female"` | Required by the standards API; absent until set. |
| `birthYear`  | `number` (optional)    | Sharpens the gym age cohort; omitted when blank. |
| `liftConfig` | `LiftConfig` (opt.)    | Per-lift source mapping + bar-weight adjustment. |

#### LiftConfig

Optional overrides authored in **More → Profile → Lift sources**, keyed by
standard-lift key (`squat`, `bench`, `deadlift`, `ohp`, `pull`, `row` — the
`RADAR_AXES` keys). Each value tunes how that lift's data is pulled for the
Symmetry view; absent keys fall back to automatic detection from the exercise
name.

| Field      | Type      | Purpose                                                               |
| ---------- | --------- | --------------------------------------------------------------------- |
| `exercise` | `string`  | Pins which logged exercise feeds the lift (overrides the alias map).  |
| `addBar`   | `boolean` | When true, adds `barKg` to every set's weight **before** the 1RM est. |
| `barKg`    | `number`  | Bar weight to add when `addBar`; defaults to 20 kg.                   |

The offset is applied per set inside `bestE1RMBySlug` (so it flows into both the
radar and the Lift Balance panel). See `src/lib/strengthStandards.js`
(`buildLiftConfigIndex`).

### Strength-standards cache (`mgym.fvCache.v1`)

A response cache for the only external API the app calls (FitnessVolt). It holds
two kinds of entry, both rounded to 0.5 kg:

- **Percentile lookups** — key `lift|sex|age|unit|weight|bodyweight`, value
  `{ verified, gym }` percentile objects (the radar + per-axis breakdown).
- **Standards lookups** — key `std|lift|sex|source|age|unit|bodyweight`, value
  `{ percentiles, p50, bwMultiple }`. The `p50` (median lift) feeds the Lift
  Balance panel's empirical ratio benchmarks.

Purely a network cache — safe to clear, rebuilt on demand. Not in the backup
payload. See `src/lib/fvApi.js`.

### Notes

- **Global notepad** (`mgym.note.v1`) — a single free-form `string`.
- **Weekly notes** (`weekly-note:<weekKey>`) — legacy; one `string` per ISO
  week, written by the removed `WeeklyNotes`. No longer surfaced in the UI but
  still round-tripped through backup/export (see below).

## Derived / computed (not stored)

The Strength tab (`StrengthAnalysis`) computes these on the fly from `workouts`;
they are **not** persisted. See `src/lib/strength.js`, `src/lib/metrics.js`, and
`src/lib/dateUtils.js`.

- **Period buckets** — `buildWeeks` / `buildMonths` group workouts into
  `{ key, label, from, to, items[] }`, sorted most-recent first.
- **Estimated 1RM** (`estimate1RM`) — Epley `weight × (1 + reps / 30)`; one rep
  or fewer is the weight itself.
- **Per-exercise series** (`exerciseSeries`) — one ascending point per workout
  date with that day's top-set weight, best e1RM, and volume.
- **Personal records** (`exercisePRs`, `recentPRs`) — all-time best e1RM /
  heaviest weight / best set volume per exercise, and a chronological feed of
  new all-time bests across all exercises.
- **Volume by muscle** (`volumeByMuscleSeries`) — Σ weight×reps per `mainMuscle`
  bucketed by week or month, for the top muscles by total volume.
- **Range windows** (`rangeWindows` / `filterByRange`) — current vs previous
  equal-length window for `3M` / `6M` / `1Y` / `all`.

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

The `mgym.theme` preference and the `mgym.session.v1` live session are **not**
part of the backup payload — they are device-local UI state.

## Worth knowing before building on this

Documented behaviors (see ARCHITECTURE.md → OPEN QUESTIONS for items that may
change):

- `lastWorkout` is **derived and persisted** — the stored copy can lag `workouts`
  until the recompute effect runs. Prefer deriving from `workouts`.
- Exercise identity is its **name** (case-insensitive), not an id.
- `weightLogs` values are **not** unit-converted.
- Imported `note`/`weightLogs`/`weeklyNotes`/`unit`/`tab` are **not** validated.
