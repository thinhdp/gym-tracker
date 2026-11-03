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
