import max753 from "./programs/max753";
import { weeklySummary, tonnageByPattern, collectHistory } from "./tonnage";

const ex = (name, ...reps) => ({ exerciseName: name, sets: reps.map((r, i) => ({ set: i + 1, weight: 100, reps: r })) });
const wo = (date, ...exercises) => ({ id: date, date, name: "S", exercises });

describe("weeklySummary", () => {
  it("sums tonnage and reps (flooring partials) and rates pattern quality", () => {
    const s = weeklySummary(max753, [wo("2026-06-09", ex("Leg Press", 13, 11, 10, 9, 7))]);
    expect(s.tonnage).toBe(100 * (13 + 11 + 10 + 9 + 7));
    expect(s.totalReps).toBe(50);
    expect(s.nSessions).toBe(1);
    expect(s.patternQualityPct).toBe(100); // one linear exercise
  });

  it("floors partial reps in tonnage and totalReps and counts partials", () => {
    const s = weeklySummary(max753, [wo("2026-06-09", ex("Leg Press", 10.7, 9.3, 8, 7, 6))]);
    expect(s.totalReps).toBe(40); // 10+9+8+7+6
    expect(s.tonnage).toBe(100 * 40);
    expect(s.nPartialReps).toBe(2);
  });

  it("returns null pattern quality when there are no complete exercises", () => {
    expect(weeklySummary(max753, []).patternQualityPct).toBeNull();
  });
});

describe("tonnageByPattern", () => {
  it("buckets tonnage by movement pattern", () => {
    const t = tonnageByPattern(max753, [wo("2026-06-09", ex("Leg Press", 10, 10, 10, 10, 10))]);
    expect(t.quad).toBe(100 * 50);
  });
});

describe("collectHistory", () => {
  it("returns nWindows windows oldest-first with deltas between cycles", () => {
    const workouts = [
      wo("2026-06-02", ex("Leg Press", 10, 10, 10, 10, 10)), // some cycle
      wo("2026-06-10", ex("Leg Press", 11, 11, 11, 11, 11)), // next cycle
    ];
    const target = 9; // arbitrary in-program cycle
    const wins = collectHistory(max753, workouts, target, 3);
    expect(wins).toHaveLength(3);
    expect(wins[0].cycle).toBe(target - 2);
    expect(wins[wins.length - 1].cycle).toBe(target);
  });

  it("labels pre-program windows with no delta and a 7-day window", () => {
    // cycleN=2, nWindows=4 -> windows for n = -1, 0, 1, 2; n<1 are pre-program.
    const wins = collectHistory(max753, [], 2, 4);
    expect(wins).toHaveLength(4);
    expect(wins[0].isInProgram).toBe(false);
    expect(wins[0].cycle).toBeNull();
    expect(wins[0].windowDays).toBe(7);
    expect(wins[0].deltaPct).toBeNull();
    expect(wins[3].isInProgram).toBe(true); // n=2
  });

  it("computes deltaPct only between consecutive in-program cycles", () => {
    const workouts = [
      wo("2026-04-28", ex("Leg Press", 10, 10, 10, 10, 10)), // cycle 1, tonnage 5000
      wo("2026-05-06", ex("Leg Press", 11, 11, 11, 11, 11)), // cycle 2, tonnage 5500
    ];
    const wins = collectHistory(max753, workouts, 2, 2); // windows: cycle 1, cycle 2
    expect(wins[0].cycle).toBe(1);
    expect(wins[0].deltaPct).toBeNull(); // first in-program cycle has no prior
    expect(wins[1].cycle).toBe(2);
    expect(wins[1].deltaPct).toBeCloseTo(10, 5); // (5500-5000)/5000*100
  });
});
