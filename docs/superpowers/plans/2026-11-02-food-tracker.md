# Food Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen food-tracking mode at `/food` to gym-tracker: search-based logging against the macro-calculator public food endpoints, six meal slots, dated targets, weekly trends beside bodyweight, barcode scanning, and one Home card on the gym side.

**Architecture:** All food code lives in `src/food/` with its own `FoodProvider` context and `mgym.food.*` localStorage keys; `App.jsx` picks the mode from `window.location.pathname`. Reference nutrition comes from one network client (`src/food/lib/foodApi.js`); every logged entry stores grams plus a per-100 g snapshot and derives macros on read. Food data joins the existing `mgym.v1` backup envelope.

**Tech Stack:** React 18 + Vite 5, plain JSX (no TypeScript), Tailwind utilities, Recharts (already a dependency), Vitest + React Testing Library. One new dependency for barcode decoding (`@zxing/browser`), loaded with a dynamic `import()`.

**Spec:** `docs/superpowers/specs/2026-11-02-food-tracker-design.md` (backlog: `docs/superpowers/specs/2026-11-02-food-tracker-backlog.md`)

## Phase mapping

Tasks follow the backlog phases in `docs/superpowers/specs/2026-11-02-food-tracker-backlog.md`. Each phase is a usable slice on its own.

| Backlog phase                                        | Plan tasks |
| ---------------------------------------------------- | ---------- |
| Phase 1 — shell, Today, Search, Targets, backup      | 1–8b       |
| Phase 2 — custom foods, saved meals, recent, offline | 9–11b      |
| Phase 3 — Trends and Home card                       | 12a–13     |
| Phase 4 — barcode                                    | 14a, 14b   |
| Phase 5 — polish and docs                            | 15         |

## Global Constraints

- No TypeScript, no CSS files, no new state mechanism; reuse `ui/` primitives, `useConfirm()`, `loadLS`/`saveLS`. Never call `localStorage` directly.
- Dates in food data are **local** `YYYY-MM-DD` via `ymdFromDate` (`src/lib/date.js`), never `todayStr()` from `storage.js` (UTC).
- Entry macros are always derived: `grams × per100 / 100`; never stored. kcal rounds to an integer, grams of macros to 1 dp.
- Six slot ids, in order: `breakfast`, `snack1`, `lunch`, `snack2`, `dinner`, `snack3` with labels Breakfast, Morning snack, Lunch, Afternoon snack, Dinner, Evening snack.
- Bar tone: default below 90 %, `warn` from 90 %, `over` past 100 %.
- API client: no `Authorization` header; base URL from `import.meta.env.VITE_FOOD_API_BASE`; unset or `"fixture"` → fixture mode with a visible "demo data" badge in Search.
- Recent list caps at 50 distinct foods keyed `kind:id`. Search cache: 7-day expiry, 200-query cap.
- Backup: `food` field in the `mgym.v1` envelope holds `entries`, `targets`, `customFoods`, `savedMeals`, `recent`; `searchCache` and `tab` are excluded.
- Every `src/food/lib/*.js` has a co-located `*.test.js`; components with logic have `*.test.jsx`. Each task runs its focused test files (`npx vitest run <files>`); `npm run check` (lint + format check + tests + build) runs once per execution part, before that part's PR and again after the rebase (the husky pre-push hook is not installed in this clone, so run it by hand).
- One execution part per session and per PR (CLAUDE.md, Execution part sizing). A part ends with the gate, a PR, and a handoff section appended to this file.
- A new stored key or shape updates `docs/DATA-MODEL.md` in the same PR (CLAUDE.md Feature path step 3): keys in Task 1, object shapes in Tasks 3 and 4, the backup `food` field in Task 8b.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. An entry logged before 07:00 in UTC+7 must land on that local day, not the previous UTC day. Test in Task 2 (`localDate`) and Task 6 (TodayView uses it).
2. Deleting the only target row leaves the app with no target: Today shows plain totals and no bars, the Home card shows "Set up food tracking". Tests in Tasks 6, 7, 13.
3. A corrupted `mgym.food.entries.v1` value (not an array) must not crash `FoodProvider`; it falls back to `[]`. Test in Task 3.
4. A search request that returns after the user has typed more must not overwrite newer results (abort stale requests). Test in Task 5.
5. Importing a backup that has no `food` field leaves existing food data untouched in both merge and replace mode. Test in Task 8a.

## Tasks

Sizes and certainty follow CLAUDE.md "Execution part sizing". A stored key or shape, the backup envelope, shared context state, or more than one view makes a task L whatever its file count. Tasks that needed a lib test and a component test were XL and are split into a lib task and a view task.

---

### Task 1: `/food` mode shell (L, certain)

L: it defines the seven `mgym.food.*` keys and writes `mgym.food.tab`.

**Files:**

- Modify: `vercel.json`
- Modify: `src/App.jsx`
- Create: `src/food/lib/keys.js`
- Create: `src/food/FoodApp.jsx`
- Create: `src/food/components/FoodBottomNav.jsx`
- Test: `src/App.test.jsx`, `src/food/components/FoodBottomNav.test.jsx`
- Modify: `docs/DATA-MODEL.md` (keys table: one row per `mgym.food.*` key; object shapes follow in Tasks 3 and 4)

**Interfaces:**

- Produces:
  - `keys.js`: `K_FOOD_ENTRIES = "mgym.food.entries.v1"`, `K_FOOD_TARGETS = "mgym.food.targets.v1"`, `K_FOOD_CUSTOM = "mgym.food.customFoods.v1"`, `K_FOOD_MEALS = "mgym.food.savedMeals.v1"`, `K_FOOD_RECENT = "mgym.food.recent.v1"`, `K_FOOD_SEARCH_CACHE = "mgym.food.searchCache.v1"`, `K_FOOD_TAB = "mgym.food.tab"`.
  - `App.jsx`: `export function isFoodPath(pathname = window.location.pathname)` → `pathname === "/food" || pathname.startsWith("/food/")`. In `AppContent`: `if (isFoodPath()) return <FoodApp />;` **before** the `session` check.
  - `FoodApp.jsx` (default export): owns `tab` (`"today" | "search" | "trends" | "settings"`, persisted to `K_FOOD_TAB`, default `"today"`), renders a placeholder heading per tab for now plus `<FoodBottomNav active onSelect />` and an `<a href="/">Gym</a>` link in the header. Later tasks swap placeholders for views.
  - `FoodBottomNav.jsx` (default export, props `{ active, onSelect }`): same markup pattern as `ui/BottomNav.jsx` with four tabs `[["today","Today"],["search","Search"],["trends","Trends"],["settings","Settings"]]` and inline SVG icons; `aria-label="Food"`.
  - `vercel.json` gains `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`.

- [x] **Step 1: Write the failing tests**

`src/App.test.jsx` (render `<ConfirmProvider><App/></ConfirmProvider>`; stub the path with `vi.spyOn(window, "location", "get")` or by `window.history.pushState({}, "", "/food")` before render):

