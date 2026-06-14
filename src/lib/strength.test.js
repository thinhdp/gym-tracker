import {
  estimate1RM,
  totalVolume,
  loggedExerciseNames,
  mostRecentExercise,
  exerciseSeries,
  exercisePRs,
  recentPRs,
  rangeWindows,
  filterByRange,
  volumeByMuscleSeries,
} from "./strength";

const db = [
  { name: "Bench Press", mainMuscle: "Chest" },
  { name: "Squat", mainMuscle: "Quads" },
];

const workout = (date, exercises) => ({
  id: date,
  date,
  name: date,
  exercises,
});
const ex = (exerciseName, sets) => ({ exerciseName, sets });
const set = (weight, reps) => ({ set: 1, weight, reps });

describe("estimate1RM", () => {
  it("applies the Epley formula", () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 5); // ~116.67
    expect(estimate1RM(60, 10)).toBeCloseTo(80, 5);
  });

  it("returns the weight for a single rep or fewer", () => {
    expect(estimate1RM(120, 1)).toBe(120);
    expect(estimate1RM(120, 0)).toBe(120);
  });

  it("guards against zero / non-finite input", () => {
    expect(estimate1RM(0, 5)).toBe(0);
    expect(estimate1RM(-10, 5)).toBe(0);
    expect(estimate1RM("abc", 5)).toBe(0);
    expect(estimate1RM(100, "abc")).toBe(100);
  });
});

describe("totalVolume", () => {
  it("sums weight × reps across all sets", () => {
    const wos = [
      workout("2026-06-01", [ex("Squat", [set(100, 5), set(100, 5)])]),
      workout("2026-06-02", [ex("Bench Press", [set(60, 10)])]),
    ];
    expect(totalVolume(wos)).toBe(100 * 5 + 100 * 5 + 60 * 10);
  });
});

describe("loggedExerciseNames / mostRecentExercise", () => {
  const wos = [
    workout("2026-06-01", [ex("Squat", [set(100, 5)])]),
    workout("2026-06-05", [ex("Bench Press", [set(60, 5)])]),
  ];
  it("lists distinct names sorted A→Z", () => {
    expect(loggedExerciseNames(wos)).toEqual(["Bench Press", "Squat"]);
  });
  it("returns the exercise from the latest workout date", () => {
    expect(mostRecentExercise(wos)).toBe("Bench Press");
  });
  it("returns null when there is no data", () => {
    expect(mostRecentExercise([])).toBeNull();
  });
});

describe("exerciseSeries", () => {
  const wos = [
    workout("2026-06-10", [ex("Squat", [set(110, 3)])]),
    workout("2026-06-01", [ex("Squat", [set(100, 5), set(90, 8)])]),
    workout("2026-06-05", [ex("Bench Press", [set(60, 5)])]),
  ];

  it("returns one ascending entry per date with the day's bests", () => {
    const s = exerciseSeries(wos, "Squat");
    expect(s.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-10"]);
    expect(s[0].topSetWeight).toBe(100);
    expect(s[0].volume).toBe(100 * 5 + 90 * 8);
    expect(s[0].bestE1RM).toBeCloseTo(estimate1RM(100, 5), 5);
    expect(s[1].topSetWeight).toBe(110);
  });

  it("ignores other exercises", () => {
    expect(exerciseSeries(wos, "Deadlift")).toEqual([]);
  });
});

describe("exercisePRs", () => {
  it("reports all-time best e1RM, heaviest, and best set volume", () => {
    const wos = [
      workout("2026-06-01", [ex("Squat", [set(100, 5), set(120, 1)])]),
      workout("2026-06-08", [ex("Squat", [set(110, 6)])]),
    ];
    const prs = exercisePRs(wos, "Squat");
    expect(prs.heaviest).toEqual({ weight: 120, reps: 1 });
    expect(prs.bestSetVolume).toEqual({ value: 110 * 6, weight: 110, reps: 6 });
    expect(prs.bestE1RM).toBeCloseTo(estimate1RM(110, 6), 5);
  });

  it("returns null PR shapes for an unknown exercise", () => {
    expect(exercisePRs([], "Nope")).toEqual({
      bestE1RM: 0,
      heaviest: null,
      bestSetVolume: null,
    });
  });
});

describe("recentPRs", () => {
  const wos = [
    workout("2026-06-01", [ex("Squat", [set(100, 5)])]),
    workout("2026-06-08", [ex("Squat", [set(110, 5)])]), // weight + e1RM PR
    workout("2026-06-15", [ex("Squat", [set(105, 8)])]), // e1RM PR only
  ];

  it("flags new all-time bests, newest first; first-ever lift is not a PR", () => {
    const prs = recentPRs(wos, 0);
    // No PR on the first-ever session.
    expect(prs.find((p) => p.date === "2026-06-01")).toBeUndefined();
    // Newest first.
    expect(prs[0].date).toBe("2026-06-15");
    expect(prs[0].type).toBe("e1RM");
    // Jun 8 set both a weight and an e1RM record.
    const jun8 = prs.filter((p) => p.date === "2026-06-08").map((p) => p.type);
    expect(jun8).toEqual(expect.arrayContaining(["e1RM", "weight"]));
  });

  it("honors the limit", () => {
    expect(recentPRs(wos, 1)).toHaveLength(1);
  });
});

describe("rangeWindows / filterByRange", () => {
  const today = new Date("2026-06-15T12:00:00");
  const wos = [
    workout("2026-06-10", [ex("Squat", [set(100, 5)])]), // in 3M current
    workout("2026-02-10", [ex("Squat", [set(100, 5)])]), // in previous 3M window
    workout("2025-06-10", [ex("Squat", [set(100, 5)])]), // far past
  ];

  it("splits into current and previous equal windows", () => {
    const { current, previous } = rangeWindows(wos, "3M", today);
    expect(current.map((w) => w.date)).toEqual(["2026-06-10"]);
    expect(previous.map((w) => w.date)).toEqual(["2026-02-10"]);
  });

  it("treats 'all' as everything with no previous window", () => {
    const { current, previous } = rangeWindows(wos, "all", today);
    expect(current).toHaveLength(3);
    expect(previous).toBeNull();
  });

  it("filterByRange returns the current window", () => {
    expect(filterByRange(wos, "3M", today).map((w) => w.date)).toEqual([
      "2026-06-10",
    ]);
  });
});

describe("volumeByMuscleSeries", () => {
  const wos = [
    workout("2026-06-01", [ex("Squat", [set(100, 5)])]),
    workout("2026-06-08", [
      ex("Bench Press", [set(60, 10)]),
      ex("Squat", [set(100, 5)]),
    ]),
  ];

  it("buckets volume per muscle over ascending periods", () => {
    const { buckets, muscles } = volumeByMuscleSeries(wos, db, "week");
    expect(buckets.length).toBe(2);
    // Ascending: earlier bucket first.
    expect(buckets[0].from <= buckets[1].from).toBe(true);
    const quads = muscles.find((m) => m.name === "Quads");
    const chest = muscles.find((m) => m.name === "Chest");
    expect(quads.points).toEqual([500, 500]);
    expect(chest.points).toEqual([0, 600]);
  });

  it("limits to the top N muscles by total volume", () => {
    const { muscles } = volumeByMuscleSeries(wos, db, "week", 1);
    expect(muscles).toHaveLength(1);
    expect(muscles[0].name).toBe("Quads"); // 1000 total > Chest 600
  });
});
