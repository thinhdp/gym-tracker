# Food Tracker Plan Handoffs

**Status:** in progress
**Date:** 2026-11-03

Handoffs for `2026-11-02-food-tracker.md` from Part D on (CLAUDE.md, Execution part sizing). Parts A and B are still appended to the plan file.

## Part D handoff

**Shipped:** Task 4, commits `a40aa14` (client, fixture, cache, DATA-MODEL section) and `71d09e6` (review fixes). New files under `src/food/lib`: `foodApi`, `foodApiFixture`, `searchCache`, each with a test (40 tests). Issue #89 closes with this PR. `npm run check` passed once before the PR; main had not moved, so no rebase was needed.

**Cost:** Fable orchestrator 78 k output tokens over 56 turns (7.8 M cache reads, 0.5 M cache writes); Opus 5.5 subagents 124 k output tokens over 95 turns (4.8 M cache reads, 0.46 M cache writes) across one implementer (two runs), one deep reviewer and one re-reviewer; 259 k subagent tokens as the harness counts them. 1 fix round, 1 advisor round before dispatch and 1 before the PR, about 25 minutes wall time to the PR.

**The uncertain item is settled.** Under Vitest with jsdom on Node 24, `AbortSignal.any` and `AbortSignal.timeout` exist and combine (a probe test showed a `TimeoutError` reason). `combineSignals(signal, timeoutMs, { useAny })` in `foodApi.js` uses them when `AbortSignal.any` exists and otherwise builds an `AbortController` with a `setTimeout` and a listener that forwards the caller's abort; `cleanup()` clears both. Tests force the manual path with `useAny: false`; no global is stubbed. Older iOS Safari is covered only by those forced tests.

**Rulings** (Fable, with one advisor round; none went to the user):