```jsx
it("renders the food app at /food and the gym app at /", ...); // expect getByRole("navigation", { name: "Food" }) vs { name: "Primary" }
it("renders the food app at /food even when a live session is stored", ...); // saveLS(K_SESSION, { workoutId: "x", startedAt: 1, currentIdx: 0 }) → still "Food" nav
it("isFoodPath matches /food and /food/ but not /foods", () => { expect(isFoodPath("/food")).toBe(true); expect(isFoodPath("/food/")).toBe(true); expect(isFoodPath("/foods")).toBe(false); });
```

`FoodBottomNav.test.jsx`: four buttons in order; the active one has `aria-current="page"`; clicking calls `onSelect("trends")`.

- [x] **Step 2: Run tests to verify they fail** — `npx vitest run src/App.test.jsx src/food` — FAIL.

- [x] **Step 3: Implement** the files above. In `FoodApp`, persist the tab with the `useState(() => loadLS(K_FOOD_TAB, "today"))` + `useEffect(saveLS)` pattern.

- [x] **Step 4: Run tests to verify they pass** — PASS.

- [x] **Step 5: Manual check:** `npm run dev`, open `http://localhost:5173/food` → food shell with four tabs; `http://localhost:5173/` → gym app unchanged.

- [x] **Step 6: Commit**

```bash
git add vercel.json src/App.jsx src/App.test.jsx src/food docs/DATA-MODEL.md
git commit -m "feat(food): /food mode shell with its own bottom nav"
```

---

### Task 2: Pure helpers: slots, macros, local dates, targets (L, certain)

Four S modules in one lib area, each with its own test; 4 points as one task.

**Files:**

- Create + Test: `src/food/lib/slots.js`, `slots.test.js`; `macros.js`, `macros.test.js`; `localDate.js`, `localDate.test.js`; `targets.js`, `targets.test.js`

**Interfaces:**

- Produces:
  - `slots.js`: `SLOTS` (array of `{ id, label }` in the fixed order), `SLOT_IDS`, `slotLabel(id)`, `slotForTime(date = new Date())` → id by local hour/minute: `< 10:00` breakfast, `< 11:30` snack1, `< 14:00` lunch, `< 17:00` snack2, `< 20:30` dinner, else snack3.
  - `macros.js`: `ZERO_MACROS = { kcal: 0, protein: 0, carb: 0, fat: 0 }`; `round1(n)`; `scaleMacros(per100, grams)` → `{ kcal: Math.round, protein/carb/fat: round1 }`; `entryMacros(entry)` = `scaleMacros(entry.per100, entry.grams)`; `sumMacros(entries)`; `kcalFromMacros({ protein, carb, fat })` = `4P + 4C + 9F` rounded; `pct(value, target)` → `value / target` or `null` when `!target`; `barTone(ratio)` → `"ok" | "warn" | "over"` (`warn` when `ratio >= 0.9`, `over` when `ratio > 1`).
  - `localDate.js`: `todayLocal(now = new Date())` via `ymdFromDate`; `addDays(ymd, n)` → ymd (build the Date with `new Date(y, m - 1, d)`, never `new Date(ymd)`); `isToday(ymd, now)`; `formatDayHeader(ymd)` → e.g. `"Mon 2 Nov"` using `toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })`.
  - `targets.js`: `targetForDate(targets, ymd)` → the row with the greatest `from <= ymd`, else `null`; `upsertTarget(targets, row)` → new array with same-`from` replaced, sorted by `from` ascending; `deleteTarget(targets, from)`; `validateTarget(row)` → array of messages (`"kcal must be above 0"`, `"protein must be 0 or more"`, …, `"from must be YYYY-MM-DD"`), empty when valid.

- [ ] **Step 1: Write the failing tests** (one `describe` per export; the boundaries that matter)

```js
// slots
expect(slotForTime(new Date(2026, 10, 2, 9, 59))).toBe("breakfast");
expect(slotForTime(new Date(2026, 10, 2, 10, 0))).toBe("snack1");
expect(slotForTime(new Date(2026, 10, 2, 20, 30))).toBe("snack3");
// macros
expect(scaleMacros({ kcal: 165, protein: 31, carb: 0, fat: 3.6 }, 150)).toEqual(
  { kcal: 248, protein: 46.5, carb: 0, fat: 5.4 },
);
expect(sumMacros([])).toEqual(ZERO_MACROS);
expect(kcalFromMacros({ protein: 10, carb: 10, fat: 10 })).toBe(170);
expect(barTone(0.89)).toBe("ok");
expect(barTone(0.9)).toBe("warn");
expect(barTone(1)).toBe("warn");
expect(barTone(1.01)).toBe("over");
expect(pct(50, 0)).toBeNull();
// localDate
expect(todayLocal(new Date(2026, 10, 2, 23, 30))).toBe("2026-11-02"); // local, regardless of TZ
expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
// targets
const t = [
  { from: "2026-01-01", kcal: 2000, protein: 150, carb: 200, fat: 70 },
  { from: "2026-11-01", kcal: 1800, protein: 160, carb: 150, fat: 60 },
];
expect(targetForDate(t, "2026-10-31").kcal).toBe(2000);
expect(targetForDate(t, "2026-11-01").kcal).toBe(1800);
expect(targetForDate(t, "2025-12-31")).toBeNull();
expect(
  upsertTarget(t, {
    from: "2026-11-01",
    kcal: 1900,
    protein: 160,
    carb: 150,
    fat: 60,
  }),
).toHaveLength(2);
expect(
  validateTarget({ from: "2026-11-01", kcal: 0, protein: 1, carb: 1, fat: 1 }),
).toContain("kcal must be above 0");
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run src/food/lib` — FAIL.

- [ ] **Step 3: Implement the four modules.**

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/food/lib
git commit -m "feat(food): slot, macro, local-date and target helpers"
```

---

### Task 3: `FoodProvider` context (L, certain)

L: shared context state and the stored shapes of five keys.

**Files:**

- Create: `src/food/context/FoodContext.jsx`
- Test: `src/food/context/FoodContext.test.jsx`
- Modify: `src/food/FoodApp.jsx` (wrap content in `<FoodProvider>`)
- Modify: `docs/DATA-MODEL.md` (object shapes for entries, targets, customFoods, savedMeals and recent, from spec §5.1–§5.6)

**Interfaces:**

- Consumes: `keys.js` (Task 1); `uuid` from `src/lib/storage.js`; `upsertTarget`, `deleteTarget` (Task 2).
- Produces: `export function FoodProvider({ children })`, `export function useFood()` returning:

  ```js
  {
    entries, targets, customFoods, savedMeals, recent,          // arrays, lazily loaded with loadLS(key, []); non-array stored values fall back to []
    addEntry({ date, slot, name, grams, per100, food, portionLabel }) -> entry (id, createdAt added),
    updateEntry(id, patch), deleteEntry(id),
    logSavedMeal(mealId, date, slot) -> entries added,
    saveMealFromSlot(name, date, slot) -> meal,
    upsertCustomFood(food) -> food (id/createdAt added when missing), deleteCustomFood(id),
    upsertTarget(row), deleteTarget(from),
    touchRecent(item)                                           // implemented in Task 11; stub here as a no-op setter wrapper
  }
  ```

  Each list is written back with `useEffect(() => saveLS(key, value), [value])`, as in `AppProvider`.

- [ ] **Step 1: Write the failing tests** (a `Probe` component that calls `useFood()` and exposes actions via buttons, or `renderHook` from RTL)

```jsx
it("loads lists lazily from localStorage and falls back to [] for a corrupt value", ...); // saveLS(K_FOOD_ENTRIES, { not: "an array" }) → entries equals []
it("addEntry assigns id and createdAt and persists to mgym.food.entries.v1", ...); // loadLS(K_FOOD_ENTRIES) has one row with per100 snapshot
it("updateEntry and deleteEntry change only the targeted row", ...);
it("upsertTarget replaces a same-from row and deleteTarget removes it", ...);
it("saveMealFromSlot copies that slot's entries and logSavedMeal creates new entries with fresh ids", ...);
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL.

