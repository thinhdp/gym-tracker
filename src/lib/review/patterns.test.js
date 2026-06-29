import max753 from "./programs/max753";
import {
  cleanReps,
  classifyPattern,
  classifyStatus,
  closestTarget,
  bucketFor,
  isDeadlift,
  isAbs,
  movementPatternFor,
} from "./patterns";

describe("cleanReps", () => {
  it("floors partials and counts them", () => {
    expect(cleanReps([8.5, 7, 6])).toEqual({
      cleaned: [8, 7, 6],
      nPartials: 1,
    });
    expect(cleanReps([10, 10])).toEqual({ cleaned: [10, 10], nPartials: 0 });
  });
});

describe("classifyPattern (5-set)", () => {
  it("linear: steady ~1-2 rep drop", () => {
    expect(classifyPattern([18, 16, 14, 12, 10])).toBe("linear");
    expect(classifyPattern([8, 7, 6, 5, 4])).toBe("linear");
  });
  it("flat: barely drops", () => {
    expect(classifyPattern([8, 8, 8, 8, 7])).toBe("flat");
  });
  it("steep: big early drop", () => {
    expect(classifyPattern([8, 5, 4, 3, 2])).toBe("steep");
  });
  it("irregular: a later set exceeds an earlier one", () => {
    expect(classifyPattern([12, 10, 10, 8, 10])).toBe("irregular");
  });
  it("incomplete: fewer than expected sets", () => {
    expect(classifyPattern([11, 9, 7, 5])).toBe("incomplete");
  });
});

describe("classifyPattern (3-set deadlift thresholds)", () => {
  it("6/5/4 is linear, 8/4/3 is steep, 5/3/7 is irregular", () => {
    expect(classifyPattern([6, 5, 4], 3)).toBe("linear");
    expect(classifyPattern([8, 4, 3], 3)).toBe("steep");
    expect(classifyPattern([5, 3, 7], 3)).toBe("irregular");
  });
});

describe("classifyStatus", () => {
  it("classifies HIT / OVER / UNDER vs target", () => {
    expect(classifyStatus(31, 30, max753)).toBe("HIT");
    expect(classifyStatus(34, 30, max753)).toBe("OVER+4");
    expect(classifyStatus(26, 30, max753)).toBe("UNDER-4");
    expect(classifyStatus(20, 30, max753)).toBe("UNDER-10");
  });
});

describe("closestTarget / bucketFor", () => {
  it("picks the nearest standard bucket", () => {
    expect(closestTarget(48, max753)).toBe(50);
    expect(closestTarget(33, max753)).toBe(30);
  });
  it("routes deadlift to the 3-set/15 bucket", () => {
    expect(isDeadlift(max753, "Deadlift")).toBe(true);
    const b = bucketFor(max753, "Deadlift", 15);
    expect(b.kind).toBe("deadlift");
    expect(b.expectedNSets).toBe(3);
    expect(b.setFloor).toBe(3);
  });
  it("routes abs to the rep-range bucket", () => {
    expect(isAbs(max753, "Cable Crunch")).toBe(true);
    const b = bucketFor(max753, "Cable Crunch", 54);
    expect(b.kind).toBe("abs");
    expect(b.repRangeMin).toBe(15);
    expect(b.repRangeMax).toBe(20);
  });
  it("detects abs by mainMuscle for names not in the abs list", () => {
    expect(isAbs(max753, "Crunch")).toBe(false); // name alone: not listed
    expect(isAbs(max753, "Crunch", "Abs")).toBe(true);
    expect(isAbs(max753, "Crunch", "Abs, Obliques")).toBe(true); // comma list
    expect(isAbs(max753, "Bench Press Barbell", "Chest")).toBe(false);
    const b = bucketFor(max753, "Crunch", 54, "Abs");
    expect(b.kind).toBe("abs");
  });
});

describe("movementPatternFor", () => {
  it("uses the curated map when the name is known", () => {
    expect(movementPatternFor(max753, "Leg press")).toBe("quad");
    expect(movementPatternFor(max753, "Pull up", "Back")).toBe("vertical_pull");
  });
  it("falls back to the exercise's primary mainMuscle when uncatalogued", () => {
    expect(
      movementPatternFor(max753, "Hip Abduction Machine", "Abductors"),
    ).toBe("abductors");
    expect(movementPatternFor(max753, "Seated Row Cable", "Back (Lats)")).toBe(
      "back (lats)",
    );
    expect(movementPatternFor(max753, "Crunch", "Abs, Obliques")).toBe("abs");
  });
  it("returns uncategorized when neither map nor muscle is available", () => {
    expect(movementPatternFor(max753, "Mystery Move")).toBe("uncategorized");
    expect(movementPatternFor(max753, "Mystery Move", "")).toBe(
      "uncategorized",
    );
  });
});
