# Cycle Review — Design

Port the `weekly-workout-review` Claude skill (Max 7/5/3 program analysis) into
the gym-tracker app as an in-app feature. The skill currently runs as a Python
parser plus LLM interpretation over an uploaded JSON backup. The app already
holds that data live, so we re-implement the deterministic engine in JS, replace
the LLM-authored prose with templated output, and render the review in-app with a
downloadable one-pager.

## Goals

- Review a completed training **cycle** against the program's rep-total targets,
  classify each exercise (progress / hold / deload / baseline), and produce the
  **next-cycle plan** as per-exercise weight deltas.
- Keep the app's invariants: **client-only, offline, no backend, no LLM, no new
  runtime libraries**, weights in kg, `loadLS`/`saveLS` for any storage.
- Make the program definition (Max 7/5/3 specifics) a **single swappable code
  module** so the program can be replaced without touching engine code.

## Non-goals

- No natural-language RPE parsing (the app stores structured RPE — see
  Adaptations). No free-form subjective-note interpretation.
- No "Open questions" section (explicitly dropped).
- No in-app editor for the program config (a code module is the agreed
  replacement mechanism).
- No restructuring of the program: exercise selection, set count, and rep
  targets are locked; only weights (and rare +1-rep target bumps) move.

## Decisions