- [ ] **Step 3: Implement `FoodContext.jsx`; wrap `FoodApp` content.**

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/food docs/DATA-MODEL.md
git commit -m "feat(food): FoodProvider with persisted entries, targets, custom foods, meals"
```

---

### Task 4: API client, fixture, search cache (L, uncertain: item 5, `AbortController` and `AbortSignal.timeout` are new to this code)

L: it writes the `mgym.food.searchCache.v1` shape. Uncertain because nothing in `src/` aborts a fetch today; the Fable session settles how the caller's signal and the 8 s timeout combine (`AbortSignal.any` where jsdom and the target browsers have it, else a manual listener) and Task 5 then reuses that mechanism.

**Files:**

- Create + Test: `src/food/lib/searchCache.js`, `searchCache.test.js`; `src/food/lib/foodApi.js`, `foodApi.test.js`; `src/food/lib/foodApiFixture.js`
- Modify: `docs/DATA-MODEL.md` (searchCache shape, spec §5.7)

**Interfaces:**

- Consumes: `K_FOOD_SEARCH_CACHE` (Task 1); `loadLS`/`saveLS`.
- Produces:
  - `searchCache.js`: `SEARCH_CACHE_TTL_MS = 7 * 86400000`, `SEARCH_CACHE_MAX = 200`; pure `getCached(map, key, now)` → results or `null` (expired counts as null); `putCached(map, key, results, now)` → new map, pruned of expired entries, then oldest-`at` dropped until `<= 200`; wrappers `readSearchCache(key, now = Date.now())` / `writeSearchCache(key, results, now = Date.now())` over `loadLS`/`saveLS`.
  - `foodApi.js`:
    ```js
    export const FOOD_API_BASE = import.meta.env.VITE_FOOD_API_BASE || "";
    export function isFixtureMode(base = FOOD_API_BASE) { return !base || base === "fixture"; }
    export class FoodApiError extends Error { constructor(kind, message) /* kind: "offline"|"rate_limited"|"not_found"|"invalid"|"unavailable" */ }
    export function normaliseQuery(q)                              // trim, lowercase, collapse whitespace
    export async function searchFoods(query, { fetchImpl, signal, now, base } = {}) // → results array (API "results"); cache key "q:" + normaliseQuery
    export async function lookupBarcode(code, { fetchImpl, now, base } = {})       // → food object; cache key "bc:" + code; 404 → throws FoodApiError("not_found")
    ```
    Defaults: `fetchImpl` = `fixtureFetch` in fixture mode else `fetch`; `base` = `FOOD_API_BASE`. Request URL `${base}/v1/foods?q=${encodeURIComponent(q)}&limit=20`, no headers besides none (do **not** set `Authorization`). Timeout 8 s via `AbortSignal.timeout(8000)` combined with the caller's `signal` when provided. Mapping: fetch throws (`TypeError`, `AbortError` from caller) → rethrow caller abort as-is, network `TypeError` → `offline`; `429` → `rate_limited`; `404` → `not_found`; `400` → `invalid`; other non-ok or timeout → `unavailable`.
  - `foodApiFixture.js`: `export const FIXTURE_FOODS` (10 foods in the API `PublicFood` shape: chicken breast roasted, rice white cooked, egg whole cooked, oats, banana, whole milk, salmon cooked, broccoli cooked, peanut butter, and one `open_food_facts` item with `barcode: "8934563138165"`), `export async function fixtureFetch(url)` returning a `Response`-like `{ ok, status, json }` that filters `FIXTURE_FOODS` by substring on `q`, or matches the barcode, else 404.

- [ ] **Step 1: Write the failing tests**

```js
// searchCache
it("returns null for a missing or expired key and the results for a fresh one", ...); // now vs now + TTL + 1
it("drops the oldest entry past 200", ...);
// foodApi
it("GETs /v1/foods with encoded q and limit=20 and no Authorization header", ...); // fetchImpl mock → ok({ results: [...] }); inspect url and init?.headers
it("serves a repeat query from the cache without fetching", ...);
it("maps 429, 404, 400, 500 and a network TypeError to FoodApiError kinds", ...);
it("lookupBarcode throws not_found on 404 and caches a hit under bc:<code>", ...);
it("uses the fixture when base is empty or 'fixture'", async () => { const r = await searchFoods("chicken", { base: "fixture" }); expect(r[0].name).toMatch(/chicken/); });
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL.

