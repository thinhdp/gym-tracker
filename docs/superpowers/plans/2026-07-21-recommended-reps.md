# Recommended Reps & Routine Weight Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat a routine's reps as a _recommendation_ shown as a grey placeholder on the live screen rather than a pre-filled log, remove the now-redundant weight input from the routine editor, and fix a tap-target bug on the live workout screen.

**Architecture:** A new optional per-set field `targetReps` carries the routine's rep target into the instantiated workout, while `reps` starts at `0` for live-started routines only. Three presentational components gain optional, default-off props (`showWeight`, `repsPlaceholder`, `blankZero`) so every existing call site renders unchanged. No new libraries, no migration.

**Tech Stack:** Vite 5 + React 18, plain JS/JSX (no TypeScript), Tailwind (classes inline), Vitest + React Testing Library, all data in localStorage.

**Spec:** [docs/superpowers/specs/2026-07-21-recommended-reps-design.md](../specs/2026-07-21-recommended-reps-design.md)

## Global Constraints

Copied from `CLAUDE.md`. Every task's requirements implicitly include these.

- **Weights are stored in kg.** Convert only at the input/display boundary with `toDisplayWeight` / `fromDisplayWeight` (`src/lib/units.js`). No task here touches weight values — only weight _visibility_.
- **Never call `localStorage` directly** — use `loadLS` / `saveLS` from `src/lib/storage.js`.
- **Destructive actions** use the `useConfirm()` hook, not `window.confirm`.
- **No TypeScript, no CSS files** (Tailwind classes inline), **no new libraries**.
- New `src/lib` helpers require a co-located `*.test.js`; components with logic require a co-located `*.test.jsx` (React Testing Library).
- `npm run check` (lint + format check + tests + build) must pass before pushing — a husky pre-push hook enforces it.
- Run a single test file with `npm run test -- <path>`; a single test with `npm run test -- <path> -t "<name>"`.

## Decisions carried from the spec — do not "fix" these

Three things look like bugs but are deliberate. Leave them alone.

1. **`routineFromWorkout` is NOT changed.** Saving a session as a routine will zero the targets of skipped sets. Accepted knowingly.
2. **Planned workouts stay pre-filled.** Only `startRoutine` passes `zeroReps: true`. The two `WorkoutPlanner` call sites and `addWorkoutFromRoutine` keep the default.
3. **Cycle Review / tonnage engines are NOT adjusted.** Skipped sets now record `0` and analysis reads them as such. That is the intent.

## File Structure

| File                                            | Change                                                    | Task |
| ----------------------------------------------- | --------------------------------------------------------- | ---- |
| `src/components/LiveSession.jsx`                | Tap-target fix; pass `repsPlaceholder`                    | 1, 6 |
| `src/components/LiveSession.test.jsx`           | Tests for both                                            | 1, 6 |
| `src/lib/routines.js`                           | `instantiateRoutine` gains `zeroReps`, emits `targetReps` | 2    |
| `src/lib/routines.test.js`                      | Tests for both modes                                      | 2    |
| `src/context/AppContext.jsx`                    | `startRoutine` passes `zeroReps: true`                    | 3    |
| `src/context/AppContext.test.jsx`               | The test that actually pins the feature down              | 3    |
| `src/components/WeightRepInputs.jsx`            | `showWeight`, then `repsPlaceholder`                      | 4, 6 |
| `src/components/WorkoutExerciseEditor.jsx`      | `showWeight` + header grid collapse                       | 4    |
| `src/components/WorkoutExerciseEditor.test.jsx` | Tests                                                     | 4    |
| `src/components/RoutineEditor.jsx`              | Passes `showWeight={false}`                               | 4    |
| `src/components/NumberInputAutoClear.jsx`       | `blankZero`                                               | 5    |
| `src/components/NumberInputAutoClear.test.jsx`  | Tests                                                     | 5    |
| `src/lib/sets.js`                               | **New.** `normalizeSet` — one definition of the set shape | 7    |
| `src/lib/sets.test.js`                          | **New.** Tests                                            | 7    |
| `src/lib/backup.js`                             | `normalizeWorkout` uses `normalizeSet`                    | 7    |
| `src/lib/backup.test.js`                        | Tests                                                     | 7    |
| `src/components/WorkoutPlanner.jsx`             | `saveWorkout` uses `normalizeSet`                         | 7    |
| `docs/DATA-MODEL.md`                            | Document `targetReps`                                     | 7    |

`WeightRepInputs.jsx` has no co-located test file today and does not get one — it is a thin presentational wrapper with no state, and both new props are covered through its two consumers (`WorkoutExerciseEditor.test.jsx` in Task 4, `LiveSession.test.jsx` in Task 6). This is a deliberate reading of the testing policy, not an oversight.

