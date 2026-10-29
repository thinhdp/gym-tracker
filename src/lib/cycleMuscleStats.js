// src/lib/cycleMuscleStats.js
// Per-cycle training stats for the muscles of one Push / Pull / Legs category,
// for the Strength tab's per-cycle chart. A "cycle" comes from a cycler:
// { cycleOf(workout) -> n | null, range(n) -> { start, end } }. Pass a Max
// 7/5/3-style config (with .cycle) to use its calendar cycles from
// src/lib/review/cycles.js, or rotationCycler() from the PP21 engine for
// Push·Pull rotations, so the chart lines up with the matching review.
//
// Weights are in kg (the storage invariant); tonnage is returned in kg and
// converted to display units at the render boundary.

import { cycleForDate, cycleDates } from "./review/cycles";
import { setReps } from "./metrics";

// Category -> the mainMuscle values it covers (canonical display labels).
// Muscles not listed (abs, calves, abductors, adductors, hip flexors,
// unknown) are excluded from the chart.
export const MUSCLE_CATEGORIES = {
  Push: ["Chest", "Shoulders", "Shoulders (side)", "Triceps"],
  Pull: ["Back", "Back (Lats)", "Shoulders (rear)", "Biceps"],
  Legs: ["Quads", "Hamstrings", "Glutes", "Glutes, Hamstrings"],
};
export const CATEGORY_NAMES = Object.keys(MUSCLE_CATEGORIES);

// One value for a WorkoutExercise under the given metric:
// sets = count of logged sets (reps > 0), reps = Σ reps, tonnage = Σ kg × reps.
function exerciseValue(ex, metric) {
  let v = 0;
  for (const s of ex.sets || []) {
    const reps = setReps(s);
    if (metric === "sets") v += reps > 0 ? 1 : 0;
    else if (metric === "reps") v += reps;
    else v += (Number(s.weight) || 0) * reps;
  }
  return v;
}

function toCycler(config) {
  if (typeof config.cycleOf === "function") return config;
  return {
    cycleOf: (w) => cycleForDate(config, w.date),
    range: (n) => cycleDates(config, n),
  };
}

// Per-cycle series for each muscle of `category` ("Push" | "Pull" | "Legs")
// under `metric` ("sets" | "reps" | "tonnage"). Returns
// { cycles: [{ n, start, end }], muscles: [{ name, points }] } with one point
// per cycle, cycles contiguous from the first to the last logged cycle.
// Muscles with no data in any cycle are omitted; pre-program workouts are
// ignored; empty input returns empty arrays.
export function cycleMuscleSeries(
  config,
  workouts,
  exercisesDb,
  category,
  metric,
) {
  const cycler = toCycler(config);
  const labels = MUSCLE_CATEGORIES[category] || [];
  const labelByLower = new Map(labels.map((l) => [l.toLowerCase(), l]));

  // exercise name (lowercased) -> canonical muscle label in this category.
  const muscleByExercise = new Map();
  for (const ex of exercisesDb || []) {
    const label = labelByLower.get((ex.mainMuscle || "").trim().toLowerCase());
    if (label) muscleByExercise.set(ex.name.trim().toLowerCase(), label);
  }

  // cycle n -> { muscleLabel: value }
  const perCycle = new Map();
  for (const w of workouts || []) {
    if (!w.date) continue;
    const n = cycler.cycleOf(w);
    if (n == null) continue;
    for (const ex of w.exercises || []) {
      const muscle = muscleByExercise.get(
        (ex.exerciseName || "").trim().toLowerCase(),
      );
      if (!muscle) continue;
      const v = exerciseValue(ex, metric);
      if (!v) continue;
      if (!perCycle.has(n)) perCycle.set(n, {});
      const m = perCycle.get(n);
      m[muscle] = (m[muscle] || 0) + v;
    }
  }

  const logged = [...perCycle.keys()];
  if (!logged.length) return { cycles: [], muscles: [] };
  const first = Math.min(...logged);
  const last = Math.max(...logged);

  const cycles = [];
  for (let n = first; n <= last; n++) {
    const { start, end } = cycler.range(n);
    cycles.push({ n, start, end });
  }
  const muscles = labels
    .map((name) => ({
      name,
      points: cycles.map((c) => perCycle.get(c.n)?.[name] || 0),
    }))
    .filter((m) => m.points.some((p) => p > 0));
  return { cycles, muscles };
}