- [ ] **Step 3: Implement the three modules.**

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/food/lib docs/DATA-MODEL.md
git commit -m "feat(food): food API client with fixture mode and localStorage search cache"
```

---

### Task 5: Search view and portion sheet (L, certain once Part D merges)

Six files; the per-request `AbortController` reuses the mechanism Task 4 settles.

**Files:**

- Create: `src/food/components/SearchView.jsx`, `SearchResultRow.jsx`, `PortionSheet.jsx`
- Test: `src/food/components/SearchView.test.jsx`, `PortionSheet.test.jsx`
- Modify: `src/food/FoodApp.jsx` (route `search` tab to `SearchView`; pass `onLogged={() => setTab("today")}` and a `presetSlot` state that Today will set later)

**Interfaces:**

- Consumes: `searchFoods`, `isFixtureMode`, `FoodApiError` (Task 4); `useFood().addEntry`, `customFoods` (Task 3); `scaleMacros`, `SLOTS`, `slotForTime`, `todayLocal` (Task 2); `Input`, `Button`, `Badge`, `Segmented`.
- Produces:
  - `SearchView` props: `{ date, presetSlot, onLogged, onScan }` (`onScan` wired in Task 14; render the camera button only when it is provided).
    Behaviour: `Input` autofocus; after ≥ 2 chars, 300 ms debounce, call `searchFoods(q, { signal })` with an `AbortController` per request; abort the previous one on each new query; ignore results whose request was aborted. Shows a "demo data" `Badge` when `isFixtureMode()`. Shows custom foods whose name includes the query at the top with a `Custom` badge. Error line text by kind: `offline` → "Search needs a connection", `rate_limited` → "Too many searches, wait a minute", other → "Search unavailable, try again" (offline/error states are completed in Task 11; here just render the line).
  - `SearchResultRow` props `{ food, onSelect }`: name (+ ` · ${prepState}` when present), `${per100.kcal} kcal / 100 g`, source badge: `usda_fdc` → `USDA`, `open_food_facts` → `Product`, `custom` → `Custom`.
  - `PortionSheet` props `{ food, date, defaultSlot, defaultGrams, onAdd, onClose }`: portion chips from `food.portions` (default selected = `isDefault` else first; none → grams field only), grams `Input type="number"` (chip tap sets grams to `portion.grams`), computed `scaleMacros` line, slot `Segmented` over `SLOTS`, Add button disabled when `grams <= 0 || isNaN`. `onAdd({ name, grams, per100, food: { kind, id, barcode }, portionLabel, slot })`.

- [ ] **Step 1: Write the failing tests** (mock `../lib/foodApi` with `vi.mock`; wrap in `FoodProvider` and `ConfirmProvider`)

```jsx
// SearchView
it("does not search below two characters and debounces", ...); // type "c" → no call; type "ch" → advance timers 300ms → one call
it("aborts the previous request when the query changes and ignores stale results", ...); // first promise resolves after second; list shows second results only
it("shows the demo data badge in fixture mode", ...);
it("shows the rate-limited message on FoodApiError('rate_limited')", ...);
it("opens the portion sheet on row tap and adds an entry to the preset slot", ...); // after Add, loadLS(K_FOOD_ENTRIES)[0].slot === "lunch" and per100 copied; onLogged called
// PortionSheet
it("selects the default portion and sets grams from a chip", ...);
it("updates the computed kcal when grams change and disables Add for 0", ...);
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL.

- [ ] **Step 3: Implement the three components and wire the tab.**

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/food
git commit -m "feat(food): search view with debounced API lookup and portion sheet"
```

---

### Task 6: Today view (L, certain)

**Files:**

- Create: `src/food/components/TodayView.jsx`, `MacroBars.jsx`, `MealSlot.jsx`, `EntryRow.jsx`, `EntryEditSheet.jsx`
- Test: `MacroBars.test.jsx`, `TodayView.test.jsx`
- Modify: `src/food/FoodApp.jsx` (own `date` state defaulting to `todayLocal()`; `today` tab → `TodayView`; `onAddTo(slot)` sets `presetSlot` and switches to `search`)

**Interfaces:**

- Consumes: `useFood()` (entries, targets, updateEntry, deleteEntry); `sumMacros`, `entryMacros`, `pct`, `barTone`, `targetForDate`, `SLOTS`, `slotLabel`, `addDays`, `isToday`, `formatDayHeader`; `useConfirm`.
- Produces:
  - `MacroBars` props `{ totals, target }`: four rows (Calories kcal, Protein g, Carbs g, Fat g) each `"<eaten> / <target>"`; fill width `min(100, ratio*100)%`; tone classes: ok `bg-blue-600`, warn `bg-amber-500`, over `bg-red-600`; when `target` is `null` render totals as four plain numbers and **no** bars (`data-testid` is allowed here: `macro-bar-<key>` for width/tone assertions).
  - `MealSlot` props `{ slot, entries, onAdd, onEdit, onMenu }`: label, slot kcal total, `EntryRow`s, "+" button (`aria-label="Add to <label>"`), "…" button (`aria-label="<label> options"`; menu content added in Task 10).
  - `EntryRow` props `{ entry, onClick }`: name, `portionLabel ?? "<grams> g"`, kcal.
  - `EntryEditSheet` props `{ entry, onSave, onDelete, onClose }`: grams field, slot `Segmented`, Delete via `useConfirm()`, Save.
  - `TodayView` props `{ date, onChangeDate, onAddTo }`: header `formatDayHeader(date)` with ‹ › buttons (`aria-label="Previous day" / "Next day"`) and a "Today" button when `!isToday(date)`; `MacroBars`; six `MealSlot`s in `SLOTS` order filtered by `entry.date === date`. (The Recent row is added in Task 11.)

- [ ] **Step 1: Write the failing tests**

```jsx
// MacroBars
it("renders eaten/target and tone classes at 89 %, 90 %, 100 %, 101 %", ...);
it("renders plain totals and no bars without a target", ...);
// TodayView
it("renders the six slots in order and places entries by slot", ...); // seed two entries (lunch, snack3) via saveLS; expect names under the right headings
it("sums only the selected date and navigates days", ...); // entries on 2026-11-02 and 2026-11-03; click Next day → totals change; Today button appears
it("edits grams through the sheet and deletes after confirm", ...);
it("+ on a slot calls onAddTo with that slot id", ...);
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL.

- [ ] **Step 3: Implement and wire.**

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/food
git commit -m "feat(food): Today view with macro bars, meal slots and entry editing"
```

---

### Task 7: Settings and targets editor (M, certain)

One view, four files, one test file.

**Files:**

- Create: `src/food/components/SettingsView.jsx`, `TargetsEditor.jsx`
- Test: `TargetsEditor.test.jsx`
- Modify: `src/food/FoodApp.jsx` (`settings` tab → `SettingsView`)

**Interfaces:**

- Consumes: `useFood()` (targets, upsertTarget, deleteTarget); `validateTarget`, `kcalFromMacros`, `todayLocal`; `useConfirm`.
- Produces:
  - `TargetsEditor` (default export, no props): four number `Input`s labelled Calories, Protein (g), Carbs (g), Fat (g) prefilled from `targetForDate(targets, today)`; `Input type="date"` "Applies from" defaulting to `todayLocal()`; helper line `"Macros imply <kcalFromMacros> kcal"`; Save disabled while `validateTarget` returns messages (messages shown inline); history list (rows sorted by `from` descending) each with Edit (loads the row into the form) and Delete (`useConfirm`).
  - `SettingsView` (default export): sections Targets (`TargetsEditor`), Custom foods (Task 9), Saved meals (Task 10), and a "Back to Gym" `<a href="/">`.

- [ ] **Step 1: Write the failing tests**

```jsx
it("saves a target with the chosen from-date and shows it in history", ...); // loadLS(K_FOOD_TARGETS) has { from: "2026-11-01", kcal: 1800, ... }
it("shows the implied kcal helper and disables Save on kcal 0", ...);
it("edit loads a history row into the form; delete removes it after confirm", ...);
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL.

