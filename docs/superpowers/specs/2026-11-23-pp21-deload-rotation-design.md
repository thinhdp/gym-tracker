# PP21: the deload covers the whole deload rotation — design spec

**Status:** draft
**Date:** 2026-11-23
**Issue:** #178

## Problem

When the PP21 engine prescribes a deload rotation, only the first session of it is a
deload. The next three sessions get normal prescriptions, and from then on a
one-session deload is prescribed at the start of every rotation.

Cause: Start builds the workout with `workoutFromPlan`
(`src/lib/review/pp21/nextSession.js:40-61`), which names it after the routine
(`plan.routineName`, e.g. "Push A") and leaves every exercise note empty. The engine
marks a session as a deload only when the workout name, or at least half of its
exercise notes, match the deload flag (`normalise`, `src/lib/review/pp21/engine.js:177`
and `:192-197`). A session started from a deload plan matches neither, so:

- the rotation is never marked as a deload (`engine.js:998-999`), so "Deload rotation
  in progress" never fires (`engine.js:1027-1030`);
- the scheduled check fires only when the next session starts a new rotation
  (`engine.js:1022-1026`), so the deload ends after the first session;
- no completed rotation is ever a deload, so the count since the last deload
  (`engine.js:1018-1020`) never resets;
- the deload session counts as a normal exposure for progression, instead of
  `DELOAD_DONE` (`engine.js:536-549`).

## Intended behavior

When the engine prescribes a deload rotation, all four sessions of it get deload
prescriptions, none of them counts for progression, and the count since the last
deload resets when the rotation ends, so the next scheduled deload comes after
`deloadEveryRotations` (`src/lib/review/programs/pp21.js`) minus one normal rotations.

## Design

`workoutFromPlan` names the workout `` `${plan.routineName} (deload)` `` when
`plan.deload` is true (example: "Push A (deload)"). When `plan.deload` is false the name
stays `plan.routineName`, as today. Nothing else in the function changes.

Mechanisms this relies on, all existing and read for this spec:

- **Session matching still works.** `matchSession` (`engine.js:107-114`) matches a
  workout to a session when the normalised name contains a `routineNames` entry as a
  whole phrase (`hasPhrase`, `engine.js:102-105`: the phrase must be bounded by start,
  end, or a character that is not a letter or digit). "push a (deload)" contains "push a"
  followed by a space, so it matches Push A.
- **The session is marked as a deload.** `normalise` tests the workout name against the
  deload flag (`p.noteFlags.deload`, default "deload", case-insensitive;
  `engine.js:177`, `:195-196`).
- **Progression skips it.** Each exposure of a deload session carries `deload: true`
  (`engine.js:807`); `reviewExercise` records it as `DELOAD_DONE` and does not progress
  from it (`engine.js:536-549`); the rotation's direct-set counts skip it
  (`engine.js:985`).
- **The deload carries through the rotation.** A rotation is a deload when at least half
  its planned sessions are (`engine.js:998-999`). With the first session marked, the
  open rotation is a deload, so `deloadInProgress` holds and `activeNow` stays true
  (`engine.js:1027-1030`, `:1151-1153`), and `nextSessionPlan` keeps prescribing deload
  sets (`engine.js:1187`, `:1213-1230`).
- **The count resets.** When the deload rotation completes, it is the last completed
  deload rotation, so the count since the last deload starts again from zero
  (`engine.js:1018-1020`).

A deload that is due but not yet active ("Deload from the next Push A") has
`plan.deload` false, so the session before it is not marked. That is the current
behavior and stays.

## Writes and shared state

- **Stored data.** The only change to what is written is the `name` of a workout that
  Start creates from a deload plan. The workout shape in `docs/DATA-MODEL.md` does not
  change (`name` is already a free string), so `docs/DATA-MODEL.md` needs no update.
  The backup envelope is unchanged.
- **Existing workouts.** Not changed. No migration. Sessions already logged during the
  current deload rotation stay as they are; the user adds "(deload)" to the name of any
  session they trained as a deload (user ruling, 2026-11-23).
- **What other views see.** History and any view that shows workout names show
  "Push A (deload)". The PP21 review and the next-session card see the session as a
  deload, as described above. The user can remove the marker by editing the name, which
  turns the session back into a normal one; that is intended.

## Tests

1. `src/lib/review/pp21/nextSession.test.js`: `workoutFromPlan` on a plan with
   `deload: true` gives the name "<routineName> (deload)"; on a plan with
   `deload: false` gives exactly `routineName`.
2. `src/lib/review/pp21/engine.test.js`: a full deload rotation. Start from history
   where the engine prescribes a deload at the start of a rotation; log each of the four
   sessions as the workout `workoutFromPlan` builds from the current plan (sets filled in
   at the prescribed weight and reps). Before each of the four sessions,
   `nextSessionPlan(...).deload` is true; after the fourth, the next plan's `deload` is
   false and `rotationsSinceDeload` is 0. This test fails on the current code (the
   second session's plan is not a deload).

## Out of scope

- Guessing and renaming past deload sessions.
- A stored `deload` field on workouts (rejected: new stored field, needs DATA-MODEL,
  backup and UI changes).
- The early-deload rules (regressed compounds, fatigue signals); they are unchanged.
