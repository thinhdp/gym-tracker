// src/lib/metrics.js
// Provides helpers to build period buckets and compute workout metrics.

import {
  toDate,
  startOfWeekMonday,
  endOfWeekSunday,
  weekKey,
  weekLabel,
  startOfMonth,
  endOfMonth,
  monthKey,
  monthLabel,
} from "./dateUtils";

// Count reps or return 0 for missing values.
export function setReps(set) {
  const r = Number(set?.reps ?? 0);
  return Number.isFinite(r) ? r : 0;
}

// Lookup main muscle for an exercise.
export function resolveMainMuscle(exerciseName, exercisesDb) {
  const ex = exercisesDb.find((e) => e.name === exerciseName);
  return ex?.mainMuscle?.trim() || "Unknown";
}

// Group workouts into weekly buckets (descending).
export function buildWeeks(workouts) {
  const buckets = new Map();
  for (const w of workouts) {
    const d = toDate(w.date);
    if (!d) continue;
    const key = weekKey(d);
    if (!buckets.has(key)) {
      const from = startOfWeekMonday(d);
      const to = endOfWeekSunday(d);
      buckets.set(key, { key, label: weekLabel(d), from, to, items: [] });
    }
    buckets.get(key).items.push(w);
  }
  return [...buckets.values()].sort((a, b) => b.from - a.from);
}

// Group workouts into monthly buckets (descending).
export function buildMonths(workouts) {
  const buckets = new Map();
  for (const w of workouts) {
    const d = toDate(w.date);
    if (!d) continue;
    const key = monthKey(d);
    if (!buckets.has(key)) {
      const from = startOfMonth(d);
      const to = endOfMonth(d);
      buckets.set(key, { key, label: monthLabel(d), from, to, items: [] });
    }
    buckets.get(key).items.push(w);
  }
  return [...buckets.values()].sort((a, b) => b.from - a.from);
}

// Calculate reps/sets totals, per-muscle counts, and PRs for a period.
export function computePeriodMetrics(period, workouts, exercisesDb) {
  const { from } = period;

  const frequency = period.items.length;
  const repsByMuscle = {};
  const setsByMuscle = {};
  let totalReps = 0;
  let totalSets = 0;

  for (const w of period.items) {
    for (const ex of w.exercises || []) {
      const main = resolveMainMuscle(ex.exerciseName, exercisesDb);
      for (const s of ex.sets || []) {
        const reps = setReps(s);
        totalReps += reps;
        totalSets += 1;
        repsByMuscle[main] = (repsByMuscle[main] || 0) + reps;
        setsByMuscle[main] = (setsByMuscle[main] || 0) + 1;
      }
    }
  }

  // PR calculation: track the best weight before the period and within the period.
  const bestBefore = new Map();
  for (const w of workouts) {
    const d = toDate(w.date);
    if (!d || d >= from) continue;
    for (const ex of w.exercises || []) {
      let maxSet = 0;
      for (const s of ex.sets || []) {
        const wt = Number(s.weight || 0);
        if (wt > maxSet) maxSet = wt;
      }
      const prev = bestBefore.get(ex.exerciseName) || 0;
      if (maxSet > prev) bestBefore.set(ex.exerciseName, maxSet);
    }
  }

  const bestInWindow = new Map();
  for (const w of period.items) {
    const d = toDate(w.date);
    for (const ex of w.exercises || []) {
      let maxSet = 0;
      for (const s of ex.sets || []) {
        const wt = Number(s.weight || 0);
        if (wt > maxSet) maxSet = wt;
      }
      const prev = bestInWindow.get(ex.exerciseName);
      if (!prev || maxSet > prev.best) {
        bestInWindow.set(ex.exerciseName, { best: maxSet, date: d });
      }
    }
  }

  const prs = [];
  for (const [name, { best, date }] of bestInWindow.entries()) {
    const oldBest = bestBefore.get(name) || 0;
    // Only count as PR when the previous best was > 0.
    if (best > oldBest && oldBest > 0) {
      prs.push({ exercise: name, newBest: best, prevBest: oldBest, date });
    }
  }

  return {
    frequency,
    totalReps,
    totalSets,
    repsByMuscle,
    setsByMuscle,
    prs: prs.sort((a, b) => b.newBest - a.newBest),
  };
}
