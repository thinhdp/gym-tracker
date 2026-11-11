# Food: complete days, month calendar, Trends filter — design spec

**Status:** draft
**Date:** 2026-11-11
**Issue:** #168
**Builds on:** `docs/superpowers/specs/2026-11-02-food-tracker-design.md` (the food
tracker spec; section numbers below that start with "food spec" point there)

## 1. Purpose

A day's food log is often half filled in. Weekly averages on Trends then mix
fully tracked days with partly tracked ones. This change lets the user mark a day
as completely tracked, filter Trends by that mark, and see a month of daily
calorie totals with the completed days in green.

Success: a day can be marked complete in one tap from the daily tab; Trends can
show averages over completed days only; one sheet shows a month of daily kcal
totals and opens any day in one tap.

## 2. Decisions already made

| Topic              | Decision                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Complete button    | On the daily tab, under the meal slots. A toggle: tapping a completed day's button removes the mark.               |
| Fasting day        | A completed day with no entries is a fasting day. It counts as a day with 0 kcal and 0 g of each macro.            |
| Editing afterwards | Adding, editing or deleting entries on a completed day keeps the mark.                                             |
| Future dates       | A date after today cannot be marked complete. The button is not shown there.                                       |
| Calendar location  | A sheet opened by tapping the date in the daily tab header. No new bottom-nav tab.                                 |
| Calendar content   | One month, Monday first. Each cell: day number and that day's total kcal. Completed days have a green background.  |
| Trends filter      | A third selector: All days / Complete / Incomplete. Default All days. Not stored; it resets like range and metric. |
| Bodyweight         | The Trends bodyweight line and columns do not change with the filter.                                              |

## 3. Data model

### 3.1 New key

| Key                          | Owner                               | Shape      | Default |
| ---------------------------- | ----------------------------------- | ---------- | ------- |
| `mgym.food.completedDays.v1` | `FoodProvider` (`K_FOOD_COMPLETED`) | `string[]` | `[]`    |

Each item is a local date `YYYY-MM-DD` (food spec 5.8). The list holds each date
at most once and is sorted oldest first. A date in the list is a completed day;
a date not in the list is not. No other key or stored shape changes.

### 3.2 Shape rules

`normalizeFoodData` gains a `completedDays` list beside the five it has. An item
is kept only when it is a string, matches `YYYY-MM-DD` and is a real date (the
same date rule as `FoodEntry.date`). Duplicates are removed and the result is
sorted. A stored value that is not an array loads as `[]`.

`FoodProvider` loads the key through these rules, like the other lists. Removed
items add to the dropped-row count in the one-line note on `/food` (food spec
5.9); a removed duplicate counts as one dropped row.

### 3.3 Writes (write and shared-state checklist)

