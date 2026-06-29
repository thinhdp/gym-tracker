import { buildOnePager, onePagerFilename } from "./onePager";

const result = {
  program: { name: "Max 7/5/3" },
  cycle: { number: 7, start: "2026-06-09", end: "2026-06-16", phase: "lean-bulk" },
  narrative: { headline: "Week 7 — steady cycle.", concerns: [{ title: "Deadlift", action: "DELOAD" }], volumeVerdict: "On point." },
  tonnageTrend: [{ label: "W7", tonnage: 1020, totalReps: 300, deltaPct: 2.0, isInProgram: true }],
  bodyweight: { thisAvg: 71.2, thisN: 5, deltaPct: 0.4, evaluation: "ON TARGET" },
  plan: {
    bySession: [{ group: "Push", lines: [{ exercise: "Bench Press Barbell", weightLabel: "42.5", action: "PROGRESS", badgeLabel: "+2.5kg", reason: "overshot 30" }] }],
    byBlock: [{ group: "Block A", lines: [{ exercise: "Bench Press Barbell", weightLabel: "42.5", action: "PROGRESS", badgeLabel: "+2.5kg", reason: "overshot 30" }] }],
  },
};

describe("buildOnePager", () => {
  it("returns a self-contained HTML document with the week and a plan row", () => {
    const html = buildOnePager(result);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toMatch(/Week 7/);
    expect(html).toMatch(/Bench Press Barbell/);
    expect(html).toMatch(/badge progress/);
    expect(html).not.toMatch(/<script/i); // no external/active content
  });
  it("escapes HTML in user-provided text", () => {
    const r = { ...result, plan: { bySession: [{ group: "Push", lines: [{ exercise: "A<b>", weightLabel: "1", action: "HOLD", badgeLabel: "HOLD", reason: "x & y" }] }], byBlock: [] } };
    const html = buildOnePager(r);
    expect(html).toMatch(/A&lt;b&gt;/);
    expect(html).toMatch(/x &amp; y/);
  });
  it("names the file by cycle number, zero-padded", () => {
    expect(onePagerFilename(result)).toBe("cycle_07_plan.html");
  });
});
