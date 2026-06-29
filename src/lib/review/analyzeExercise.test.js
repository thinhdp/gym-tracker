import max753 from "./programs/max753";
import {
  buildExerciseHistory,
  findPriorSession,
  analyzeExercise,
} from "./analyzeExercise";

const sets = (...reps) => reps.map((r, i) => ({ set: i + 1, weight: 40, reps: r }));

const workouts = [
  {
    id: "a",
    date: "2026-06-02",
    name: "Push",
    exercises: [{ exerciseName: "Bench Press Barbell", sets: sets(8, 7, 6, 5, 4) }],
  },
  {
    id: "b",
    date: "2026-06-10",
    name: "Push",
    exercises: [
      { exerciseName: "Bench Press Barbell", sets: sets(9, 8, 7, 6, 5), rpe: 8, feedback: "felt good" },
    ],
  },
];

describe("buildExerciseHistory / findPriorSession", () => {
  it("indexes sessions by normalized name, sorted ascending", () => {
    const h = buildExerciseHistory(workouts);
    expect(h.get("bench press barbell")).toHaveLength(2);
    const prior = findPriorSession(h, "Bench Press Barbell", "2026-06-10");
    expect(prior.date).toBe("2026-06-02");
  });
});

describe("analyzeExercise", () => {
  const h = buildExerciseHistory(workouts);
  it("computes bucket/status/pattern and prior comparison", () => {
    const ex = workouts[1].exercises[0];
    const prior = findPriorSession(h, ex.exerciseName, "2026-06-10");
    const a = analyzeExercise(max753, ex, prior, h, "2026-06-10");
    expect(a.totalReps).toBe(35);
    expect(a.target).toBe(30);
    expect(a.status).toBe("OVER+5");
    expect(a.pattern).toBe("linear");
    expect(a.rpe).toBe(8);
    expect(a.priorComparison.loadDelta).toBe(0);
    expect(a.priorComparison.repDelta).toBe(5);
  });
  it("flags baseline exercises below the session threshold", () => {
    const ex = { exerciseName: "Hammer Curl", sets: sets(20, 18, 16, 14, 12) };
    const h2 = buildExerciseHistory([{ id: "x", date: "2026-06-10", name: "Pull", exercises: [ex] }]);
    const a = analyzeExercise(max753, ex, null, h2, "2026-06-10");
    expect(a.isBaseline).toBe(true);
  });
  it("marks abs as the rep-range bucket with no pattern/status", () => {
    const ex = { exerciseName: "Cable Crunch", sets: sets(20, 18, 16) };
    const h2 = buildExerciseHistory([{ id: "x", date: "2026-06-10", name: "Push", exercises: [ex] }]);
    const a = analyzeExercise(max753, ex, null, h2, "2026-06-10");
    expect(a.bucketKind).toBe("abs");
    expect(a.status).toBeNull();
    expect(a.pattern).toBe("n/a");
  });
});
