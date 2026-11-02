# Food Tracker — backlog

Companion to `2026-11-02-food-tracker-design.md`. Items are ordered for
delivery. "Repo" says where the work lands. Status column is for tracking.

## Phase 0 — API (macro-calculator)

| #   | Item                                                                                                                                                                        | Repo             | Status |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| 0.1 | `GET /v1/foods?q=&limit=` public search endpoint: verified foods only, scored match, per100 + portions in response, Upstash cache 24 h                                      | macro-calculator | todo   |
| 0.2 | Public rate-limit middleware variant (IP + daily global, no key tier) and CORS for `/v1/foods*`                                                                             | macro-calculator | todo   |
| 0.3 | `GET /v1/foods/barcode/:code`: indexed lookup on `(source, source_ref)`, live Open Food Facts fetch on miss (5 s timeout, 10/min/IP), save complete products, 404 otherwise | macro-calculator | todo   |
| 0.4 | OpenAPI regenerated; `docs/API_SPEC.md` section; `docs/DECISIONS.md` entry for public read-only endpoints                                                                   | macro-calculator | todo   |
| 0.5 | `ingest:usda --subset fndds` (USDA Survey / FNDDS cooked and mixed dishes)                                                                                                  | macro-calculator | todo   |
| 0.6 | Deploy; set `ALLOWED_ORIGINS` to include the gym-tracker production origin and `http://localhost:5173`; record the deployed API URL for gym-tracker item 1.5                | macro-calculator | todo   |

## Phase 1 — Shell, Today, Search, Targets (gym-tracker)

| #    | Item                                                                                                                                                           | Repo        | Status |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| 1.1  | `vercel.json` SPA rewrite; `App.jsx` path check renders `FoodApp` at `/food`                                                                                   | gym-tracker | todo   |
| 1.2  | `src/food/lib`: `keys.js`, `slots.js`, `macros.js`, `targets.js`, `localDate.js` with tests                                                                    | gym-tracker | todo   |
| 1.3  | `FoodContext` provider: entries, targets, customFoods, savedMeals, recent; lazy load + reactive save                                                           | gym-tracker | todo   |
| 1.4  | `FoodBottomNav` + `FoodApp` tab shell; `mgym.food.tab` persistence                                                                                             | gym-tracker | todo   |
| 1.5  | `foodApi.js` + `foodApiFixture.js` + `searchCache.js` with tests; `VITE_FOOD_API_BASE` env set in the gym-tracker Vercel project; "demo data" badge when unset | gym-tracker | todo   |
| 1.6  | `SearchView`, `SearchResultRow`, `PortionSheet` (database foods only)                                                                                          | gym-tracker | todo   |
| 1.7  | `TodayView`, `MacroBars`, `MealSlot`, `EntryRow`, `EntryEditSheet`, day navigation                                                                             | gym-tracker | todo   |
| 1.8  | `SettingsView` + `TargetsEditor` (set targets with applies-from; history list)                                                                                 | gym-tracker | todo   |
| 1.9  | Backup envelope `food` field; `normalizeFoodData`; merge/replace rules; tests in `backup.test.js` and `DataManagementMenu.test.jsx`                            | gym-tracker | todo   |
| 1.10 | `docs/DATA-MODEL.md` and `ARCHITECTURE.md` updated for the food mode and keys                                                                                  | gym-tracker | todo   |

## Phase 2 — Custom foods, Saved meals, Recent, offline

| #   | Item                                                                                            | Repo        | Status |
| --- | ----------------------------------------------------------------------------------------------- | ----------- | ------ |
| 2.1 | `CustomFoodForm`; custom foods appear in Search results; manage in Settings                     | gym-tracker | todo   |
| 2.2 | `SavedMealsPanel`; "Save as meal" from a slot; "Log saved meal" into a slot; manage in Settings | gym-tracker | todo   |
| 2.3 | `recent.js` + `RecentRow` one-tap re-log with undo toast; slot-by-time default                  | gym-tracker | todo   |
| 2.4 | Offline and error states in Search (disabled box, shortcuts shown, 429/5xx notes)               | gym-tracker | todo   |

## Phase 3 — Trends and Home card

| #   | Item                                                                         | Repo        | Status |
| --- | ---------------------------------------------------------------------------- | ----------- | ------ |
| 3.1 | `trends.js` weekly buckets, logged-day averages, bodyweight join, with tests | gym-tracker | todo   |
| 3.2 | `TrendsView` chart (Recharts ComposedChart) + table; 4w/12w/All              | gym-tracker | todo   |
| 3.3 | `FoodSummaryCard` on gym Home                                                | gym-tracker | todo   |

## Phase 4 — Barcode

| #   | Item                                                                                                           | Repo        | Status |
| --- | -------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| 4.1 | `barcode.js`: `BarcodeDetector` when available, else dynamic-import `@zxing/browser`; EAN-13/EAN-8/UPC-A/UPC-E | gym-tracker | todo   |
| 4.2 | `BarcodeScanner` component: camera view, permission-denied and no-camera fallbacks, manual code field          | gym-tracker | todo   |
| 4.3 | Scan → `lookupBarcode` → `PortionSheet`; miss → `CustomFoodForm` prefilled                                     | gym-tracker | todo   |
| 4.4 | Manual check on iPhone Safari and Android Chrome; note results in the PR                                       | gym-tracker | todo   |

## Phase 5 — Polish

| #   | Item                                                   | Repo        | Status |
| --- | ------------------------------------------------------ | ----------- | ------ |
| 5.1 | Edit and delete rows in target history                 | gym-tracker | todo   |
| 5.2 | Empty states (no entries today, no targets, no recent) | gym-tracker | todo   |
| 5.3 | README feature list and screenshots for the food mode  | gym-tracker | todo   |

## Later (not v1)

| Item                                                    | Note                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| Target suggestion from bodyweight log, profile and goal | Uses `weightLogs` + `mgym.profile.v1`; v2                           |
| Per-weekday targets                                     | Asked for by SSM users; v2                                          |
| Switch gym `todayStr()` to local time                   | Fixes the same UTC day-boundary issue for workouts; separate change |
| Share custom foods to the API review queue              | Needs a write endpoint and moderation; v2                           |
| Decide whether to disable the LLM on `POST /v1/macros`  | Deferred by product owner; not needed by the food tracker           |
| Water, fibre, fasting, photos, food bank                | Dropped from v1 by product owner                                    |