- [ ] **Step 3: Implement and wire.**

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/food
git commit -m "feat(food): settings view with dated targets editor and history"
```

---

### Task 8a: Food backup lib: normalise and merge (L, certain)

L by the backup-envelope rule. Split from the menu wiring (Task 8b) because the two have test signals in different areas.

**Files:**

- Create + Test: `src/food/lib/normalize.js`, `normalize.test.js`; `src/food/lib/backupFood.js`, `backupFood.test.js`

**Interfaces:**

- Consumes: keys (Task 1); `uuid`.
- Produces:
  - `normalize.js`: `normalizeEntry(e)` → entry or `null` (requires string `id`, `date` matching `/^\d{4}-\d{2}-\d{2}$/`, `slot` in `SLOT_IDS`, `grams > 0`, numeric `per100` four fields; coerces `name` to string, `createdAt` to number or `Date.now()`); `normalizeTarget(t)` (valid per `validateTarget`), `normalizeCustomFood(c)`, `normalizeSavedMeal(m)` (drops invalid items; meal with zero items → null), `normalizeRecent(r)`; `normalizeFoodData(raw)` → `{ entries, targets, customFoods, savedMeals, recent }` (missing lists → `[]`; never throws).
    `mergeFoodData(current, incoming)` → union by `id` (entries, customFoods, savedMeals), by `from` (targets), by `kind:id` keeping the newer `lastAt` (recent); existing rows win.
  - `backupFood.js`: `exportFoodData()` → the five lists via `loadLS`; `importFoodData(raw, mode)` → when `raw.food` is absent do nothing and return `false`; otherwise normalise, `replace` → `saveLS` each list, `merge` → `saveLS(mergeFoodData(current, incoming))`; return `true`.

- [ ] **Step 1: Write the failing tests**

```js
// normalize
it("drops entries with bad date, unknown slot, non-positive grams or non-numeric per100 and keeps valid ones", ...);
it("merge keeps existing rows on id collision and unions by from for targets", ...);
// backupFood
it("importFoodData returns false and writes nothing when raw.food is absent (merge and replace)", ...);
it("replace overwrites each list; merge unions", ...);
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run src/food/lib` — FAIL.

- [ ] **Step 3: Implement the two modules.**

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/food/lib
git commit -m "feat(food): normalise and merge food data for backup import"
```

---

### Task 8b: Backup menu wiring and phase 1 docs (M, certain)

**Files:**

- Modify: `src/components/DataManagementMenu.jsx`, `src/components/DataManagementMenu.test.jsx`
- Modify: `docs/DATA-MODEL.md`, `ARCHITECTURE.md`

**Interfaces:**

- Consumes: `exportFoodData`, `importFoodData` (Task 8a).
- Produces: `DataManagementMenu`: export payload gains `food: exportFoodData()`; `onFileChange` calls `importFoodData(raw, modeRef.current)` after the existing imports.

- [ ] **Step 1: Write the failing test** in `DataManagementMenu.test.jsx`

```jsx
it("export payload includes food with the five lists", ...);
it("import with no food field leaves stored food data untouched", ...);
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run src/components/DataManagementMenu.test.jsx` — FAIL.

