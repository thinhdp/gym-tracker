# PP21 Deload Rotation Implementation Plan

**Status:** draft
**Date:** 2026-11-23
**Issue:** #178
**Handoffs:** `docs/superpowers/plans/2026-11-23-pp21-deload-rotation-handoffs.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A workout that Start creates from a deload plan is named "<routine> (deload)", so the engine sees it as a deload and keeps the deload going for the whole rotation.

**Architecture:** One change in `workoutFromPlan`. Everything else (matching, deload marking, progression skip, rotation deload, counter reset) is existing engine behavior, listed with file and line in the spec's Design section.

**Tech Stack:** Vite 5 + React 18, plain JS, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-pp21-deload-rotation-design.md`

## Global Constraints

- Weights stay in kg; this change touches no weights.
- No new stored key or shape; `docs/DATA-MODEL.md` and the backup envelope do not change.
- No change to existing workouts, no migration (spec, Writes and shared state).
- The deload marker is exactly `` `${plan.routineName} (deload)` `` (spec, Design).

## Review Focus

1. The user renames a deload workout and removes "(deload)": the session counts as normal again. Intended (spec, Writes and shared state); no test.
2. The deload is due but not active ("Deload from the next Push A"): the plan's `deload` is false and the name has no marker. Pinned by Task 1 test (a), the `deload: false` case.
3. A deload session logged by hand, without Start, in the middle of a deload rotation: the half rule (`engine.js:998-999`) decides. Unchanged behavior, out of scope; no test.
4. The marker must not break session matching: the rotation test (b) fails if "Push A (deload)" stops matching Push A, because the rotation would never complete.
5. The deload session must not move progression: test (b) checks the top-set prescription for `bench` after the rotation equals the one before it.

---

## Task 1: Name deload workouts and pin the whole deload rotation

**Size:** M (2 points: `nextSession.js`, `nextSession.test.js`, `engine.test.js`; one lib area). **Certainty:** certain (all six items hold; mechanism lines are in the spec's Design section).

**Files:**

- Modify: `src/lib/review/pp21/nextSession.js:40-61` (`workoutFromPlan`)
- Test: `src/lib/review/pp21/nextSession.test.js`
- Test: `src/lib/review/pp21/engine.test.js`

**Interfaces:**

- Consumes: `nextSessionPlan(review, p)` returns `{ routineName, deload, exercises, ... }` (`engine.js:1187-1230`); `reviewProgram(data, p)` returns `{ global: { nextSessionDate, deload: { activeNow, rotationsSinceDeload } }, exercises, ... }`.
- Produces: `workoutFromPlan(plan, date)` unchanged signature; `name` is `` `${plan.routineName} (deload)` `` when `plan.deload` is true, else `plan.routineName`.

- [ ] **Step 1: Write the failing tests**

(a) In `nextSession.test.js`, `describe("workoutFromPlan")`: `it("marks a deload workout in its name")`. Build a plan with `nextSessionPlan(reviewProgram(fixture, pp21), pp21)` (the fixture ends with a deload active, see `engine.test.js` "prescribes 1 set per exercise at RPE 7 during a deload"); assert `workoutFromPlan(plan, "2026-11-21").name === "Push A (deload)"`. Then assert `workoutFromPlan({ ...plan, deload: false }, "2026-11-21").name === "Push A"`.

(b) In `engine.test.js`: `it("keeps the deload for the whole rotation started from the plan")`. Start from `fixture`. Four times: `review = reviewProgram(data, pp21)`; `plan = nextSessionPlan(review, pp21)`; assert `plan.deload === true`; build `w = workoutFromPlan(plan, review.global.nextSessionDate)`, fill every set's `reps` with its `targetReps`; append `w` to `data.workouts` (new object, do not mutate `fixture`). Record `bench`'s `next.top` from the first review. After the fourth session: assert `nextSessionPlan(...).deload === false`, `global.deload.rotationsSinceDeload === 0`, the last completed rotation has `deload === true` and four sessions, and `bench`'s `next.top` equals the recorded value.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/review/pp21/nextSession.test.js src/lib/review/pp21/engine.test.js`
Expected: (a) fails on the name ("Push A" instead of "Push A (deload)"); (b) fails at the second session's `plan.deload` assertion.

- [ ] **Step 3: Implement the name change in `workoutFromPlan`**

```js
name: plan.deload ? `${plan.routineName} (deload)` : plan.routineName,
```

Update the function's doc comment to say the deload marker is how the engine recognizes the session.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/review/pp21`
Expected: all pass, including existing `nextSession` and `engine` tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/pp21/nextSession.js src/lib/review/pp21/nextSession.test.js src/lib/review/pp21/engine.test.js
git commit -m "fix(pp21): mark Start-created deload workouts so the deload covers the rotation (#178)"
```

---

## Execution parts

One task, so one part. It is 2 points, under the 4-point floor; there is no neighbor to merge into, so it stays a part of its own.

| Part | Points | Certainty (task: failed item) | Orchestrator                                | Needs | Wave | Critical path | Gate |
| ---- | ------ | ----------------------------- | ------------------------------------------- | ----- | ---- | ------------- | ---- |
| A    | 2      | certain                       | Opus 5.5 (`fable-fallback`, plan-task mode) | —     | 1    | yes           | none |

**Dependencies:** Part A needs nothing merged first, consumes nothing from other parts, and shares no files with other parts.

**Chains:** `A` (single part).

**Parallel runs:** none; Part A is the only part. It edits existing files only.

**Run Part A:** worktree `.claude/worktrees/fix-178-deload-rotation` on branch `fix/178-deload-rotation` from fresh `main`. Pass Task 1 to the workflow as `{ task, planTask: { size: "M", has_test_signal: true, high_risk: false } }`; dispatch `sonnet55-fixer`, review with `opus55-reviewer`, final whole-branch pass with `opus55-reviewer-deep`. Then one `npm run check`, PR, and after merge: append the handoff with cost lines, set this plan and the spec to `shipped`, close #178 with the merge SHA.
