import {
  slugForExercise,
  bestE1RMBySlug,
  liftWeight,
  ageFromBirthYear,
  percentileToTier,
  overallTier,
  starsFromPercentile,
  axisRequests,
  BODYWEIGHT_SLUGS,
} from "./strengthStandards";

const workout = (date, exercises) => ({
  id: date,
  date,
  name: date,
  exercises,
});
const ex = (exerciseName, sets) => ({ exerciseName, sets });
const set = (weight, reps) => ({ set: 1, weight, reps });

describe("slugForExercise", () => {
  it("maps known names case-insensitively, trimming whitespace", () => {
    expect(slugForExercise("Squat Barbell")).toBe("back_squat");
    expect(slugForExercise("  bench press barbell ")).toBe("bench_press");
    expect(slugForExercise("Chin-ups")).toBe("chinup");
  });

  it("maps spelling/spacing variants of common lifts", () => {
    // "Pull up" (space) must map the same as "Pull-up" (hyphen).
    expect(slugForExercise("Pull up")).toBe("pullup");
    expect(slugForExercise("Pull-up")).toBe("pullup");
    expect(slugForExercise("Pullups")).toBe("pullup");
    expect(slugForExercise("Shoulder press")).toBe("overhead_press");
    expect(slugForExercise("Barbell Row")).toBe("pendlay_row");
  });

  it("returns undefined for unsupported or empty names", () => {
    expect(slugForExercise("Leg Press")).toBeUndefined();
    expect(slugForExercise("")).toBeUndefined();
    expect(slugForExercise(undefined)).toBeUndefined();
  });
});

describe("bestE1RMBySlug", () => {
  it("takes the best estimated 1RM per slug across workouts", () => {
    const wos = [
      workout("2026-01-01", [ex("Deadlift", [set(100, 5)])]), // ~116.67
      workout("2026-02-01", [ex("Deadlift", [set(120, 1)])]), // 120
    ];
    expect(bestE1RMBySlug(wos).deadlift).toBeCloseTo(120, 5);
  });

  it("collapses variants of an axis onto their own slugs", () => {
    const wos = [
      workout("2026-01-01", [
        ex("Squat Barbell", [set(140, 1)]),
        ex("Front Squat", [set(100, 1)]),
      ]),
    ];
    const m = bestE1RMBySlug(wos);
    expect(m.back_squat).toBeCloseTo(140, 5);
    expect(m.front_squat).toBeCloseTo(100, 5);
  });

  it("caps at an as-of date (inclusive)", () => {
    const wos = [
      workout("2026-01-01", [ex("Deadlift", [set(100, 1)])]),
      workout("2026-06-01", [ex("Deadlift", [set(150, 1)])]),
    ];
    expect(bestE1RMBySlug(wos, "2026-03-01").deadlift).toBeCloseTo(100, 5);
    expect(bestE1RMBySlug(wos, "2026-06-01").deadlift).toBeCloseTo(150, 5);
  });

  it("ignores zero-weight sets for loaded lifts but keeps them for bodyweight", () => {
    const loaded = [workout("2026-01-01", [ex("Deadlift", [set(0, 10)])])];
    expect(bestE1RMBySlug(loaded).deadlift).toBeUndefined();

    const bw = [workout("2026-01-01", [ex("Pull-up", [set(0, 8)])])];
    expect(bestE1RMBySlug(bw).pullup).toBe(0);
  });

  it("ignores sets with no reps and unmapped exercises", () => {
    const wos = [
      workout("2026-01-01", [
        ex("Deadlift", [set(100, 0)]),
        ex("Leg Press", [set(200, 5)]),
      ]),
    ];
    expect(bestE1RMBySlug(wos)).toEqual({});
  });
});

describe("liftWeight", () => {
  it("adds bodyweight for bodyweight slugs and passes through otherwise", () => {
    expect(BODYWEIGHT_SLUGS.has("pullup")).toBe(true);
    expect(liftWeight("pullup", 10, 70)).toBe(80);
    expect(liftWeight("pullup", 0, 70)).toBe(70);
    expect(liftWeight("back_squat", 140, 70)).toBe(140);
  });
});

describe("ageFromBirthYear", () => {
  const now = new Date("2026-06-15");
  it("computes age within the API's 10-90 range", () => {
    expect(ageFromBirthYear(1996, now)).toBe(30);
  });
  it("returns null for missing or out-of-range years", () => {
    expect(ageFromBirthYear(undefined, now)).toBeNull();
    expect(ageFromBirthYear(2020, now)).toBeNull(); // age 6
    expect(ageFromBirthYear(1800, now)).toBeNull();
  });
});

describe("percentileToTier / overallTier", () => {
  it("buckets percentiles into tiers", () => {
    expect(percentileToTier(5)).toBe("beginner");
    expect(percentileToTier(30)).toBe("novice");
    expect(percentileToTier(50)).toBe("intermediate");
    expect(percentileToTier(75)).toBe("advanced");
    expect(percentileToTier(95)).toBe("elite");
    expect(percentileToTier(null)).toBeNull();
  });

  it("averages axis percentiles for an overall tier", () => {
    expect(overallTier([50, 70])).toBe("advanced"); // avg 60
    expect(overallTier([])).toBeNull();
    expect(overallTier([null, 50])).toBe("intermediate"); // ignores null
  });
});

describe("starsFromPercentile", () => {
  it("scales a percentile to 0-5 stars", () => {
    expect(starsFromPercentile(0)).toBe(0);
    expect(starsFromPercentile(50)).toBe(3); // 2.5 -> 3
    expect(starsFromPercentile(100)).toBe(5);
    expect(starsFromPercentile(null)).toBe(0);
  });
});

describe("axisRequests", () => {
  it("picks the heaviest slug per axis and drops axes with no data", () => {
    const reqs = axisRequests(
      { back_squat: 140, front_squat: 120, bench_press: 100 },
      70,
    );
    const squat = reqs.find((r) => r.axis === "squat");
    const bench = reqs.find((r) => r.axis === "bench");
    expect(squat).toMatchObject({ slug: "back_squat", weight: 140 });
    expect(bench).toMatchObject({ slug: "bench_press", weight: 100 });
    expect(reqs.find((r) => r.axis === "deadlift")).toBeUndefined();
  });

  it("scores bodyweight axes against total system weight", () => {
    const reqs = axisRequests({ pullup: 10, chinup: 5 }, 70);
    const pull = reqs.find((r) => r.axis === "pull");
    // pullup: 70+10=80 beats chinup: 70+5=75
    expect(pull).toMatchObject({ slug: "pullup", weight: 80 });
  });
});