- [ ] **Step 3: Implement; update docs:** `docs/DATA-MODEL.md` "Food tracker" section gains the backup `food` field and merge rules (keys and shapes were added in Tasks 1, 3 and 4); `ARCHITECTURE.md` gets the two-mode routing paragraph, `src/food/` in the directory tree, and `FoodApp` in the component hierarchy.

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DataManagementMenu.jsx src/components/DataManagementMenu.test.jsx docs/DATA-MODEL.md ARCHITECTURE.md
git commit -m "feat(food): include food data in the mgym.v1 backup; document the food mode"
```

---

### Task 9: Custom foods (L, certain)

L: it edits two views (Search and Settings).

**Files:**

- Create: `src/food/components/CustomFoodForm.jsx`
- Test: `CustomFoodForm.test.jsx`
- Modify: `SearchView.jsx` ("Create custom food" button → form; custom results at top), `SettingsView.jsx` (Custom foods list with edit/delete)

**Interfaces:**

- Consumes: `useFood()` (customFoods, upsertCustomFood, deleteCustomFood); `kcalFromMacros`; `useConfirm`.
- Produces: `CustomFoodForm` props `{ initial, onSaved, onClose }` with fields Name (required), Barcode (optional, digits only), per 100 g: Calories (optional → computed with `kcalFromMacros` when blank), Protein, Carbs, Fat (required, `>= 0`), optional one portion (Label + grams). `onSaved(food)` after `upsertCustomFood`. Custom foods appear in `SearchView` results as `{ ...food, source: "custom" }` and are logged with `food: { kind: "custom", id }`.

- [ ] **Step 1: Write the failing tests**

```jsx
it("computes kcal from macros when left blank and saves to mgym.food.customFoods.v1", ...); // P10 C10 F10 → kcal 170
it("requires a name and non-negative macros", ...);
it("a saved custom food appears at the top of search results with a Custom badge", ...); // SearchView test addition
it("editing a custom food does not change an existing entry's per100", ...); // FoodContext-level: entry snapshot unchanged
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/food
git commit -m "feat(food): custom foods with manual per-100g values"
```

---

### Task 10: Saved meals (L, certain)

L: two new `FoodProvider` actions (shared state) and four views.

**Files:**

- Create: `src/food/components/SavedMealsPanel.jsx`
- Test: `SavedMealsPanel.test.jsx`
- Modify: `MealSlot.jsx` ("…" menu: "Save as meal" when the slot has entries, "Log saved meal"), `TodayView.jsx`, `SearchView.jsx` (Saved meals shortcut), `SettingsView.jsx` (rename/delete)

**Interfaces:**

- Consumes: `useFood()` (savedMeals, saveMealFromSlot, logSavedMeal, setters for rename/delete via `updateSavedMeal(id, patch)` and `deleteSavedMeal(id)` — add these two actions to `FoodProvider` in this task); `useConfirm`.
- Produces: `SavedMealsPanel` props `{ date, slot, onLogged, onClose }`: list of meals with item count and total kcal; tap → `logSavedMeal(meal.id, date, slot)` then `onLogged()`. "Save as meal" prompts for a name with an inline `Input` (not `window.prompt`).

- [ ] **Step 1: Write the failing tests**

```jsx
it("Save as meal creates a meal from the slot's entries", ...);
it("logging a meal copies its items into the chosen date and slot with fresh ids", ...);
it("rename and delete in Settings", ...);
```

- [ ] **Step 2–5:** fail → implement → pass → commit `feat(food): saved meals`.

---

### Task 11a: Recent list helper (S, certain)

**Files:**

- Create + Test: `src/food/lib/recent.js`, `recent.test.js`

**Interfaces:**

- Produces: `RECENT_MAX = 50`; `recentKey(food)` → `${food.kind}:${food.id}`; `touchRecent(list, item)` → new list with the item (`{ food, name, per100, portions, lastGrams, lastPortionLabel, lastAt }`) at index 0, previous same-key row removed, trimmed to 50.

- [ ] **Step 1: Write the failing test**

```js
it("touchRecent moves an existing food to the front, caps at 50, keys by kind:id", ...);
```

- [ ] **Step 2–5:** fail → implement → pass → commit `feat(food): recent list helper`.

---

### Task 11b: Recent row, one-tap re-log, undo toast, offline states (L, certain)

L: it writes the `mgym.food.recent.v1` shape through `FoodProvider` and edits two views.

**Files:**

- Create: `src/food/components/RecentRow.jsx`, `src/food/components/Toast.jsx`
- Test: `RecentRow.test.jsx`, `SearchView.test.jsx` (offline cases)
- Modify: `FoodContext.jsx` (`touchRecent` real implementation; `addEntry` calls it), `TodayView.jsx` (mount `RecentRow`), `SearchView.jsx` (offline: disable input, hide scan, show Recent/Saved/Custom shortcuts)

**Interfaces:**

- Consumes: `touchRecent`, `recentKey` (Task 11a).
- Produces:
  - `RecentRow` props `{ date, onOpen }`: horizontal chips `"<name> · <lastGrams> g"`; tap → `addEntry` at `lastGrams` into `slotForTime()` and show `Toast` "Logged <name>" with Undo (3 s) that calls `deleteEntry`; the chip's "…" calls `onOpen(recentItem)` which opens `PortionSheet` prefilled.
  - `Toast` props `{ message, actionLabel, onAction, onDone, durationMs = 3000 }`.
  - `SearchView` offline: `navigator.onLine === false` or a `FoodApiError("offline")` sets `offline` state → input disabled with the note; shortcuts rendered below.

- [ ] **Step 1: Write the failing tests**

```jsx
it("tapping a recent chip logs lastGrams into the time-of-day slot and Undo removes it", ...); // vi.useFakeTimers for the 3 s window; vi.setSystemTime for slot
it("offline shows the note, disables the input and lists recent foods", ...); // Object.defineProperty(navigator, "onLine", { value: false, configurable: true })
```

- [ ] **Step 2–5:** fail → implement → pass → commit `feat(food): recent foods, undo toast and offline states`.

---

### Task 12a: Weekly intake helper (S, certain)

**Files:**

- Create + Test: `src/food/lib/trends.js`, `trends.test.js`

**Interfaces:**

- Consumes: `startOfWeekMonday`, `weekKey`, `weekLabel` (`src/lib/dateUtils.js`); `averageWeightInRange` (`src/lib/weightUtils.js`); `sumMacros`, `entryMacros`.
- Produces:
  - `trends.js`: `weeklyIntake(entries, weightLogs, { weeks, today })` → array oldest→newest of `{ key, label, from, to, loggedDays, avg: { kcal, protein, carb, fat } | null, bodyweight: number | null, bodyweightDelta: number | null }`. `weeks` is `4 | 12 | null` (null = from the first entry's week to today). `avg` divides by `loggedDays` (days in the week with ≥ 1 entry); `loggedDays === 0` → `avg: null`. `bodyweightDelta` = this week's avg minus the previous week's avg when both exist.

- [ ] **Step 1: Write the failing tests**

```js
it("buckets Monday-start weeks across a month boundary and averages by logged days, not 7", ...); // 2 days logged at 2000 and 1000 → avg.kcal 1500
it("returns avg null for a week with no entries and joins weekly bodyweight averages with delta", ...);
it("weeks: 4 yields exactly four buckets ending with today's week", ...);
```

- [ ] **Step 2–5:** fail → implement → pass → commit `feat(food): weekly intake helper`.

---

### Task 12b: Trends view (M, certain)

**Files:**

- Create: `src/food/components/TrendsView.jsx`
- Test: `TrendsView.test.jsx` (mock Recharts with `withFixedResponsiveContainer` as `StrengthStandards.test.jsx` does)
- Modify: `FoodApp.jsx` (`trends` tab)

**Interfaces:**

- Consumes: `weeklyIntake` (Task 12a); `K_WEIGHT_LOGS`; `useFood().entries`.
- Produces:
  - `TrendsView`: `Segmented` range (4w / 12w / All) and metric (Calories / Protein / Carbs / Fat); Recharts `ComposedChart` with `Bar` for the metric average and `Line` on a right `YAxis` for bodyweight; `XAxis` label `"<label> (<loggedDays>/7)"`; below, a table of the same rows.

- [ ] **Step 1: Write the failing test**

```jsx
it("renders one bar per week and switches metric with the segmented control", ...);
```

- [ ] **Step 2–5:** fail → implement → pass → commit `feat(food): weekly intake trends beside bodyweight`.

---

### Task 13: Gym Home card (M, certain)

One gym-side view; it reads two food keys and writes none.

**Files:**

- Create: `src/components/FoodSummaryCard.jsx`
- Test: `src/components/FoodSummaryCard.test.jsx`
- Modify: `src/components/Home.jsx` (mount under the Today / NextSession card)

**Interfaces:**

- Consumes: `loadLS`, `K_FOOD_ENTRIES`, `K_FOOD_TARGETS`, `targetForDate`, `sumMacros`, `pct`, `barTone`, `todayLocal`.
- Produces: `FoodSummaryCard` (default export, no props): with a target for today → "Food today" label, one kcal bar `eaten / target` with tone classes, `"Protein <eaten> / <target> g"`, wrapped in `<a href="/food">`; otherwise → `<a href="/food">Set up food tracking →</a>`. Reads storage once on mount (`useMemo`), like `Home`'s bodyweight tile.

- [ ] **Step 1: Write the failing tests**

```jsx
it("shows today's kcal against target and links to /food", ...);
it("ignores entries from other days", ...);
it("shows the set-up prompt without a target", ...);
```

- [ ] **Step 2–5:** fail → implement → pass → commit `feat(home): food summary card`.

---

### Task 14a: Barcode detector helper (S, uncertain: item 5, new dependency `@zxing/browser` and the `BarcodeDetector` API)

**Files:**

- Create + Test: `src/food/lib/barcode.js`, `barcode.test.js`
- Modify: `package.json` (dependency `@zxing/browser` and its peer `@zxing/library`)

**Interfaces:**

- Produces:
  - `barcode.js`: `BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"]`; `pickStrategy(win = window)` → `"native"` when `"BarcodeDetector" in win`, else `"zxing"`; `createDetector(strategy)` → `Promise<{ detectOnce(videoEl): Promise<string|null>, stop() }>`; the zxing branch does `await import("@zxing/browser")` and uses `BrowserMultiFormatReader.decodeOnceFromVideoElement`; `isValidBarcode(code)` → `/^\d{8,14}$/`.

- [ ] **Step 1: Write the failing tests**

```js
it("pickStrategy returns native when BarcodeDetector exists, else zxing", ...);
it("isValidBarcode accepts 8–14 digits only", ...);
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL.

- [ ] **Step 3: Install and implement**

Run: `npm install @zxing/browser @zxing/library` (current 0.1.x / 0.21.x). Confirm `npm run build` output shows the zxing chunk split from the main bundle (dynamic import).

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/food/lib
git commit -m "feat(food): barcode detector helper with native and zxing strategies"
```

---

### Task 14b: Barcode scanner and search wiring (L, uncertain: item 4, the camera path has no automated test; item 5, `getUserMedia` is new to this code)

**Files:**

