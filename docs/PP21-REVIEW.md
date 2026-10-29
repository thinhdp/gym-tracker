# PP21 Review Framework

This spec covers the review function behind **More → Push·Pull Review**. It covers for the **Push·Pull 2-1 Split** (Push A + Squat → Pull A + Deadlift → Rest → Push B + Leg press → Pull B + Glute/Curl → Rest). The function reads the app's workouts (the `mgym.v1` shape) and produces three things:

1. A **decision per exercise**: ADD, HOLD, REDUCE, RESET or SWAP, with the next weights and target reps.
2. **Session and rotation checks**: missing exercises, volume, RPE logging, regressions and fatigue.
3. **Program-level calls**: next session and date, deload, chest frequency, schedule adherence and size check.

Files:

| File                                    | Purpose                                                                                                                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/review/programs/pp21.js`       | Program definition: sessions, exercises, rep and RPE targets, weight steps, rules and thresholds. All tuning happens here.                                                                                                              |
| `src/lib/review/pp21/engine.js`         | Engine with pure functions and no dependencies. `reviewProgram(data, program, { asOf })`, `nextSessionPlan(review, program)`, plus `reviewRotation(data, program, n)` and `loggedRotations(data, program)` for the cycle-by-cycle view. |
| `src/lib/review/pp21/fixture.pp21.json` | 4 rotations of sample sessions in `mgym.v1` format (28 Oct – 19 Nov 2026), covering every rule.                                                                                                                                         |
| `src/lib/review/pp21/engine.test.js`    | Vitest suite asserting each rule (§11).                                                                                                                                                                                                 |
| `src/components/PushPullReview.jsx`     | The More sub-screen (§9).                                                                                                                                                                                                               |

---

## 1. Input contract (`mgym.v1`)

```
workouts[]: { id, date: "YYYY-MM-DD", name, exercises[] }
exercises[]: { exerciseName, sets[], rpe: number|null, feedback: string }
sets[]: { set, weight, reps, targetReps? }
```

| Field               | How the review reads it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workout.name`      | Session identity. The name only has to **contain** `Push A`, `Pull A`, `Push B` or `Pull B` as a whole phrase (any prefix works: `[LV] Push A`, `[PP21] Push A`). If no phrase matches, the session is matched by exercise overlap (≥ 50%).                                                                                                                                                                                                                                                                        |
| `exerciseName`      | Filled into a program slot in passes: (1) `name` + `aliases` of a slot in this session; (2) the logged exercise's **main muscle** (from the app's exercise catalog) against each slot's `mainMuscles`, filling this session's slots in order (`SUBSTITUTED`); (3) `name` + `aliases` of a slot on another day (`MOVED`, e.g. the abductor done on Push A). Muscle matching never crosses sessions, so add-on work doesn't feed another day's progression. Case and spacing are ignored. Anything left is an extra. |
| `sets[].reps`       | `0` is ignored as an unfilled routine slot. A decimal such as `8.5` means a bad-form rep: it's floored for decisions and counted as a quality flag.                                                                                                                                                                                                                                                                                                                                                                |
| `sets[].weight`     | kg. For pull-ups it's the **added** load, so a back-off of `0` means bodyweight.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `exercise.rpe`      | One value per exercise. Barbell lifts: RPE of the **top set**. Everything else: RPE of the **last set**. Can be empty; the decision then uses reps only and is marked `confidence: low`.                                                                                                                                                                                                                                                                                                                           |
| `exercise.feedback` | Free text scanned for flags (§5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `sets[].targetReps` | Written by the app when it prefills the next session from `next.routineSets`. Not read by the review.                                                                                                                                                                                                                                                                                                                                                                                                              |

**Working-set extraction.** Leading sets lighter than 80% of the heaviest set are treated as warm-ups.

- `top_backoff`: the top set is the heaviest set and the back-off is the set right after it.
- `double`: the first two non-warm-up sets are the working sets.
- Any further sets are `EXTRA_SETS`.

Only workouts dated on or after `startDate` (2026-10-28) are reviewed. Older Max 7/5/3 sessions (which ended 2026-10-27) are ignored.

**Start weights (`START`).** The config has no fixed start weights. Until an exercise is logged in the program, its first prescription comes from the lifter's own history:

- **Recent best set.** The engine looks at any workout in the 8 weeks up to the review date, including ones before `startDate`, matched by the slot's name or aliases. If nothing falls in that window, it falls back to the most recent session of the exercise ever, and the reason says how many weeks ago that was. It takes the set with the highest Epley e1RM, ignoring sets over 20 reps. The start weight is what fits the first target reps at the low end of the RPE target, treating reps plus reps-in-reserve as a rep max. That figure is cut by `seedSafetyPct` (5%) and floored to the step. Example: bench 50×6 gives an e1RM of 60. A top set of 5 @ RPE 8 is about a 7RM, so 60 ÷ 1.233 × 0.95 = 46.2, giving 45 kg, with a 40 kg back-off.
- **Bodyweight lifts** (`backoffMode: "bodyweight"`, i.e. pull-ups) use the heaviest added weight that reached the bottom of the rep range, or 0 (bodyweight).
- **No history at all.** The weights are `null`, and the lifter picks a weight for the target reps and RPE ("Pick a weight" on the Home card, `?` in the review). From the first logged session on, the normal rules take over.

---

## 2. Pipeline

```
export ─► normalise ─► assign rotations ─► build exposures ─► replay each exercise ─► session checks ─► rotation checks ─► global calls
```

1. **Normalise**: filter by date, sort by date, map exercise names, match the session, detect deloads. A deload is a workout whose name contains "deload", or where at least half its exercises have "deload" in the feedback.
2. **Rotations**: a new rotation starts whenever the session order wraps back (for example Pull B → Push A, or Push B → Pull A). A skipped session therefore doesn't shift later rotations. Unplanned workouts are kept for schedule and chest counts but sit outside the order.
3. **Exposures**: one per exercise per workout, holding the working sets, top and back-off sets, RPE, note flags, partial reps and the e1RM of the top set (Epley).
4. **Replay**: walk each exercise's exposures oldest → newest, carrying state (stall count, resets, previous shoulder note, skip-back-off). Each step produces a decision and the prescription for the next exposure. Replaying the history means a review run on any date gives the same answer.
5. **Checks and calls**: §6 and §7.

---

## 3. Base decision per exercise

Each exposure is compared with the exercise's own rep range and RPE target from the config.

### 3a. `top_backoff` (bench, squat, deadlift, incline Smith, weighted pull-up)

| Condition (top set)                                                | Decision   | Next                                                                      |
| ------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------- |
| reps ≥ top of range **and** (RPE ≤ target high **or** RPE missing) | **ADD**    | top + step, back-off = 90% rounded to step, target reps = bottom of range |
| reps ≥ top of range **but** RPE > target high                      | HOLD       | reason: "own it before adding"                                            |
| reps < bottom of range **and** (RPE ≥ 10 **or** missing)           | **REDUCE** | top − 1 step                                                              |
| reps < bottom of range **and** RPE < 10                            | HOLD       | flag `UNDER_RANGE`                                                        |
| otherwise                                                          | HOLD       | target = last reps + 1 (capped at the top of the range)                   |

Back-off checks:

- `NO_BACKOFF` if the back-off is missing, unless the previous review said to skip it.
- `BACKOFF_PCT` if the back-off is outside 85–95% of the top set. The pull-up back-off is bodyweight and isn't checked.

RPE checks: `RPE_OVER` if RPE > high + 0.5, and `RPE_UNDER` if RPE < low − 1.

### 3b. `double` (all machine, cable and DB work)

| Condition                                                        | Decision   | Next                                         |
| ---------------------------------------------------------------- | ---------- | -------------------------------------------- |
| both sets ≥ top of range **and** (RPE within cap **or** missing) | **ADD**    | weight + step, target reps = bottom of range |
| set 1 < bottom of range                                          | **REDUCE** | weight − 1 step                              |
| otherwise                                                        | HOLD       | each set target = last reps + 1, capped      |

RPE checks:

- **Capped exercises** (set-2 target < 10: shoulder press 9, incline DB 9.5, glute raise 9.5, low-to-high fly 8): `RPE_CAP` if logged RPE > cap + 0.5. ADD also requires RPE ≤ cap.
- **To-failure exercises** (target 10): `RPE_UNDER` if RPE < 9.

---

## 4. Overrides and stall handling

These run after the base decision, highest priority first.

| #   | Trigger                                                                               | Applies to                                  | Result                                                                                                                             |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Shoulder pain note, previous exposure also had one                                    | exercises with rule `shoulder` and an `alt` | **SWAP** to `alt` for 2 rotations (`SHOULDER_PAIN`, alert)                                                                         |
| 2   | Shoulder pain note                                                                    | rule `shoulder`                             | **REDUCE** by 5 kg (`SHOULDER_PAIN`, alert)                                                                                        |
| 3   | Pain note (shoulder / elbow / wrist / knee / generic) on an exercise without the rule | any                                         | ADD → HOLD (`PAIN`, alert)                                                                                                         |
| 4   | Lower back note                                                                       | any                                         | ADD → HOLD. On `top_backoff` lifts with rule `lowerBack`, the next prescription drops the back-off set (`LOWER_BACK`, alert)       |
| 5   | Fatigue note                                                                          | any                                         | ADD → HOLD (`FATIGUE`, warn)                                                                                                       |
| 6   | Form or cheating note, or a bad-form rep on a rule `form` exercise (glute raise)      | any                                         | ADD → HOLD (`FORM`, warn)                                                                                                          |
| 7   | Stall: `stallCount ≥ 3` and no override above has already dropped or swapped          | any                                         | **RESET**: weight × 0.9, floored to step. After 2 resets, the next stall gives **SWAP** (or "add a 3rd set" when there's no `alt`) |

**Progress and the stall counter**

- An exposure counts as progress if the weight went up, or the weight stayed the same and reps went up. `top_backoff` compares top-set reps; `double` compares total reps across both sets.
- Progress, or a weight drop, resets `stallCount` to 0. An exposure with no progress adds 1.
- Deload exposures are skipped entirely. They don't count, and they don't reset anything.
- In practice, 3 sessions in a row with no gain over the one before (about 18 days) trigger a reset.

**Regression** (`REGRESSED`): same or higher weight than last time, and top-set e1RM down by more than 5%. This feeds the rotation-level deload trigger.

---

## 5. Note flags

The patterns live in `noteFlags` in the config and are case-insensitive. Body-part flags need a pain word, so a cue like "keep left shoulder up" doesn't trigger the shoulder rule.

| Flag                                 | Pattern idea                                                               | Used by                             |
| ------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------- |
| `shoulder`, `elbow`, `wrist`, `knee` | body part + pain / hurt / sore / ache / tight / tweak / injur / limitation | overrides 1–3                       |
| `lowerBack`                          | "back" + pain words, or weak / pull                                        | override 4                          |
| `pain`                               | pain / hurt / injur / tweak                                                | override 3                          |
| `fatigue`                            | tired / tires / exhaust / not fresh / drained                              | override 5, rotation fatigue count  |
| `form`                               | cheat / bad form / not full ROM / sloppy                                   | override 6                          |
| `deload`                             | deload                                                                     | marks a deload exposure             |
| `myo`                                | myo                                                                        | info flag (set-count rules relaxed) |
| `cutShort`                           | cut off / no time / skipped                                                | info flag                           |

Patterns tested against your real notes: "Pain in shoulder" → shoulder, "Back off cuz lower back felt tight" → lowerBack, "Super tired" / "Tires" → fatigue, "Super heavy, have to cheat" → form, "Myo rep" → myo.

---

## 6. Session and rotation checks

**Per session (`SessionReview`)**

| Check                                         | Flag                                                    |
| --------------------------------------------- | ------------------------------------------------------- |
| No routine-name match, matched by exercises   | `NAME_MISMATCH` (info)                                  |
| No match at all                               | `UNPLANNED` (info). Excluded from the rotation order.   |
| Planned, non-optional exercise not logged     | `MISSING_EXERCISES` (warn)                              |
| Working sets > 14 (excluding optional calves) | `VOLUME_HIGH` (warn)                                    |
| All sets including optional > 16              | `VOLUME_HIGH_TOTAL` (warn)                              |
| Exercise not in the plan                      | `EXTRA_EXERCISES` (info). Its sets count toward volume. |
| RPE logged on N of M exercises                | `rpeLogged` / `rpeExpected` for a logging-quality badge |

**Rotation-aware missing check.** A slot counts as done if any session of the same rotation filled it. While the latest rotation is still open, unfilled slots are `NOT_YET_DONE` (info) instead of `MISSING_EXERCISES` (warn). The next-session plan marks a slot already done earlier this rotation as `doneEarlier` and carries in the slot it displaced on that day (`carriedFrom`): abductor done on Push A → adductor planned on Pull A.

**Switched exercise.** When the exercise logged in a slot changes (e.g. DB bench → incline DB), the progression comparison restarts (`SWITCHED`): no stall count or regression across different lifts.

**Per rotation (`RotationReview`)**: sessions done and missing, complete or not, deload or not, `regressedCompounds` (exercises with `compound: true`), `fatigueSignals` (fatigue notes + RPE overshoot/cap flags), and direct sets per primary muscle.

---

## 7. Program-level calls (`review.global`)

| Call                               | Rule                                                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `nextSession`                      | The session after the last planned one in `sessionOrder`.                                                                                                                                                                                                    |
| `restDayFirst` / `nextSessionDate` | If the last session was Pull A or Pull B, rest a day first (date + 2); otherwise date + 1.                                                                                                                                                                   |
| `deload.due`                       | Any of: (a) **scheduled**: 4 completed non-deload rotations since the last deload, so the 5th is a deload; (b) **≥ 2 compounds regressed** in the latest rotation; (c) **≥ 3 fatigue signals** in the latest rotation; (d) a deload rotation is in progress. |
| `deload.activeNow`                 | `true` when the next session should be run as a deload. That means the next session is Push A, or a deload rotation is already in progress. A trigger that fires mid-rotation waits for the next Push A.                                                     |
| Deload prescription                | `nextSessionPlan` returns 1 set per exercise at the current weight with RPE 7. Deload exposures are skipped when the review replays progression.                                                                                                             |
| `chest`                            | Rolling 7-day windows inside the program period. Counts days with ≥ 1 chest exercise (muscles `chest_mid` / `chest_upper`). Lists windows under 3.                                                                                                           |
| `schedule.longStreaks`             | More than 2 training days in a row, which breaks the 2-on/1-off pattern.                                                                                                                                                                                     |
| `schedule.longGaps`                | More than 2 rest days in a row.                                                                                                                                                                                                                              |
| `sizeCheckDue`                     | After every 4 completed rotations: prompt for a manual size check. If a muscle isn't growing while lifts move, add a 3rd set to its isolation. Size data isn't in the log, so this stays a prompt.                                                           |

---

## 8. Output shape

```
ProgramReview {
  programId, asOf, firstDate, lastDate,
  sessions: SessionReview[],           // one per workout in range
  rotations: RotationReview[],
  exercises: ExerciseReview[],         // one per program exercise
  global: { nextSession, nextSessionDate, restDayFirst,
            deload: { due, activeNow, reasons[], rotationsSinceDeload },
            sizeCheckDue, chest, schedule, flags[] }
}

ExerciseReview {
  exId, name, session, exposures, last,
  decision: 'START'|'ADD'|'HOLD'|'REDUCE'|'RESET'|'SWAP'|'DELOAD_DONE',
  reasons: string[],                   // plain-language "why"
  flags: { code, severity: 'info'|'warn'|'alert', message }[],
  stallCount, resets, confidence: 'high'|'low',
  next: { top?, backoff?, weight?, skipBackoff?, swapTo?, repRange, rpe,
          routineSets: { set, weight, reps: 0, targetReps }[] },   // drop-in routine prefill
  history: { date, rotation, decision, reasons, flags, progressed, stallCount, regressed }[]
}
```

`nextSessionPlan(review, program)` returns the next session's exercises with `sets` ready to write into the routine, the decision, reasons and flags. If `deload.activeNow` is true, it returns 1 set per exercise at RPE 7.

---

## 9. UI

**Built: More → Push·Pull Review** (`PushPullReview.jsx`), cycle by cycle. A
rotation picker (newest first) selects rotation N; `reviewRotation` reruns the
review with `asOf` = that rotation's last session date, so each rotation shows
the state as it stood then:

- Header: dates, sessions done, in progress / deload, missed sessions.
- Alerts and calls: `alert` flags from that rotation's exposures, plus `global.flags` (deload, chest, schedule, size check).
- Next session: name, date, rest-day badge, deload banner, each exercise's sets and decision chip.
- Sessions: working sets, RPE logged N/M, session flags.
- Exercises by session: the decision made in that rotation with its reasons and flags, stall dots (●●○), and the next prescription.
- Rotation checks: regressed compounds, fatigue signals, rotations since deload, chest days per 7, direct sets per muscle.

**Home next-session card** (`src/components/NextSessionCard.jsx`, helpers in `src/lib/review/pp21/nextSession.js`): replaces Home's Today card when nothing is logged today. It shows the session name, its date ("Today", or the planned date on a rest day with a rest-day banner) and a deload banner when `activeNow`. Each exercise shows its decision chip, the prescribed sets and the first reason. **Start** adds a workout named after the session's routine name, dated today. Weights come from `sets` (a `null` start weight shows "Pick a weight: reps @ RPE" and starts at 0 for the lifter to fill in), reps start blank with `targetReps` as the placeholder, exercises already done this rotation are left out, and optional ones are kept (shown as optional in the live session). Start stays available on a rest day.

**Not built yet** (from the original suggestions):

2. **Post-workout summary**: run the review after saving. Show what changed for each exercise logged today, plus any session flags.
3. **Exercise detail**: `history` as a timeline of decisions, with the stall counter shown as dots (●●○).
4. **Rotation strip**: one row per rotation with sessions done, regressed compounds and fatigue count.
5. **Alerts tray**: every `alert`-severity flag (pain, lower back) until the next exposure of that exercise.

Run the review on every save. It's pure and cheap: it replays at most a few hundred exposures.

---

## 10. Edge cases

| Case                                               | Handling                                                                                                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two workouts on one date                           | Both are kept, ordered by `id`. Each is matched to its own session.                                                                                                                 |
| Session done out of order                          | A new rotation starts whenever the order goes backwards. Doing Push B before Pull A puts that Pull A in a new rotation, so keep to the order.                                       |
| Exercise logged during a SWAP period               | The `alt` name isn't an alias, so it shows as `EXTRA_EXERCISES` and doesn't affect the original's progression. When the swap ends, the original resumes from its last prescription. |
| All reps `0`                                       | Not an exposure (unfilled routine).                                                                                                                                                 |
| RPE missing                                        | Decision from reps only, `confidence: low`.                                                                                                                                         |
| Myo-reps / extra sets                              | Only the first 2 working sets drive the decision. Extras are flagged.                                                                                                               |
| Weight change by the user against the prescription | The review evaluates what was actually lifted. A heavier weight that hits the range simply moves on.                                                                                |
| Config change (steps, rep/RPE targets)             | Takes effect for `START` and future steps. History replays with the current config.                                                                                                 |

---

## 11. Test coverage (`src/lib/review/pp21/engine.test.js`)

Bench top-set ADD after 3 exposures · warm-up detection · squat lower-back hold and skipped back-off · leg extension double progression · shoulder press REDUCE then SWAP · deadlift fatigue hold and regression · pull-up bodyweight back-off · lat pulldown stall → RESET to 60 kg · glute raise cheat blocks ADD · low-to-high fly RPE cap · preacher low confidence · unnamed workout matched by overlap · extra and missing exercises · 2 regressed compounds + scheduled 5th rotation → deload active · size check after 4 rotations · chest ≥ 3 per 7 days.
