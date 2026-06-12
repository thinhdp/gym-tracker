import {
  extractExerciseOptions,
  workoutsWithExercise,
  createExerciseEntry,
} from "./exerciseUtils";

describe("extractExerciseOptions", () => {
  it("collects distinct trimmed values per field", () => {
    const opts = extractExerciseOptions([
      {
        mainMuscle: "Chest",
        type: "Compound",
        equipment: "Barbell",
        force: "Push",
      },
      { mainMuscle: "Chest", type: "Compound" },
      { mainMuscle: "Quads" },
    ]);
    expect(opts.mainOptions).toEqual(["Chest", "Quads"]);
    expect(opts.typeOptions).toEqual(["Compound"]);
    expect(opts.equipmentOptions).toEqual(["Barbell"]);
    expect(opts.forceOptions).toEqual(["Push"]);
  });

  it("splits secondary muscles on commas and trims each part", () => {
    const opts = extractExerciseOptions([
      { secondaryMuscles: "Triceps, Front Delts" },
      { secondaryMuscles: "Triceps,  " },
    ]);
    expect(opts.secondaryOptions).toEqual(["Triceps", "Front Delts"]);
  });

  it("returns empty arrays for an empty database", () => {
    const opts = extractExerciseOptions([]);
    expect(opts.mainOptions).toEqual([]);
    expect(opts.secondaryOptions).toEqual([]);
  });
});

describe("workoutsWithExercise", () => {
  const workouts = [
    { id: "a", exercises: [{ exerciseName: "Squat" }] },
    { id: "b", exercises: [{ exerciseName: "Bench Press" }] },
  ];

  it("returns only workouts containing the named exercise", () => {
    expect(workoutsWithExercise(workouts, "Squat").map((w) => w.id)).toEqual([
      "a",
    ]);
  });

  it("handles null/empty workouts", () => {
    expect(workoutsWithExercise(null, "Squat")).toEqual([]);
  });
});

describe("createExerciseEntry", () => {
  it("returns null for a blank name", () => {
    const setExercises = vi.fn();
    expect(createExerciseEntry("   ", [], setExercises)).toBeNull();
    expect(setExercises).not.toHaveBeenCalled();
  });

  it("does not create a duplicate for an existing name (case-insensitive)", () => {
    const setExercises = vi.fn();
    const entry = createExerciseEntry(
      "bench press",
      [{ name: "Bench Press", lastWorkout: null }],
      setExercises,
    );
    expect(setExercises).not.toHaveBeenCalled();
    expect(entry.exerciseName).toBe("bench press");
  });

  it("creates a new exercise with blank metadata when missing", () => {
    const setExercises = vi.fn();
    const entry = createExerciseEntry("Deadlift", [], setExercises);
    expect(setExercises).toHaveBeenCalledTimes(1);
    // The setter receives an updater function — apply it to verify the entry.
    const next = setExercises.mock.calls[0][0]([]);
    expect(next).toEqual([
      {
        name: "Deadlift",
        recommendRep: "",
        lastWorkout: null,
        mainMuscle: "",
        secondaryMuscles: "",
        type: "",
        equipment: "",
        force: "",
      },
    ]);
    expect(entry.sets).toEqual([{ set: 1, weight: 0, reps: 0 }]);
  });

  it("prefills sets from the last set of the exercise's last workout", () => {
    const setExercises = vi.fn();
    const entry = createExerciseEntry(
      "Squat",
      [
        {
          name: "Squat",
          lastWorkout: {
            date: "2026-06-01",
            sets: [
              { set: 1, weight: 100, reps: 5 },
              { set: 2, weight: 110, reps: 3 },
            ],
          },
        },
      ],
      setExercises,
    );
    expect(entry.sets).toEqual([{ set: 1, weight: 110, reps: 3 }]);
  });
});
