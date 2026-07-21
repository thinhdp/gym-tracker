# Recommended Reps & Routine Weight Cleanup — Design

Three related changes to how routine data reaches the live workout screen: stop
editing weights in the routine editor, treat routine reps as a *recommendation*
rather than a pre-filled log, and fix a tap-target bug on the live screen.

## Goals

- Remove the weight input from the routine editor, since `instantiateRoutine`
  already overrides it from workout history.
- Make a routine-started live session open with **zero reps on every set**, with
  the routine's rep target shown as a small hint next to the reps input.
- Fix: tapping the empty area beside the exercise name on the live screen opens
  the past-workout modal. It should only open when tapping the name itself.

## Non-goals

- No change to planned workouts (the Plan flow). They keep pre-filled reps — an
  explicit decision, see below.
- No data migration. `targetReps` is additive; workouts saved before this change
  simply have no hint.
- No change to what counts as a logged set (`isLogged` stays `reps > 0`).
- No change to the exercise database's `recommendRep` string or where it renders.

## Decisions

| Topic                | Decision                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Routine weight input | Removed from the editor. Stored routine weights are **kept**, still used as the no-history fallback. |
| Hint source          | Per-set `targetReps` copied from the routine, not the exercise's `recommendRep` string.              |
| Planned workouts     | Unchanged — still pre-filled. Only `startRoutine` zeroes reps.                                       |
| Hint placement       | Small muted `·N` immediately right of the reps input, inside `WeightRepInputs`.                       |

### Why planned workouts stay pre-filled

Both `startRoutine` and the Plan flow call `instantiateRoutine`, and a planned
workout is later opened by the same `LiveSession` via `startSession`. Making
planned workouts behave the new way would have been more consistent, but the
user chose to leave them alone. The alternative — having `LiveSession` zero reps
at session start — was rejected outright: `startSession` is also how an
interrupted or past workout is re-opened (`WorkoutHistoryItem`), so that would
erase real logged sets.

Consequence to accept: starting a *planned* workout still shows pre-filled reps.

## Changes

### 1. `src/lib/routines.js` — `instantiateRoutine`

Signature gains an option:

```js
instantiateRoutine(routine, { date, exercises = [], zeroReps = false })
```

Per set it now writes:

- `targetReps: Number(s.reps) || 0` — **always**, both paths.
- `reps: zeroReps ? 0 : Number(s.reps) || 0`

Weight resolution is unchanged: last set of the exercise's `lastWorkout`, falling
back to the routine's stored weight.

Call sites:

| Call site                                     | `zeroReps` |
| --------------------------------------------- | ---------- |
| `AppContext.startRoutine` (▶ Start, live)      | `true`     |
| `AppContext.addWorkoutFromRoutine` (plan)      | default    |
| `WorkoutPlanner` (two call sites, plan)        | default    |

### 2. `src/components/WeightRepInputs.jsx`

Two new optional props, both backwards-compatible:

- `showWeight = true` — when `false`, the weight input is not rendered and the
  wrapper drops to a single column.
- `repsHint` — when truthy, renders a small muted `·{repsHint}` beside the reps
  input.

### 3. `src/components/WorkoutExerciseEditor.jsx`

Accepts `showWeight = true` and forwards it to `WeightRepInputs`. When `false`,
the `Weight ({unit})` header cell is omitted so the header stays aligned with the
rows.

### 4. `src/components/RoutineEditor.jsx`

Passes `showWeight={false}`. `handleSave` is unchanged — it still persists
`weight` from the item, preserving whatever the routine already stored.

### 5. `src/components/LiveSession.jsx`

- Set rows pass `repsHint={s.targetReps > 0 ? s.targetReps : null}`.
- Bug fix at the exercise-name button: drop `flex-1` so the button shrinks to its
  text instead of spanning the row. Keep truncation for long names
  (`max-w-full truncate self-start`). The surrounding `justify-between` wrapper
  no longer needs to stretch it.

## Data model

`docs/DATA-MODEL.md` gains `targetReps` on a workout exercise's set:

```js
{ set: 1, weight: 60, reps: 0, targetReps: 10 }
```

Optional. Absent on pre-existing workouts and on sets added manually mid-session
(`addSet` does not invent a target). Routines themselves are unchanged — a
routine set keeps `{ set, weight, reps }`, where `reps` is the target.

## Testing

Per the repo's testing policy, every touched module gets co-located tests.

- `src/lib/routines.test.js`
  - `zeroReps: true` → every set has `reps === 0` and `targetReps` equal to the
    routine's reps.
  - Default (no `zeroReps`) → `reps === targetReps === routine reps`.
  - Weight fallback behaviour still holds under both.
- `src/components/WorkoutExerciseEditor.test.jsx`
  - Weight input present by default; absent with `showWeight={false}`.
  - Reps editing still fires `onChange` when the weight input is hidden.
- `src/components/LiveSession.test.jsx`
  - A session whose sets carry `targetReps` renders the hint; a session without
    it renders no hint.
  - Sets with `reps: 0` render unticked.
  - The exercise-name button does not carry the row-spanning class (guards the
    tap-target regression).

`npm run check` must pass before pushing.

## Manual smoke check

1. Routine tab → edit a routine: no weight inputs, reps still editable, save works.
2. Routine tab → ▶ Start: every set shows reps `0`, unticked, with `·N` hints.
3. Weights are pre-filled from the last workout for exercises with history.
4. On the live screen, tap the blank area right of the exercise name — nothing
   happens. Tap the name — the past-logs modal opens.
5. Routine tab → Plan a routine for a future date, then start it: reps are still
   pre-filled (expected, unchanged).
