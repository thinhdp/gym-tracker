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

**Incoming rows (`normalizeFoodData`, used on `raw.food` only when these rulings were made; since #126 `FoodProvider` and the Home card also load through it, see spec section 5.9):**

1. An entry date must be a real calendar date, as for targets. `isRealDate` is exported from `targets.js`.
2. An entry, custom food or saved meal with a missing, empty or non-string `id` is dropped. No id is created for it.
3. `raw.food` counts as absent unless it is a plain object. Missing, null, a string, a number and an array all return `false` and write nothing. A plain object with a missing list means that list is `[]`, so replace mode overwrites it.
4. Targets: the first row wins for a `from`, and the list is sorted ascending by `from`.
5. Recent rows need a valid FoodRef, a finite `lastAt`, numeric `per100` and `lastGrams` above 0. The newer `lastAt` wins for a food; the list is sorted newest first and capped at `RECENT_MAX`.
6. Duplicates inside one list are removed. The first row wins for entries, custom foods and saved meals.
7. Entries and saved meal items need a valid FoodRef: `food` is an object, `kind` is `db` or `custom`, and `id` is a non-empty string. An entry without one is dropped. A meal item without one is dropped, and a meal left with no items is dropped.
8. An optional field of the wrong type is removed and the row stays: `portionLabel`, `lastPortionLabel`, `barcode`, `food.barcode`. A non-array `portions` is removed, and inside an array only rows with a string `label` and grams above 0 stay.
9. A number or boolean `name` becomes text, and a missing, null, object or array `name` becomes `""`; the row stays. The exception is a custom food, whose `name` must be a non-empty string.

**Stored rows (merge mode):** for entries, targets, custom foods and saved meals, a merge keeps every stored row unchanged, including malformed rows and duplicates, and adds incoming rows whose key matches no stored row. Targets are re-sorted by `from`. A stored list that is not an array counts as `[]`. Recent follows its own rule below. Replace mode writes the normalised incoming lists.

Recent: a stored row is replaced when the incoming row for that food has a newer `lastAt`. Two stored rows for one food collapse to one (newer `lastAt` wins, the first row wins a tie). A `lastAt` that is not a finite number counts as oldest. A stored row with no valid FoodRef has no key: it goes after the keyed rows, counts toward the cap, and the cap removes it first. The cap can also remove the oldest stored row, or an old incoming row.

**Reversed ruling:** the first version of Task 8a normalised the stored lists before a merge, so that the merge never met a malformed row. Review showed that this deletes logged history and saved meals with no message, even when the backup does not mention them. Spec 5.9 says "union" and "existing rows win", so that ruling was wrong and was reversed.

**Notes for later parts.** Merge and replace both drop incoming rows that fail the checks above, so a restore loses any row the app wrote wrongly. Every writer must produce valid rows:

- **#126 (provider load):** a merge keeps malformed stored rows, and `FoodProvider` does not filter them, so Part C's notes on `targetForDate` and `sumMacros` still apply. Part E unblocks #126: `normalizeFoodData` now exists. It drops rows, and the provider's write-back would delete them for good, so #126 still needs the owner's decision on a notice.
- **Part F (`PortionSheet`):** the API row has `source`, not `kind`. Map it to `kind: "db"` when building `food`, and keep `kind: "custom"` for a custom food. `addEntry` stores `food` as given, with no check. The test asserts that the entry logged through `addEntry` passes `normalizeEntry`; this test also covers the Part C provider, which merged before `normalize.js` existed. Task 5's text does not state this. Without it, a restore drops every entry logged from Search. Task 5's test list now names this test.
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

## Part F handoff

**Shipped:** Tasks 5 and 7. Commits on the branch before squash or merge: `c6f9915` (Task 5), `724e8d4` (remount the portion sheet), `b571776` (Task 7), `51a85ed` and `ca63a88` (test pins). New files: `SearchView`, `SearchResultRow`, `PortionSheet`, `SettingsView`, `TargetsEditor`, with tests. `FoodApp` routes the search and settings tabs. #90, #92 and #106 close with this PR; Task 7 already delivers the edit and delete rows that #106 asks for.

**Cost:** $10.66 for the session up to this handoff, read from `get_session`. The per-model split was not measured: `session-cost.mjs` is not on this machine. 631,875 subagent tokens across 12 agents, in 2 workflow runs, 1 test fix agent and 1 diff review. Fix rounds: 1 for Task 5, 1 for Task 7, 1 controller round for test gaps. Decision rounds: 2, against the limit of one per part (1 controller advisor call, 1 advisor call in the Task 5 workflow). About 40 minutes of wall time.

**Verified in a browser:** a Playwright run on the dev server in fixture mode, at iPhone 13 size. Search autofocuses and shows the demo data badge. A search, portion sheet and Add stored an entry with `food.kind` `db` in the chosen slot and returned to Today. A target saved and deleted through the confirm dialog. No console errors, and no horizontal page scroll on the sheet or Settings.

**Not verified:** the real food API, because the run used the fixture; a real phone.

**Rulings** (Opus orchestrator, with one advisor round, unless marked):

- Until Part G adds date state, `FoodApp` passes `date={todayLocal()}` at render. `presetSlot` state has no setter yet, and `SearchView` falls back to `slotForTime()`.
- `PortionSheet` shows `date` as a day line. Its `onAdd` payload has no date; `SearchView` adds it.
- Grams start at `defaultGrams`, else the default chip's grams, else empty. Typing a value that differs from the chip clears the chip, so `portionLabel` never disagrees with the grams.
- The invalid grams outline sits on a wrapper, because `ui/Input` lets `className` replace its base classes. An untouched empty field also shows the outline (implementer's choice; spec section 8 does not settle it).
- The slot `Segmented` uses `flex-wrap`. `ui/Segmented` is unchanged.
- Custom foods match from two characters on normalised names, sit above API rows, and stay when the API call fails.
- `not_found` and non-`FoodApiError` failures read as "Search unavailable, try again".
- `TargetsEditor`: an empty field converts to `NaN`, so it blocks Save. The form prefills on mount and Applies from defaults to today, not the row's `from`. Messages show on a new empty form, as the plan states. `SettingsView` has no placeholder sections for Tasks 9 and 10.
- `PortionSheet` is keyed by `source:id`, so choosing another row resets it (review fix).
- Midnight (owner): an entry logs to the day shown, so no midnight handling is needed. A display left open overnight keeps showing the earlier day until the user changes it. #131 is closed with this ruling.
- Commits use the Opus 5.5 trailer, because this session ran on Opus 5.5.

**Parked review findings** (real, low impact, deferred):

- Search: API rows from the previous query stay visible while a new query is pending, so a slow connection can show them for up to the 8 s timeout; `per100` values from the API are not checked; `defaultGrams` `null` would show as text (no caller yet); `FoodApp.test.jsx` wiring tests assume fixture mode; the `vi.stubGlobal("jest", ...)` workaround in `SearchView.test.jsx` is not in `docs/TESTING.md`.
- Barcode: `PortionSheet` copies `food.barcode` into the ref on a text search, while spec 5.1 says it is present when reached by scan. Part J should settle this.
- Unpinned by tests: the `Number.isFinite` check and macro clamp in `PortionSheet`, the `flex-wrap` class, the `presetSlot` prop, and source in the sheet key; in `TargetsEditor`, history row macro text, the form keeping protein, carb and fat after Save and Delete, and an unsorted stored list at component level.
- `TargetsEditor`: the Save early return cannot run today; implied kcal can show Infinity for absurd input such as 1e308.

**Notes for later parts:**

- Part G: replace `date={todayLocal()}` with the new state and add the `presetSlot` setter. Search logs to that state's day, including a past day the user is viewing, and no midnight logic is added (#131, owner ruling). `onLogged` already switches to Today.
- Part H: add the Custom foods section to `SettingsView` and pass custom rows as today; `SearchView` sets `source: "custom"` on them.
- Part J: pass `onScan`; `PortionSheet` takes `defaultGrams` and keeps the rules above.
- Part K: `SearchView` has no "no results" line yet (Task 15). The offline state is only the one error line (Task 11b).
- #126 still applies: a stored `[null]` in targets crashes Settings during render, because `TargetsEditor` calls `targetForDate`.

**Owner action before deploying:** set `VITE_FOOD_API_BASE` in the gym-tracker Vercel project to the deployed API URL (plan, "Part finish"). Until then production runs in fixture mode and shows the demo data badge. This session could not read the Vercel project, so whether it is already set is not known.

**Follow-ups:** #132, #133, and #129 and #126 from earlier parts. Plan size: the plan file is still over the 30 KB limit in CLAUDE.md; the owner has not decided whether to cut it.

**Unchecked steps moved:** none.

**Next:** Parts G and H can run once this PR merges; both need `FoodApp.jsx` or `SearchView.jsx` from this part. Default order is G, then H.

## Part G handoff

**Shipped:** Tasks 6, 12a and 12b. Commits on the branch before squash or merge: `d26c7c8` (Task 6), `eb3eddb` and `7add4b8` (Task 12a), `d0f14e1` and `36b0d00` (Task 12b), `4f52d30` (axis labels and test pins). New files: `TodayView`, `MacroBars`, `MealSlot`, `EntryRow`, `EntryEditSheet`, `TrendsView`, `lib/trends.js`, with tests. `localDateFromYmd` is now exported from `localDate.js`, which Task 12a's Files list does not name. #91, #99 and #100 close with this PR.

**Cost:** $8.19 for the session up to this handoff, read from `get_session`. The per-model split was not measured: `session-cost.mjs` is not on this machine. 601,386 subagent tokens across 12 agents, in 3 workflow runs, 1 fix agent and 1 diff review. Fix rounds: 0 for Task 6, 1 for Task 12a, 1 for Task 12b, 1 controller round for the axis labels. Decision rounds: 1, before the first dispatch. About 48 minutes of agent time and about 60 minutes of wall time.

**Verified in a browser:** a Playwright run on the dev server in fixture mode, with a viewport of 390 px, and label measurements at 360 and 390 px. On a past day, + on Lunch opened Search with Lunch selected, and the log stored on that past day in that slot. An edit to grams cleared `portionLabel`. Delete went through the confirm dialog. Trends drew bars, the line and the table. No console errors, and no horizontal page scroll.

**Not verified:** the real food API; a real phone; dark mode; a time zone with daylight saving in the browser (unit tests cover it).

**Rulings** (Opus orchestrator, with one advisor round, unless marked):

- Rows in a slot sort by `createdAt` ascending; equal values keep stored order.
- `EntryEditSheet` has no portion picker, which differs from spec 6.1: a stored entry has `portionLabel` but no `portions`. Saving changed grams clears `portionLabel`; unchanged grams leave it.
- `presetSlot` resets after a log and on a bottom nav pick.
- The slot "..." button is disabled until Part I passes `onMenu`.
- A macro target of 0 shows `eaten / 0` with an empty bar and the ok tone.
- The `h1` stays "Today" on a past day; the date line below it shows the day.
- Trends buckets compare dates and use `from` as the React key, because `weekKey` can repeat across a daylight-saving change in zones that have one.
- `bodyweightDelta` on the first row of a range uses the real previous week from `weightLogs`.
- Bodyweight is raw, not converted (`docs/DATA-MODEL.md`, "Bodyweight log"), and labelled with the stored `mgym.unit`.
- Range and metric are component state, so no stored key or `docs/DATA-MODEL.md` change is needed.
- The axis tick is a short date plus `(n/7)`, not the plan's `<label> (n/7)`, which does not fit a phone. The table keeps the full label.
- Next day has no upper limit, so a future day can be viewed and logged to (owner ruling: allow for now, change later in #137). Trends ignores entries after today's week.
- Tick labels are angled, and Recharts drops some when they do not fit. In the longer ranges some weeks have no tick, so their logged-day count shows only in the table. Spec 6.3 can be read as each drawn label or each week; this takes the first reading. The owner's decision is tracked in #138. Measured with `interval={0}` at 390 px, 12 weeks overlapped.

**Parked review findings** (real, low impact, deferred):

- Task 6: unpinned `onLogged` reset (no route can show it today), the `Number.isFinite` half of the grams check, the sheet's day line; `MealSlot` with `onMenu` is untested until Part I. One test uses `fireEvent` against `docs/TESTING.md`, because `user.type` cannot enter "50.0" in a controlled number input; a comment says why. `EntryEditSheet`'s Save stays reachable by keyboard while the confirm dialog is open; confirming still deletes the right row.
- Task 12a: the `todayLocal()` default and the `Array.isArray(entries)` guard are unpinned.
- Task 12b: the weight axis `orientation`, the unit in the line name, and the chart's left margin, `textAnchor` and `height` are unpinned. Long locale labels such as Vietnamese may clip on the first tick (calculated, not run).
- Tick thinning has no test: #135.

**Notes for later parts:**

- Part I: pass `onMenu` from `TodayView` to `MealSlot`. It receives the slot id, as `onAdd` does. Add a test that the button is enabled with `onMenu`.
- Part K: add the Recent row to `TodayView` and empty states to `TrendsView` (All with no entries renders only the controls and an empty chart). A row with a null value is still a crash until #126 ships; `TodayView` and `weeklyIntake` read entries the same way.

**Follow-ups:** #135, #137, #138, and #126, #129, #132, #133 from earlier parts. Plan size: the plan file is still over the 30 KB limit in CLAUDE.md; the owner has not decided whether to cut it.

**Unchecked steps moved:** none.

**Next:** Part H, then I, J and K in the plan's default order.

## Part H handoff

**Shipped:** Tasks 9 and 13. Commits on the branch before squash or merge: `e4a63a1` (Task 9), `1146668` (Task 9 review fixes), `37e1793` (Task 13), `254967e` (Task 13 review fix), `581ce00` (test pins), plus this docs commit. New files: `CustomFoodForm`, `FoodSummaryCard`, and tests for both, plus `SettingsView.test.jsx`, which Task 9's Files list omits. `TONE_CLASSES` is now exported from `MacroBars.jsx`, which Task 13's Files list omits. #95 and #101 close with this PR. `npm run check` passed before the PR (1059 tests); main had not moved, so no rebase was needed.

**Cost:** $9.15 for the session up to the gate, read from `get_session`. The per-model split was not measured: `session-cost.mjs` is not on this machine. 508,549 subagent tokens across 10 agents, in 2 workflow runs, 1 test fix agent and 1 diff review. Fix rounds: 1 for Task 9, 1 for Task 13, 1 controller round for test gaps. Decision rounds: 1, before the first dispatch. About 40 minutes of wall time.

**Verified in a browser:** a Playwright run on the dev server in fixture mode, at iPhone 13 size. A custom food saved with blank Calories stored the computed kcal, and the portion sheet opened on it. Add stored an entry with `food.kind` `custom`. The food appeared in Search with the Custom badge. An edit in Settings changed the custom food and left the logged entry's `per100` unchanged. Delete went through the confirm dialog and left the entry stored. Gym Home showed the set-up link with no target, then the card with today's totals and a link that opened `/food`. No console errors, and no horizontal page scroll on the form, Settings or Home.

**Not verified:** the real food API; a real phone; dark mode; the browser back button from `/food` to Home, where a page restored from the browser's cache may show old totals.

**Plan and spec difference left in place:** spec 6.5 shows "Set up food tracking →" without a target or with no entries ever. Task 13 shows it only without a target, so a target with no entries shows the card at 0 eaten. The code follows the plan, as in Part A. The owner can change this if the prompt should also cover no entries.

**Rulings** (Opus orchestrator, with one advisor round, unless marked):

- After saving from Search, the form closes and `PortionSheet` opens on the new food. Closing without saving keeps the query. The form does not prefill the name from the query.
- A blank macro blocks Save and never becomes 0. Calories may be 0. A portion needs both label and grams.
- The form edits `portions[0]` only and keeps further portions. It rebuilds `portions[0]` as `{ label, grams }`.
- Settings has no create button; custom foods are created from Search. An empty list shows one line.
- Review fix: Save is blocked when blank Calories would compute to a non-finite number. Settings leaves out the kcal text for a row with no finite `per100.kcal`.
- The Home card guards only against a non-array stored value. Row-level filtering stays with #126 (advisor ruling). This means a malformed food row can now break gym Home, not only `/food`; #126 has a comment with the cases. Rows the app writes itself are valid, so this needs corrupted storage or a merge that kept such a row.
- Commits use the Opus 5.5 trailer, because this session ran on Opus 5.5.

**Parked review findings** (real, low impact, deferred):

- Custom foods: an `isDefault` on `portions[0]` from a restored row is lost on save. Typed Calories with an extreme macro such as 1e308 is accepted, and logging can then show Infinity. A row with no kcal shows no hint in Settings.
- Unpinned by tests: the `Number.isFinite` halves in the form, the grams field's red outline and two of its `aria-invalid` cases, the `portions` `Array.isArray` guard, the `initial?.id` title check, the finite half of the Settings kcal guard, and a typed barcode reaching `entry.food.barcode` through the create flow.
- Home card: the 23:59:30 test cannot catch a UTC date, so the 00:30 UTC+7 test is the one that pins it; do not remove that test as a near-duplicate. The zone leak test depends on test order. `vi.useRealTimers()` in `afterEach` is unpinned. The position test covers only the no-workout state.

**Notes for later parts:**

- Part I: add the Saved meals section to `SettingsView`, after Custom foods. The sheet pattern is in `CustomFoodForm` and `PortionSheet`.
- Part J: pass `initial={{ barcode }}` to `CustomFoodForm` on `not_found`. `onSaved` already opens the portion sheet in Search. `initial?.id` picks the title, so a prefilled form reads "Create custom food". A digits-only barcode is all the form checks; `isValidBarcode` adds the length rule.
- Part K: spec 6.2's online "Custom foods" shortcut has no task yet, so add it with Task 11b's shortcuts. `ARCHITECTURE.md` needs `CustomFoodForm` and `FoodSummaryCard` (Task 15). Task 15's "No match" line should reuse the Create custom food button already in `SearchView`.

**Follow-ups:** a new comment on #126, and #129, #132, #133, #135, #137, #138 from earlier parts. Plan size: the plan file is still over the 30 KB limit in CLAUDE.md; the owner has not decided whether to cut it.

**Unchecked steps moved:** none.

**Next:** Part I, then J and K in the plan's default order.
