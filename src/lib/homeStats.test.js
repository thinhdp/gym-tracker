import {
  setVolume,
  workoutVolume,
  weekStats,
  weekVolumeByDay,
  currentStreak,
  latestBodyweight,
} from "./homeStats";

// Wednesday 2026-06-10 sits inside the Mon 2026-06-08 … Sun 2026-06-14 week.
const REF = new Date("2026-06-10T12:00:00");

const wo = (date, ...sets) => ({
  id: date,
  date,
  exercises: [{ exerciseName: "Bench", sets }],
});

describe("setVolume / workoutVolume", () => {
  it("multiplies weight by reps", () => {
    expect(setVolume({ weight: 80, reps: 8 })).toBe(640);
  });

  it("treats missing/invalid fields as zero", () => {
    expect(setVolume({ weight: "x", reps: 5 })).toBe(0);
    expect(setVolume({})).toBe(0);
    expect(setVolume(null)).toBe(0);
  });

  it("sums every set in a workout", () => {
    expect(
      workoutVolume(
        wo("2026-06-10", { weight: 80, reps: 8 }, { weight: 80, reps: 6 }),
      ),
    ).toBe(80 * 8 + 80 * 6);
  });
});

describe("weekStats", () => {
  it("counts workouts and sums volume within the Mon–Sun week", () => {
    const workouts = [
      wo("2026-06-08", { weight: 100, reps: 5 }), // Mon, in week
      wo("2026-06-14", { weight: 50, reps: 10 }), // Sun, in week
      wo("2026-06-07", { weight: 999, reps: 9 }), // prev Sun, excluded
      wo("2026-06-15", { weight: 999, reps: 9 }), // next Mon, excluded
    ];
    expect(weekStats(workouts, REF)).toEqual({ count: 2, volume: 500 + 500 });
  });
});

describe("weekVolumeByDay", () => {
  it("buckets volume Monday→Sunday", () => {
    const days = weekVolumeByDay(
      [
        wo("2026-06-08", { weight: 100, reps: 1 }), // Mon → idx 0
        wo("2026-06-14", { weight: 70, reps: 1 }), // Sun → idx 6
      ],
      REF,
    );
    expect(days).toEqual([100, 0, 0, 0, 0, 0, 70]);
  });
});

describe("currentStreak", () => {
  it("counts consecutive days ending on refDate", () => {
    const workouts = [wo("2026-06-10"), wo("2026-06-09"), wo("2026-06-08")];
    expect(currentStreak(workouts, REF)).toBe(3);
  });

  it("is zero when refDate itself has no workout", () => {
    expect(currentStreak([wo("2026-06-09")], REF)).toBe(0);
  });

  it("stops at the first gap", () => {
    // 06-10 and 06-09 present, 06-08 missing → streak of 2
    expect(currentStreak([wo("2026-06-10"), wo("2026-06-09")], REF)).toBe(2);
  });
});

describe("latestBodyweight", () => {
  it("returns the most recent entry", () => {
    expect(latestBodyweight({ "2026-06-01": 79, "2026-06-09": 78.6 })).toEqual({
      date: "2026-06-09",
      value: 78.6,
    });
  });

  it("returns null when there are no logs", () => {
    expect(latestBodyweight({})).toBeNull();
    expect(latestBodyweight(null)).toBeNull();
  });
});
