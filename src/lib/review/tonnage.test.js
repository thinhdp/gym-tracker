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
});
