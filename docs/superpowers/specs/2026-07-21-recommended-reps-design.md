# Recommended Reps & Routine Weight Cleanup — Design

Three related changes to how routine data reaches the live workout screen: stop
editing weights in the routine editor, treat routine reps as a _recommendation_
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
- No change to what counts as a logged set (`isLogged` stays `reps > 0`). Note
  this is a statement about the predicate, not about statistics — see
  "Consequences for analysis" below.
- No change to the exercise database's `recommendRep` string or where it renders.
- No change to `routineFromWorkout` — see "Accepted losses".
- No change to the Cycle Review / tonnage engines.

## Decisions

| Topic                | Decision                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Routine weight input | Removed from the editor. Stored routine weights are **kept**, still used as the no-history fallback. |
| Hint source          | Per-set `targetReps` copied from the routine, not the exercise's `recommendRep` string.              |
| Planned workouts     | Unchanged — still pre-filled. Only `startRoutine` zeroes reps.                                       |
| Hint placement       | Grey placeholder **inside** the reps input, shown while the set is unlogged.                         |
| Save as routine      | Unchanged. Skipped sets save as `reps: 0`, losing their target — accepted.                           |
| Backup import        | `targetReps` preserved through `normalizeWorkout` so the hint survives a round-trip.                 |

### Accepted losses

Two consequences were reviewed and deliberately accepted rather than fixed.

**1. "Save as routine" drops targets for skipped sets.** `routineFromWorkout`
(`src/lib/routines.js:15`) builds routine sets from `reps` alone. Today that
round-trips cleanly because a routine-started session arrives pre-filled; after
this change, a set you never logged saves as `reps: 0`, so the resulting routine
has no target for it and shows no hint on the next start. Reachable from the live
screen's "Save as routine" button and from `WorkoutHistoryItem`.

The cheap fix — `reps: Number(s.reps) || Number(s.targetReps) || 0` — was
considered and declined. If this proves annoying in use, that one clause is the
whole change.

**2. Removing the weight input makes the no-history fallback uneditable.** The
goal statement above ("`instantiateRoutine` already overrides it from history")
only holds once history exists; `routines.js:59-60` falls back to the routine's
stored weight otherwise. After this change, a routine containing a never-logged
exercise keeps whatever `createExerciseEntry` captured — `0` for a brand-new
exercise — and there is no longer any way to author that starting weight. Such an
exercise opens at weight `0` on its first live session until you type one in.

### Why planned workouts stay pre-filled

Both `startRoutine` and the Plan flow call `instantiateRoutine`, and a planned
workout is later opened by the same `LiveSession` via `startSession`. Making
planned workouts behave the new way would have been more consistent, but the
user chose to leave them alone. The alternative — having `LiveSession` zero reps
at session start — was rejected outright: `startSession` is also how an
interrupted or past workout is re-opened (`WorkoutHistoryItem`), so that would
erase real logged sets.

Consequence to accept: starting a _planned_ workout still shows pre-filled reps.

### Consequences for analysis

Today an untouched routine set is recorded into history **at its target** — a
routine session even opens with every set already ticked, since `isLogged` is
`reps > 0`. Downstream, `review/tonnage.js`, `review/patterns.js`,
`lib/analyzeExercise.js`, `lib/metrics.js` and `lib/homeStats.js` all read those
reps as performed work.

After this change, a set you performed but forgot to log records `0`. Cycle
Review may then read the exercise as `UNDER` and recommend a deload, and tonnage
trends will dip. This is the intended direction — the app should count what you
logged, not what you planned — but it is a real behavioural change to the
analysis surface, not a no-op. Accepted knowingly; the review engines are not
being modified to compensate.

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

| Call site                                 | `zeroReps` |
| ----------------------------------------- | ---------- |
| `AppContext.startRoutine` (▶ Start, live) | `true`     |
| `AppContext.addWorkoutFromRoutine` (plan) | default    |
| `WorkoutPlanner` (two call sites, plan)   | default    |

### 2. `src/components/NumberInputAutoClear.jsx`

Gains `blankZero = false`. When `true`, a `valueNumber` of `0` (or `""`/`null`)
renders as `""` **whether or not the input is focused**, so the `placeholder`
shows through. The existing focus-clearing behaviour is untouched, and the
default keeps every current call site rendering exactly as it does today.

This is the piece that makes a placeholder hint possible at all: today an
unlogged set renders a literal `0`, which would hide any placeholder.

### 3. `src/components/WeightRepInputs.jsx`

Two new optional props, both backwards-compatible:

- `showWeight = true` — when `false`, the weight input is not rendered and the
  wrapper drops to a single column.
- `repsPlaceholder` — when truthy, passed to the reps input as `placeholder`
  along with `blankZero`, so an unlogged set shows the grey target number. When
  absent, no `placeholder` is passed and `NumberInputAutoClear`'s own default of
  `"0"` (`NumberInputAutoClear.jsx:10`) applies, unchanged.

The weight input never receives `blankZero`; only reps are affected.

### 4. `src/components/WorkoutExerciseEditor.jsx`

Accepts `showWeight = true` and forwards it to `WeightRepInputs`. When `false`:

