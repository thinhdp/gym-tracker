// Builds chart-ready weight series from a body-weight log map
// ({ "YYYY-MM-DD": number }), filling gaps so the x-axis is continuous.

import { ymdFromDate } from "./date";
import { startOfWeekMonday } from "./dateUtils";

/**
 * Produce a continuous daily series within [from, to] (inclusive).
 *
 * Days without a logged weight inherit the most recent prior weight
 * (forward-fill / carry-forward), including weights logged before `from`.
 * Leading days that have no prior weight at all are omitted, since there
 * is nothing to carry yet.
 *
 * @param {Object<string, number>} logs - map of `YYYY-MM-DD` to weight.
 * @param {Date} from - range start (inclusive).
 * @param {Date} to - range end (inclusive).
 * @returns {{date: string, weight: number}[]} one entry per day with a value.
 */
export function fillDailyWeights(logs, from, to) {
  if (!from || !to) return [];
  const fromKey = ymdFromDate(from);

  // Seed with the most recent weight logged on or before the range start.
  let lastWeight = null;
  for (const date of Object.keys(logs).sort()) {
    if (date <= fromKey) {
      const v = logs[date];
      if (typeof v === "number" && isFinite(v)) lastWeight = v;
    } else {
      break;
    }
  }

  const out = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const key = ymdFromDate(cur);
    const v = logs[key];
    if (typeof v === "number" && isFinite(v)) lastWeight = v;
    if (lastWeight != null) out.push({ date: key, weight: lastWeight });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Build the chart series for the given period and view.
 *
 * Daily view returns the forward-filled daily series. Weekly view groups
 * those filled days by ISO (Mon–Sun) week and averages them, so every week
 * in the range is represented.
 *
 * @param {Object<string, number>} logs
 * @param {Date} from
 * @param {Date} to
 * @param {"daily"|"weekly"} view
 * @returns {{date: string, weight: number}[]}
 */
export function buildWeightSeries(logs, from, to, view = "daily") {
  const daily = fillDailyWeights(logs, from, to);
  if (view !== "weekly") return daily;

  const byWeek = {};
  daily.forEach(({ date, weight }) => {
    const wk = ymdFromDate(startOfWeekMonday(new Date(date + "T00:00:00")));
    (byWeek[wk] = byWeek[wk] || []).push(weight);
  });
  return Object.keys(byWeek)
    .sort()
    .map((wk) => {
      const weights = byWeek[wk];
      const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
      return { date: wk, weight: Math.round(avg * 100) / 100 };
    });
}

/**
 * Compute the [from, to] range for a named period ending at `today`.
 * Custom ranges are handled by the caller.
 *
 * @param {"1m"|"3m"|"6m"|"1y"} period
 * @param {Date} [today]
 * @returns {{from: Date, to: Date}}
 */
export function rangeForPeriod(period, today = new Date()) {
  const to = new Date(today);
  to.setHours(0, 0, 0, 0);
  const from = new Date(to);
  switch (period) {
    case "1m":
      from.setMonth(from.getMonth() - 1);
      break;
    case "3m":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6m":
      from.setMonth(from.getMonth() - 6);
      break;
    case "1y":
      from.setFullYear(from.getFullYear() - 1);
      break;
    default:
      from.setMonth(from.getMonth() - 3);
  }
  return { from, to };
}
