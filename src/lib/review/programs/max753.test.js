import max753 from "./max753";

describe("max753 program config", () => {
  it("has core sections the engine relies on", () => {
    expect(max753.cycle.lengthDays).toBe(8);
    expect(max753.cycle.startDate).toBe("2026-04-27");
    expect(max753.buckets.map((b) => b.target)).toEqual([30, 50, 70]);
    expect(max753.special.deadlift.nSets).toBe(3);
    expect(max753.special.abs.repRangeMin).toBe(15);
    expect(max753.special.abs.repRangeMax).toBe(20);
  });
  it("has chronological, non-overlapping phases", () => {
    const ph = max753.phases;
    for (let i = 1; i < ph.length; i++) {
      expect(ph[i].from > ph[i - 1].to).toBe(true);
    }
  });
  it("declares fatigue feedback keywords that map to hold", () => {
    expect(max753.feedbackRules.fatigue.keywords).toEqual(
      expect.arrayContaining(["heavy", "tired"]),
    );
    expect(max753.feedbackRules.fatigue.action).toBe("hold");
  });
});