- `FoodApiError extends Error` with `kind` in `offline | rate_limited | not_found | invalid | unavailable` (the spec's four plus `invalid` for 400).
- Cache keys are `q:<normalised query>` and `bc:<code>` (plan), not the bare query of spec 5.7; `docs/DATA-MODEL.md` says so. A barcode entry stores `results: [food]`.
- The request sends the normalised query so the wire query and the cache key agree. An empty normalised query resolves `[]` with no request.
- `readSearchCache` treats a non-object stored value as `{}`.
- `timeoutMs` (default `FOOD_API_TIMEOUT_MS = 8000`) and `useAny` are options on `searchFoods` and `lookupBarcode`, for tests.
- Body-read failures map like fetch failures: caller abort rethrown unchanged, anything else `unavailable`. A 200 without a `results` array, or a barcode 200 without `food`, is `unavailable` or `not_found` and caches nothing (a wrong `VITE_FOOD_API_BASE` makes the SPA rewrite answer `/v1/foods` with `index.html`).
- When `now` is not injected the cache `at` stamp is taken after the await.
- Fixture mode uses an empty URL prefix (`/v1/...`), trailing slashes are stripped from `base`, barcodes are trimmed.
- The fixture matches a food when every whitespace token of the query is a substring of its name, so "chicken breast" finds "chicken, breast, roasted". The `open_food_facts` item is "instant noodles, hot and sour shrimp" with `isVerified: false` (implementer's choice).
- The deep task review over the whole branch served as the whole-branch review, because the part has one task.

**Parked review findings** (real, low impact, deferred): no test pins that the default path is `AbortSignal.any`; a 404 on search maps to `not_found`, which the spec gives no search message for; `lookupBarcode` takes no `signal`; an injected real `fetchImpl` in fixture mode gets a relative URL; barcode entries share the 200-key cap with queries (spec 5.7); a clock moved backward keeps future-dated entries fresh; `fixtureFetch` treats `limit=0` as 20 and does not cap `limit`; no test pins the caller-abort rethrow during the body read.

**Notes for later parts:**

- Part F (Task 5): `searchFoods(query, { signal })` rethrows the caller's abort reason unchanged, so `SearchView` should ignore errors whose `name` is `AbortError` and show one line for every `FoodApiError.kind`; treat `not_found` on search like `unavailable`. `isFixtureMode()` with no argument reads the build-time base.
- Part J (Task 14b): `lookupBarcode(code, { fetchImpl, now, base, timeoutMs })` has an 8 s timeout but no caller signal; add one there if the scanner needs to cancel.
- Part K (Task 15): the client's error kinds and fixture badge rule are in `foodApi.js`; `ARCHITECTURE.md` does not describe the network client yet.

**Follow-ups:** none open beyond the parked findings above. The plan file is over the 30 KB limit in CLAUDE.md (56 KB with the Part A and B handoffs inside it); moving those two handoffs into this file is a docs-only change for a later session.

**Unchecked steps moved:** none.

**Next:** Part E (Tasks 8a, 8b) needs A and B, both merged, and can run now. Part F needs C and D merged.

## Part C handoff

**Shipped:** Task 3, commits `fbc5cf2` (provider), `bdc22ef` (review fixes) and `a7b8424` (removes the row filter that `bdc22ef` added). New files: `src/food/context/FoodContext.jsx` and its test. `FoodApp` now wraps its content in `FoodProvider`, and `docs/DATA-MODEL.md` has the food shapes. Issue #87 closes with this PR. `npm run check` passed before the rebase onto Part D and again after it (704 tests).

**Cost:** 682,544 subagent tokens across 9 agents (574,990 and 7 in the workflow, 107,554 and 2 after it); 2 fix rounds; 1 advisor round in the workflow and 1 in the controller session; about 32 minutes of agent time. Controller session tokens not measured.

**Rulings** (Fable advisor in the workflow's decide stage, unless marked):

- The provider's only load-time rule is the non-array fallback. It has no per-row filter. The workflow's fix stage had not seen this ruling and added a filter in `bdc22ef`. A controller advisor round kept the ruling and `a7b8424` removed the filter, because it was partial (an entry with no `per100` still crashed `sumMacros`), it did not protect the Task 13 read, and it deleted stored rows for good with no notice. #126 tracks the gap.
- `addEntry` appends. Display order inside a meal slot stays Part G's decision; rows carry `createdAt`.
- `saveMealFromSlot` on an empty slot returns `null` and stores nothing.
- `logSavedMeal` with an unknown id returns `[]` and changes nothing.
- Controller advisor round: keep the `useStoredList` hook and its ref. `saveMealFromSlot` and `logSavedMeal` read the current list through the ref, so a function held across an `await` or used in the same batch does not read a stale list. This deviates from "no new state mechanism" in Global Constraints and from the plain `useState` pattern in spec section 7. The hook does not expose its setter, so every change goes through `update`.
- `FoodApp.test.jsx` gained one test that proves the wrap, though Task 3's Files list omits that file.
- Commits use the Opus 5.5 trailer, because this session ran on Opus 5.5.

**Parked review findings** (real, low impact, deferred): no test pins the absence of a per-row filter or lazy loading; a corrupt non-array value is overwritten with `[]` on load (the plan's write-back pattern does this); `updateEntry` does not protect `id` or `per100`, and the actions do not validate `grams` or the meal name (spec section 8 puts validation in the UI); `addEntry` and `logSavedMeal` create an own `portionLabel: undefined` key that JSON drops on reload; `DATA-MODEL.md` leaves out the spec's "see §5.8" reference on the entry date; `FoodContext.test.jsx` seeds keep `items` and `food` fields the code no longer needs; a held action called after the provider unmounts returns a row that is not stored; the context value is rebuilt on every render, as in `AppProvider`.

**Notes for later parts:**

- This corrects the Part B note for Parts C and E: `FoodProvider` does not drop malformed rows. `normalizeFoodData` drops them on import only, until #126 ships.
- Part E: #126 needs `normalizeFoodData`, so write it so a load path can reuse it. Food data is not in the backup until Part E ships, so Part E should merge before Parts F and G put food logging in front of users.
- Part F (Task 5): calling `addEntry` does not touch the recent list; Task 11b wires that.
- Part G (Task 6): with a null row stored, `targetForDate` and `sumMacros` throw during render, and `src/` has no error boundary. This stays open until #126 ships.
- Part I (Task 10): `saveMealFromSlot` and `logSavedMeal` return synchronously. Add `updateSavedMeal` and `deleteSavedMeal` through the `updateSavedMeals` function from `useStoredList`.
- Part H (Task 13): `loadLS(K_FOOD_TARGETS)` outside the provider can return a non-array, and `targetForDate` throws on it. Guard that read; #126 covers row-level cleanup.

**Follow-ups:** #126.

**Unchecked steps moved:** none.

**Next:** Part E can run now. Part F needs C and D merged, so it can run once this PR merges.

## Part E rulings

Spec 5.9 and Task 8a leave these points open. They were decided while Task 8a ran, and they bind later parts.

**Incoming rows (`normalizeFoodData`, used on `raw.food` only):**

1. An entry date must be a real calendar date, as for targets. `isRealDate` is exported from `targets.js`.
2. A row with a missing, empty or non-string `id` is dropped. No id is created for it.
3. `raw.food` counts as absent unless it is a plain object. Missing, null, a string, a number and an array all return `false` and write nothing. A plain object with a missing list means that list is `[]`, so replace mode overwrites it.
4. Targets: the first row wins for a `from`, and the list is sorted ascending by `from`.
5. Recent rows need a valid FoodRef, a finite `lastAt`, numeric `per100` and `lastGrams` above 0. The newer `lastAt` wins for a food; the list is sorted newest first and capped at `RECENT_MAX`.
6. Duplicates inside one list are removed. The first row wins for entries, custom foods and saved meals.
7. Entries and saved meal items need a valid FoodRef: `food` is an object, `kind` is `db` or `custom`, and `id` is a non-empty string. An entry without one is dropped. A meal item without one is dropped, and a meal left with no items is dropped.
8. An optional field of the wrong type is removed and the row stays: `portionLabel`, `lastPortionLabel`, `barcode`, `food.barcode`. A non-array `portions` is removed, and inside an array only rows with a string `label` and grams above 0 stay.
9. A number or boolean `name` becomes text, and an object, array or null `name` becomes `""`; the row stays. The exception is a custom food, whose `name` must be a non-empty string.

**Stored rows (merge mode):** for entries, targets, custom foods and saved meals, a merge keeps every stored row unchanged, including malformed rows and duplicates, and adds incoming rows whose key matches no stored row. Targets are re-sorted by `from`. A stored list that is not an array counts as `[]`. Recent follows its own rule below. Replace mode writes the normalised incoming lists.

Recent: a stored row is replaced when the incoming row for that food has a newer `lastAt`. Two stored rows for one food collapse to one (newer `lastAt` wins, the first row wins a tie). A `lastAt` that is not a finite number counts as oldest. A stored row with no valid FoodRef has no key: it goes after the keyed rows, counts toward the cap, and the cap removes it first. The cap can also remove the oldest stored row, or an old incoming row.

**Reversed ruling:** the first version of Task 8a normalised the stored lists before a merge, so that the merge never met a malformed row. Review showed that this deletes logged history and saved meals with no message, even when the backup does not mention them. Spec 5.9 says "union" and "existing rows win", so that ruling was wrong and was reversed.

**Notes for later parts.** A restore in replace mode drops any row that fails the checks above, so every writer must produce valid rows:

- **#126 (provider load):** a merge keeps malformed stored rows, and `FoodProvider` does not filter them, so Part C's notes on `targetForDate` and `sumMacros` still apply. Part E unblocks #126: `normalizeFoodData` now exists. It drops rows, and the provider's write-back would delete them for good, so #126 still needs the owner's decision on a notice.
- **Part F (`PortionSheet`):** the API row has `source`, not `kind`. Map it to `kind: "db"` when building `food`. `addEntry` stores `food` as given, with no check. The test asserts that the entry logged through `addEntry` passes `normalizeEntry`; this test also covers the Part C provider, which merged before `normalize.js` existed. Task 5's text does not state this. Without it, a restore in replace mode drops every entry logged from Search.
- **Part K (`RecentRow`):** pass `recent.food` as `food`, not the recent row itself. The test asserts that the logged entry passes `normalizeEntry`.

## Part E handoff

**Shipped:** Tasks 8a and 8b. Commits `226c3ea`, `2087549`, `b3fcd31`, `3a44e0c`, `d5f7f5d` (Task 8a), `bc9455a`, `64f6ab1` (Task 8b), plus docs commits. `src/food/lib/normalize.js` and `backupFood.js` are new, and `DataManagementMenu` exports and imports the `food` field. `isRealDate` is now exported from `targets.js`, which Task 8a's Files list does not name. `docs/DATA-MODEL.md`, `ARCHITECTURE.md` and spec 5.9 are updated.

**Cost:** about $21.50 for the session so far, read from `get_session` before the last gate and the PR. The per-model split was not measured: `session-cost.mjs` is not on this machine. 1,306,179 subagent tokens across 21 agents, in 4 workflow runs and one final review. About 62 minutes of workflow time. Fix rounds: 3 for Task 8a and 1 for Task 8b. Decision rounds: 4, against the limit of one per part (2 from the controller, 2 inside the workflow runs).

**What cost the extra rounds:** the first ruling let a merge normalise stored rows, and the plan task did not state the effect on stored rows. It took two fix passes and a second controller advisor call to find that this deleted stored rows, against spec 5.9.

**Differences from the plan:**

- Task 8a's Interfaces line lists `uuid`. It is not used, because a row with no id is dropped.
- `normalizeEntry` also requires a valid `food`, which the Interfaces line does not list.
- Task 8b's reviews ran on `opus55-reviewer-deep`, not the plain reviewer the plan names, because CLAUDE.md sends backup-envelope work there.
- The backup note is in the `docs/DATA-MODEL.md` "Backup / export payload" section, not the "Food tracker" section Task 8b names, because the payload is documented there.

**Not verified:** a real browser, and rows written by the real food UI, which is not merged. The menu tests import and export through the real `importFoodData` and `exportFoodData` in jsdom. The first deep review ran an export-then-import round trip through the menu with a temporary test; no committed test does this.

**Follow-ups:** #129 (Import (replace) has no confirm, which conflicts with the `useConfirm()` hard invariant; this needs the owner's decision). #126 is now unblocked. Left as they are, by decision: writes across the five keys are not atomic, and a failed food write shows the existing "Import failed" message after gym data has already changed (spec section 8 keeps `saveLS` behaviour).

**Issues:** #93 closes with this PR. #94 stays open until Part K, because Task 15 finishes the docs.

**Plan size:** the plan file is 56 KB, above the 30 KB limit in CLAUDE.md. It was not cut, because that restructure is outside this part. The owner should decide whether to cut it before Part F.

**Unchecked steps moved:** none.

**Next:** Part F. The notes for later parts are under Part E rulings above.
