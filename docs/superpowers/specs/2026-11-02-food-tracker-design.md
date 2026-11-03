# Food Tracker — design spec

**Date:** 2026-11-02
**Status:** draft for review
**Repos touched:** `thinhdp/gym-tracker` (this spec), `thinhdp/macro-calculator`
(companion spec: `docs/superpowers/specs/2026-11-02-public-foods-api-design.md`
in that repo)

## 1. Purpose

Log what you eat and see calories, protein, carbs and fat for each day next to
your training and bodyweight data, with a UI as plain as
[Stupid Simple Macros](https://www.mystupidsimpleapp.com/stupid-simple-macros).

The food tracker is a second full-screen mode of the gym-tracker site. It shares
localStorage and the backup file with the gym app but shows none of the gym UI.
Nutrition reference data (per-100 g macros and portions) comes from the
macro-calculator API; every logged entry is computed and stored in the browser.

Success for v1: a day's food can be logged in under a minute from the phone,
most entries after the first week come from Recent or Saved meals without a
network call, and the weekly intake average sits on the same chart as the
weekly bodyweight average.

## 2. Decisions already made

| Topic           | Decision                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Entry method    | Search a food list and pick a portion. No free-text sentence parsing, no manual kcal-only entry.                                  |
| Audience        | Public. Other people will use the deployed site.                                                                                  |
| Separation      | Same repo, same origin, separate full-screen mode at `/food`. Not a separate deploy.                                              |
| API access      | Food endpoints are public read-only; no API key in the bundle.                                                                    |
| Offline         | Recent, Saved meals and Custom foods work offline. New search and barcode need a connection. No queueing.                         |
| Meals           | Six fixed slots: Breakfast, Morning snack, Lunch, Afternoon snack, Dinner, Evening snack.                                         |
| Targets         | Four numbers (kcal, protein g, carb g, fat g), each set with an "applies from" date. Past days keep the target that applied then. |
| Over-target     | Bar colour only (amber at 90 %, red past 100 %). No popups.                                                                       |
| Barcode         | In v1. Browser camera, EAN/UPC.                                                                                                   |
| LLM             | Not used by the food tracker. The API's `POST /v1/macros` and its LLM stay as they are; disabling the LLM there is deferred.      |
| Dropped from v1 | Food bank, water, fibre, fasting timer, progress photos, coach export (covered by the gym backup file).                           |

## 3. Architecture

### 3.1 Two modes, one site

`App.jsx` picks a mode from `window.location.pathname`:

- path starts with `/food` → render `<FoodApp />`
- anything else → the existing gym app (`AppContent`)

Both render inside `AppProvider`, so the theme (`mgym.theme`, `dark` class on
`<html>`) applies to both. There is still no router. Switching modes is a full
navigation via a plain `<a href="/food">` / `<a href="/">`; localStorage
survives the reload. `/food` can be added to a phone home screen as its own
icon.

Vercel needs an SPA rewrite so `/food` serves `index.html`. Add to
`vercel.json`:

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

The Vite dev server already falls back to `index.html`.

### 3.2 Code layout

All food code lives under `src/food/` so it reads as its own app:

```
src/food/
├── FoodApp.jsx                 # mode root: FoodProvider + active tab + FoodBottomNav
├── context/FoodContext.jsx     # entries, targets, customFoods, savedMeals, recent + persistence
├── lib/
│   ├── keys.js                 # localStorage key constants (mgym.food.*)
│   ├── slots.js                # the six meal slots (id, label, order)
│   ├── macros.js               # entryMacros, sumMacros, pct, rounding
│   ├── targets.js              # targetForDate, upsertTarget, validation
│   ├── trends.js               # weekly buckets, averages, loggedDays, bodyweight join
│   ├── localDate.js            # todayLocal(), addDays()  (local-time YYYY-MM-DD)
│   ├── recent.js               # recent-foods ring (50 distinct), touchRecent()
│   ├── searchCache.js          # query → results cache, 7-day expiry, 200-entry cap
│   ├── foodApi.js              # the only file that knows the API shape
│   ├── foodApiFixture.js       # fixture fetch used in tests and when VITE_FOOD_API_BASE=fixture
│   ├── barcode.js              # detector selection (BarcodeDetector | zxing), format list
│   └── normalize.js            # normalizeFoodData() for backup import and load
└── components/
    ├── FoodBottomNav.jsx       # Today | Search | Trends | Settings
    ├── TodayView.jsx           # date header, MacroBars, RecentRow, six MealSlots
    ├── MacroBars.jsx           # four progress bars with amber/red thresholds
    ├── RecentRow.jsx           # one-tap re-log chips
    ├── MealSlot.jsx            # slot header + EntryRow list + "+"
    ├── EntryRow.jsx            # name, grams, kcal; tap → edit/delete
    ├── EntryEditSheet.jsx      # change grams / portion, delete (useConfirm)
    ├── SearchView.jsx          # text box, results, offline note, scan button, shortcuts
    ├── SearchResultRow.jsx     # name, kcal/100 g, source badge
    ├── PortionSheet.jsx        # portion picker + grams + slot picker + Add
    ├── BarcodeScanner.jsx      # camera view, manual code field fallback
    ├── CustomFoodForm.jsx      # name, barcode?, per-100 g values, optional portion
    ├── SavedMealsPanel.jsx     # list, log a meal into a slot, create from a slot
    ├── TrendsView.jsx          # weekly bars + bodyweight line (Recharts), range toggle
    ├── SettingsView.jsx        # targets editor, custom foods, saved meals, back to gym
    └── TargetsEditor.jsx       # current targets + applies-from + history list
```

Gym-side changes are limited to:

- `src/App.jsx` — path check, render `FoodApp`.
- `src/components/FoodSummaryCard.jsx` (new) — Home card, see §6.5.
- `src/components/Home.jsx` — mount the card.
- `src/components/DataManagementMenu.jsx` + `src/lib/backup.js` — backup
  envelope, see §5.
- `vercel.json` — SPA rewrite.

`FoodApp` reuses `ui/` primitives (`Button`, `Input`, `Card`, `Badge`,
`Segmented`), `useConfirm()`, `loadLS`/`saveLS`, `ymdFromDate`, and Recharts
(already a dependency). No CSS files, no TypeScript.

### 3.3 Dependencies

One new runtime dependency: a barcode decoder for browsers without
`BarcodeDetector` (iPhone Safari). Use `@zxing/browser` (with `@zxing/library`),
loaded with a dynamic `import()` only when the scanner opens so the main bundle
does not grow. Chrome on Android uses the built-in `BarcodeDetector`.

### 3.4 Network

`src/food/lib/foodApi.js` is the single network client, modelled on
`src/lib/fvApi.js`:

- Base URL from `import.meta.env.VITE_FOOD_API_BASE`, set at build time in
  the gym-tracker Vercel project to the deployed macro-calculator URL. There
  is no hard-coded default: when the variable is unset or equals `fixture`,
  the client runs on `foodApiFixture.js` and Search shows a small "demo data"
  badge so a missing variable is visible, not silent.
- `searchFoods(query, { fetchImpl, signal })` → `GET /v1/foods?q=&limit=20`
- `lookupBarcode(code, { fetchImpl })` → `GET /v1/foods/barcode/:code`
- No `Authorization` header. The API protects these routes with per-IP rate
  limits and an Origin allowlist (companion spec).
- Both functions read and write `searchCache.js` and never throw for a cache
  hit. Network failures throw a plain `Error` with a `kind` of `offline`,
  `rate_limited`, `not_found` or `unavailable`; the views map these to one-line
  messages.

## 4. API contract (owned by the macro-calculator spec, quoted here)

`GET /v1/foods?q=<text>&limit=<n>` → `200`

```json
{
  "requestId": "req_…",
  "query": "chicken breast",
  "results": [
    {
      "id": "9f1d…",
      "name": "chicken, breast, roasted",
      "prepState": "roasted",
      "source": "usda_fdc",
      "isVerified": true,
      "barcode": null,
      "per100": { "kcal": 165, "protein": 31.0, "carb": 0, "fat": 3.6 },
      "portions": [
        { "label": "1 breast", "grams": 172, "isDefault": true },
        { "label": "1 oz", "grams": 28.35, "isDefault": false }
      ]
    }
  ]
}
```

`GET /v1/foods/barcode/<code>` → `200 { "requestId", "food": { …same shape… } }`
or `404 { "error": { "code": "not_found" } }`.

`source` is one of `usda_fdc`, `open_food_facts`. The UI shows a badge: USDA,
Product. Custom foods (local only) show Custom. Unknown fields are ignored.
`limit` is capped at 20 on the server.

## 5. Data model

All keys are read and written through `loadLS`/`saveLS`. Constants live in
`src/food/lib/keys.js`.

| Key                        | Holds                                           | In backup            |
| -------------------------- | ----------------------------------------------- | -------------------- |
| `mgym.food.entries.v1`     | `FoodEntry[]`                                   | yes                  |
| `mgym.food.targets.v1`     | `TargetPeriod[]`                                | yes                  |
| `mgym.food.customFoods.v1` | `CustomFood[]`                                  | yes                  |
| `mgym.food.savedMeals.v1`  | `SavedMeal[]`                                   | yes                  |
| `mgym.food.recent.v1`      | `RecentFood[]`                                  | yes                  |
| `mgym.food.searchCache.v1` | `{ [normQuery]: { at, results } }`              | no (network cache)   |
| `mgym.food.tab`            | `"today" \| "search" \| "trends" \| "settings"` | no (device UI state) |

### 5.1 FoodRef

Where an entry's nutrition came from. Stored inside entries, saved-meal items
and recent foods.

| Field     | Type               | Notes                                                      |
| --------- | ------------------ | ---------------------------------------------------------- |
| `kind`    | `"db" \| "custom"` | `db` = macro-calculator food, `custom` = local custom food |
| `id`      | `string`           | API food id, or `CustomFood.id`                            |
| `barcode` | `string?`          | present when the item was reached by scan                  |

### 5.2 FoodEntry

One logged item.

| Field          | Type                           | Notes                                      |
| -------------- | ------------------------------ | ------------------------------------------ |
| `id`           | `string`                       | `uuid()`                                   |
| `date`         | `string`                       | local `YYYY-MM-DD` (see §5.8)              |
| `slot`         | `string`                       | one of the six slot ids in `slots.js`      |
| `name`         | `string`                       | display name at time of logging            |
| `grams`        | `number`                       | > 0                                        |
| `per100`       | `{ kcal, protein, carb, fat }` | copied at time of logging; never rewritten |
| `food`         | `FoodRef`                      |                                            |
| `portionLabel` | `string?`                      | e.g. `"1 large egg"`; informational        |
| `createdAt`    | `number`                       | epoch ms                                   |

Macros for an entry are always derived: `grams × per100 / 100`. They are never
stored. `macros.js` exports `entryMacros(entry)`, `sumMacros(entries)`, and
rounding helpers (kcal to integer, grams to 1 dp).

### 5.3 TargetPeriod

| Field     | Type     | Notes                                  |
| --------- | -------- | -------------------------------------- |
| `from`    | `string` | local `YYYY-MM-DD`; unique in the list |
| `kcal`    | `number` | > 0                                    |
| `protein` | `number` | g, ≥ 0                                 |
| `carb`    | `number` | g, ≥ 0                                 |
| `fat`     | `number` | g, ≥ 0                                 |

`targetForDate(targets, date)` returns the row with the greatest `from` that is
≤ `date`, or `null`. Saving targets with a `from` that already exists replaces
that row. Rows can be deleted from the history list; deleting the only row
leaves the app with no target (plain totals, no bars).

### 5.4 CustomFood

| Field       | Type                           | Notes                                                                 |
| ----------- | ------------------------------ | --------------------------------------------------------------------- |
| `id`        | `string`                       | `uuid()`                                                              |
| `name`      | `string`                       | required                                                              |
| `barcode`   | `string?`                      | set when created from a failed scan                                   |
| `per100`    | `{ kcal, protein, carb, fat }` | required; kcal may be left blank and is then computed as 4P + 4C + 9F |
| `portions`  | `{ label, grams }[]`           | optional, usually one ("1 serving = 45 g")                            |
| `createdAt` | `number`                       |                                                                       |

Editing a custom food changes future entries only. Existing entries keep their
`per100` copy.

### 5.5 SavedMeal

| Field       | Type                                             | Notes                                      |
| ----------- | ------------------------------------------------ | ------------------------------------------ |
| `id`        | `string`                                         |                                            |
| `name`      | `string`                                         |                                            |
| `items`     | `{ name, grams, per100, food, portionLabel? }[]` | same fields as an entry minus id/date/slot |
| `createdAt` | `number`                                         |                                            |

Logging a saved meal copies each item into a new `FoodEntry` for the chosen
date and slot. "Save as meal" on a slot builds a `SavedMeal` from that slot's
entries.

### 5.6 RecentFood

The last 50 distinct foods logged, newest first, keyed by `kind + id`.

| Field              | Type                             | Notes                              |
| ------------------ | -------------------------------- | ---------------------------------- |
| `food`             | `FoodRef`                        |                                    |
| `name`             | `string`                         |                                    |
| `per100`           | `{ kcal, protein, carb, fat }`   |                                    |
| `portions`         | `{ label, grams, isDefault? }[]` | from the API result or custom food |
| `lastGrams`        | `number`                         | what you logged last time          |
| `lastPortionLabel` | `string?`                        |                                    |
| `lastAt`           | `number`                         | epoch ms                           |

`touchRecent(list, item)` moves or inserts the item at the front and trims to 50. This list is what makes offline logging work: tapping a chip logs
`lastGrams` of that food in one step; opening it lets you change the portion.

### 5.7 Search cache

`{ [normalisedQuery]: { at: epochMs, results: ApiFood[] } }`. Entries older than
7 days are ignored and pruned on write. When the map exceeds 200 queries the
oldest `at` is dropped. Barcode lookups are cached under `bc:<code>`.

### 5.8 Dates are local

`todayStr()` in `src/lib/storage.js` slices a UTC ISO string, so in UTC+7 an
entry logged before 07:00 local would land on the previous day. The food tracker uses
`ymdFromDate(new Date())` from `src/lib/date.js` (already local-time) through
`localDate.todayLocal()`. Switching the gym app's `todayStr()` to local time is
recorded in the backlog as a separate item; it is not part of this work.

### 5.9 Backup envelope

The `mgym.v1` export gains one field:

```json
"food": {
  "entries": [], "targets": [], "customFoods": [], "savedMeals": [], "recent": []
}
```

Import runs `normalizeFoodData(raw.food)` (in `src/food/lib/normalize.js`),
which coerces each list, drops rows that fail shape checks (missing id, bad
date, non-positive grams, non-numeric per100), and never throws. Then:

| Mode    | Rule                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| merge   | Union by `id` for entries, customFoods, savedMeals; union by `from` for targets; union by `kind+id` for recent keeping the newer `lastAt`. Existing rows win on conflict. |
| replace | Each list is overwritten.                                                                                                                                                 |

A backup without a `food` field leaves food data untouched in both modes.

Merge rewrites no stored row, except a recent row replaced by a newer `lastAt`. The
recent list is also de-duplicated and capped, which can remove stored rows.
A merge runs `normalizeFoodData` on incoming rows only. The detailed row rules are in
`docs/superpowers/plans/2026-11-02-food-tracker-handoffs.md` (Part E rulings).

**Loading stored rows (issue #126).** The same rules also apply when stored rows are
read, so one shape rule covers load and import:

- `FoodProvider` loads all five lists through `normalizeFoodData`. Its existing
  write-back then saves the result, so a row that fails the rules is deleted from
  storage for good, and a row the rules repair (a missing `createdAt`, an optional
  field of the wrong type) is saved repaired. Valid rows the app wrote keep every value
  they hold. A stored non-array still loads as `[]` and is overwritten, as before.
- A merge restore can still keep a malformed stored row. The next `/food` load removes
  it.
- `FoodProvider` exposes `droppedRows`: for the lists stored as arrays, the number of
  rows in storage minus the number of rows after normalising, summed over the five
  lists. A duplicate counts as removed. A stored non-array counts as 0. A saved meal
  that loses some items but stays counts as 0, and so does a repaired row.
- When `droppedRows` is above 0, `/food` shows a one-line note on every tab until the
  next page load: "Removed N damaged food row(s) from this device. A backup can restore
  them." Nothing about the note is stored. The write-back has already removed the rows,
  so the next load counts 0 and shows no note. The owner chose this on 2026-11-03.
- `FoodSummaryCard` on gym Home reads entries and targets through the same rules and
  uses the result for that render only. It writes nothing, so it deletes nothing and
  shows no note. Home shows the same totals `/food` will show. Other views read these
  lists from `FoodProvider`.
- A backup export reads storage as it is, so it includes a malformed row until `/food`
  has loaded once.

## 6. Screens

The food app has its own four-tab bottom bar (`FoodBottomNav`), styled like the
gym `BottomNav`. The active tab persists in `mgym.food.tab`.

### 6.1 Today

- Header: the date (e.g. "Mon 2 Nov") with ‹ › arrows to move a day; a
  "Today" button appears when not on today.
- `MacroBars`: four horizontal bars (Calories, Protein, Carbs, Fat), each
  labelled `eaten / target` with the unit. Fill colour: default up to 90 %,
  amber from 90 %, red past 100 %. With no target, totals show as plain numbers
  and bars are hidden.
- `RecentRow`: horizontally scrolling chips (name · lastGrams). Tap logs that
  food at `lastGrams` into the slot nearest the current time (Breakfast before
  10:00, Morning snack to 11:30, Lunch to 14:00, Afternoon snack to 17:00,
  Dinner to 20:30, Evening snack after), with a 3-second undo toast. Long press
  or the chip's "…" opens `PortionSheet` to change grams or slot.
- Six `MealSlot`s in order. Each shows its label, the slot kcal total, its
  `EntryRow`s (name, grams or portion label, kcal), a "+" button that opens
  Search with the slot preselected, and a "…" menu with "Save as meal" (when the
  slot has entries) and "Log saved meal".
- Tapping an `EntryRow` opens `EntryEditSheet`: portion picker (if the food has
  portions), grams field, slot picker, Delete (via `useConfirm`), Save.

### 6.2 Search

- Text box, autofocus. Results request after 2 characters, 300 ms debounce,
  previous in-flight request aborted. Cache is checked first.
- Result rows: name (with prepState when present), kcal per 100 g, source
  badge. Custom foods matching the text appear at the top with a Custom badge.
- Tapping a result opens `PortionSheet`: portion chips (from `portions`, default
  selected), a grams field that updates when a chip is tapped, the computed kcal
  and macros for that amount, a slot picker (preselected from where Search was
  opened, else by time of day), and Add. Add writes the entry, touches Recent,
  returns to Today.
- A camera button opens `BarcodeScanner`. On a successful decode:
  `lookupBarcode` → `PortionSheet`. On `not_found`: `CustomFoodForm` with the
  barcode prefilled. On camera permission denied or no camera: a manual code
  field with the same flow.
- Offline (no network, or the request failed with `offline`): the text box is
  disabled with "Search needs a connection"; the scan button is hidden; a
  Recent list, Saved meals and Custom foods are shown instead, all loggable.
- `rate_limited` → "Too many searches, wait a minute". `unavailable` →
  "Search unavailable, try again". Both leave the shortcuts usable.
- Bottom shortcuts: Saved meals, Custom foods, Create custom food.

### 6.3 Trends

- Weekly buckets (Monday start, using `dateUtils` week helpers) over a range
  toggle: 4 weeks, 12 weeks, All.
- Chart (Recharts `ComposedChart`): bars for average daily kcal per week;
  a line for the weekly bodyweight average from `weightLogs` (via
  `weightUtils.averageWeightInRange`) on a second axis. A segmented control
  swaps the bars between Calories, Protein, Carbs, Fat.
- Averages divide by the number of logged days in the week (days with ≥ 1
  entry), not by 7. Each week label shows the logged-day count ("5/7"); weeks
  with 0 logged days render as a gap.
- Under the chart: a table of the same weeks (week, avg kcal, avg P/C/F,
  logged days, avg bodyweight, bodyweight change vs previous week).

### 6.4 Settings

- `TargetsEditor`: the four current numbers, an "applies from" date (default
  today), Save. Below, the history list (from → kcal/P/C/F) with edit and delete
  per row. A helper line shows kcal implied by the macros (4P + 4C + 9F) so a
  mismatch is visible.
- Custom foods: list with edit and delete (`useConfirm`).
- Saved meals: list with rename and delete.
- "Back to Gym" link (`<a href="/">`).

### 6.5 Gym Home card

`FoodSummaryCard` on the gym Home, under today's workout / next-session card:

- With a target: "Food today" title, one bar kcal eaten / target with the same
  colour rules, protein eaten / target as text, and a chevron. Tap →
  `<a href="/food">`.
- Without a target or with no entries ever: "Set up food tracking →".
- Reads `mgym.food.entries.v1` and `mgym.food.targets.v1` directly through the
  food lib (`loadLS` + `targetForDate` + `sumMacros`); it does not use
  `FoodContext`.

## 7. State and persistence inside the food app

`FoodProvider` (in `src/food/context/FoodContext.jsx`) owns `entries`,
`targets`, `customFoods`, `savedMeals`, `recent`, each initialised lazily with
`loadLS` and written back by a `useEffect` on change, the same pattern as
`AppProvider`. It exposes `useFood()` with the lists and these actions:
`addEntry`, `updateEntry`, `deleteEntry`, `logSavedMeal`, `saveMealFromSlot`,
`upsertCustomFood`, `deleteCustomFood`, `upsertTarget`, `deleteTarget`,
`touchRecent`. Views read `useFood()` directly; presentational children get
props.

`searchCache` and `tab` are not in context; `foodApi.js` and `FoodApp` own them
with `loadLS`/`saveLS` directly.

## 8. Error handling

| Situation                        | Behaviour                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Network error / offline          | Search box disabled with one-line note; Recent, Saved meals, Custom foods usable. |
| 429 from API                     | One-line note; shortcuts usable. Retry allowed after the next keystroke.          |
| 5xx / timeout (8 s)              | One-line note "Search unavailable, try again".                                    |
| Barcode not found                | `CustomFoodForm` with barcode prefilled.                                          |
| Camera denied / absent           | Manual barcode field.                                                             |
| Invalid grams (≤ 0, NaN)         | Add/Save disabled; field outlined.                                                |
| Target with kcal ≤ 0             | Save disabled.                                                                    |
| Backup import with bad food rows | Rows dropped by `normalizeFoodData`; import continues.                            |
| Malformed stored food rows       | Removed on `/food` load, with a one-line note (section 5.9). Home ignores them.   |
| localStorage write throws        | Existing `saveLS` behaviour (unchanged).                                          |

No `window.alert` / `window.confirm`; use `useConfirm()` and inline notes.

## 9. Testing

Per `docs/TESTING.md`: every `src/food/lib/*.js` has a co-located `*.test.js`;
components with logic have `*.test.jsx` with React Testing Library; `npm run
check` must pass.

Lib tests (minimum):

- `macros.js` — entryMacros scaling, rounding, sum over empty list.
- `targets.js` — targetForDate picks the latest `from` ≤ date, returns null
  before the first row, replace-on-same-`from`.
- `trends.js` — weekly bucketing across a month boundary, average by logged
  days not 7, zero-day weeks produce gaps, bodyweight join.
- `localDate.js` — local date at 06:30 in UTC+7 stays on the same day (a UTC slice gives the previous day).
- `recent.js` — moves existing item to front, caps at 50, keyed by kind+id.
- `searchCache.js` — expiry at 7 days, 200-entry cap drops oldest.
- `foodApi.js` — builds URLs, no Authorization header, maps 429/404/network to
  error kinds, cache hit avoids fetch (inject `fetchImpl` like `fvApi.test.js`).
- `normalize.js` — drops malformed rows, keeps valid, merge rules.
- `slots.js` — slot by time of day boundaries.

Component tests (minimum):

- `MacroBars` — colour class at 89 %, 90 %, 100 %, 101 %; hidden without target.
- `TodayView` — renders six slots in order, entries land in the right slot,
  day navigation changes totals.
- `PortionSheet` — portion chip sets grams, computed kcal updates, Add calls
  `addEntry` with the snapshot `per100`.
- `SearchView` — debounce + abort, offline state shows shortcuts, 429 note.
- `TargetsEditor` — save with from-date, history list order, delete via confirm.
- `FoodSummaryCard` — target vs none, totals for today only.
- `App` — `/food` renders `FoodApp`; `/` renders gym; live session still wins
  on `/`.
- `DataManagementMenu` — export includes `food`; import merge/replace rules.

Manual checks (cannot run in jsdom): barcode scan on an iPhone (zxing path) and
an Android phone (`BarcodeDetector` path); `/food` as a home-screen icon;
dark mode in both modes.

## 10. Delivery order

Each step is usable on its own and ships as its own PR slice:

1. `/food` mode shell, `FoodProvider`, Today + Search against the API (database
   foods only), targets in Settings, backup envelope. Needs the API search
   endpoint deployed; UI tests use the fixture.
2. Custom foods, Saved meals, Recent row, offline states.
3. Trends view and the gym Home card.
4. Barcode scanning.
5. Polish: target history editing, undo toast, empty states.

The API companion work (search endpoint, barcode endpoint, FNDDS ingestion)
runs first in `macro-calculator`; see that repo's spec.

## 11. Out of scope for v1 (recorded for later)

- Target suggestion from bodyweight, sex, birth year and goal.
- Per-weekday targets.
- Water, fibre, fasting, progress photos, food bank.
- Sharing custom foods back to the API's review queue.
- Free-text meal entry via `POST /v1/macros`.
- Changing the gym app's `todayStr()` to local time (separate backlog item).
