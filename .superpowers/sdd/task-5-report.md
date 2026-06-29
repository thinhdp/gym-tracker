# Task 5 Report: Progression decision matrix + modifiers

## What was implemented

Created `src/lib/review/decide.js` containing the progression decision engine and its complete modifier system. This is the core logic for generating workout progression recommendations based on performance data.

### Core function: `decide(config, a, context = {})`

Consumes:

- `config`: program configuration (phases, caution exercises, feedback rules, baseline settings)
- `a`: Analysis object from Task 4's analyzeExercise (per-exercise performance data)
- `context`: runtime context (phase, stallCount, isFirstBulkSession)

Returns: Decision object with:

- `action`: one of "PROGRESS", "HOLD", "DELOAD", "BASELINE", "REP_BUMP"
- `newWeight`: calculated in kg, rounded to 0.5
- `increment`: the load increase amount (0 for non-progress actions)
- `reason`: explanatory string for the decision
- `badgeLabel`: UI badge text ("+Xkg", "HOLD", "DELOAD", "BASELINE", "+1 REP")
- `flags`: metadata array

### Architecture

The implementation follows a clear decision pipeline with precedence:

1. **Short-circuits** (evaluated first)
   - Baseline period: always BASELINE
   - Incomplete sessions: always HOLD
   - Abs exercises: special logic (rep-range model)

2. **Base matrix** (status x pattern)
   - OVER + linear/flat: PROGRESS
   - OVER + steep/irregular: HOLD
   - HIT + linear: PROGRESS (if strong final), HOLD (if weak final)
   - HIT + flat: PROGRESS (doubled increment)
   - HIT + steep/irregular: HOLD
   - UNDER severe (≤-8): DELOAD (-10%)
   - UNDER mild (-4 to -8): HOLD (linear), DELOAD (steep)

3. **Phase modifier**
   - First bulk session: force HOLD for recalibration
   - Cut phase (conservative bias): downgrade HIT-based PROGRESS to HOLD
   - (OVER-based progress always preserved regardless of phase)

4. **Front-delt caution** (strict tier only)
   - Shoulder Press and similar: requires OVER+5 clean linear, strong final to progress
   - Caps increment at 2.5 kg max
   - Blocks progress on steep/irregular patterns

5. **RPE modifier**
   - RPE 10: caps PROGRESS down to HOLD (at ceiling)
   - RPE 6-7: upgrades HOLD to PROGRESS on linear/flat only
   - Respects caution increment cap

6. **Feedback rules**
   - "felt heavy" / "tired": caps PROGRESS to HOLD
   - "pain" / "discomfort" on caution lifts: deload, hold, or downgrade per config

7. **Stall counter** (3-strike rule)
   - 3rd consecutive HOLD (stallCount >= 2): escalates to DELOAD (-10%)
   - Adds "3-strike" flag

### Test Coverage

**21 comprehensive tests** covering:

- Base matrix decisions across all status × pattern combinations
- Severe undershoot behavior
- BASELINE short-circuit
- Incomplete pattern short-circuit
- ABS rep-range model (all-top, in-range, below-range)
- Phase modifier cut phase behavior
- Front-delt caution eligibility and increment cap
- RPE modifiers (both capping and upgrading)
- Feedback keyword rules (fatigue, discomfort)
- Stall counter escalation

## TDD Process

### Step 1: Write failing test (RED)

```bash
$ npm run test -- src/lib/review/decide.test.js
[FAIL] Error: Failed to resolve import "./decide" from "src/lib/review/decide.test.js"
```

### Step 2: Implement (GREEN)

Created `decide.js` per brief specification.

### Step 3: Run test (PASS)

```bash
$ npm run test -- src/lib/review/decide.test.js
✓ src/lib/review/decide.test.js (21 tests) 4ms

Test Files  1 passed (1)
     Tests  21 passed (21)
```

### Step 4: Full suite verification

```bash
$ npm run test
Test Files  44 passed (44)
     Tests  351 passed (351)
```

All tests pass. No regressions.

### Step 5: Commit

```bash
git commit -m "feat(review): add progression decision matrix and modifiers"
```

## Files Changed

- **Created**: `src/lib/review/decide.js` (223 lines)
- **Created**: `src/lib/review/decide.test.js` (153 lines)

## Self-Review Findings

### Completeness ✓

All functionality from brief implemented faithfully. No omissions.

### Decision precedence ✓

Follows spec exactly: short-circuits → matrix → phase → caution → RPE → feedback → stall.

### Code quality ✓

- Plain JavaScript, no TypeScript
- No new dependencies
- Pure functions with clear responsibilities
- Weight calculations rounded to 0.5 kg per spec
- Badge label generation correct for all actions

### Test coverage ✓

21 tests covering all major paths and edge cases:

- Base matrix all branches
- All modifiers (phase, caution, RPE, feedback, stall)
- Short-circuit paths
- ABS special case

### YAGNI ✓

No speculative abstraction. No dead code. No gold-plating.

### Pristine output ✓

- Clean helper functions (statusNumber, badgeFor, finalize, cautionTier, feedbackHit, matrixAction, decideAbs)
- Consistent style with rest of codebase
- Clear comments marking decision pipeline stages

## Concerns

None. Implementation matches brief exactly. All tests pass. Full suite passes. Ready for merge.

## Commit Hash

78bbbe2 — feat(review): add progression decision matrix and modifiers

## Fix: conservatism guards

Four modifiers could silently downgrade a base DELOAD to HOLD, violating the
"conflicts resolve to the more conservative action" invariant. Each was guarded
with `if (action !== "DELOAD")` so a DELOAD is never overwritten by HOLD.

### Guards applied

1. Front-delt **strict** caution — steep/irregular branch
2. Front-delt **moderate** caution — irregular branch
3. **isFirstBulkSession** phase modifier
4. **Feedback** `discomfort === "hold"` branch

### Commands run

```bash
$ npx vitest run src/lib/review/decide.test.js
✓ src/lib/review/decide.test.js (26 tests) 5ms
Test Files  1 passed (1)
     Tests  26 passed (26)

$ npx vitest run
Test Files  44 passed (44)
     Tests  356 passed (356)
```

### Commit

dc05d6d — fix(review): never downgrade a DELOAD to HOLD via caution/recalibration/feedback

## Final-review fix: RPE conservatism guard

The RPE modifier (`rpe <= 7 && action === "HOLD"`) could upgrade a conservatism
HOLD back to PROGRESS, silently undoing five safety holds set by phase and
caution modifiers. Fixed by introducing a `conservativeHold` flag set in each of
the five conservatism branches; the RPE upgrade guard now also requires
`!conservativeHold`. Base-matrix HOLDs remain upgradable by RPE.

Also closed two trivial gaps:
- `onePager.test.js`: added test for `byBlock` grouping.
- `max753.js`: added comment that block `sessions` names must be lowercase.

### Commands run

```bash
$ npx vitest run src/lib/review/decide.test.js src/lib/review/onePager.test.js
✓ src/lib/review/onePager.test.js (4 tests) 17ms
✓ src/lib/review/decide.test.js (29 tests) 25ms
Test Files  2 passed (2)
     Tests  33 passed (33)

$ npm run check
> lint ✓
> format:check ✓ — All matched files use Prettier code style!
> test ✓ — 50 passed (50 files), 391 passed (391 tests)
> build ✓ — built in 13.81s
```

### Commit

13d774c — fix(review): stop RPE upgrade from undoing conservatism holds
