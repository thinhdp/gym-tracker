import { setReps, resolveMainMuscle, buildWeeks, buildMonths } from "./metrics";

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
