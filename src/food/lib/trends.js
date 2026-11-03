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

const buildRow = (entries, weightLogs, monday) => {
  const from = monday;
  const to = addDays(monday, 6);
  const byDay = new Map();
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue;
    if (!byDay.has(entry.date)) byDay.set(entry.date, []);
    byDay.get(entry.date).push(entry);
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
 * oldest to newest. `weeks` is 4, 12 or null (first entry's week to today).
 */
export const weeklyIntake = (
  entries,
  weightLogs,
  { weeks = null, today = todayLocal() } = {},
) => {
  const list = Array.isArray(entries) ? entries : [];
  const logs =
    weightLogs && typeof weightLogs === "object" && !Array.isArray(weightLogs)
      ? weightLogs
      : {};
  const lastMonday = mondayOf(today);
  let firstMonday;
  if (weeks) {
    firstMonday = addDays(lastMonday, -7 * (weeks - 1));
  } else {
    if (list.length === 0) return [];
    const earliest = list.reduce(
      (min, e) => (e.date < min ? e.date : min),
      list[0].date,
    );
    firstMonday = mondayOf(earliest);
    if (firstMonday > lastMonday) return [];
  }
  const rows = [];
  for (let m = firstMonday; m <= lastMonday; m = addDays(m, 7)) {
    rows.push(buildRow(list, logs, m));
  }
  return rows;
};
