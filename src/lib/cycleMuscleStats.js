// src/lib/cycleMuscleStats.js
// Per-cycle training stats grouped into Push / Pull / Legs, for the Strength
// tab's per-cycle chart. A "cycle" is the program's microcycle — date math
// comes from src/lib/review/cycles.js so re-anchored cycles line up with the
// Cycle Review feature.
//
// Weights are in kg (the storage invariant); tonnage is returned in kg and
// converted to display units at the render boundary.

import { cycleForDate, cycleDates } from "./review/cycles";
import { setReps } from "./metrics";

export const GROUP_NAMES = ["Push", "Pull", "Legs"];

// mainMuscle (lowercased) -> group. Muscles not listed here (abs, calves,
// abductors, adductors, hip flexors, unknown) are excluded from the chart.
const MUSCLE_GROUPS = {
  chest: "Push",
  shoulders: "Push",
  "shoulders (side)": "Push",
  triceps: "Push",
  back: "Pull",
  "back (lats)": "Pull",
  "shoulders (rear)": "Pull",
  biceps: "Pull",
  quads: "Legs",
  hamstrings: "Legs",
  glutes: "Legs",
  "glutes, hamstrings": "Legs",
};

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

// Per-cycle Push/Pull/Legs series for `metric` ("sets" | "reps" | "tonnage").
// Returns { cycles: [{ n, start, end }], groups: [{ name, points }] } with one
// point per cycle, cycles contiguous from the first to the last logged cycle.
// Pre-program workouts are ignored; empty input returns empty arrays.
export function cycleMuscleGroupSeries(config, workouts, exercisesDb, metric) {
  const groupByName = new Map();
  for (const ex of exercisesDb || []) {
    const muscle = (ex.mainMuscle || "").trim().toLowerCase();
    const group = MUSCLE_GROUPS[muscle];
    if (group) groupByName.set(ex.name.trim().toLowerCase(), group);
  }

  // cycle n -> { Push, Pull, Legs }
  const perCycle = new Map();
  for (const w of workouts || []) {
    if (!w.date) continue;
    const n = cycleForDate(config, w.date);
    if (n == null) continue;
    for (const ex of w.exercises || []) {
      const group = groupByName.get(
        (ex.exerciseName || "").trim().toLowerCase(),
      );
      if (!group) continue;
      const v = exerciseValue(ex, metric);
      if (!v) continue;
      if (!perCycle.has(n)) perCycle.set(n, { Push: 0, Pull: 0, Legs: 0 });
      perCycle.get(n)[group] += v;
    }
  }

  const logged = [...perCycle.keys()];
  if (!logged.length) return { cycles: [], groups: [] };
  const first = Math.min(...logged);
  const last = Math.max(...logged);

  const cycles = [];
  for (let n = first; n <= last; n++) {
    const { start, end } = cycleDates(config, n);
    cycles.push({ n, start, end });
  }
  const groups = GROUP_NAMES.map((name) => ({
    name,
    points: cycles.map((c) => perCycle.get(c.n)?.[name] || 0),
  }));
  return { cycles, groups };
}
