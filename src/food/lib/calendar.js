import { ymd } from "../../lib/date";
import { sumMacros } from "./macros";

/**
 * Monday-first weeks for a month (month is 0-based). Each week has 7 items:
 * a YYYY-MM-DD string inside the month, null outside it.
 */
export const monthGrid = (year, month) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => ymd(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

/** date -> that day's integer kcal. A non-array gives an empty Map. */
export const dayTotals = (entries) => {
  const byDay = new Map();
  if (!Array.isArray(entries)) return new Map();
  for (const entry of entries) {
    if (!byDay.has(entry.date)) byDay.set(entry.date, []);
    byDay.get(entry.date).push(entry);
  }
  const totals = new Map();
  for (const [date, list] of byDay) totals.set(date, sumMacros(list).kcal);
  return totals;
};