| Topic | Decision |
| --- | --- |
| LLM-driven parts | Fully offline; prose generated from templates over structured results. |
| Program config | One documented JS module (`programs/max753.js`) behind a defined `ProgramConfig` shape. |
| Placement | A **More → Cycle Review** sub-screen (reuses MoreMenu's `view` sub-screen pattern). |
| Scope | Tonnage + bodyweight trends, templated wins/concerns, downloadable one-pager, cycle picker. |
| Download | In-app view **plus** a "Download" button that emits a self-contained HTML one-pager (Blob download). `window.print()` (Save as PDF) also available. |
| Plan grouping | Toggle: **By session** (workout name) or **By block** (from config `blocks`). |

## Architecture — three layers

### Layer 1 — Program definition (swappable)

`src/lib/review/programs/max753.js` exports a `ProgramConfig` object. This is the
*only* file that changes when the program changes. Shape (documented as the
engine's input contract):

```js
{
  id: "max753",
  name: "Max 7/5/3",
  cycle: { startDate: "2026-04-27", lengthDays: 8, expectedSessions: 6 },
  phases: [
    // chronological, non-overlapping; phaseForDate picks by date range
    { id: "cut",         from: "2026-04-27", to: "2026-05-23",
      bias: "conservative", bodyweight: { minPct: -0.7, maxPct: -0.4 } },
    { id: "maintenance", from: "2026-05-24", to: "2026-05-31",
      bias: "hold",         bodyweight: { minPct: -0.3, maxPct: 0.3 }, excludeFromAnalysis: true },
    { id: "lean-bulk",   from: "2026-06-01", to: "2026-07-26",
      bias: "normal",       bodyweight: { minPct: 0.25, maxPct: 0.5 } },
  ],
  buckets: [
    { target: 30, set5Floor: 4, label: "compound",  increment: 2.5 },
    { target: 50, set5Floor: 7, label: "mid",        increment: 2.5 },
    { target: 70, set5Floor: 10, label: "isolation", increment: 1.25 },
  ],
  tolerance: 2,          // +/-2 reps counts as HIT
  overshoot: 3,          // OVER if total >= target + 3
  deloadUndershoot: 7,   // severe UNDER if total <= target - 8
  special: {
    deadlift: {
      names: ["deadlift", "barbell deadlift", "conventional deadlift",
              "sumo deadlift", "trap bar deadlift"],
      nSets: 3, target: 15, set3Floor: 3, hitBand: 2, increment: 2.5,
    },
    // pullup transition rule (bodyweight -> weighted) lives here too
  },
  movementPatterns: { /* normalized name -> "quad" | "hinge" | ... */ },
  baselineExercises: { names: ["romanian deadlift", "rdl", "hammer curl",
                               "incline dumbbell bench press"], sessionsRequired: 3 },
  cautionExercises: {
    // front-delt tiers; each lists name matchers + override behavior
    strict:   { names: [/* shoulder press ... */], overshootMin: 5, maxIncrement: 2.5,
                discomfort: "deload" },
    moderate: { names: [/* incline bench/smith/db */], maxIncrement: 2.5, irregular: "hold",
                discomfort: "hold" },
    light:    { names: [/* flat bench, overhead triceps */], discomfort: "downgrade" },
  },
  injuryKeywords: ["shoulder", "pain", "discomfort", "tweak", "hurt"],
  blocks: [
    { id: "A", label: "Block A", sessions: ["Quads", "Push", "Pull"] },
    { id: "B", label: "Block B", sessions: ["Hamstrings", "Push", "Pull"] },
  ],
}
```

Helper predicates that need the config (e.g. `isDeadlift(name)`, `bucketFor`,
`cautionTierFor`) are pure functions in the engine that *take* the config — the
config stays plain data.

### Layer 2 — Pure analysis engine (`src/lib/review/`)

All deterministic, framework-free, each with a co-located `*.test.js`.

- **`cycles.js`** — cycle math (ports `m_week_*` / `phase_for_*`):
  `cycleForDate(config, d)`, `cycleDates(config, n)`, `phaseForDate(config, d)`,
  `phaseForCycle(config, n)` (majority-days, later-phase tie-break),
  `mostRecentCompletedCycle(config, workouts)`, `dayPhases(config, n)`.
- **`patterns.js`** — `cleanReps(reps) -> {cleaned, nPartials}`,
  `classifyPattern(reps, nSets) -> linear|flat|steep|irregular|incomplete`,
  `classifyStatus(total, target, config) -> HIT|OVER+n|UNDERn`,
  `closestTarget(total, config)`, `bucketFor(config, name, total)`.
- **`analyzeExercise.js`** — `analyzeExercise(config, ex, prior, history, date)`:
  weight + consistency, cleaned reps + partials, bucket/target/expected-sets,
  status, pattern, weak-final, prior-session comparison with not-comparable
  flags, session count + baseline state, movement pattern, and **RPE read from
  the structured `ex.rpe` field** (last-set proxy).
- **`decide.js`** — `decide(config, analysis, context) -> { action, newWeight,
  reason, flags }` where `action ∈ {PROGRESS, HOLD, DELOAD, BASELINE, REP_BUMP}`.
  Implements: the rep-status × pattern matrix; the 3-strike stall counter
  (consecutive HOLDs per exercise across cycles → escalate to DELOAD); the phase
  modifier (cut = conservative, bulk = normal, first-bulk re-calibration HOLD);
  front-delt caution overrides; the RPE modifier table; and feedback
  injury-keyword detection (→ DELOAD/HOLD/downgrade per caution tier).
- **`tonnage.js`** — `weeklySummary(workouts)` (tonnage, reps, pattern counts,
  pattern-quality %), `tonnageByPattern(workouts, config)`,
  `collectHistory(config, workouts, cycleN, nWindows)` (in-program 8-day cycles;
  pre-program rows labeled, no Δton).
- **`bodyweight.js`** — `cycleAverage(weightLogs, start, end)` and
  `evaluate(config, phase, deltaPct)` → on-target / too-fast / too-slow verdict.
- **`review.js`** — orchestrator
  `buildCycleReview(config, { workouts, weightLogs, exercises }, cycleNumber?)`
  → a single structured **`ReviewResult`** (below).
- **`narrative.js`** — `buildNarrative(result) -> { headline, wins[], concerns[],
  volumeVerdict }`, derived entirely from `ReviewResult`. Replaces the LLM.
  Concerns are ranked (injury-risk → plateau → execution) and capped at 3.

### `ReviewResult` shape (engine ↔ UI/narrative contract)

```js
{
  program: { id, name },
  cycle: { number, start, end, phase, dayPhases, straddles, partial },
  sessions: [{ date, dayInCycle, name, nExercises, nSets }],
  exercises: [ /* analyzeExercise output + decide output, in logged order */ ],
  tonnageTrend: [ /* per-window summary incl. deltaPct, phase, isInProgram */ ],
  bodyweight: { thisAvg, thisN, priorAvg, priorN, deltaKg, deltaPct, evaluation },
  byPattern: [{ pattern, thisTonnage, priorTonnage, delta }],
  plan: {
    bySession: [{ group: "Push", lines: [PlanLine] }],
    byBlock:   [{ group: "Block A", lines: [PlanLine] }],
  },
  narrative: { headline, wins, concerns, volumeVerdict },
  warnings: [ /* schema mismatch, no sessions, post-program, partial cycle */ ],
}
// PlanLine = { exercise, newWeight, action, badgeLabel, reason }
```

### Layer 3 — UI

- **`src/components/CycleReview.jsx`** — reads `workouts`, `weightLogs`,
  `exercises` from `useApp()`; imports the active `ProgramConfig`; calls
  `buildCycleReview`. Renders, in order: **cycle picker** (Segmented/select over
  available cycles, default = most recent completed) → headline → wins →
  concerns → **tonnage trend** table (pattern-quality %, Δton) → **bodyweight**
  vs phase target → **per-exercise analysis** table → **next-cycle plan** with a
  grouping toggle (By session | By block) and color-coded action badges. Empty/
  edge states render the relevant `warnings`.
- **Download** — `src/lib/review/onePager.js` builds a self-contained HTML
  string (ports `html-template.md`: inlined CSS, mobile-first, color-coded
  badges, static program-reference appendix) from `ReviewResult`; the component
  triggers a Blob download `cycle_NN_plan.html`. The same view supports
  `window.print()` for Save-as-PDF.
- **`src/components/MoreMenu.jsx`** — add a "Cycle Review" row under a new
  section (or Content) that sets `view === "cycleReview"`, mirroring the existing
  Notepad / Lift sources sub-screens.

Color tokens for badges reuse the skill's palette: PROGRESS green `#16a34a`,
HOLD amber `#d97706`, DELOAD red `#dc2626`, BASELINE gray `#6b7280` (as Tailwind
classes in-app; inlined hex in the downloadable HTML).

## Adaptations from the skill ("changes where necessary")

1. **RPE** — the app stores structured `rpe` (6–10, per exercise) and free-text
   `feedback`. Use `ex.rpe` directly as the last-set-RPE proxy and apply the RPE
   modifier table. **Drop** natural-language RPE parsing and the `--rpe` sidecar.
2. **Subjective notes** — use `ex.feedback`; an offline keyword scan
   (`config.injuryKeywords`) drives the caution rules, and feedback text is
   surfaced verbatim in concerns. No free-form interpretation.
3. **Input** — read live `AppContext` state; no JSON upload / schema-version
   gate (a `warnings` entry covers genuinely empty/odd data instead).
4. **Prose** — templated from `ReviewResult` (no LLM).
5. **Output** — in-app view + downloadable self-contained HTML one-pager (and
   print-to-PDF), instead of writing a file to `/mnt/user-data/outputs/`.
6. **Next-cycle plan** — derived from the reviewed cycle's actually-logged
   sessions, grouped By session by default and By block via `config.blocks`,
   instead of a hardcoded Block A/B template.
7. **Open questions** — section removed.

## Edge cases (surfaced as `warnings` or inline)

- No completed cycle / no sessions in the selected cycle → friendly empty state.
- Maintenance-majority cycle → excluded from analysis per phase rule; the picker
  still shows it but the body explains it's a travel/maintenance cycle.
- Partial cycle (< expected sessions) → flagged PARTIAL; excluded from Δton.
- Pre-program / post-program dates → labeled; post-program nudges the user to
  pick a continuation.
- Exercise with < `sessionsRequired` history (or in `baselineExercises`) →
  BASELINE badge, no progression.
- Incomplete exercise (fewer sets than expected) → flagged, treated as HOLD.

## Testing

Per the repo policy, every `src/lib/review/*.js` gets a co-located `*.test.js`
and `CycleReview.jsx` gets `CycleReview.test.jsx` (RTL). The skill's reference
docs provide ready-made fixtures, e.g.:

- Pattern: `18/16/14/12/10` linear, `8/8/8/8/7` flat, `8/5/4/3/2` steep,
  `12/10/10/8/10` irregular, `5/3/7` incomplete.
- Deadlift: `6/5/4`=15 HIT linear → PROGRESS; `5/3/7` irregular → HOLD+flag;
  `8/4/3` steep → HOLD; `7/6/5`=18 OVER+3 → PROGRESS.
- Status: OVER+3 / HIT (±2) / UNDER thresholds.
- Caution: shoulder press OVER+3 linear → HOLD (needs OVER+5); discomfort note →
  DELOAD.
- RPE modifier: last-set RPE 10 caps PROGRESS→HOLD; RPE ≤6 upgrades HOLD→PROGRESS.
- Phase: cut downgrades borderline PROGRESS→HOLD; bulk applies matrix as-is.

`npm run check` (lint + format + tests + build) must pass before pushing.

## File inventory

New:
- `src/lib/review/programs/max753.js`
- `src/lib/review/cycles.js` (+ test)
- `src/lib/review/patterns.js` (+ test)
- `src/lib/review/analyzeExercise.js` (+ test)
- `src/lib/review/decide.js` (+ test)
- `src/lib/review/tonnage.js` (+ test)
- `src/lib/review/bodyweight.js` (+ test)
- `src/lib/review/review.js` (+ test)
- `src/lib/review/narrative.js` (+ test)
- `src/lib/review/onePager.js` (+ test)
- `src/components/CycleReview.jsx` (+ test)

Changed:
- `src/components/MoreMenu.jsx` — add the Cycle Review sub-screen entry.
- Docs: `ARCHITECTURE.md` / `docs/DATA-MODEL.md` note the new feature (no new
  persisted keys — the review is computed on the fly).
```
