# Data Model

The exact shape of everything Gym Tracker stores. Read this before building a
feature that touches saved data. For how the data flows through the UI, see
[../ARCHITECTURE.md](../ARCHITECTURE.md).

There is no database and no server — all state is JSON in the browser's
`localStorage`. There is no migration system; keys carry a `.v1` suffix where
versioned, and that is the only versioning.

## localStorage keys

| Key                        | Written by                        | Holds                                                                                    | Default when absent                              |
| -------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `mgym.exercises.v1`        | `AppContext` (`K_EX`)             | `Exercise[]`                                                                             | the 76-entry seed `src/data/exercises_seed.json` |
| `mgym.workouts.v1`         | `AppContext` (`K_WO`)             | `Workout[]`                                                                              | `[]`                                             |
| `mgym.routines.v1`         | `AppContext` (`K_ROUTINES`)       | `Routine[]` (built by `routineFromWorkout`, `src/lib/routines.js`)                       | `[]`                                             |
| `mgym.unit`                | `AppContext` (`K_UNIT`)           | `"kg"` \| `"lb"` (toggle UI hidden; effectively `"kg"`)                                  | `"kg"`                                           |
| `mgym.tab`                 | `AppContext` (`K_TAB`)            | active tab: `home`/`workouts`/`progress`/`exercises`/`more` (legacy values remapped)     | `"workouts"`                                     |
| `mgym.theme`               | `AppContext` (`K_THEME`)          | `"system"` \| `"light"` \| `"dark"`                                                      | `"system"`                                       |
| `mgym.session.v1`          | `AppContext` (`K_SESSION`)        | live-logging session object, or `null`                                                   | `null`                                           |
| `mgym.note.v1`             | `Notepad` (`K_NOTE`)              | `string` — global note                                                                   | `""`                                             |
| `weightLogs`               | `WeightTracker`                   | `{ [YYYY-MM-DD]: number }` — bodyweight                                                  | `{}`                                             |
| `mgym.profile.v1`          | `MoreMenu`                        | `{ sex?: "male"\|"female", birthYear?: number }` — lifter profile for strength standards | `{}`                                             |
| `mgym.fvCache.v1`          | `fvApi`                           | cache of FitnessVolt percentile + standards responses (see below)                        | `{}`                                             |
| `mgym.food.entries.v1`     | `FoodProvider` (`K_FOOD_ENTRIES`) | `FoodEntry[]`                                                                            | `[]`                                             |
| `mgym.food.targets.v1`     | `FoodProvider` (`K_FOOD_TARGETS`) | `TargetPeriod[]`                                                                         | `[]`                                             |
| `mgym.food.customFoods.v1` | `FoodProvider` (`K_FOOD_CUSTOM`)  | `CustomFood[]`                                                                           | `[]`                                             |
| `mgym.food.savedMeals.v1`  | `FoodProvider` (`K_FOOD_MEALS`)   | `SavedMeal[]`                                                                            | `[]`                                             |
| `mgym.food.recent.v1`      | `FoodProvider` (`K_FOOD_RECENT`)  | `RecentFood[]`                                                                           | `[]`                                             |
| `mgym.food.searchCache.v1` | `foodApi` (`K_FOOD_SEARCH_CACHE`) | `{ ["q:<normalised query>" \| "bc:<code>"]: { at, results } }`                           | `{}`                                             |
| `mgym.food.tab`            | `FoodApp` (`K_FOOD_TAB`)          | active food tab: `today`/`search`/`trends`/`settings`                                    | `"today"`                                        |
| `weekly-note:<weekKey>`    | _legacy_ (no longer used)         | `string` — one note per ISO week (written by the removed `WeeklyNotes`)                  | `""`                                             |
| `summary-open:<periodKey>` | _legacy_ (no longer used)         | `boolean` — card collapse state (written by the removed `PeriodCard`)                    | card default                                     |

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

| Field        | Type      | Purpose                                                                                                                                                                  | Default    |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `set`        | `number`  | 1-based index; renumbered on add/delete to stay contiguous.                                                                                                              | sequential |
| `weight`     | `number`  | **Always kilograms**, regardless of the kg/lb toggle.                                                                                                                    | `0`        |
| `reps`       | `number`  | Repetitions.                                                                                                                                                             | `0`        |
| `targetReps` | `number?` | Recommended reps from the routine; shown as a grey placeholder while the set is unlogged. Absent on manually added sets and on workouts saved before this field existed. | absent     |