- Create: `src/food/components/BarcodeScanner.jsx`
- Test: `BarcodeScanner.test.jsx` (manual-code path and permission-denied path only)
- Modify: `SearchView.jsx` (camera button; scan → `lookupBarcode` → `PortionSheet`; `not_found` → `CustomFoodForm` with `initial.barcode`), `FoodApp.jsx` (pass `onScan`)

**Interfaces:**

- Consumes: `createDetector`, `pickStrategy`, `isValidBarcode` (Task 14a); `lookupBarcode` (Task 4); `CustomFoodForm` (Task 9).
- Produces:
  - `BarcodeScanner` props `{ onDetected, onCancel }`: requests `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })`, shows `<video>`, loops `detectOnce` until a valid code → `onDetected(code)`; permission denied or no `mediaDevices` → shows "Camera unavailable" plus a manual code `Input` and Use button (validated with `isValidBarcode`). Stops tracks on unmount.

- [ ] **Step 1: Write the failing tests**

```jsx
it("falls back to the manual code field when getUserMedia rejects and submits a valid code", ...);
it("search view: scanned code → lookupBarcode → portion sheet; not_found → custom food form with barcode prefilled", ...); // mock foodApi.lookupBarcode
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL.

- [ ] **Step 3: Implement and wire.**

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Manual check on devices** — `npm run dev -- --host`, open `/food` on an Android phone (Chrome, native path) and an iPhone (Safari, zxing path): scan a packaged product; confirm the portion sheet opens or the custom-food form appears with the code. Record the outcome in the commit body.

- [ ] **Step 6: Commit**

```bash
git add src/food
git commit -m "feat(food): barcode scanning with native detector and zxing fallback"
```

---

### Task 15: Empty states and final docs (M, certain)

Two one-line empty states in views that share no state in this task, plus prose; sized M, not L.

**Files:**

- Modify: `TodayView.jsx` (empty states: no entries today → "Nothing logged yet"; no target → "Set targets in Settings" link), `SearchView.jsx` (no results → "No match. Create a custom food?")
- Modify: `README.md` (Features: Food tracking at `/food`; env var `VITE_FOOD_API_BASE`), `docs/DATA-MODEL.md`, `ARCHITECTURE.md` (final tree and component hierarchy), `CONTRIBUTING.md` (manual smoke checklist: food mode items)
- Test: extend `TodayView.test.jsx` and `SearchView.test.jsx` for the empty states

- [ ] **Step 1: Write the failing empty-state tests; run; implement; run.**

- [ ] **Step 2: Update the docs listed above.**

- [ ] **Step 3: Commit**

```bash
git add src/food src/components README.md docs ARCHITECTURE.md CONTRIBUTING.md
git commit -m "feat(food): empty states and documentation"
```

---

## Execution parts

| Part | Points                | Certainty (task: failed item)                                                                      | Orchestrator | Needs         | Wave | Critical path | Gate |
| ---- | --------------------- | -------------------------------------------------------------------------------------------------- | ------------ | ------------- | ---- | ------------- | ---- |
| A    | 4 (Task 1)            | certain                                                                                            | Opus 5.5     | —             | 1    | yes           | no   |
| B    | 5 (Tasks 2, 11a)      | certain                                                                                            | Opus 5.5     | —             | 1    | no            | no   |
| C    | 4 (Task 3)            | certain                                                                                            | Opus 5.5     | A, B          | 2    | yes           | no   |
| D    | 4 (Task 4)            | uncertain (Task 4: item 5, fetch abort and timeout are new mechanisms)                             | Fable        | A             | 2    | no            | no   |
| E    | 6 (Tasks 8a, 8b)      | certain                                                                                            | Opus 5.5     | A, B          | 2    | no            | no   |
| F    | 6 (Tasks 5, 7)        | certain once D merges                                                                              | Opus 5.5     | B, C, D       | 3    | yes           | no   |
| G    | 7 (Tasks 6, 12a, 12b) | certain                                                                                            | Opus 5.5     | B, C          | 4    | no            | no   |
| H    | 6 (Tasks 9, 13)       | certain                                                                                            | Opus 5.5     | A, B, F       | 4    | yes           | no   |
| I    | 4 (Task 10)           | certain                                                                                            | Opus 5.5     | C, F, G, H    | 5    | no            | no   |
| J    | 5 (Tasks 14a, 14b)    | uncertain (14a: item 5, new dependency; 14b: item 4, camera path untested; item 5, `getUserMedia`) | Fable        | D, F, H       | 6    | no            | no   |
| K    | 6 (Tasks 11b, 15)     | certain                                                                                            | Opus 5.5     | B, C, F, G, H | 7    | yes           | no   |

57 points in eleven parts. No part has a user gate; the design gate was the spec. Task 14b's phone check is acceptance of a built feature, not an open choice, so Part J stays in phase order rather than moving to the front. D and J hold the uncertain tasks and stay apart under the one-label rule. Reviews: Tasks 1, 3, 4, 8a, 10 and 11b (stored keys and shapes, backup envelope, `FoodProvider` state) and the whole-branch pass of Part K get `opus55-reviewer-deep`.

Issues: phase 1 (#85–#94) is A–G; phase 2 (#95–#98) is H, I and K; phase 3 (#99–#101) is G and H; phase 4 (#102–#105) is J; phase 5 (#106–#108) is K.

### Part dependencies and parallel runs

| Part | Needs merged first | Consumes                                                                                  | Shares files with parts it does not need                                                      |
| ---- | ------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A    | —                  | —                                                                                         | `FoodApp.jsx` with C, F, G, J (each wires one tab or prop); `docs/DATA-MODEL.md` with C, D, E |
| B    | —                  | —                                                                                         | none (new files only)                                                                         |
| C    | A, B               | A: keys; B: `upsertTarget`, `deleteTarget`                                                | `FoodApp.jsx` with F, G, J; `FoodContext.jsx` with I, K; `docs/DATA-MODEL.md` with D, E       |
| D    | A                  | A: `K_FOOD_SEARCH_CACHE`                                                                  | `docs/DATA-MODEL.md` with C, E                                                                |
| E    | A, B               | A: keys; B: `SLOT_IDS`, `validateTarget`                                                  | `docs/DATA-MODEL.md` with C, D; `ARCHITECTURE.md` with K                                      |
| F    | B, C, D            | C: `useFood`; D: `searchFoods`, `isFixtureMode`, `FoodApiError`; B: slots, macros, dates  | `FoodApp.jsx` with G, J; `SearchView.jsx` with H, I, J, K; `SettingsView.jsx` with H, I       |
| G    | B, C               | C: `useFood`; B: macros, dates, targets                                                   | `FoodApp.jsx` with F, J; `TodayView.jsx`, `MealSlot.jsx` with I, K                            |
| H    | A, B, F            | F: `SearchView`, `SettingsView`; A, B: keys and helpers for the Home card                 | `SearchView.jsx`, `SettingsView.jsx` with I, J, K                                             |
| I    | C, F, G, H         | G: `MealSlot`, `TodayView`; F, H: `SearchView`, `SettingsView`; C: `FoodProvider`         | `TodayView.jsx`, `SearchView.jsx` with K; `FoodContext.jsx` with K                            |
| J    | D, F, H            | D: `lookupBarcode`; F: `SearchView`, `PortionSheet`; H: `CustomFoodForm`                  | `SearchView.jsx`, `FoodApp.jsx` with K and G                                                  |
| K    | B, C, F, G, H      | B: `touchRecent`; C: `FoodProvider`; G: `TodayView`; F, H: `SearchView`, `CustomFoodForm` | —                                                                                             |

```
A (Opus: shell, keys) ──┬─> C (Opus: FoodProvider) ──┬─> F (Opus: Search + Settings) ──┬─> H (Opus: custom foods + Home card) ──┬─> I (Opus: saved meals)
                        │                            │                                 │                                       ├─> J (Fable: barcode)
                        ├─> D (Fable: API client) ───┘                                 └─> G (Opus: Today + Trends) ───────────┴─> K (Opus: recent, offline, empty states, docs)
                        └─> E (Opus: backup)