| Write                              | What happens to data that already exists                                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toggleDayComplete(date)`          | Adds the date when absent, removes it when present. No other date changes. `entries` is not written.                                                                    |
| Backup export                      | `food.completedDays` is added to the envelope, read from storage as it is.                                                                                              |
| Backup import, merge               | The stored list becomes the union of stored and incoming dates. Merge never removes a mark.                                                                             |
| Backup import, replace             | The incoming list overwrites the stored list. A backup whose `food` has no `completedDays` (every backup made before this change) counts as `[]` and removes all marks. |
| Backup with no `food` plain object | Food data is untouched, as today.                                                                                                                                       |
| Deleting the last entry of a day   | The mark stays; the day is then a fasting day.                                                                                                                          |

The replace row follows the existing rule that a list missing from `food` counts
as `[]` (`docs/DATA-MODEL.md`, backup section).

### 3.4 What other views see

- **Gym Home `FoodSummaryCard`:** reads entries and targets only. No change.
- **Daily tab macro bars, meal slots, Recent, Saved meals, Search, Settings:** no
  change.
- **Trends, All days:** a completed day with no entries now counts as a logged
  day with zeros. Weeks without such a day show the same numbers as before.

`docs/DATA-MODEL.md` gets the new key, the shape rules and the backup rows in the
same PR as the code.

## 4. Screens

### 4.1 Daily tab

- Under the last meal slot: a full-width button. Text "Mark day complete" when
  the shown date is not completed; "Completed ✓" with a green style when it is.
  Tapping toggles the mark for the shown date. No confirm dialog: the mark holds
  no data and one more tap restores it.
- The button is not rendered when the shown date is after today.
- The date in the header becomes a button (accessible name "Open calendar") that
  opens the calendar sheet. The ‹ › and Today buttons stay as they are.

### 4.2 Calendar sheet

A sheet in the same style as the other food sheets (`role="dialog"`, Close
button).

- Opens on the month of the date shown in the daily tab.
- Header: month and year, with ‹ › buttons for the previous and next month.
- Grid: seven columns, Monday first, with weekday letters above. Cells outside
  the month are empty.
- Each day cell shows the day number and, below it, the day's total kcal as a
  whole number. A day with no entries and no mark shows no number. A completed
  day with no entries shows `0`.
- A completed day has a green background, readable in light and dark theme. The
  date shown in the daily tab has an outline. Today's day number is bold.
- Tapping a day cell calls `onChangeDate` with that date and closes the sheet.
  Future days can be tapped, as ‹ › already reaches them.
- Each cell's accessible name carries the date, the kcal when shown, and
  "completed" when marked.

### 4.3 Trends

- A third `Segmented` beside range and metric: All days / Complete / Incomplete.
- Which days count in a week's average:

| Filter     | A day counts when                              |
| ---------- | ---------------------------------------------- |
| All days   | it has at least one entry, or it is completed  |
| Complete   | it is completed                                |
| Incomplete | it has at least one entry and is not completed |

- The average divides by the number of counted days. A counted day with no
  entries adds zeros. A week with no counted days shows dashes and no bar, as a
  week with no entries does today.
- The Days column and the chart tick labels show counted days out of 7.
- Range "All" starts at the week of the earliest entry or completed day.
- The "No food logged yet" line shows only when there are no entries and no
  completed days.
- Bodyweight and Change columns and the bodyweight line ignore the filter.

## 5. Code layout

| File                                          | Change                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/food/lib/keys.js`                        | `K_FOOD_COMPLETED`                                                                                |
| `src/food/lib/normalize.js`                   | `completedDays` in `normalizeFoodData` and `mergeFoodData`                                        |
| `src/food/lib/backupFood.js`                  | export and import the sixth list                                                                  |
| `src/food/context/FoodContext.jsx`            | `completedDays` in the stored lists; `toggleDayComplete(date)`                                    |
| `src/food/lib/trends.js`                      | `weeklyIntake` takes `completedDays` and `filter` (`"all"`, `"complete"`, `"incomplete"`)         |
| `src/food/lib/calendar.js` (new)              | `monthGrid(year, month)`: the weeks of a month, Monday first; `dayTotals(entries)`: kcal per date |
| `src/food/components/CalendarSheet.jsx` (new) | the sheet in 4.2; props `date`, `onPick`, `onClose`                                               |
| `src/food/components/TodayView.jsx`           | Complete button, date header button, renders `CalendarSheet`                                      |
| `src/food/components/TrendsView.jsx`          | filter selector; passes `completedDays` and `filter` to `weeklyIntake`                            |
| `docs/DATA-MODEL.md`                          | section 3 of this spec                                                                            |

The gym `src/components/CalendarView.jsx` is not reused: it is tied to workouts
and `AppContext`. No new library.

## 6. Testing

Co-located tests, per `docs/TESTING.md`:

- `normalize.test.js`: invalid, duplicate and unsorted `completedDays`; merge is
  a union.
- `backupFood.test.js`: export includes the list; merge keeps stored marks;
  replace overwrites; replace from a backup without the list empties it; a
  backup with no `food` leaves it.
- `FoodContext.test.jsx`: toggle adds then removes; the list is saved to its key;
  invalid stored items add to the dropped count.
- `trends.test.js`: each filter's counted days and averages; a fasting day counts
  as zeros in All days and Complete; range "All" starts at an early completed day.
- `calendar.test.js`: grid for months starting on Monday and on Sunday, February
  in a leap year; day totals.
- `CalendarSheet.test.jsx`: kcal per cell, completed cell marked, month
  navigation, tapping a day calls `onPick`.
- `TodayView.test.jsx`: button toggles and changes text; hidden on a future date;
  header date opens the sheet; picking a day changes the date.
- `TrendsView.test.jsx`: the filter changes the Days column and averages.

## 7. Out of scope

- A month total or month average in the calendar.
- Colouring calendar days by target (over or under).
- A completed mark on the gym Home card.
- Storing the Trends filter choice.
- Marking a day complete automatically.
