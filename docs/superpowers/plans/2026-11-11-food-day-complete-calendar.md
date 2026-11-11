# Food: Complete Days, Month Calendar, Trends Filter — Implementation Plan

**Status:** draft
**Date:** 2026-11-11
**Issue:** #168
**Handoffs:** `docs/superpowers/plans/2026-11-11-food-day-complete-calendar-handoffs.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user mark a food day complete, filter Trends by that mark, and open a month calendar of daily kcal from the daily tab header.

**Architecture:** One new stored list of local dates, `mgym.food.completedDays.v1`, owned by `FoodProvider` and carried in the backup `food` field. `weeklyIntake` gains a filter; a new pure `CalendarSheet` gets its data by props from `TodayView`.

**Tech Stack:** React 18, plain JSX, Tailwind classes, Vitest + React Testing Library. No new library.

**Spec:** `docs/superpowers/specs/2026-11-11-food-day-complete-calendar-design.md`

## Global Constraints

- No TypeScript, no CSS files, no new library. Never call `localStorage` directly; use `loadLS`/`saveLS`.
- Dates are local `YYYY-MM-DD` strings (`src/food/lib/localDate.js`); compare them as strings.
- UI copy, filter names, the filter order and the default filter are fixed by spec sections 2, 4.1 and 4.3. Copy them from the spec, not from this plan.
- The stored shape and every write rule are fixed by spec section 3.
- Each task runs only its focused test files (`npx vitest run <files>`). `npm run check` runs once per part, before the PR and again after a rebase.
- Each new or changed guard is mutation-checked by its implementer: the test must fail against the broken state, and the report says so.
- Commit messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Review Focus

1. Replace-import of a backup made before this change (no `completedDays` in `food`) empties the list; merge-import of the same file keeps it. Tests in Task 1.
2. A stored `mgym.food.completedDays.v1` that is not an array, or holds junk items, must not crash `/food`. Tests in Tasks 1 and 5.
3. A completed day whose entries were all deleted stays completed and counts as zeros in Trends and shows `0` in the calendar. Tests in Tasks 2 and 4.
4. Calendar grid for a month that starts on Sunday, one that starts on Monday, and February in a leap year. Tests in Task 3.
5. Trends opens on Complete for a user with entries and no marks: the chart area must explain itself, not look broken. Test in Task 7.

## Task 0: Smoke check of the backup import (S, done at planning)

The plan builds on `importFoodData` and `exportFoodData`. Run on 2026-11-11 on `main` at `7026f73`:
`npx vitest run src/food/lib/backupFood.test.js src/components/DataManagementMenu.test.jsx` → 2 files, 31 tests, all passed. The merge and replace paths work as `docs/DATA-MODEL.md` describes.

## Tasks

### Task 1: Stored list, shape rules and backup (L, certain)

L: new stored key and the backup envelope. Dispatch `opus55-implementer`; review `opus55-reviewer-deep`.

**Files:**

- Modify: `src/food/lib/keys.js`, `src/food/lib/normalize.js` (`normalizeFoodData` at line 195, `mergeFoodData` at line 238), `src/food/lib/backupFood.js`
- Modify: `docs/DATA-MODEL.md` (key table near line 26; a `completedDays` subsection under "Food tracker"; the backup JSON sample and rules near lines 421–461)
- Test: `src/food/lib/normalize.test.js`, `src/food/lib/backupFood.test.js`, `src/food/lib/keys.test.js`; fix exact-shape expectations in `src/components/DataManagementMenu.test.jsx` (line 194) if they fail

**Interfaces:**

- Consumes: `isRealDate(ymd)` from `src/food/lib/targets.js:5`; the `DATE_RE` constant in `normalize.js`.
- Produces:
  - `K_FOOD_COMPLETED = "mgym.food.completedDays.v1"` in `keys.js`
  - `normalizeCompletedDays(value) -> string[]` exported from `normalize.js`: valid dates only, no duplicates, sorted oldest first; a non-array gives `[]`
  - `normalizeFoodData(raw).completedDays` (uses the function above)
  - `mergeFoodData(current, incoming).completedDays = normalizeCompletedDays([...current, ...incoming])`. This drops an invalid stored item on merge, which differs from the other lists; the DATA-MODEL text says so.
  - `exportFoodData().completedDays`; `importFoodData` writes `K_FOOD_COMPLETED` in both modes

- [ ] **Step 1: Write failing tests**

`normalize.test.js`:

```js
it("normalizeCompletedDays keeps real dates once, sorted", () => {
  expect(
    normalizeCompletedDays([
      "2026-11-05",
      "2026-11-03",
      "2026-11-05",
      "2026-02-30",
      "5 Nov",
      7,
      null,
    ]),
  ).toEqual(["2026-11-03", "2026-11-05"]);
});
it("normalizeCompletedDays returns [] for a non-array", () => {
  expect(normalizeCompletedDays({ a: 1 })).toEqual([]);
  expect(normalizeCompletedDays(undefined)).toEqual([]);
});
it("mergeFoodData unions completedDays", () => {
  // current ["2026-11-01"], incoming ["2026-11-02", "2026-11-01"]
  // -> ["2026-11-01", "2026-11-02"]
});
```

`backupFood.test.js` (same helpers as the tests at lines 105–217):

- export returns the stored `completedDays`, and `[]` when the key holds a non-array
- replace with `food.completedDays: ["2026-11-02"]` over stored `["2026-11-01"]` → stored `["2026-11-02"]`
- replace with a `food` object that has no `completedDays` over stored `["2026-11-01"]` → stored `[]`
- merge with a `food` object that has no `completedDays` over stored `["2026-11-01"]` → stored `["2026-11-01"]`
- merge with `["2026-11-02"]` over stored `["2026-11-01"]` → both, sorted
- a backup with no `food` field leaves stored `["2026-11-01"]` in both modes

- [ ] **Step 2: Run** `npx vitest run src/food/lib/normalize.test.js src/food/lib/backupFood.test.js src/food/lib/keys.test.js` — expect the new tests to fail.
- [ ] **Step 3: Implement** the Produces list. Update existing exact-shape expectations that now include `completedDays: []`.
- [ ] **Step 4: Run** the same command plus `src/components/DataManagementMenu.test.jsx` — expect all to pass.
- [ ] **Step 5: Update `docs/DATA-MODEL.md`** from spec section 3: the key row, the shape rules, the six write rows, the JSON sample, and "five lists" wording that is now six.
- [ ] **Step 6: Commit** `feat(food): completedDays list in shape rules and backup (#168)`

### Task 2: Trends filter in `weeklyIntake` (S, certain)

**Files:** Modify `src/food/lib/trends.js` (`buildRow` line 17, `weeklyIntake` line 68). Test `src/food/lib/trends.test.js`.

**Interfaces:**

- Produces: `weeklyIntake(entries, weightLogs, { weeks, today, completedDays = [], filter = "all" })`. `filter` is `"all" | "complete" | "incomplete"`; which days count is the table in spec 4.3. Row shape is unchanged; `loggedDays` is now the number of counted days. The lib default stays `"all"` so existing callers and tests keep their numbers.
- With `weeks: null`, the first week is the week of the earliest entry date or completed date; with neither, the result is `[]`.

- [ ] **Step 1: Write failing tests** (fixed `today`, one week, entries of known kcal):
  - `complete`: a week with entries on Mon (2000 kcal, completed), Tue (1000 kcal, not completed) → `loggedDays` 1, `avg.kcal` 2000
  - `incomplete`: same week → `loggedDays` 1, `avg.kcal` 1000
  - `all`: same week plus Wed completed with no entries → `loggedDays` 3, `avg.kcal` 1000
  - `complete` with only a fasting day → `loggedDays` 1, `avg` all zeros (not `null`)
  - a filter that counts no day → `loggedDays` 0, `avg` `null`
  - `weeks: null`, no entries, one completed day three weeks back → 4 rows
  - `completedDays` not an array → treated as `[]`
  - no options given → same rows as before this task (existing tests untouched)
- [ ] **Step 2: Run** `npx vitest run src/food/lib/trends.test.js` — new tests fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** again — all pass.
- [ ] **Step 5: Commit** `feat(food): completed-day filter in weeklyIntake (#168)`

### Task 3: Calendar helpers (S, certain)

**Files:** Create `src/food/lib/calendar.js`, `src/food/lib/calendar.test.js`.

**Interfaces:**

- Consumes: `sumMacros` (`src/food/lib/macros.js:18`, returns integer `kcal`), `ymdFromDate` (`src/lib/date.js`).
- Produces:
  - `monthGrid(year, month) -> (string | null)[][]` — `month` is 0-based; each inner array is one Monday-first week of 7 items; a `YYYY-MM-DD` string inside the month, `null` outside it; no all-`null` week.
  - `dayTotals(entries) -> Map<string, number>` — date → that day's integer kcal; a non-array gives an empty Map.

- [ ] **Step 1: Write failing tests:**
  - `monthGrid(2026, 10)` (November 2026 starts on Sunday): first week is six `null` then `"2026-11-01"`; last item of the last week is `null` after `"2026-11-30"`; 6 weeks
  - `monthGrid(2026, 5)` (June 2026 starts on Monday): first item `"2026-06-01"`; 5 weeks
  - `monthGrid(2024, 1)`: contains `"2024-02-29"`; `monthGrid(2026, 1)` (starts Sunday, 28 days): 5 weeks, no `"2026-02-29"`
  - `dayTotals`: two entries on one date sum; a second date is separate; `dayTotals(null).size` is 0
- [ ] **Step 2: Run** `npx vitest run src/food/lib/calendar.test.js` — fails (module missing).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** again — passes.
- [ ] **Step 5: Commit** `feat(food): month grid and day totals helpers (#168)`

### Task 4: `CalendarSheet` (S, certain)

**Files:** Create `src/food/components/CalendarSheet.jsx`, `src/food/components/CalendarSheet.test.jsx`.

**Interfaces:**

- Consumes: `monthGrid`, `dayTotals` (Task 3); `localDateFromYmd`, `todayLocal` (`src/food/lib/localDate.js`); `Button` (`src/components/ui/Button`). Sheet markup follows `SlotMenu` in `src/food/components/TodayView.jsx:23-48`.
- Produces: `export default function CalendarSheet({ date, entries, completedDays, onPick, onClose })`. It does not read `useFood()`. `onPick(ymd)` is called on a day tap; the parent closes the sheet.

Fixed details (spec 4.2 has the behaviour):

- `role="dialog"`, `aria-modal="true"`, `aria-label="Calendar"`; a Close button.
- Month title via `toLocaleDateString(undefined, { month: "long", year: "numeric" })`; buttons with `aria-label` "Previous month" and "Next month".
- Weekday row: `M T W T F S S`.
- Each day is a `<button>` with `aria-label` built as `<ymd>`, then `, <kcal> kcal` when a number is shown, then `, completed` when marked. The shown `date` gets `aria-current="date"`.
- Completed cell classes: `bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100`.

- [ ] **Step 1: Write failing tests** (render with `date="2026-11-11"`, entries on 2026-11-05 totalling 1850 kcal, `completedDays=["2026-11-05","2026-11-06"]`):
  - button named `2026-11-05, 1850 kcal, completed` exists
  - button named `2026-11-06, 0 kcal, completed` exists (fasting day)
  - button named exactly `2026-11-07` exists and shows no kcal
  - the `2026-11-11` button has `aria-current="date"`
  - "Next month" then a button named `2026-12-01` exists; "Previous month" twice then `2026-10-01` exists
  - clicking `2026-11-07` calls `onPick("2026-11-07")`; Close calls `onClose`
- [ ] **Step 2: Run** `npx vitest run src/food/components/CalendarSheet.test.jsx` — fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** again — passes.
- [ ] **Step 5: Commit** `feat(food): month calendar sheet (#168)`

### Task 5: `completedDays` in `FoodProvider` (L, certain)

L: shared context state and a stored key. Dispatch `opus55-implementer`; review `opus55-reviewer-deep`.

**Files:** Modify `src/food/context/FoodContext.jsx` (`LIST_KEYS` line 19, provider line 91, `value` near line 236). Test `src/food/context/FoodContext.test.jsx`.

**Interfaces:**

- Consumes: `K_FOOD_COMPLETED`, `normalizeFoodData(raw).completedDays`, `normalizeCompletedDays` (Task 1); `useStoredList` (`FoodContext.jsx:53`). Adding the key to `LIST_KEYS` makes `loadLists` (line 32) load it through the shape rules and count its dropped items (loop at lines 38–43).
- Produces on the `useFood()` value: `completedDays: string[]` and `toggleDayComplete(date: string): void` — removes the date when present, adds it when absent, result through `normalizeCompletedDays`. It writes no other list.

- [ ] **Step 1: Write failing tests:**
  - starts as `[]` with nothing stored; starts as the stored list
  - `toggleDayComplete("2026-11-05")` then `("2026-11-03")` → `["2026-11-03","2026-11-05"]`, and `loadLS(K_FOOD_COMPLETED)` equals it
  - toggling `"2026-11-05"` again → `["2026-11-03"]`
  - two toggles of different dates in one `act` both land
  - `entries` is the same array reference before and after a toggle
  - stored `["2026-11-05","junk","2026-11-05"]` → `completedDays` `["2026-11-05"]`, `droppedRows` 2
  - stored `{}` (not an array) → `[]`, `droppedRows` 0, no throw
- [ ] **Step 2: Run** `npx vitest run src/food/context/FoodContext.test.jsx` — new tests fail.
- [ ] **Step 3: Implement.** Update the "five stored lists" comments.
- [ ] **Step 4: Run** again — all pass.
- [ ] **Step 5: Commit** `feat(food): completedDays and toggleDayComplete in FoodProvider (#168)`

### Task 6: Daily tab — Complete button and calendar entry (M, certain)

**Files:** Modify `src/food/components/TodayView.jsx` (header `h2` at line 82; after the `SLOTS.map` block). Test `src/food/components/TodayView.test.jsx`.

**Interfaces:**

- Consumes: `completedDays`, `toggleDayComplete` (Task 5); `CalendarSheet` (Task 4); `todayLocal`, `formatDayHeader`.

Fixed details (spec 4.1):

- The `h2` keeps the date text. Its content becomes a `<button>` with `aria-label` `Open calendar, <formatDayHeader(date)>`.
- Complete button: full width, after the last `MealSlot`. Text and toggle per spec 4.1; `aria-pressed` true when completed; completed style uses the same green classes as Task 4. Not rendered when `date > todayLocal()`.
- `CalendarSheet` gets `date`, `entries`, `completedDays`; `onPick` calls `onChangeDate(ymd)` and closes the sheet.

- [ ] **Step 1: Write failing tests** (use the file's existing render helper):
  - on today: button "Mark day complete" exists; click → text is the completed text from spec 4.1 and `aria-pressed="true"`; click again → back
  - with the date stored as completed → renders in the completed state
  - `date = addDays(todayLocal(), 1)` → no Complete button
  - `date = addDays(todayLocal(), -1)` → the button exists
  - deleting the day's only entry through the edit sheet keeps the completed state
  - clicking the header date button opens a dialog named "Calendar"; clicking a day calls `onChangeDate` with that date and the dialog is gone; Close removes the dialog without calling `onChangeDate`
- [ ] **Step 2: Run** `npx vitest run src/food/components/TodayView.test.jsx` — new tests fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** that file and `src/food/FoodApp.test.jsx` — all pass.
- [ ] **Step 5: Commit** `feat(food): mark day complete and open calendar from the daily tab (#168)`

### Task 7: Trends filter selector (S, certain)

**Files:** Modify `src/food/components/TrendsView.jsx`. Test `src/food/components/TrendsView.test.jsx`.

**Interfaces:**

- Consumes: `completedDays` (Task 5); `weeklyIntake` options (Task 2); `Segmented` as used at `TrendsView.jsx:94`.

Fixed details (spec 4.3): a third `Segmented` with the three filters in the spec's order, initial value `"complete"`. The "No food logged yet" line shows when there are no entries and no completed days. The no-completed-days line (copy in spec 4.3) shows when the filter is `"complete"`, every row has `loggedDays` 0, and the "No food logged yet" line is not showing.

- [ ] **Step 1: Write failing tests:**
  - entries this week on two days, one of them completed → on open the current week's Days cell reads `1/7`; choosing "All days" → `2/7`; choosing "Incomplete" → `1/7` with the other day's kcal
  - entries but no completed days → the no-completed-days line shows on open; choosing "All days" hides it
  - no entries and no completed days → "No food logged yet" shows and the no-completed-days line does not
  - no entries, one completed day this week → neither line shows; Days reads `1/7`; kcal reads `0`
  - existing tests that assert numbers select "All days" first
- [ ] **Step 2: Run** `npx vitest run src/food/components/TrendsView.test.jsx` — new tests fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** again — all pass.
- [ ] **Step 5: Commit** `feat(food): Complete / Incomplete / All days filter on Trends (#168)`

## Execution parts

| Part | Points                         | Certainty (task: failed item) | Orchestrator               | Needs | Wave | Critical path | Gate |
| ---- | ------------------------------ | ----------------------------- | -------------------------- | ----- | ---- | ------------- | ---- |
| A    | 7 (T1 L4, T2 S1, T3 S1, T4 S1) | certain (none failed)         | Opus 5.5, `fable-fallback` | —     | 1    | yes           | none |
| B    | 7 (T5 L4, T6 M2, T7 S1)        | certain (none failed)         | Opus 5.5, `fable-fallback` | A     | 2    | yes           | none |

Certainty item 5, read at planning on `main` `7026f73`: `normalizeFoodData` builds each list independently (`normalize.js:195-210`); `mergeFoodData` likewise (`normalize.js:238-254`); `importFoodData` saves each list by key (`backupFood.js:31-42`); `loadLists` counts drops per `LIST_KEYS` name (`FoodContext.jsx:32-45`); `useStoredList` saves on change and applies updates in order (`FoodContext.jsx:53-62`); `buildRow` groups entries by day and divides by the day count (`trends.js:17-43`). Each does what the tasks assume.

There is no user gate: the spec leaves no user-visible choice open.

### Part dependencies and parallel runs

| Part | Needs merged first | Consumes                                                                                                                  | Shares files with parts it does not need |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| A    | —                  | —                                                                                                                         | none                                     |
| B    | A                  | `K_FOOD_COMPLETED`, `normalizeCompletedDays`, `normalizeFoodData().completedDays`, `weeklyIntake` filter, `CalendarSheet` | none                                     |

```
A (T1, T2, T3, T4) ──► B (T5, T6, T7)
```

The parts run one after the other; nothing runs in parallel. Inside Part A, Tasks 1–4 touch separate files (Task 4 needs Task 3). After Part A merges, the app behaves as before for the user, except that a backup file carries an empty `completedDays` list.

### Part finish (every part)

1. `npm run check` once; rebase on `main`; `npm run check` again if the rebase changed anything.
2. A reviewer has read the part's final commit (`opus55-reviewer-deep` for the whole-branch pass).
3. PR via `superpowers:finishing-a-development-branch`. The user merges.
4. Append the part's handoff, with its cost lines, to the handoffs file. Part B's handoff also sets this plan and the spec to `shipped` and closes #168 with the merge SHA.
