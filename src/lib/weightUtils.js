// Shared helpers for body-weight logs ({ "YYYY-MM-DD": number } maps).

import { ymdFromDate } from "./date";

/**
 * Average the logged weights between two dates (inclusive).
 * @param {Object<string, number>} weightLogs - map of `YYYY-MM-DD` to weight.
 * @param {Date} from - range start (inclusive).
 * @param {Date} to - range end (inclusive).
 * @returns {number|null} the average rounded to 1 decimal, or null if no entries.
 */
export function averageWeightInRange(weightLogs, from, to) {
  const vals = [];
  const cur = new Date(from);
  while (cur <= to) {
    const key = ymdFromDate(cur);
    const v = weightLogs[key];
    if (typeof v === "number" && isFinite(v)) vals.push(v);
    cur.setDate(cur.getDate() + 1);
  }
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 10) / 10;
}
