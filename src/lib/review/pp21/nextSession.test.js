import fixture from "./fixture.pp21.json";
import pp21 from "../programs/pp21";
import { upcomingSession, workoutFromPlan, setsLabel } from "./nextSession";

const empty = { workouts: [], exercises: [] };

describe("upcomingSession", () => {
  it("starts with Push A at the start weights when nothing is logged", () => {
    const u = upcomingSession(empty, pp21, "2026-10-29");
    expect(u.plan.sessionId).toBe("pushA");
    expect(u.date).toBe("2026-10-29");
    expect(u.isToday).toBe(true);
    expect(u.isRestDay).toBe(false);
    const bench = u.plan.exercises.find((e) => e.exId === "bench");
    expect(bench.decision).toBe("START");
    expect(bench.sets.map((s) => s.weight)).toEqual([45, 40]);
  });

  it("flags a scheduled rest day and dates the session after it", () => {
    // fixture ends with Pull B on 19 Nov -> rest on the 20th, Push A on the 21st
    const u = upcomingSession(fixture, pp21, "2026-11-20");
    expect(u.plan.sessionId).toBe("pushA");
    expect(u.date).toBe("2026-11-21");
    expect(u.isRestDay).toBe(true);
    expect(u.isToday).toBe(false);
  });

  it("makes an overdue session due today", () => {
    const u = upcomingSession(fixture, pp21, "2026-11-25");
    expect(u.date).toBe("2026-11-25");
    expect(u.isToday).toBe(true);
    expect(u.isRestDay).toBe(false);
  });
});

describe("workoutFromPlan", () => {
  const plan = {
    routineName: "Push A",
    exercises: [
      {
        exerciseName: "Bench Press Barbell",
        optional: false,
        doneEarlier: false,
        sets: [
          { set: 1, weight: 45, reps: 0, targetReps: 5 },
          { set: 2, weight: 40, reps: 0, targetReps: 7 },
        ],
      },
      {
        exerciseName: "Adductor Machine",
        optional: false,
        doneEarlier: true,
        sets: [],
      },
      {
        exerciseName: "Standing Calf Raise Barbell",
        optional: true,
        doneEarlier: false,
        sets: [{ set: 1, weight: 47.5, reps: 0, targetReps: 12 }],
      },
    ],
  };

  it("prefills weights in kg and carries reps as targets", () => {
    const w = workoutFromPlan(plan, "2026-10-29");
    expect(w.id).toBeTruthy();
    expect(w.date).toBe("2026-10-29");
    expect(w.name).toBe("Push A");
    expect(w.exercises[0]).toEqual({
      exerciseName: "Bench Press Barbell",
      sets: [
        { set: 1, weight: 45, reps: 0, targetReps: 5 },
        { set: 2, weight: 40, reps: 0, targetReps: 7 },
      ],
      rpe: null,
      feedback: "",
    });
  });

  it("skips exercises already done this rotation and marks optional ones", () => {
    const w = workoutFromPlan(plan, "2026-10-29");
    expect(w.exercises.map((e) => e.exerciseName)).toEqual([
      "Bench Press Barbell",
      "Standing Calf Raise Barbell",
    ]);
    expect(w.exercises[1].optional).toBe(true);
  });

  it("is matched back to its session by the engine", () => {
    const u = upcomingSession(empty, pp21, "2026-10-29");
    const w = workoutFromPlan(u.plan, "2026-10-29");
    const next = upcomingSession(
      { workouts: [w], exercises: [] },
      pp21,
      "2026-10-29",
    );
    expect(next.plan.sessionId).toBe("pullA");
  });
});

describe("setsLabel", () => {
  it("formats weight×reps and shows 0 kg as bodyweight", () => {
    const sets = [
      { weight: 7.5, targetReps: 5 },
      { weight: 0, targetReps: 8 },
    ];
    expect(setsLabel(sets, "kg")).toBe("7.5×5 · BW×8");
  });

  it("converts to pounds for display", () => {
    expect(setsLabel([{ weight: 45, targetReps: 5 }], "lb")).toBe("99.2×5");
  });

  it("returns an empty string for no sets", () => {
    expect(setsLabel([], "kg")).toBe("");
  });
});