B (Opus: pure helpers) ─┘  (B feeds C, E, F, G, H, K)
```

A and B run at the same time; B is the clean parallel (new files only). After A and B merge, C, D and E run at the same time; they share only `docs/DATA-MODEL.md` (each adds its own rows, so rebases are trivial). F waits for C and D. G and H run at the same time in wave 4; G follows F only because both wire `FoodApp.jsx`. Waves 5 to 7 are serialized by `SearchView.jsx`, `TodayView.jsx` and `FoodApp.jsx`, not by needs: I, J and K all edit `SearchView.jsx`, so they run one after another; J before K so that Task 15's final docs describe the scanner. Default order: A, B, C, D, E, F, G, H, I, J, K. Seven waves; the longest needs chain is A → C → F → H → K (five parts).

Every part handoff records its cost (session tokens, fix rounds, wall time) in this file.

### Part finish (every part; not a sized task)

The former Task 15 "finish" steps assumed one long-lived branch. The workflow is one PR per part, so each part ends with:

- [ ] **Gate:** `npm run check`, once before the PR and once more after `git fetch origin && git rebase origin/main` (git-workflow skill).
- [ ] **Review:** each task gets an `opus55-reviewer` pass; the tasks named above and Part K's whole-branch pass get `opus55-reviewer-deep`. Part K's whole-branch review confirms every spec §3–§9 item maps to a commit.
- [ ] **PR** via `superpowers:finishing-a-development-branch`; the owner merges. Close the part's issues with the merge SHA.
- [ ] **Handoff:** append a `## Part <X> handoff` section to this file: shipped commits, cost (session tokens, fix rounds, wall time), rulings, follow-ups, unchecked steps moved into a named later part.

Before the first production deploy that includes Part F, set `VITE_FOOD_API_BASE` in the gym-tracker Vercel project to the deployed API URL (macro-calculator Part G handoff). Until then the app runs in fixture mode.

## Part A handoff

**Shipped:** Task 1, commits `2f64093` (shell) and `44d9301` (theme test), plus the review follow-ups the owner asked to fold in: `aeaeba8` and `463749b` (#113, #114), `64f0b3d` (#115). Issues #85, #88, #113, #114 and #115 close with this PR. All 20 focused tests pass. A Playwright run on the dev server passed Step 5.

**Cost:** 520,529 subagent tokens across 8 agents in the workflow, plus about 80,000 for the follow-ups and the controller session (not measured); 2 fix rounds; 17 minutes for the workflow run.

**Rulings** (made by the Opus orchestrator; none went to the advisor or the user):

- Added `keys.test.js` and `FoodApp.test.jsx`, which Task 1's Files list omits but Global Constraints requires.
- An invalid `mgym.food.tab` value shows Today and is rewritten to `today` on load. The plan did not state this; `AppContent` also falls back for the gym tab.
- `/food` sets the page title to Food Tracker with an effect in `FoodApp`, for spec section 3.1's home screen icon. The owner did not name the text. Home screen naming on a real phone is not tested.
- Chose the four nav icon paths. The plan names none.
- Added the "live session still wins on /" test from spec section 9.
- The test in Step 1 for a stored session did not guard the line order. Its session names a workout that does not exist, so `LiveSession` ends it and the Food nav appears anyway. The test now also asserts the session stays stored, and a second test seeds a real workout.
- Commits carry the Opus trailer, not the Fable trailer in Global Constraints, because the session ran on Opus.

**Plan and spec differences left in place:** spec section 3.1 says "path starts with /food", while this plan excludes `/foods`. The code follows the plan.

**Not verified:** the `vercel.json` rewrite cannot run locally. Check `/food`, a hard reload and the browser console on the preview deployment.

**Follow-ups:** none open. `ARCHITECTURE.md` does not mention the `/food` branch yet; Task 15 covers that in Part K.

**Unchecked steps moved:** none.

**Next:** Part B can run now. Parts C, D and E need Parts A and B merged (D needs only A).

## Part B handoff

**Shipped:** `85c4de1` (Task 2), `fe42d01` (Task 11a), `1ac68fb` (review fixes). New files under `src/food/lib` only: `slots`, `macros`, `localDate`, `targets`, `recent`, each with a test.

**Cost:** 374,570 subagent tokens across 6 agents; controller session tokens not measured; 1 fix round; about 15 minutes in the workflow.

**Rulings** (from the `fable-fallback` decide stage, using the Fable advisor):

- `sumMacros` adds the rounded `entryMacros` values, so visible rows add up to the visible total.
- `validateTarget` messages for the other fields: `carb must be 0 or more`, `fat must be 0 or more`.
- The recent helper is named `touchRecent`, as in this plan. The spec says `touch`.
- `formatDayHeader` keeps the `undefined` locale, so an en-US user sees `Mon, Nov 2`, not `Mon 2 Nov`. It matches `src/components/Home.jsx`.
- Local-date tests add zone-stubbed cases, because the plan's 23:30 case cannot fail against the UTC bug.
- Commits use the Opus 5.5 trailer, because this session ran on Opus 5.5.

**Notes for later parts:**

- Part F (Task 7): `validateTarget` uses `Number.isFinite`, so numeric strings fail. `TargetsEditor` must convert inputs to numbers before calling it, or Save stays disabled.
- Part F and Part G (any test of the day header): do not assert the literal text `Mon 2 Nov`; the output depends on the machine locale.
- Part G (Task 6): `barTone(null)` returns `ok`. `MacroBars` must hide bars itself when there is no target.
- Part C and Part E: `targetForDate` throws on a null row, and `touchRecent` throws on a row with no `food`. Both rely on `FoodProvider` and `normalizeFoodData` to drop malformed rows. `addDays` returns `NaN-NaN-NaN` on a malformed date.

**Follow-ups:** #116 and #117 were fixed in this PR. No plan steps are left undone. Issue #86 stays open until Part A also merges, because it includes `keys.js`. Issue #97 stays open until Part K.
