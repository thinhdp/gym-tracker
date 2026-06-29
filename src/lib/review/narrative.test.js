import { buildNarrative } from "./narrative";

const base = {
  cycle: { number: 7, start: "2026-06-09", end: "2026-06-16", phase: "lean-bulk" },
  sessions: [{ date: "2026-06-09" }, { date: "2026-06-10" }],
  exercises: [
    { name: "Bench Press Barbell", decision: { action: "PROGRESS", badgeLabel: "+2.5kg" }, flags: [] },
    { name: "Deadlift", decision: { action: "DELOAD", reason: "irregular" }, flags: [] },
    { name: "Shoulder Press", decision: { action: "HOLD", reason: "feedback: discomfort — hold", flags: ["3-strike"] }, flags: ["3-strike"] },
  ],
  tonnageTrend: [
    { cycle: 6, tonnage: 1000, patternQualityPct: 80, deltaPct: null, isInProgram: true },
    { cycle: 7, tonnage: 1020, patternQualityPct: 80, deltaPct: 2.0, isInProgram: true },
  ],
  bodyweight: { deltaPct: 0.4, evaluation: "ON TARGET (lean bulk band)" },
};

describe("buildNarrative", () => {
  it("writes a headline with cycle, phase, sessions, progressions, concerns", () => {
    const n = buildNarrative(base);
    expect(n.headline).toMatch(/Week 7/);
    expect(n.headline).toMatch(/lean-bulk/);
    expect(n.headline).toMatch(/2 sessions/);
    expect(n.headline).toMatch(/1 progression,/);
    expect(n.headline).toMatch(/2 concerns/);
  });
  it("lists progressions as wins", () => {
    const n = buildNarrative(base);
    expect(n.wins.join(" ")).toMatch(/Bench Press Barbell/);
  });
  it("ranks injury/3-strike and deload concerns, capped at 3", () => {
    const n = buildNarrative(base);
    expect(n.concerns.length).toBeLessThanOrEqual(3);
    expect(n.concerns[0].title).toMatch(/Shoulder Press|Deadlift/);
  });
  it("derives a volume verdict from tonnage + pattern quality", () => {
    const n = buildNarrative(base);
    expect(typeof n.volumeVerdict).toBe("string");
    expect(n.volumeVerdict.length).toBeGreaterThan(0);
  });
});
