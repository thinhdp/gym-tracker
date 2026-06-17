import { describe, it, expect, vi } from "vitest";
import {
  routineFromWorkout,
  instantiateRoutine,
  normalizeRoutine,
  mergeRoutines,
} from "./routines";
import { MAX_SETS } from "./constants";

vi.mock("./storage", () => ({
  uuid: vi.fn(() => "test-uuid"),
  todayStr: vi.fn(() => "2026-06-17"),
}));

const makeWorkout = (overrides = {}) => ({
  id: "w1",
  date: "2026-06-16",
  name: "Push Day",
  exercises: [
    {
      exerciseName: "Bench Press",
      sets: [
        { set: 1, weight: 60, reps: 8 },
        { set: 2, weight: 60, reps: 8 },
      ],
      rpe: 8,
      feedback: "good",
    },
    {
      exerciseName: "OHP",
      sets: [{ set: 1, weight: 40, reps: 10 }],
      rpe: null,
      feedback: "",
    },
  ],
  ...overrides,
});

describe("routineFromWorkout", () => {
  it("strips date and produces a new id", () => {
    const r = routineFromWorkout(makeWorkout());
    expect(r.id).toBe("test-uuid");
    expect(r).not.toHaveProperty("date");
  });

  it("preserves name and exercises", () => {
    const r = routineFromWorkout(makeWorkout());
    expect(r.name).toBe("Push Day");
    expect(r.exercises).toHaveLength(2);
    expect(r.exercises[0].exerciseName).toBe("Bench Press");
  });

  it("resets rpe and feedback on each exercise", () => {
    const r = routineFromWorkout(makeWorkout());
    for (const we of r.exercises) {
      expect(we.rpe).toBeNull();
      expect(we.feedback).toBe("");
    }
  });

  it("preserves rep scheme from sets", () => {
    const r = routineFromWorkout(makeWorkout());
    expect(r.exercises[0].sets[0].reps).toBe(8);
    expect(r.exercises[1].sets[0].reps).toBe(10);
  });

  it("caps sets at MAX_SETS", () => {
    const sets = Array.from({ length: MAX_SETS + 3 }, (_, i) => ({
      set: i + 1,
      weight: 50,
      reps: 5,
    }));
    const w = makeWorkout({
      exercises: [{ exerciseName: "Squat", sets, rpe: null, feedback: "" }],
    });
    const r = routineFromWorkout(w);
    expect(r.exercises[0].sets).toHaveLength(MAX_SETS);
  });

  it("sets timestamps", () => {
    const before = Date.now();
    const r = routineFromWorkout(makeWorkout());
    expect(r.createdAt).toBeGreaterThanOrEqual(before);
    expect(r.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe("instantiateRoutine", () => {
  const routine = {
    id: "r1",
    name: "Push Day A",
    exercises: [
      {
        exerciseName: "Bench Press",
        sets: [{ set: 1, weight: 55, reps: 8 }],
        rpe: null,
        feedback: "",
      },
      {
        exerciseName: "OHP",
        sets: [{ set: 1, weight: 35, reps: 10 }],
        rpe: null,
        feedback: "",
      },
    ],
    createdAt: 0,
    updatedAt: 0,
  };

  const exercises = [
    {
      name: "Bench Press",
      lastWorkout: {
        sets: [
          { set: 1, weight: 60, reps: 8 },
          { set: 2, weight: 62, reps: 6 },
        ],
      },
    },
    {
      name: "OHP",
      lastWorkout: null,
    },
  ];

  it("creates a workout with the given date", () => {
    const w = instantiateRoutine(routine, { date: "2026-06-17", exercises });
    expect(w.date).toBe("2026-06-17");
    expect(w.name).toBe("Push Day A");
  });

  it("pulls weight from last set of lastWorkout", () => {
    const w = instantiateRoutine(routine, { date: "2026-06-17", exercises });
    expect(w.exercises[0].sets[0].weight).toBe(62);
  });

  it("falls back to routine weight when no history", () => {
    const w = instantiateRoutine(routine, { date: "2026-06-17", exercises });
    expect(w.exercises[1].sets[0].weight).toBe(35);
  });

  it("preserves rep targets from routine", () => {
    const w = instantiateRoutine(routine, { date: "2026-06-17", exercises });
    expect(w.exercises[0].sets[0].reps).toBe(8);
    expect(w.exercises[1].sets[0].reps).toBe(10);
  });

  it("resets rpe and feedback", () => {
    const w = instantiateRoutine(routine, { date: "2026-06-17", exercises });
    for (const we of w.exercises) {
      expect(we.rpe).toBeNull();
      expect(we.feedback).toBe("");
    }
  });

  it("falls back to todayStr when no date provided", () => {
    const w = instantiateRoutine(routine, { exercises });
    expect(w.date).toBe("2026-06-17");
  });

  it("handles empty exercises array gracefully", () => {
    const w = instantiateRoutine(routine, {
      date: "2026-06-17",
      exercises: [],
    });
    expect(w.exercises[0].sets[0].weight).toBe(55);
  });
});

describe("normalizeRoutine", () => {
  it("returns null for missing name", () => {
    expect(
      normalizeRoutine({
        exercises: [{ exerciseName: "Squat", sets: [{ weight: 0, reps: 5 }] }],
      }),
    ).toBeNull();
  });

  it("returns null for empty exercises", () => {
    expect(normalizeRoutine({ name: "Push", exercises: [] })).toBeNull();
  });

  it("normalizes a valid routine", () => {
    const r = normalizeRoutine({
      id: "r1",
      name: "Push Day",
      exercises: [
        { exerciseName: "Bench Press", sets: [{ weight: 60, reps: 8 }] },
      ],
      createdAt: 1000,
      updatedAt: 2000,
    });
    expect(r).not.toBeNull();
    expect(r.name).toBe("Push Day");
    expect(r.id).toBe("r1");
    expect(r.exercises[0].exerciseName).toBe("Bench Press");
    expect(r.createdAt).toBe(1000);
  });

  it("generates id when missing", () => {
    const r = normalizeRoutine({
      name: "Leg Day",
      exercises: [{ exerciseName: "Squat", sets: [{ weight: 0, reps: 5 }] }],
    });
    expect(r.id).toBe("test-uuid");
  });

  it("filters out exercises with no name", () => {
    const r = normalizeRoutine({
      name: "Push",
      exercises: [
        { exerciseName: "", sets: [{ weight: 0, reps: 5 }] },
        { exerciseName: "Bench Press", sets: [{ weight: 60, reps: 8 }] },
      ],
    });
    expect(r.exercises).toHaveLength(1);
  });
});

describe("mergeRoutines", () => {
  const r1 = {
    id: "r1",
    name: "Push",
    exercises: [],
    createdAt: 100,
    updatedAt: 200,
  };
  const r2 = {
    id: "r2",
    name: "Pull",
    exercises: [],
    createdAt: 100,
    updatedAt: 300,
  };

  it("appends new routines", () => {
    const merged = mergeRoutines([r1], [r2]);
    expect(merged).toHaveLength(2);
  });

  it("re-ids collisions", () => {
    const incoming = [{ ...r1, name: "Push v2" }];
    const merged = mergeRoutines([r1], incoming);
    expect(merged).toHaveLength(2);
    const ids = merged.map((r) => r.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("sorts by updatedAt descending", () => {
    const merged = mergeRoutines([r1], [r2]);
    expect(merged[0].updatedAt).toBeGreaterThanOrEqual(merged[1].updatedAt);
  });
});
