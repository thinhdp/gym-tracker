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