- the `Weight ({unit})` header cell is omitted, **and**
- the header's inner wrapper (`WorkoutExerciseEditor.jsx:107`, currently
  `flex-1 grid grid-cols-2 gap-3`) collapses to `grid-cols-1`.

Both are required. Dropping the cell alone would leave "Reps" sitting in the left
half of a two-column grid while the single-column `WeightRepInputs` below spans
the full width.

### 5. `src/components/RoutineEditor.jsx`

Passes `showWeight={false}`. `handleSave` is unchanged — it still persists
`weight` from the item, preserving whatever the routine already stored.

### 6. `src/components/LiveSession.jsx`

- Set rows pass `repsPlaceholder={s.targetReps > 0 ? String(s.targetReps) : null}`.
  An unlogged set therefore shows an empty reps box carrying a grey target
  number; sets with no target keep the plain `0` placeholder.
- Bug fix at the exercise-name button (`LiveSession.jsx:340`): drop `flex-1` so
  the button shrinks to its text instead of spanning the row. Keep `max-w-full
truncate` for long names — flexbox clamps the automatic minimum size by
  max-width, so truncation still works. Its wrapper at line 339 needs no change;
  it has only one child (the action buttons are a separate row at line 352).

### 7. `src/lib/backup.js` and `src/components/WorkoutPlanner.jsx` — persistence

Both rebuild sets as exactly `{ set, weight, reps }`, which would silently strip
`targetReps`:

- `normalizeWorkout` (`backup.js:45-49`) — a merge-import would erase hints from
  an in-progress workout, and `docs/DATA-MODEL.md` would document a field its own
  import path drops.
- `WorkoutPlanner.saveWorkout` (`WorkoutPlanner.jsx:70-75`) — the other plan
  route, `addWorkoutFromRoutine`, stores the instantiated workout verbatim and
  keeps `targetReps`. Without this the two plan paths disagree.

Both gain `targetReps: Number(s?.targetReps) || undefined`, so the field is
carried when present and omitted when not.

## Data model

`docs/DATA-MODEL.md` gains `targetReps` on a workout exercise's set:

```js
{ set: 1, weight: 60, reps: 0, targetReps: 10 }
```

Optional. Absent on pre-existing workouts and on sets added manually mid-session
(`addSet` does not invent a target). Routines themselves are unchanged — a
routine set keeps `{ set, weight, reps }`, where `reps` is the target.

Carried by both plan routes and through backup import (see Change 7), so a
planned workout's sets do hold `targetReps` — invisible in the UI, since planned
reps are pre-filled and the placeholder never surfaces.

## Testing

Per the repo's testing policy, every touched module gets co-located tests.

- `src/lib/routines.test.js`
  - `zeroReps: true` → every set has `reps === 0` and `targetReps` equal to the
    routine's reps.
  - Default (no `zeroReps`) → `reps === targetReps === routine reps`.
  - Weight fallback behaviour still holds under both.
- `src/context/AppContext.test.jsx` — **the most important test here.**
  `startRoutine` produces a workout whose sets are all `reps: 0` with
  `targetReps` set. `zeroReps` defaults to `false`, so omitting that one argument
  at the call site reproduces today's behaviour exactly and _every other test in
  this list still passes_. Nothing else pins the feature down. There is currently
  no `startRoutine` coverage at all.
- `src/lib/backup.test.js` — `normalizeWorkout` preserves `targetReps` when
  present and omits it when absent.
- `src/components/WorkoutExerciseEditor.test.jsx`
  - Weight input present by default; absent with `showWeight={false}`.
  - Reps editing still fires `onChange` when the weight input is hidden.
- `src/components/NumberInputAutoClear.test.jsx` (file exists — extend it)
  - With `blankZero`, a `valueNumber` of `0` renders an empty input while
    unfocused, and the `placeholder` is the given target.
  - Without `blankZero` (default), `0` still renders as `0` — guards every
    existing call site.
  - Typing into a `blankZero` input still reports the number through
    `onNumberChange`.
- `src/components/LiveSession.test.jsx`
  - A set with `targetReps` renders an empty reps input whose placeholder is
    that target; a set without one falls back to placeholder `0`.
  - Typing reps into such a set updates the value and ticks it.
  - Sets with `reps: 0` render unticked.
  - The exercise-name button does not carry the row-spanning class. This asserts
    a Tailwind class name and will rot on any restyle — it is a deliberate
    regression guard, not a behavioural test, since jsdom cannot measure hit
    areas.

`npm run check` must pass before pushing.

## Manual smoke check

1. Routine tab → edit a routine: no weight inputs, reps still editable, save works.
2. Routine tab → ▶ Start: every set's reps box is empty and unticked, showing
   the routine's target as a grey placeholder. Typing a number replaces it and
   ticks the set.
3. Weights are pre-filled from the last workout for exercises with history.
4. On the live screen, tap the blank area right of the exercise name — nothing
   happens. Tap the name — the past-logs modal opens.
5. Routine tab → Plan a routine for a future date, then start it: reps are still
   pre-filled (expected, unchanged).
6. Routine editor: an exercise with no logged history shows weight `0` on start
   and cannot be pre-set (expected — see Accepted losses).
7. Start a routine, log some sets, skip others, tap "Save as routine": the new
   routine has `0` targets for the skipped sets (expected — see Accepted losses).
