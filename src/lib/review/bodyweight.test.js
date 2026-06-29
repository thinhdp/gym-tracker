import max753 from "./programs/max753";
import { cycleAverage, evaluate } from "./bodyweight";

describe("cycleAverage", () => {
  const logs = { "2026-06-02": 70.0, "2026-06-05": 70.4, "2026-05-20": 71.0 };
  it("averages weigh-ins within the inclusive range", () => {
    const r = cycleAverage(logs, "2026-06-01", "2026-06-08");
    expect(r.n).toBe(2);
    expect(r.avg).toBeCloseTo(70.2, 5);
  });
  it("returns null when no weigh-ins fall in range", () => {
    expect(cycleAverage(logs, "2026-07-01", "2026-07-08")).toEqual({ avg: null, n: 0 });
  });
});

describe("evaluate", () => {
  it("cut on-target band", () => {
    expect(evaluate(max753, "cut", -0.5)).toMatch(/ON TARGET/);
  });
  it("cut too fast", () => {
    expect(evaluate(max753, "cut", -1.4)).toMatch(/TOO FAST/);
  });
  it("lean-bulk on-target band", () => {
    expect(evaluate(max753, "lean-bulk", 0.4)).toMatch(/ON TARGET/);
  });
  it("returns empty for unknown/missing data", () => {
    expect(evaluate(max753, "post-program", 0.2)).toBe("");
    expect(evaluate(max753, "cut", null)).toBe("");
  });
});
