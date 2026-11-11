import { ymdFromDate } from "../../lib/date";
import { startOfWeekMonday, weekKey, weekLabel } from "../../lib/dateUtils";
import { averageWeightInRange } from "../../lib/weightUtils";
import { addDays, localDateFromYmd, todayLocal } from "./localDate";
import { round1, sumMacros } from "./macros";

const mondayOf = (ymd) => ymdFromDate(startOfWeekMonday(localDateFromYmd(ymd)));

const weekAverageWeight = (weightLogs, monday) =>
  averageWeightInRange(
    weightLogs,
    localDateFromYmd(monday),
    localDateFromYmd(monday, 6),
  );

// Which days count: complete = completed; incomplete = has entries and not
// completed; all = has entries or completed.
const countsDay = (filter, hasEntries, completed) => {
  if (filter === "complete") return completed;
  if (filter === "incomplete") return hasEntries && !completed;
  return hasEntries || completed;
};

const buildRow = (entries, weightLogs, monday, completed, filter) => {
  const from = monday;
  const to = addDays(monday, 6);
  const entriesByDay = new Map();
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue;
    if (!entriesByDay.has(entry.date)) entriesByDay.set(entry.date, []);
    entriesByDay.get(entry.date).push(entry);
  }
  const byDay = new Map();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dayEntries = entriesByDay.get(d) ?? [];
    if (countsDay(filter, dayEntries.length > 0, completed.has(d))) {
      byDay.set(d, dayEntries);
    }
  }
  const loggedDays = byDay.size;
  let avg = null;
  if (loggedDays > 0) {
    const total = { kcal: 0, protein: 0, carb: 0, fat: 0 };
    for (const dayEntries of byDay.values()) {
      const day = sumMacros(dayEntries);
      total.kcal += day.kcal;
      total.protein += day.protein;
      total.carb += day.carb;
      total.fat += day.fat;
    }
    avg = {
      kcal: Math.round(total.kcal / loggedDays),
      protein: round1(total.protein / loggedDays),
      carb: round1(total.carb / loggedDays),
      fat: round1(total.fat / loggedDays),
    };
  }
  const bodyweight = weekAverageWeight(weightLogs, monday);
  const previous = weekAverageWeight(weightLogs, addDays(monday, -7));
  const monDate = localDateFromYmd(monday);
  return {
    key: weekKey(monDate),
    label: weekLabel(monDate),
    from,
    to,
    loggedDays,
    avg,
    bodyweight,
    bodyweightDelta:
      bodyweight !== null && previous !== null
        ? round1(bodyweight - previous)
        : null,
  };
};

/**
 * Weekly (Monday to Sunday) intake averages joined with bodyweight averages,
 * oldest to newest. `weeks` is 4, 12 or null (first entry or completed day's week to today).
 * `filter` (all | complete | incomplete) picks which days count.
 */
export const weeklyIntake = (
  entries,
  weightLogs,
  {
    weeks = null,
    today = todayLocal(),
    completedDays = [],
    filter = "all",
  } = {},
) => {
  const list = Array.isArray(entries) ? entries : [];
  const logs =
    weightLogs && typeof weightLogs === "object" && !Array.isArray(weightLogs)
      ? weightLogs
      : {};
  const completed = new Set(
    Array.isArray(completedDays)
      ? completedDays.filter((d) => typeof d === "string")
      : [],
  );
  const lastMonday = mondayOf(today);
  let firstMonday;
  if (weeks) {
    firstMonday = addDays(lastMonday, -7 * (weeks - 1));
  } else {
    const dates = [...list.map((e) => e.date), ...completed];
    if (dates.length === 0) return [];
    const earliest = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
    firstMonday = mondayOf(earliest);
    if (firstMonday > lastMonday) return [];
  }
  const rows = [];
  for (let m = firstMonday; m <= lastMonday; m = addDays(m, 7)) {
    rows.push(buildRow(list, logs, m, completed, filter));
  }
  return rows;
};
