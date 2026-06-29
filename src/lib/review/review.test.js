import max753 from "./programs/max753";
import { buildCycleReview } from "./review";

const sets = (w, ...reps) => reps.map((r, i) => ({ set: i + 1, weight: w, reps: r }));

// One Push session inside a known lean-bulk cycle (2026-06-09).
const data = {
  exercises: [],
  weightLogs: { "2026-06-02": 71.0, "2026-06-09": 71.3 },
  workouts: [
    {
      id: "p1",
      date: "2026-06-02",
      name: "Push",
      exercises: [{ exerciseName: "Bench Press Barbell", sets: sets(40, 8, 7, 6, 5, 4) }],
    },
    {
      id: "p2",
      date: "2026-06-09",
      name: "Push",
      exercises: [
        { exerciseName: "Bench Press Barbell", sets: sets(40, 9, 8, 7, 6, 5) },
        { exerciseName: "Triceps Pushdown", sets: sets(20, 18, 16, 14, 12, 10) },
      ],
    },
  ],
};

describe("buildCycleReview", () => {
  it("reviews the most recent cycle and emits structured sections", () => {
    const r = buildCycleReview(max753, data);
    // 2026-06-09 is the latest session; cycle 6 of the 8-day program.
    expect(r.cycle.number).toBe(6);
    expect(r.cycle.phase).toBe("lean-bulk");
    expect(r.sessions.length).toBeGreaterThan(0);
    expect(r.exercises.length).toBeGreaterThan(0);
    expect(r.plan.bySession.length).toBeGreaterThan(0);
    expect(r.plan.byBlock.length).toBeGreaterThan(0);
    expect(r.narrative.headline).toMatch(/Week/);
    expect(Array.isArray(r.warnings)).toBe(true);
  });

  it("produces a PROGRESS decision for the overshoot lift", () => {
    const r = buildCycleReview(max753, data, /* cycle of 2026-06-09 */ undefined);
    const bench = r.exercises.find((e) => e.name === "Bench Press Barbell" && e.date === "2026-06-09");
    expect(bench.decision.action).toBe("PROGRESS");
  });

  it("warns when the selected cycle has no sessions", () => {
    const r = buildCycleReview(max753, data, 1);
    expect(r.warnings.some((w) => /no sessions/i.test(w))).toBe(true);
  });
});
