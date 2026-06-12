import {
  setReps,
  resolveMainMuscle,
  buildWeeks,
  buildMonths,
  computePeriodMetrics,
} from "./metrics";

const db = [
  { name: "Bench Press", mainMuscle: "Chest" },
  { name: "Squat", mainMuscle: "Quads" },
  { name: "Mystery Move", mainMuscle: "  " },
];

const workout = (date, exercises, id = date) => ({
  id,
  date,
  name: date,
  exercises,
});
const ex = (exerciseName, sets) => ({ exerciseName, sets });
const set = (weight, reps) => ({ set: 1, weight, reps });

describe("setReps", () => {
  it("returns 0 for null/undefined/NaN", () => {
    expect(setReps(null)).toBe(0);
    expect(setReps({})).toBe(0);
    expect(setReps({ reps: "abc" })).toBe(0);
  });

  it("returns the numeric rep count", () => {
    expect(setReps({ reps: 8 })).toBe(8);
    expect(setReps({ reps: "10" })).toBe(10);
  });
});

describe("resolveMainMuscle", () => {
  it("looks up the main muscle by exact exercise name", () => {
    expect(resolveMainMuscle("Bench Press", db)).toBe("Chest");
  });

  it("falls back to Unknown for missing exercises or blank muscles", () => {
    expect(resolveMainMuscle("Nope", db)).toBe("Unknown");
    expect(resolveMainMuscle("Mystery Move", db)).toBe("Unknown");
  });
});

describe("buildWeeks / buildMonths", () => {
  const workouts = [
    workout("2026-06-08", []), // Mon, week A
    workout("2026-06-10", [], "w2"), // Wed, week A
    workout("2026-06-01", [], "w3"), // Mon, prior week B
    workout("2026-05-15", [], "w4"), // prior month
  ];

  it("buckets workouts by week, descending", () => {
    const weeks = buildWeeks(workouts);
    expect(weeks).toHaveLength(3);
    expect(weeks[0].items).toHaveLength(2);
    expect(weeks[0].from > weeks[1].from).toBe(true);
    expect(weeks[1].from > weeks[2].from).toBe(true);
  });

  it("buckets workouts by month, descending", () => {
    const months = buildMonths(workouts);
    expect(months).toHaveLength(2);
    expect(months[0].key).toBe("2026-06");
    expect(months[0].items).toHaveLength(3);
    expect(months[1].key).toBe("2026-05");
  });

  it("skips workouts without a date", () => {
    expect(buildWeeks([{ id: "x", date: "" }])).toHaveLength(0);
  });
});

describe("computePeriodMetrics", () => {
  const workouts = [
    // Before the period: establishes a prior best of 100 for Bench Press.
    workout("2026-06-01", [ex("Bench Press", [set(100, 5)])]),
    // In the period (week of Jun 8): Bench PR at 105, first-ever Squat.
    workout("2026-06-08", [
      ex("Bench Press", [set(105, 5), set(95, 8)]),
      ex("Squat", [set(140, 5)]),
    ]),
    workout("2026-06-10", [ex("Squat", [set(150, 3)])]),
  ];

  const period = buildWeeks(workouts).find((w) => w.items.length === 2);

  it("totals reps and sets across the period", () => {
    const m = computePeriodMetrics(period, workouts, db);
    expect(m.frequency).toBe(2);
    expect(m.totalSets).toBe(4);
    expect(m.totalReps).toBe(5 + 8 + 5 + 3);
  });

  it("aggregates reps and sets per main muscle", () => {
    const m = computePeriodMetrics(period, workouts, db);
    expect(m.repsByMuscle).toEqual({ Chest: 13, Quads: 8 });
    expect(m.setsByMuscle).toEqual({ Chest: 2, Quads: 2 });
  });

  it("counts a PR only when a prior best existed (first-ever lift is not a PR)", () => {
    const m = computePeriodMetrics(period, workouts, db);
    expect(m.prs).toHaveLength(1);
    expect(m.prs[0]).toMatchObject({
      exercise: "Bench Press",
      newBest: 105,
      prevBest: 100,
    });
    // Squat hit 150 but had no history before the period → not a PR.
    expect(m.prs.find((p) => p.exercise === "Squat")).toBeUndefined();
  });

  it("sorts PRs by newBest descending", () => {
    const history = [
      workout("2026-06-01", [
        ex("Bench Press", [set(100, 5)]),
        ex("Squat", [set(140, 5)]),
      ]),
      workout("2026-06-08", [
        ex("Bench Press", [set(105, 5)]),
        ex("Squat", [set(150, 5)]),
      ]),
    ];
    const p = buildWeeks(history).find((w) =>
      w.items.some((i) => i.date === "2026-06-08"),
    );
    const m = computePeriodMetrics(p, history, db);
    expect(m.prs.map((x) => x.exercise)).toEqual(["Squat", "Bench Press"]);
  });
});
