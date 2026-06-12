// src/lib/dateUtils.js
// Consolidated date helper functions for weekly and monthly periods.

export function toDate(d) {
  if (!d) return null;
  return typeof d === "number" ? new Date(d) : new Date(d);
}

// Week helpers (Mon–Sun, local time)
export function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = (day + 6) % 7; // Convert Sunday=0 to 6, Monday=1 to 0, etc.
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMon);
  return d;
}
export function endOfWeekSunday(date) {
  const start = startOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
export function weekKey(date) {
  const s = startOfWeekMonday(date);
  const year = s.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const jan4Start = startOfWeekMonday(jan4);
  const diffDays = Math.floor((s - jan4Start) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return `${year}-${String(week).padStart(2, "0")}`;
}
export function weekLabel(date) {
  const s = startOfWeekMonday(date);
  const e = endOfWeekSunday(date);
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return `${fmt(s)} to ${fmt(e)}`;
}
export function prevWeekKeyFrom(periodFrom) {
  const d = new Date(periodFrom);
  d.setDate(d.getDate() - 7);
  return weekKey(d);
}

// Month helpers
export function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
export function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}
export function monthKey(date) {
  const d = startOfMonth(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(date) {
  const d = startOfMonth(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function prevMonthKeyFrom(periodFrom) {
  const d = new Date(periodFrom);
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
}