Tasks 1 and 2 are independent of each other. Tasks 3–7 depend on the tasks before them as noted in each **Interfaces** block.

---

### Task 1: Fix the exercise-name tap target

The name button carries `flex-1`, so it stretches across the whole row and tapping the empty space beside the name still hits it, opening the past-workout modal.

**Files:**

- Modify: `src/components/LiveSession.jsx:340-347`
- Test: `src/components/LiveSession.test.jsx`

**Interfaces:**

- Consumes: nothing — fully independent of every other task.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe("LiveSession", ...)` block in `src/components/LiveSession.test.jsx`. The file already defines `seedAndRender()`; reuse it.

```jsx
it("sizes the exercise-name button to its text, not the whole row", () => {
  seedAndRender();
  // The nav chip's accessible name is "1. Bench", so an exact match on
  // "Bench" selects only the title button.
  const nameButton = screen.getByRole("button", { name: "Bench" });
  // flex-1 would stretch the button across the row, making the empty space
  // beside the name a live tap target for the history modal.
  expect(nameButton.className).not.toMatch(/\bflex-1\b/);
});

it("still opens past logs when the name itself is tapped", async () => {
  const user = userEvent.setup();
  seedAndRender();
  await user.click(screen.getByRole("button", { name: "Bench" }));
  // The modal excludes the in-progress workout, and it is the only one
  // seeded, so it opens on its empty state (ExerciseHistoryModal.jsx:52).
  expect(screen.getByText("No past workouts.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- src/components/LiveSession.test.jsx
```

Expected: the `flex-1` test FAILS (the class is present). The second test should already PASS — it is a regression guard for Step 3.

- [ ] **Step 3: Remove `flex-1` from the button**

In `src/components/LiveSession.jsx`, the button at line 340. Replace `min-w-0 flex-1 truncate` with `min-w-0 max-w-full truncate` in its `className`. The full attribute becomes:

```jsx
className =
  "min-w-0 max-w-full truncate text-left text-lg font-semibold text-neutral-900 underline decoration-dotted underline-offset-4 transition hover:text-blue-600 dark:text-neutral-100 dark:hover:text-blue-400";
```

Nothing else changes. The wrapper `<div>` at line 339 keeps its classes — it has only one child (the action buttons are a separate row at line 352), so `justify-between` is already inert there.

`max-w-full` preserves truncation for long names: flexbox clamps an item's automatic minimum size by its max-width.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test -- src/components/LiveSession.test.jsx
```

Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/components/LiveSession.jsx src/components/LiveSession.test.jsx
git commit -m "Fix exercise-name row opening past logs on empty-space taps"
```

---

### Task 2: `instantiateRoutine` gains `zeroReps` and emits `targetReps`

**Files:**

- Modify: `src/lib/routines.js:38-68`
- Test: `src/lib/routines.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces: `instantiateRoutine(routine, { date, exercises = [], zeroReps = false })`. Each emitted set is `{ set: number, weight: number, reps: number, targetReps: number }`. `targetReps` is always present and always equals the routine's stored `reps` for that set. `reps` is `0` when `zeroReps` is true, otherwise equals `targetReps`. Task 3 calls this with `zeroReps: true`; Task 6 reads `targetReps`.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe("instantiateRoutine", ...)` block in `src/lib/routines.test.js`. That block already defines the `routine` and `exercises` fixtures used below — Bench Press targets 8 reps with history at 62 kg, OHP targets 10 reps with no history.

```js
it("records the routine's reps as targetReps in both modes", () => {
  const prefilled = instantiateRoutine(routine, {
    date: "2026-06-17",
    exercises,
  });
  const zeroed = instantiateRoutine(routine, {
    date: "2026-06-17",
    exercises,
    zeroReps: true,
  });
  expect(prefilled.exercises[0].sets[0].targetReps).toBe(8);
  expect(zeroed.exercises[0].sets[0].targetReps).toBe(8);
  expect(zeroed.exercises[1].sets[0].targetReps).toBe(10);
});

it("zeroes reps when zeroReps is set, keeping the target intact", () => {
  const w = instantiateRoutine(routine, {
    date: "2026-06-17",
    exercises,
    zeroReps: true,
  });
  expect(w.exercises[0].sets[0].reps).toBe(0);
  expect(w.exercises[1].sets[0].reps).toBe(0);
});

it("still resolves weights normally when zeroReps is set", () => {
  const w = instantiateRoutine(routine, {
    date: "2026-06-17",
    exercises,
    zeroReps: true,
  });
  expect(w.exercises[0].sets[0].weight).toBe(62); // from history
  expect(w.exercises[1].sets[0].weight).toBe(35); // routine fallback
});
```

The existing `"preserves rep targets from routine"` test covers the default (`zeroReps` absent → `reps` unchanged). Leave it as is; it is now also the guard that the default stays `false`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- src/lib/routines.test.js
```

Expected: the two new `targetReps` / `zeroReps` tests FAIL with `expected undefined to be 8` and `expected 8 to be 0`. The weight test should already PASS.

- [ ] **Step 3: Implement**

In `src/lib/routines.js`, change the signature on line 38 and the set mapping on lines 57-62.

```js
export function instantiateRoutine(
  routine,
  { date, exercises = [], zeroReps = false },
) {
```

Replace the `sets:` mapping inside the returned exercise object with:

```js
        sets: (we.sets || []).map((s, idx) => {
          // The routine's stored reps are the *target*. Live sessions start at
          // zero so the number you see is the number you actually did.
          const targetReps = Number(s.reps) || 0;
          return {
            set: idx + 1,
            weight:
              historyWeight !== null ? historyWeight : Number(s.weight) || 0,
            reps: zeroReps ? 0 : targetReps,
            targetReps,
          };
        }),
```

Also update the JSDoc above the function (lines 28-37): after the sentence "Rep targets always come from the routine.", add:

```
 * Reps are pre-filled from the routine unless `zeroReps` is set, in which case
 * every set starts at 0 and the routine's number is carried as `targetReps`
 * for display as a recommendation.
```

and add the param line `@param {boolean} [ctx.zeroReps=false]` to the existing `@param` block.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test -- src/lib/routines.test.js
```

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routines.js src/lib/routines.test.js
git commit -m "Add zeroReps option and targetReps field to instantiateRoutine"
```

---

### Task 3: `startRoutine` zeroes reps

**This is the task the whole feature hangs on.** `zeroReps` defaults to `false`, so omitting the argument here reproduces today's behaviour exactly _and every other test in this plan still passes_. Nothing else pins it down. `startRoutine` has no test coverage today.

**Files:**

- Modify: `src/context/AppContext.jsx:92-103`
- Test: `src/context/AppContext.test.jsx`

**Interfaces:**

- Consumes: `instantiateRoutine(..., { zeroReps })` from Task 2.
- Produces: `startRoutine(id)` creates a workout whose sets all have `reps: 0` and a populated `targetReps`. Task 6 renders that workout.

- [ ] **Step 1: Write the failing test**

In `src/context/AppContext.test.jsx`, extend the storage import on line 4 to include `K_ROUTINES`:

```jsx
import { saveLS, loadLS, K_WO, K_UNIT, K_ROUTINES } from "../lib/storage";
```

Then append this new `describe` block at the end of the file:

```jsx
describe("startRoutine", () => {
  const routine = {
    id: "r1",
    name: "Push Day A",
    exercises: [
      {
        exerciseName: "Bench Press",
        sets: [
          { set: 1, weight: 55, reps: 10 },
          { set: 2, weight: 55, reps: 8 },
        ],
        rpe: null,
        feedback: "",
      },
    ],
    createdAt: 0,
    updatedAt: 0,
  };

  function renderWithRoutine() {
    saveLS(K_ROUTINES, [routine]);
    render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  }

  it("starts every set at zero reps", () => {
    renderWithRoutine();
    act(() => {
      captured.startRoutine("r1");
    });
    const w = captured.workouts[0];
    expect(w.exercises[0].sets.map((s) => s.reps)).toEqual([0, 0]);
  });

  it("carries the routine's reps through as targetReps", () => {
    renderWithRoutine();
    act(() => {
      captured.startRoutine("r1");
    });
    const w = captured.workouts[0];
    expect(w.exercises[0].sets.map((s) => s.targetReps)).toEqual([10, 8]);
  });

  it("leaves planned workouts pre-filled (addWorkoutFromRoutine)", () => {
    renderWithRoutine();
    let planned;
    act(() => {
      planned = captured.addWorkoutFromRoutine("r1", "2026-08-01");
    });
    // Deliberate asymmetry: only the live path zeroes reps.
    expect(planned.exercises[0].sets.map((s) => s.reps)).toEqual([10, 8]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- src/context/AppContext.test.jsx
```

Expected: the first test FAILS with `expected [10, 8] to deeply equal [0, 0]`. The second and third should already PASS (Task 2 populates `targetReps` on both paths).

- [ ] **Step 3: Implement**

In `src/context/AppContext.jsx`, in `startRoutine` (line 92), add `zeroReps: true` to the `instantiateRoutine` call:

```jsx
const w = instantiateRoutine(routine, {
  date: ymdFromDate(new Date()),
  exercises,
  // Live sessions start blank — the routine's reps become a recommendation.
  zeroReps: true,
});
```

Do **not** touch `addWorkoutFromRoutine` on line 108.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test -- src/context/AppContext.test.jsx
```

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add src/context/AppContext.jsx src/context/AppContext.test.jsx
git commit -m "Start live routine sessions with zero reps"
```

---

### Task 4: Hide the weight input in the routine editor

`instantiateRoutine` already overrides the routine's weight from workout history, so the editor's weight column is near-dead UI.

**Files:**

- Modify: `src/components/WeightRepInputs.jsx`
- Modify: `src/components/WorkoutExerciseEditor.jsx:105-112` (header) and `:126-143` (rows)
- Modify: `src/components/RoutineEditor.jsx:97-127`
- Test: `src/components/WorkoutExerciseEditor.test.jsx`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `WeightRepInputs` accepts `showWeight = true`; `WorkoutExerciseEditor` accepts `showWeight = true` and forwards it. Task 6 adds a second prop to `WeightRepInputs` alongside this one.

- [ ] **Step 1: Write the failing tests**

In `src/components/WorkoutExerciseEditor.test.jsx`, thread a `showWeight` prop through the existing `Harness` (line 9). Change its signature and the element it renders:

```jsx
function Harness({ initialSets, unit = "kg", spy, showWeight }) {
  const [item, setItem] = useState({
    exerciseName: "Bench Press",
    sets: initialSets,
  });
  return (
    <ConfirmProvider>
      <WorkoutExerciseEditor
        item={item}
        unit={unit}
        showWeight={showWeight}
        onChange={(patch) => {
          spy?.(patch);
          setItem((prev) => ({ ...prev, ...patch }));
        }}
        onRemove={() => {}}
      />
    </ConfirmProvider>
  );
}
```

Passing `showWeight={undefined}` by default lets the component's own default (`true`) apply, so every existing test keeps its current behaviour.

Then append these tests inside the existing `describe("WorkoutExerciseEditor", ...)` block:

```jsx
it("shows both weight and reps inputs by default", () => {
  render(<Harness initialSets={sets(1, 100, 5)} />);
  expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
  expect(screen.getByText("Weight (kg)")).toBeInTheDocument();
});

it("hides the weight input and its header when showWeight is false", () => {
  render(<Harness initialSets={sets(1, 100, 5)} showWeight={false} />);
  expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
  expect(screen.queryByText("Weight (kg)")).not.toBeInTheDocument();
  expect(screen.getByText("Reps")).toBeInTheDocument();
});

it("still edits reps when the weight input is hidden", async () => {
  const user = userEvent.setup();
  const spy = vi.fn();
  render(
    <Harness initialSets={sets(1, 100, 5)} showWeight={false} spy={spy} />,
  );
  // Only one spinbutton remains, and it must be reps — not weight.
  const [repsInput] = screen.getAllByRole("spinbutton");
  await user.clear(repsInput);
  await user.type(repsInput, "12");
  const lastPatch = spy.mock.calls.at(-1)[0];
  expect(lastPatch.sets[0].reps).toBe(12);
  expect(lastPatch.sets[0].weight).toBe(100); // untouched
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- src/components/WorkoutExerciseEditor.test.jsx
```

Expected: the two `showWeight={false}` tests FAIL (`expected length 2 to be 1`). The default test should already PASS.

- [ ] **Step 3: Implement `WeightRepInputs`**

Replace the whole body of `src/components/WeightRepInputs.jsx` below the JSDoc. Add `showWeight` to the props list and to the doc comment's prop list:

```jsx
export default function WeightRepInputs({
  weight,
  reps,
  onWeightChange,
  onRepsChange,
  showWeight = true,
}) {
  return (
    <div
      className={`flex-1 grid gap-3 ${showWeight ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {showWeight && (
        <div className="flex items-center gap-2">
          <NumberInputAutoClear
            step="0.5"
            min="0"
            className="border rounded-xl px-3 py-1.5 text-sm w-16 bg-white dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            valueNumber={weight}
            onNumberChange={onWeightChange}
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <NumberInputAutoClear
          step="1"
          min="0"
          className="border rounded-xl px-3 py-1.5 text-sm w-16 bg-white dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          valueNumber={reps}
          onNumberChange={onRepsChange}
        />
      </div>
    </div>
  );
}
```

Add to the JSDoc prop list: `*   - showWeight: when false, renders reps only (routine editor)`.

- [ ] **Step 4: Implement `WorkoutExerciseEditor`**

Add `showWeight = true` to the destructured props (after `recommendRep` on line 21).

Replace the header row's inner wrapper (lines 107-110). **Both** changes are required — dropping the cell alone would leave "Reps" in the left half of a two-column grid while the single-column row below spans full width:

```jsx
<div
  className={`flex-1 grid gap-3 ${showWeight ? "grid-cols-2" : "grid-cols-1"}`}
>
  {showWeight && <div>Weight ({unit})</div>}
  <div>Reps</div>
</div>
```

Then forward the prop to `WeightRepInputs` (line 126) by adding one line to its props:

```jsx
            <WeightRepInputs
              showWeight={showWeight}
              weight={toDisplayWeight(s.weight, unit)}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run test -- src/components/WorkoutExerciseEditor.test.jsx
```

Expected: PASS, all tests in the file.

- [ ] **Step 6: Wire up `RoutineEditor`**

In `src/components/RoutineEditor.jsx`, add one prop to the `WorkoutExerciseEditor` element (line 97):

```jsx
            <WorkoutExerciseEditor
              key={it.exerciseName}
              item={it}
              unit={unit}
              showWeight={false}
              recommendRep={rec}
```

Leave `handleSave` untouched — it still persists `weight` from each item, preserving whatever the routine already stored as the no-history fallback.

Do **not** touch `WorkoutPlanner.jsx`'s use of `WorkoutExerciseEditor`; planned workouts keep their weight inputs.

- [ ] **Step 7: Verify nothing else regressed**

```bash
npm run test
```

Expected: PASS. `WorkoutPlanner` and `WorkoutHistoryItem` render `WeightRepInputs` without `showWeight`, so they take the `true` default and are unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/components/WeightRepInputs.jsx src/components/WorkoutExerciseEditor.jsx src/components/WorkoutExerciseEditor.test.jsx src/components/RoutineEditor.jsx
git commit -m "Hide the weight input in the routine editor"
```

---

### Task 5: `NumberInputAutoClear` gains `blankZero`

Today the component blanks a displayed `0` only _while focused_. An unlogged set therefore renders a literal `0` that would sit on top of any placeholder. `blankZero` is what makes a placeholder hint possible at all.

**Files:**

- Modify: `src/components/NumberInputAutoClear.jsx`
- Test: `src/components/NumberInputAutoClear.test.jsx`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `NumberInputAutoClear` accepts `blankZero = false`. When `true`, a `valueNumber` of `0`, `"0"`, `""`, or `null`/`undefined` renders as `""` regardless of focus, so `placeholder` shows through. Task 6 passes it.

- [ ] **Step 1: Write the failing tests**

In `src/components/NumberInputAutoClear.test.jsx`, thread two props through the existing `Harness` (line 7):

```jsx
function Harness({ initial = 0, spy, blankZero, placeholder }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberInputAutoClear
      valueNumber={value}
      blankZero={blankZero}
      placeholder={placeholder}
      onNumberChange={(n) => {
        spy?.(n);
        setValue(n);
      }}
    />
  );
}
```

`placeholder={undefined}` lets the component's own `"0"` default apply, so existing tests are unaffected.

Append these tests inside the existing `describe` block:

```jsx
it("renders an empty input for 0 while unfocused when blankZero is set", () => {
  render(<Harness initial={0} blankZero placeholder="10" />);
  const input = screen.getByRole("spinbutton");
  expect(input).toHaveValue(null); // empty, without needing focus
  expect(input).toHaveAttribute("placeholder", "10");
});

it("shows a non-zero value normally even with blankZero", () => {
  render(<Harness initial={7} blankZero placeholder="10" />);
  expect(screen.getByRole("spinbutton")).toHaveValue(7);
});

it("still reports typed values through onNumberChange with blankZero", async () => {
  const user = userEvent.setup();
  const spy = vi.fn();
  render(<Harness initial={0} blankZero placeholder="10" spy={spy} />);
  const input = screen.getByRole("spinbutton");
  await user.type(input, "9");
  expect(spy).toHaveBeenLastCalledWith(9);
  expect(input).toHaveValue(9);
});
```

The pre-existing test `"shows the value initially"` (asserting `0` renders as `0` without `blankZero`) is the guard that every current call site is unaffected. Leave it.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- src/components/NumberInputAutoClear.test.jsx
```

Expected: the first new test FAILS with `expected element to have value null, but got 0`.

- [ ] **Step 3: Implement**

In `src/components/NumberInputAutoClear.jsx`, add `blankZero = false` to the props (after `className`), and replace the `display` computation on lines 14-21:

```jsx
const [clear, setClear] = useState(false);
const isZero =
  valueNumber === 0 ||
  valueNumber === "0" ||
  valueNumber === "" ||
  valueNumber == null;
// `clear` blanks a zero only while focused; `blankZero` blanks it always, so
// a placeholder (e.g. a recommended rep count) can show through.
const display = (clear || blankZero) && isZero ? "" : valueNumber;
```

Update the component's doc comment (line 4) to:

```jsx
/**
 * Clears the default 0 on mobile when focusing a number input.
 * With `blankZero`, a zero value renders empty even unfocused, so the
 * `placeholder` is visible as a hint.
 */
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test -- src/components/NumberInputAutoClear.test.jsx
```

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add src/components/NumberInputAutoClear.jsx src/components/NumberInputAutoClear.test.jsx
git commit -m "Add blankZero to NumberInputAutoClear so placeholders show through"
```

---

### Task 6: Show the recommended reps as a grey placeholder

**Files:**

- Modify: `src/components/WeightRepInputs.jsx`
- Modify: `src/components/LiveSession.jsx:438-449`
- Test: `src/components/LiveSession.test.jsx`

**Interfaces:**

- Consumes: `showWeight` on `WeightRepInputs` (Task 4); `blankZero` on `NumberInputAutoClear` (Task 5); `targetReps` on sets (Tasks 2 and 3).
- Produces: `WeightRepInputs` accepts `repsPlaceholder` (a string, or null/undefined for none).

- [ ] **Step 1: Write the failing tests**

In `src/components/LiveSession.test.jsx`, add a seed helper next to the existing `seedAndRender` / `seedTwo` helpers:

```jsx
function seedWithTargets() {
  saveLS(K_WO, [
    {
      id: "w3",
      date: "2026-06-13",
      name: "Push Day",
      exercises: [
        {
          exerciseName: "Bench",
          sets: [
            { set: 1, weight: 80, reps: 0, targetReps: 10 },
            { set: 2, weight: 80, reps: 0 }, // no target
          ],
        },
      ],
    },
  ]);
  saveLS(K_SESSION, { workoutId: "w3", startedAt: Date.now(), currentIdx: 0 });
  return renderLive();
}
```

Then append these tests inside the existing `describe("LiveSession", ...)` block:

```jsx
it("shows the routine's target as a placeholder on an unlogged set", () => {
  seedWithTargets();
  // Order per row: weight, reps. Row 1 is the set with a target.
  const [, firstReps] = screen.getAllByRole("spinbutton");
  expect(firstReps).toHaveValue(null); // empty, not a literal 0
  expect(firstReps).toHaveAttribute("placeholder", "10");
});

it("falls back to a 0 placeholder when a set has no target", () => {
  seedWithTargets();
  const inputs = screen.getAllByRole("spinbutton");
  const secondReps = inputs[3]; // row 2: weight, reps
  expect(secondReps).toHaveAttribute("placeholder", "0");
});

it("counts no sets as logged until reps are typed", async () => {
  const user = userEvent.setup();
  seedWithTargets();
  expect(screen.getByText(/0\/2 sets/)).toBeInTheDocument();

  const [, firstReps] = screen.getAllByRole("spinbutton");
  await user.type(firstReps, "9");

  expect(screen.getByText(/1\/2 sets/)).toBeInTheDocument();
  expect(firstReps).toHaveValue(9);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- src/components/LiveSession.test.jsx
```

Expected: the first test FAILS — the input renders `0` and carries the default `placeholder="0"` rather than `"10"`.

- [ ] **Step 3: Implement `WeightRepInputs`**

Add `repsPlaceholder` to the props (after `showWeight`) and to the JSDoc prop list, then apply it to the reps input only:

```jsx
<NumberInputAutoClear
  step="1"
  min="0"
  className="border rounded-xl px-3 py-1.5 text-sm w-16 bg-white dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
  placeholder={repsPlaceholder || "0"}
  blankZero={Boolean(repsPlaceholder)}
  valueNumber={reps}
  onNumberChange={onRepsChange}
/>
```

The weight input is untouched and never receives `blankZero`.

JSDoc line to add: `*   - repsPlaceholder: grey hint shown in the reps box while the set is unlogged`.

- [ ] **Step 4: Implement `LiveSession`**

In `src/components/LiveSession.jsx`, add one prop to the `WeightRepInputs` element at line 438:

```jsx
                    <WeightRepInputs
                      weight={toDisplayWeight(s.weight, unit)}
                      reps={s.reps}
                      repsPlaceholder={
                        s.targetReps > 0 ? String(s.targetReps) : null
                      }
```

Leave `addSet` (line 125) alone — a manually added set has no target and correctly gets the plain `0` placeholder.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run test -- src/components/LiveSession.test.jsx
```

Expected: PASS, all tests in the file — including the pre-existing ones that seed sets _with_ reps and assert they read as logged.

- [ ] **Step 6: Commit**

```bash
git add src/components/WeightRepInputs.jsx src/components/LiveSession.jsx src/components/LiveSession.test.jsx
git commit -m "Show recommended reps as a grey placeholder on the live screen"
```

---

### Task 7: Persist `targetReps` through import and planning, and document it

Both `normalizeWorkout` and `WorkoutPlanner.saveWorkout` rebuild sets as exactly `{ set, weight, reps }`, silently dropping the new field. Without this, a merge-import would erase hints from an in-progress workout, the two plan routes would disagree with each other, and `docs/DATA-MODEL.md` would document a field its own import path discards.

Both call sites need the identical normalisation, so it lives in one helper
rather than being duplicated. This was decided before execution: the set shape
gets one home now that it has grown a field.

**Files:**

- Create: `src/lib/sets.js`
- Create: `src/lib/sets.test.js`
- Modify: `src/lib/backup.js:45-49`
- Modify: `src/components/WorkoutPlanner.jsx:70-75`
- Modify: `docs/DATA-MODEL.md:106-114`
- Test: `src/lib/backup.test.js`, `src/lib/sets.test.js`

**Interfaces:**

- Consumes: the `targetReps` set field from Task 2.
- Produces: `normalizeSet(raw, index)` from `src/lib/sets.js`, returning
  `{ set: index + 1, weight: number, reps: number }` plus `targetReps: number`
  only when the input's `targetReps` is a positive number. Tolerates `null` /
  `undefined` / missing fields on `raw`.

- [ ] **Step 1: Write the failing helper tests**

Create `src/lib/sets.test.js`:

```js
import { normalizeSet } from "./sets";

describe("normalizeSet", () => {
  it("numbers the set from its index and coerces weight and reps", () => {
    expect(normalizeSet({ weight: "60", reps: "8" }, 0)).toEqual({
      set: 1,
      weight: 60,
      reps: 8,
    });
  });

  it("defaults missing or unparseable fields to 0", () => {
    expect(normalizeSet({}, 2)).toEqual({ set: 3, weight: 0, reps: 0 });
    expect(normalizeSet({ weight: "abc", reps: null }, 0)).toEqual({
      set: 1,
      weight: 0,
      reps: 0,
    });
  });

  it("tolerates a null or undefined raw set", () => {
    expect(normalizeSet(null, 0)).toEqual({ set: 1, weight: 0, reps: 0 });
    expect(normalizeSet(undefined, 1)).toEqual({ set: 2, weight: 0, reps: 0 });
  });

  it("carries a positive targetReps through", () => {
    expect(normalizeSet({ weight: 60, reps: 0, targetReps: 10 }, 0)).toEqual({
      set: 1,
      weight: 60,
      reps: 0,
      targetReps: 10,
    });
  });

  it("omits targetReps when absent or non-positive", () => {
    expect(normalizeSet({ weight: 60, reps: 8 }, 0)).not.toHaveProperty(
      "targetReps",
    );
    expect(
      normalizeSet({ weight: 60, reps: 8, targetReps: 0 }, 0),
    ).not.toHaveProperty("targetReps");
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

```bash
npm run test -- src/lib/sets.test.js
```

Expected: FAIL — `Failed to resolve import "./sets"`.

- [ ] **Step 3: Create the helper**

Create `src/lib/sets.js`:

```js
/**
 * Normalise one raw set into the stored Set shape.
 *
 * Shared by every path that rebuilds sets from untrusted or re-mapped data
 * (backup import, the workout planner) so the shape has a single definition.
 *
 * `targetReps` is optional: it is carried only when positive, never written as
 * 0, so sets that never had a rep target round-trip unchanged.
 *
 * @param {object|null|undefined} raw  a set-like object
 * @param {number} index               0-based position; becomes 1-based `set`
 * @returns {{set: number, weight: number, reps: number, targetReps?: number}}
 */
export function normalizeSet(raw, index) {
  const set = {
    set: index + 1,
    weight: Number(raw?.weight) || 0,
    reps: Number(raw?.reps) || 0,
  };
  const targetReps = Number(raw?.targetReps) || 0;
  if (targetReps > 0) set.targetReps = targetReps;
  return set;
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

```bash
npm run test -- src/lib/sets.test.js
```

Expected: PASS, all five tests.

- [ ] **Step 5: Commit the helper**

```bash
git add src/lib/sets.js src/lib/sets.test.js
git commit -m "Add normalizeSet helper as the single definition of the set shape"
```

- [ ] **Step 6: Write the failing normalizeWorkout tests**

Append inside the existing `describe("normalizeWorkout", ...)` block in `src/lib/backup.test.js`:

```js
it("preserves targetReps when present", () => {
  const w = normalizeWorkout({
    date: "2026-06-01",
    exercises: [
      {
        exerciseName: "Bench",
        sets: [{ weight: 60, reps: 0, targetReps: 10 }],
      },
    ],
  });
  expect(w.exercises[0].sets[0].targetReps).toBe(10);
});

it("omits targetReps when absent or zero", () => {
  const w = normalizeWorkout({
    date: "2026-06-01",
    exercises: [
      {
        exerciseName: "Bench",
        sets: [
          { weight: 60, reps: 8 },
          { weight: 60, reps: 8, targetReps: 0 },
        ],
      },
    ],
  });
  expect(w.exercises[0].sets[0]).not.toHaveProperty("targetReps");
  expect(w.exercises[0].sets[1]).not.toHaveProperty("targetReps");
});
```

- [ ] **Step 7: Run the tests to verify they fail**

```bash
npm run test -- src/lib/backup.test.js
```

Expected: the first test FAILS with `expected undefined to be 10`. The second should already PASS.

- [ ] **Step 8: Use the helper in `normalizeWorkout`**

In `src/lib/backup.js`, add the import alongside the existing ones at the top:

```js
import { normalizeSet } from "./sets";
```

Then replace the `sets` mapping on lines 45-49 with a call to it:

```js
const sets = setsRaw.slice(0, MAX_SETS).map(normalizeSet);
```

`Array.prototype.map` passes `(element, index)`, which is exactly
`normalizeSet`'s signature. The `sets.length ? sets : [{ set: 1, weight: 0, reps: 0 }]`
fallback below it is unchanged.

- [ ] **Step 9: Run the tests to verify they pass**

```bash
npm run test -- src/lib/backup.test.js
```

Expected: PASS, all tests in the file — including the pre-existing ones covering
`MAX_SETS` truncation, renumbering, and coercion of junk values, which now
exercise the shared helper.

- [ ] **Step 10: Use the helper in `WorkoutPlanner` too**

In `src/components/WorkoutPlanner.jsx`, add the import:

```jsx
import { normalizeSet } from "../lib/sets";
```

Then replace the `sets` mapping inside `saveWorkout` (lines 70-75):

```jsx
        sets: i.sets.slice(0, MAX_SETS).map(normalizeSet),
```

This aligns it with `addWorkoutFromRoutine`, which stores the instantiated workout verbatim and already keeps the field.

- [ ] **Step 11: Document the field**

In `docs/DATA-MODEL.md`, add a row to the `Set` table (after the `reps` row on line 114):

```markdown
| `targetReps` | `number?` | Recommended reps from the routine; shown as a grey placeholder while the set is unlogged. Absent on manually added sets and on workouts saved before this field existed. | absent |
```

Then update the `sets` example on line 92 to show the field:

```markdown
| `sets` | `Set[]` | Sets performed; 1–`MAX_SETS` (10) entries. | `[{ set:1, weight:0, reps:0 }]` |
```

leave that default cell as is (a bare set genuinely has no `targetReps`), and instead append this sentence below the `Set` table, before "Constraints enforced in code:":

```markdown
`targetReps` is written by `instantiateRoutine` from the routine's stored reps.
A live-started routine session sets `reps: 0` and relies on `targetReps` for the
placeholder; a _planned_ workout keeps its reps pre-filled, so the placeholder
never surfaces there. See `docs/superpowers/specs/2026-07-21-recommended-reps-design.md`.
```

Also update line 147's note — it currently reads that a set is logged once it has `reps > 0`. Append to that paragraph:

```markdown
Sets instantiated from a routine into a live session start at `reps: 0` and so
read as unlogged until you enter what you actually did; their `targetReps` is
display-only and never counts toward logged volume.
```

- [ ] **Step 12: Run the full gate**

```bash
npm run check
```

Expected: PASS — lint, format check, all tests, and build. If the format check fails, run `npm run format` and re-run.

- [ ] **Step 13: Commit**

```bash
git add src/lib/backup.js src/lib/backup.test.js src/components/WorkoutPlanner.jsx docs/DATA-MODEL.md
git commit -m "Preserve targetReps through import and planning, document the field"
```

---

## Final verification

- [ ] **Run the full gate one more time**

```bash
npm run check
```

- [ ] **Manual smoke check** (from the spec — `npm run dev`, http://localhost:5173)

1. Routine tab → edit a routine: no weight inputs, reps still editable, header reads just "Reps" and lines up with the input below, save works.
2. Routine tab → ▶ Start: every set's reps box is empty and unticked, showing the routine's target as a grey placeholder. Typing a number replaces it and ticks the set.
3. Weights are pre-filled from the last workout for exercises with history.
4. On the live screen, tap the blank area right of the exercise name — nothing happens. Tap the name — the past-logs modal opens.
5. Routine tab → Plan a routine for a future date, then start it: reps are still pre-filled (expected, unchanged — see Decisions).
6. An exercise with no logged history shows weight `0` on start and cannot be pre-set (expected — accepted loss).
7. Start a routine, log some sets, skip others, tap "Save as routine": the new routine has `0` targets for the skipped sets (expected — accepted loss).
