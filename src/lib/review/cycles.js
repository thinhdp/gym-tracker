// src/lib/review/cycles.js
// Cycle + phase date math for the review engine. A "cycle" is the program's
// microcycle (config.cycle.lengthDays); cycle 1 starts at config.cycle.startDate.
// Dates are "YYYY-MM-DD" strings; we parse to local-midnight Dates so day diffs
// are DST-safe, and rely on lexical ordering of zero-padded YMD for comparisons.

const MS_PER_DAY = 86400000;

export function parseYMD(str) {
  if (!str) return null;
  const [y, m, d] = String(str).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function cycleForDate(config, dateStr) {
  const start = parseYMD(config.cycle.startDate);
  const d = parseYMD(dateStr);
  if (!start || !d || d < start) return null;
  const days = Math.round((d - start) / MS_PER_DAY);
  return Math.floor(days / config.cycle.lengthDays) + 1;
}

export function cycleDates(config, n) {
  const start = parseYMD(config.cycle.startDate);
  const s = addDays(start, (n - 1) * config.cycle.lengthDays);
  const e = addDays(s, config.cycle.lengthDays - 1);
  return { start: ymd(s), end: ymd(e) };
}

export function phaseForDate(config, dateStr) {
  const d = parseYMD(dateStr);
  if (!d) return null;
  const start = parseYMD(config.cycle.startDate);
  if (start && d < start) return "pre-program";
  for (const ph of config.phases) {
    if (dateStr >= ph.from && dateStr <= ph.to) return ph.id;
  }
  return "post-program";
}

export function dayPhases(config, n) {
  const { start } = cycleDates(config, n);
  const s = parseYMD(start);
  const out = [];
  for (let i = 0; i < config.cycle.lengthDays; i++) {
    out.push(phaseForDate(config, ymd(addDays(s, i))));
  }
  return out;
}

const PHASE_ORDER = [
  "pre-program",
  "cut",
  "maintenance",
  "lean-bulk",
  "post-program",
];

export function phaseForCycle(config, n) {
  const counts = new Map();
  for (const p of dayPhases(config, n)) counts.set(p, (counts.get(p) || 0) + 1);
  let best = null;
  let bestCount = -1;
  let bestOrder = -1;
  for (const [p, c] of counts) {
    const order = PHASE_ORDER.indexOf(p);
    if (c > bestCount || (c === bestCount && order > bestOrder)) {
      best = p;
      bestCount = c;
      bestOrder = order;
    }
  }
  return best;
}

export function mostRecentCompletedCycle(config, workouts, today = null) {
  const dates = (workouts || []).map((w) => w.date).filter(Boolean);
  if (!dates.length) return null;
  const ref = today || dates.reduce((a, b) => (a > b ? a : b));
  let n = cycleForDate(config, ref);
  if (n == null) return null;
  while (n >= 1) {
    const { start, end } = cycleDates(config, n);
    if ((workouts || []).some((w) => w.date >= start && w.date <= end)) return n;
    n -= 1;
  }
  return null;
}

export function loggedCycles(config, workouts) {
  const set = new Set();
  for (const w of workouts || []) {
    const n = cycleForDate(config, w.date);
    if (n != null) set.add(n);
  }
  return [...set].sort((a, b) => b - a);
}
