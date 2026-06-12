/**
 * Create or fetch an exercise entry and prepare its initial sets.
 *
 * - Trims and lowercases the provided name.
 * - If the exercise does not already exist (case‑insensitive), adds it to
 *   the exercises array via setExercises.
 * - Prefills the sets array with the last set from the exercise’s last workout
 *   (if available); otherwise starts with a single set of 0 weight and reps.
 *
 * Returns an object with `exerciseName` and `sets`, or null if the name is blank.
 */
export function createExerciseEntry(rawName, exercises, setExercises) {
  const name = (rawName || "").trim();
  if (!name) return null;

  // Find existing exercise (case‑insensitive)
  const existing = exercises.find(
    (e) => e.name.toLowerCase() === name.toLowerCase()
  );

  // If it doesn't exist, create a new one with empty fields
  if (!existing) {
    const newExercise = {
      name,
      recommendRep: "",
      lastWorkout: null,
      mainMuscle: "",
      secondaryMuscles: "",
      type: "",
      equipment: "",
      force: "",
    };
    setExercises((prev) => [...prev, newExercise]);
  }

  // Determine initial sets based on the last workout’s last set (if any)
  let initSets = [{ set: 1, weight: 0, reps: 0 }];
  if (existing?.lastWorkout?.sets?.length) {
    const lastSet = existing.lastWorkout.sets.at(-1);
    initSets = [
      {
        set: 1,
        weight: lastSet.weight || 0,
        reps: lastSet.reps || 0,
      },
    ];
  }

  return { exerciseName: name, sets: initSets };
}
