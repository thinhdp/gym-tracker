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

// Segments of uninterrupted lengthDays cycles: the base start plus any
// config.cycle.anchors ({cycle, startDate} re-anchor points, for when a real
// cycle ran long and the calendar slipped). The last cycle of a segment
// stretches to the day before the next segment's anchor.
function segments(config) {
  const base = [{ cycle: 1, startDate: config.cycle.startDate }];
  const anchors = [...(config.cycle.anchors || [])].sort(
    (a, b) => a.cycle - b.cycle,
  );
  return base.concat(anchors);
}

export function cycleForDate(config, dateStr) {
  const d = parseYMD(dateStr);
  if (!d) return null;
  const segs = segments(config);
  let seg = null;
  for (const s of segs) {
    const start = parseYMD(s.startDate);
    if (start && d >= start) seg = s;
  }
  if (!seg) return null;
  const days = Math.round((d - parseYMD(seg.startDate)) / MS_PER_DAY);
  const n = seg.cycle + Math.floor(days / config.cycle.lengthDays);
  const next = segs[segs.indexOf(seg) + 1];
  return next ? Math.min(n, next.cycle - 1) : n;
}

export function cycleDates(config, n) {
  const segs = segments(config);
  let i = 0;
  for (let j = 0; j < segs.length; j++) if (segs[j].cycle <= n) i = j;
  const seg = segs[i];
  const s = addDays(
    parseYMD(seg.startDate),
    (n - seg.cycle) * config.cycle.lengthDays,
  );
  let e = addDays(s, config.cycle.lengthDays - 1);
  const next = segs[i + 1];
  if (next && n === next.cycle - 1) e = addDays(parseYMD(next.startDate), -1);
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
  const { start, end } = cycleDates(config, n);
  const s = parseYMD(start);
  const nDays = Math.round((parseYMD(end) - s) / MS_PER_DAY) + 1;
  const out = [];
  for (let i = 0; i < nDays; i++) {
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
    if ((workouts || []).some((w) => w.date >= start && w.date <= end))
      return n;
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
