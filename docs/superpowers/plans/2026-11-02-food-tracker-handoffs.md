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
