import {
  normalizeExercise,
  normalizeWorkout,
  normalizeData,
  mergeExercises,
  mergeWorkouts,
} from "./backup";
import { MAX_SETS } from "./constants";

describe("normalizeExercise", () => {
  it("returns null for a blank or whitespace-only name", () => {
    expect(normalizeExercise({ name: "" })).toBeNull();
    expect(normalizeExercise({ name: "   " })).toBeNull();
    expect(normalizeExercise({})).toBeNull();
    expect(normalizeExercise(null)).toBeNull();
  });

  it("trims the name and defaults missing fields to empty strings", () => {
    const ex = normalizeExercise({ name: "  Bench Press  " });
    expect(ex.name).toBe("Bench Press");
    expect(ex.mainMuscle).toBe("");
    expect(ex.secondaryMuscles).toBe("");
    expect(ex.type).toBe("");
    expect(ex.equipment).toBe("");
    expect(ex.force).toBe("");
  });

  it("always forces lastWorkout to null (recomputed from workouts)", () => {
    const ex = normalizeExercise({
      name: "Squat",
      lastWorkout: { date: "2026-01-01", sets: [] },
    });
    expect(ex.lastWorkout).toBeNull();
  });

  it("stringifies a numeric recommendRep", () => {
    expect(
      normalizeExercise({ name: "Squat", recommendRep: 8 }).recommendRep,
    ).toBe("8");
  });
});

describe("normalizeWorkout", () => {
  it("returns null when the date is missing", () => {
    expect(normalizeWorkout({ name: "No date", exercises: [] })).toBeNull();
  });

  it("truncates sets to MAX_SETS and renumbers them 1..n", () => {
    const sets = Array.from({ length: MAX_SETS + 3 }, (_, i) => ({
      set: 99,
      weight: i,
      reps: i,
    }));
    const w = normalizeWorkout({
      date: "2026-06-01",
      exercises: [{ exerciseName: "Squat", sets }],
    });
    const norm = w.exercises[0].sets;
    expect(norm).toHaveLength(MAX_SETS);
    expect(norm.map((s) => s.set)).toEqual(
      Array.from({ length: MAX_SETS }, (_, i) => i + 1),
    );
  });

  it("coerces non-numeric weight/reps to 0", () => {
    const w = normalizeWorkout({
      date: "2026-06-01",
      exercises: [
        { exerciseName: "Squat", sets: [{ weight: "abc", reps: null }] },
      ],
    });
    expect(w.exercises[0].sets[0]).toEqual({ set: 1, weight: 0, reps: 0 });
  });

  it("drops exercises with a blank name", () => {
    const w = normalizeWorkout({
      date: "2026-06-01",
      exercises: [{ exerciseName: "  " }, { exerciseName: "Squat" }],
    });
    expect(w.exercises).toHaveLength(1);
    expect(w.exercises[0].exerciseName).toBe("Squat");
  });

  it("gives an exercise with no sets a single default set", () => {
    const w = normalizeWorkout({
      date: "2026-06-01",
      exercises: [{ exerciseName: "Squat", sets: [] }],
    });
    expect(w.exercises[0].sets).toEqual([{ set: 1, weight: 0, reps: 0 }]);
  });

  it("generates an id when missing and falls back to the date as name", () => {
    const w = normalizeWorkout({ date: "2026-06-01", exercises: [] });
    expect(typeof w.id).toBe("string");
    expect(w.id.length).toBeGreaterThan(0);
    expect(w.name).toBe("2026-06-01");
  });

  it("slices a full ISO datetime down to YYYY-MM-DD", () => {
    const w = normalizeWorkout({
      date: "2026-06-01T10:30:00.000Z",
      exercises: [],
    });
    expect(w.date).toBe("2026-06-01");
  });
});

describe("normalizeData", () => {
  it("returns empty arrays for garbage input", () => {
    expect(normalizeData(null)).toEqual({ exercises: [], workouts: [] });
    expect(normalizeData({ exercises: "nope", workouts: 42 })).toEqual({
      exercises: [],
      workouts: [],
    });
  });

  it("filters out invalid rows and keeps valid ones", () => {
    const { exercises, workouts } = normalizeData({
      exercises: [{ name: "Squat" }, { name: "" }],
      workouts: [{ date: "2026-06-01" }, { name: "no date" }],
    });
    expect(exercises).toHaveLength(1);
    expect(workouts).toHaveLength(1);
  });
});

describe("mergeExercises", () => {
  it("dedupes by name case-insensitively", () => {
    const merged = mergeExercises(
      [{ name: "Bench Press", mainMuscle: "Chest" }],
      [{ name: "bench press", mainMuscle: "Pecs" }],
    );
    expect(merged).toHaveLength(1);
  });

  it("fills only blank fields on existing entries, never overwrites", () => {
    const merged = mergeExercises(
      [{ name: "Bench Press", mainMuscle: "Chest", equipment: "" }],
      [{ name: "Bench Press", mainMuscle: "Pecs", equipment: "Barbell" }],
    );
    expect(merged[0].mainMuscle).toBe("Chest"); // kept
    expect(merged[0].equipment).toBe("Barbell"); // filled
  });

  it("appends new exercises", () => {
    const merged = mergeExercises(
      [{ name: "Bench Press" }],
      [{ name: "Squat", mainMuscle: "Quads" }],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((e) => e.name === "Squat")).toBeTruthy();
  });
});

describe("mergeWorkouts", () => {
  it("keeps workouts with distinct ids", () => {
    const merged = mergeWorkouts(
      [{ id: "a", date: "2026-06-01" }],
      [{ id: "b", date: "2026-06-02" }],
    );
    expect(merged).toHaveLength(2);
  });

  it("keeps both copies on id collision, reassigning the incoming id", () => {
    const merged = mergeWorkouts(
      [{ id: "a", date: "2026-06-01", name: "current" }],
      [{ id: "a", date: "2026-06-02", name: "incoming" }],
    );
    expect(merged).toHaveLength(2);
    const incoming = merged.find((w) => w.name === "incoming");
    expect(incoming.id).not.toBe("a");
  });

  it("sorts the result by date descending", () => {
    const merged = mergeWorkouts(
      [{ id: "a", date: "2026-06-01" }],
      [
        { id: "b", date: "2026-06-10" },
        { id: "c", date: "2026-05-20" },
      ],
    );
    expect(merged.map((w) => w.date)).toEqual([
      "2026-06-10",
      "2026-06-01",
      "2026-05-20",
    ]);
  });
});