`targetReps` is written by `instantiateRoutine` from the routine's stored reps.
A live-started routine session sets `reps: 0` and relies on `targetReps` for the
placeholder; a _planned_ workout keeps its reps pre-filled, so the placeholder
never surfaces there. See `docs/superpowers/specs/2026-07-21-recommended-reps-design.md`.

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
backups. Sets instantiated from a routine into a live session start at
`reps: 0` and so read as unlogged until you enter what you actually did; their
`targetReps` is display-only and never counts toward logged volume.

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

### Search cache (`mgym.food.searchCache.v1`)

A response cache for the food API (spec §5.7). One map, two kinds of key:

- **Search** — key `q:<normalised query>` (trimmed, lowercased, whitespace
  collapsed by `normaliseQuery`), value `{ at, results }` where `results` is
  the API `results` array.
- **Barcode** — key `bc:<code>`, value `{ at, results: [food] }` (one food).

`at` is the epoch ms of the write. Entries older than 7 days
(`SEARCH_CACHE_TTL_MS`) are ignored on read and pruned on write; past 200 keys
(`SEARCH_CACHE_MAX`) the oldest `at` is dropped on write. A stored value that is
not a plain object reads as `{}`. Errors and empty queries are not cached.
Purely a network cache — safe to clear, rebuilt on demand. Not in the backup
payload. See `src/food/lib/searchCache.js` and `src/food/lib/foodApi.js`.

### Notes

- **Global notepad** (`mgym.note.v1`) — a single free-form `string`.
- **Weekly notes** (`weekly-note:<weekKey>`) — legacy; one `string` per ISO
  week, written by the removed `WeeklyNotes`. No longer surfaced in the UI but
  still round-tripped through backup/export (see below).

### Food tracker (`mgym.food.*`)

The food tracker's stored shapes. `FoodProvider` owns the lists through
`loadLS`/`saveLS`. Constants live in `src/food/lib/keys.js`.

#### FoodRef

Where an entry's nutrition came from. Stored inside entries, saved-meal items
and recent foods.

| Field     | Type               | Notes                                                      |
| --------- | ------------------ | ---------------------------------------------------------- |
| `kind`    | `"db" \| "custom"` | `db` = macro-calculator food, `custom` = local custom food |
| `id`      | `string`           | API food id, or `CustomFood.id`                            |
| `barcode` | `string?`          | present when the item was reached by scan                  |

#### FoodEntry

One logged item.

| Field          | Type                           | Notes                                      |
| -------------- | ------------------------------ | ------------------------------------------ |
| `id`           | `string`                       | `uuid()`                                   |
| `date`         | `string`                       | local `YYYY-MM-DD`                         |
| `slot`         | `string`                       | one of the six slot ids in `slots.js`      |
| `name`         | `string`                       | display name at time of logging            |
| `grams`        | `number`                       | > 0                                        |
| `per100`       | `{ kcal, protein, carb, fat }` | copied at time of logging; never rewritten |
| `food`         | `FoodRef`                      |                                            |
| `portionLabel` | `string?`                      | e.g. `"1 large egg"`; informational        |
| `createdAt`    | `number`                       | epoch ms                                   |

Macros for an entry are always derived: `grams × per100 / 100`. They are never
stored. `macros.js` exports `entryMacros(entry)`, `sumMacros(entries)`, and
rounding helpers (kcal to integer, grams to 1 dp).

#### TargetPeriod

| Field     | Type     | Notes                                  |
| --------- | -------- | -------------------------------------- |
| `from`    | `string` | local `YYYY-MM-DD`; unique in the list |
| `kcal`    | `number` | > 0                                    |
| `protein` | `number` | g, ≥ 0                                 |
| `carb`    | `number` | g, ≥ 0                                 |
| `fat`     | `number` | g, ≥ 0                                 |

`targetForDate(targets, date)` returns the row with the greatest `from` that is
≤ `date`, or `null`. Saving targets with a `from` that already exists replaces
that row. Rows can be deleted from the history list; deleting the only row
leaves the app with no target (plain totals, no bars).

#### CustomFood

