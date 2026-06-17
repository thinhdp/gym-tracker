import { uuid, todayStr } from "./storage";
import { MAX_SETS } from "./constants";
import { normalizeRpe, normalizeFeedback } from "./rpe";

/**
 * Build a Routine from a completed Workout.
 * Strips date/id, preserves the exercise+rep structure, resets RPE/feedback.
 */
export function routineFromWorkout(workout) {
  return {
    id: uuid(),
    name: (workout.name || "").trim() || todayStr(),
    exercises: (workout.exercises || []).slice(0, MAX_SETS).map((we) => ({
      exerciseName: we.exerciseName,
      sets: (we.sets || []).slice(0, MAX_SETS).map((s, idx) => ({
        set: idx + 1,
        weight: Number(s.weight) || 0,
        reps: Number(s.reps) || 0,
      })),
      rpe: null,
      feedback: "",
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Instantiate a Routine into a Workout for a given date.
 * Weights are pulled from the exercise's lastWorkout (last set); falls back to
 * the routine's stored weight if no history exists. Rep targets always come
 * from the routine.
 *
 * @param {object} routine
 * @param {{ date: string, exercises: object[] }} ctx  exercises = exercise database
 * @returns {object} a Workout
 */
export function instantiateRoutine(routine, { date, exercises = [] }) {
  const d = date || todayStr();
  const exMap = new Map(
    (exercises || []).map((e) => [e.name.toLowerCase(), e]),
  );

  return {
    id: uuid(),
    date: d,
    name: routine.name,
    exercises: (routine.exercises || []).map((we) => {
      const dbEx = exMap.get((we.exerciseName || "").toLowerCase());
      const lastSets = dbEx?.lastWorkout?.sets;
      const historyWeight = lastSets?.length
        ? Number(lastSets.at(-1).weight) || 0
        : null;

      return {
        exerciseName: we.exerciseName,
        sets: (we.sets || []).map((s, idx) => ({
          set: idx + 1,
          weight:
            historyWeight !== null ? historyWeight : Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
        })),
        rpe: null,
        feedback: "",
      };
    }),
  };
}

/**
 * Validate and normalise a routine from an import payload.
 * Returns null for unrecoverable rows.
 */
export function normalizeRoutine(r) {
  const name = String(r?.name || "").trim();
  if (!name) return null;
  const id = typeof r?.id === "string" && r.id ? r.id : uuid();
  const exercises = (Array.isArray(r?.exercises) ? r.exercises : [])
    .map((we) => {
      const exerciseName = String(we?.exerciseName || "").trim();
      if (!exerciseName) return null;
      const setsRaw = Array.isArray(we?.sets) ? we.sets : [];
      const sets = setsRaw.slice(0, MAX_SETS).map((s, idx) => ({
        set: idx + 1,
        weight: Number(s?.weight) || 0,
        reps: Number(s?.reps) || 0,
      }));
      return {
        exerciseName,
        sets: sets.length ? sets : [{ set: 1, weight: 0, reps: 0 }],
        rpe: normalizeRpe(we?.rpe),
        feedback: normalizeFeedback(we?.feedback),
      };
    })
    .filter(Boolean);
  if (!exercises.length) return null;
  return {
    id,
    name,
    exercises,
    createdAt: Number(r?.createdAt) || Date.now(),
    updatedAt: Number(r?.updatedAt) || Date.now(),
  };
}

/**
 * Merge incoming routines into the current set.
 * Id collisions get a fresh uuid (same strategy as mergeWorkouts).
 * Result sorted by updatedAt descending.
 */
export function mergeRoutines(current, incoming) {
  const ids = new Set(current.map((r) => r.id));
  const merged = [...current];
  for (const r of incoming) {
    if (!ids.has(r.id)) {
      ids.add(r.id);
      merged.push(r);
    } else {
      merged.push({ ...r, id: uuid() });
    }
  }
  return merged.sort((a, b) => b.updatedAt - a.updatedAt);
}
