// src/lib/strength.js
// Strength-analysis helpers: estimated 1RM, per-exercise progression series,
// personal records, volume-by-muscle trends, and time-range windowing.
//
// All weights are in kg (the storage invariant); convert to display units only
// at the render boundary with toDisplayWeight.

import { toDate } from "./dateUtils";
import { setReps, resolveMainMuscle, buildWeeks, buildMonths } from "./metrics";

// Estimated one-rep max via the Epley formula: weight * (1 + reps / 30).
// A single rep (or fewer) is already a 1RM. Returns 0 for non-positive or
// non-finite weights.
export function estimate1RM(weight, reps) {
  const w = Number(weight);
  if (!Number.isFinite(w) || w <= 0) return 0;
  const r = Number(reps);
  if (!Number.isFinite(r) || r <= 1) return w;
  return w * (1 + r / 30);
}

// Total training volume (Σ weight × reps) across a list of workouts, in kg.
export function totalVolume(workouts) {
  let v = 0;
  for (const w of workouts || []) {
    for (const ex of w.exercises || []) {
      for (const s of ex.sets || []) {
        v += (Number(s.weight) || 0) * setReps(s);
      }
    }
  }
  return v;
}

// Distinct exercise names that have at least one logged set, sorted A→Z.
export function loggedExerciseNames(workouts) {
  const set = new Set();
  for (const w of workouts || []) {
    for (const ex of w.exercises || []) {
      if (ex.exerciseName) set.add(ex.exerciseName);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Exercise trained on the most recent workout date (for a sensible default
// selection). Returns null when there is no logged data.
export function mostRecentExercise(workouts) {
  let bestDate = null;
  let bestName = null;
  for (const w of workouts || []) {
    const d = w?.date;
    if (!d) continue;
    for (const ex of w.exercises || []) {
      if (!ex.exerciseName) continue;
      if (bestDate == null || d > bestDate) {
        bestDate = d;
        bestName = ex.exerciseName;
      }
    }
  }
  return bestName;
}

// Progression series for one exercise: one entry per workout date that includes
// it, ascending by date, each with the day's top-set weight, best estimated
// 1RM, and total volume (all kg).
export function exerciseSeries(workouts, exerciseName) {
  const byDate = new Map();
  for (const w of workouts || []) {
    const date = w?.date;
    if (!date) continue;
    for (const ex of w.exercises || []) {
      if (ex.exerciseName !== exerciseName) continue;
      let top = 0;
      let bestE = 0;
      let vol = 0;
      for (const s of ex.sets || []) {
        const wt = Number(s.weight) || 0;
        const reps = setReps(s);
        if (wt > top) top = wt;
        const e = estimate1RM(wt, reps);
        if (e > bestE) bestE = e;
        vol += wt * reps;
      }
      const cur = byDate.get(date) || {
        date,
        topSetWeight: 0,
        bestE1RM: 0,
        volume: 0,
      };
      cur.topSetWeight = Math.max(cur.topSetWeight, top);
      cur.bestE1RM = Math.max(cur.bestE1RM, bestE);
      cur.volume += vol;
      byDate.set(date, cur);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// All-time personal records for one exercise (kg).
export function exercisePRs(workouts, exerciseName) {
  let bestE1RM = 0;
  let heaviest = null; // { weight, reps }
  let bestSetVolume = null; // { value, weight, reps }
  for (const w of workouts || []) {
    for (const ex of w.exercises || []) {
      if (ex.exerciseName !== exerciseName) continue;
      for (const s of ex.sets || []) {
        const wt = Number(s.weight) || 0;
        if (wt <= 0) continue;
        const reps = setReps(s);
        const e = estimate1RM(wt, reps);
        if (e > bestE1RM) bestE1RM = e;
        if (!heaviest || wt > heaviest.weight) heaviest = { weight: wt, reps };
        const v = wt * reps;
        if (!bestSetVolume || v > bestSetVolume.value) {
          bestSetVolume = { value: v, weight: wt, reps };
        }
      }
    }
  }
  return { bestE1RM, heaviest, bestSetVolume };
}

// Chronological feed of personal-record events across all exercises. A record
// is logged when a workout day beats the running all-time best estimated 1RM
// ("e1RM") or top weight ("weight") for that exercise. Newest first.
// Pass limit = 0 for the full list (used for counting PRs in a window).
export function recentPRs(workouts, limit = 8) {
  const sorted = [...(workouts || [])]
    .filter((w) => w?.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const bestE = new Map();
  const bestW = new Map();
  const prs = [];

  for (const w of sorted) {
    const dayE = new Map();
    const dayW = new Map();
    for (const ex of w.exercises || []) {
      const name = ex.exerciseName;
      if (!name) continue;
      for (const s of ex.sets || []) {
        const wt = Number(s.weight) || 0;
        if (wt <= 0) continue;
        const e = estimate1RM(wt, setReps(s));
        if (!dayE.has(name) || e > dayE.get(name)) dayE.set(name, e);
        if (!dayW.has(name) || wt > dayW.get(name)) dayW.set(name, wt);
      }
    }
    for (const [name, e] of dayE) {
      const prev = bestE.get(name);
      if (prev != null && e > prev) {
        prs.push({ date: w.date, exercise: name, type: "e1RM", value: e });
      }
      if (prev == null || e > prev) bestE.set(name, e);
    }
    for (const [name, wt] of dayW) {
      const prev = bestW.get(name);
      if (prev != null && wt > prev) {
        prs.push({ date: w.date, exercise: name, type: "weight", value: wt });
      }
      if (prev == null || wt > prev) bestW.set(name, wt);
    }
  }

  prs.reverse(); // sorted ascending → reverse to newest-first
  return limit ? prs.slice(0, limit) : prs;
}

// Walk a Date back by the span of a range key ("3M" / "6M" / "1Y").
function stepBack(date, range) {
  switch (range) {
    case "3M":
      date.setMonth(date.getMonth() - 3);
      break;
    case "1Y":
      date.setFullYear(date.getFullYear() - 1);
      break;
    case "6M":
    default:
      date.setMonth(date.getMonth() - 6);
      break;
  }
}

// Split workouts into the current range window and the equally-sized window
// immediately before it (for trend deltas). For range "all", everything is
// current and there is no previous window.
export function rangeWindows(workouts, range, today = new Date()) {
  if (!range || range === "all") {
    return { current: [...(workouts || [])], previous: null, from: null };
  }
  const from = new Date(today);
  from.setHours(0, 0, 0, 0);
  stepBack(from, range);
  const prevFrom = new Date(from);
  stepBack(prevFrom, range);

  const current = [];
  const previous = [];
  for (const w of workouts || []) {
    const d = toDate(w?.date);
    if (!d) continue;
    if (d >= from) current.push(w);
    else if (d >= prevFrom && d < from) previous.push(w);
  }
  return { current, previous, from, prevFrom };
}

// Workouts within a time range ("3M" / "6M" / "1Y" / "all").
export function filterByRange(workouts, range, today = new Date()) {
  return rangeWindows(workouts, range, today).current;
}

// Volume-per-muscle trend over time. period is "week" or "month". Returns
// ascending time buckets and a series of points (kg volume) for the top N
// muscles by total volume across the window.
export function volumeByMuscleSeries(
  workouts,
  exercisesDb,
  period = "week",
  topN = 4,
) {
  const builder = period === "month" ? buildMonths : buildWeeks;
  const asc = builder(workouts || []).reverse(); // builders return descending

  const totals = {};
  const perBucket = asc.map((b) => {
    const vol = {};
    for (const w of b.items) {
      for (const ex of w.exercises || []) {
        const m = resolveMainMuscle(ex.exerciseName, exercisesDb || []);
        let v = 0;
        for (const s of ex.sets || [])
          v += (Number(s.weight) || 0) * setReps(s);
        vol[m] = (vol[m] || 0) + v;
        totals[m] = (totals[m] || 0) + v;
      }
    }
    return vol;
  });

  const top = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);

  return {
    buckets: asc.map((b) => ({ key: b.key, label: b.label, from: b.from })),
    muscles: top.map((name) => ({
      name,
      points: perBucket.map((vol) => vol[name] || 0),
    })),
  };
}