| Field       | Type                           | Notes                                                                 |
| ----------- | ------------------------------ | --------------------------------------------------------------------- |
| `id`        | `string`                       | `uuid()`                                                              |
| `name`      | `string`                       | required                                                              |
| `barcode`   | `string?`                      | set when created from a failed scan                                   |
| `per100`    | `{ kcal, protein, carb, fat }` | required; kcal may be left blank and is then computed as 4P + 4C + 9F |
| `portions`  | `{ label, grams }[]`           | optional, usually one ("1 serving = 45 g")                            |
| `createdAt` | `number`                       |                                                                       |

Editing a custom food changes future entries only. Existing entries keep their
`per100` copy.

#### SavedMeal

| Field       | Type                                             | Notes                                      |
| ----------- | ------------------------------------------------ | ------------------------------------------ |
| `id`        | `string`                                         |                                            |
| `name`      | `string`                                         |                                            |
| `items`     | `{ name, grams, per100, food, portionLabel? }[]` | same fields as an entry minus id/date/slot |
| `createdAt` | `number`                                         |                                            |

Logging a saved meal copies each item into a new `FoodEntry` for the chosen
date and slot. "Save as meal" on a slot builds a `SavedMeal` from that slot's
entries.

#### RecentFood

The last 50 distinct foods logged, newest first, keyed by `kind + id`.

| Field              | Type                             | Notes                              |
| ------------------ | -------------------------------- | ---------------------------------- |
| `food`             | `FoodRef`                        |                                    |
| `name`             | `string`                         |                                    |
| `per100`           | `{ kcal, protein, carb, fat }`   |                                    |
| `portions`         | `{ label, grams, isDefault? }[]` | from the API result or custom food |
| `lastGrams`        | `number`                         | what you logged last time          |
| `lastPortionLabel` | `string?`                        |                                    |
| `lastAt`           | `number`                         | epoch ms                           |

`touchRecent(list, item)` moves or inserts the item at the front and trims to 50. This list is what makes offline logging work: tapping a chip logs
`lastGrams` of that food in one step; opening it lets you change the portion.

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
- **Cycle Review** — `src/lib/review/*` computes an 8-day-cycle `ReviewResult`
  (per-exercise progression decisions, tonnage trend, bodyweight evaluation,
  next-cycle plan) from `workouts` + `weightLogs`; not persisted. Reads
  bodyweight via `K_WEIGHT_LOGS`; adds no new keys.

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
  "routines": [
    /* Routine[] */
  ],
  "unit": "kg",
  "tab": "workouts",
  "note": "…",
  "weightLogs": { "2026-06-01": 70.2 },
  "weeklyNotes": { "weekly-note:2026-24": "…" },
  "food": {
    "entries": [],
    "targets": [],
    "customFoods": [],
    "savedMeals": [],
    "recent": []
  }
}
```

| Field                                                  | Type                | Purpose                                                                  |
| ------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------ |
| `schema`                                               | `string`            | Format tag `"mgym.v1"`. Not validated on import.                         |
| `exportedAt`                                           | `string` (ISO 8601) | When generated.                                                          |
| `exercises` / `workouts` / `routines`                  | arrays              | Validated via `normalizeData()` on import.                               |
| `unit` / `tab` / `note` / `weightLogs` / `weeklyNotes` | misc                | Restored **directly** to localStorage on import, **without** validation. |
| `food`                                                 | object              | The five food lists. Validated via `normalizeFoodData()` on import.      |

On import, exercises/workouts/routines go through `normalizeData()` then **merge** or
**replace** (rules in
[ARCHITECTURE.md → Export / import](../ARCHITECTURE.md#export--import-backup));
the remaining fields are written straight back to their keys.

`food` is the exception to that last line. It holds the five lists `entries`,
`targets`, `customFoods`, `savedMeals` and `recent`; `mgym.food.searchCache.v1` and
`mgym.food.tab` are excluded. `importFoodData()` (`src/food/lib/backupFood.js`)
applies it as follows:

- **Merge** adds incoming rows and rewrites no stored row, except a recent row
  replaced by an incoming row with a newer `lastAt`. Targets are re-sorted by `from`.
  Recent is re-sorted newest first and capped at 50, so the cap can remove the oldest
  stored row.
- **Replace** normalises the incoming lists and overwrites each one. A list missing
  from `food` counts as `[]`, so `food: {}` empties all five lists.
- A backup with no `food` field, or a `food` value that is not a plain object, leaves
  food data untouched in both modes.

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
