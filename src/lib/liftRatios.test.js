import {
  buildRatioRows,
  overallScore,
  scoreRating,
  focusAreas,
} from "./liftRatios";

// Median (p50) lifts roughly matching a male @70kg: squat 110, bench 82,
// deadlift 132, ohp 53, row 73. Median ratios: bench .745, dl 1.2, ohp .48, row .66.
const avg = { squat: 110, bench: 82, deadlift: 132, ohp: 53, row: 73 };

describe("buildRatioRows", () => {
  it("returns one row per non-base lift present in both user and average", () => {
    const user = { squat: 100, bench: 75, deadlift: 120 };
    const rows = buildRatioRows(user, avg);
    expect(rows.map((r) => r.key).sort()).toEqual(["bench", "deadlift"]);
    expect(rows.find((r) => r.key === "bench")).toMatchObject({
      label: "Bench Press",
    });
  });

  it("returns nothing when the squat base is missing on either side", () => {
    expect(buildRatioRows({ bench: 75 }, avg)).toEqual([]);
    expect(buildRatioRows({ squat: 100, bench: 75 }, { bench: 82 })).toEqual(
      [],
    );
  });

  it("flags a lift matching the median ratio as balanced", () => {
    // bench/squat = 82/110 = median exactly.
    const rows = buildRatioRows({ squat: 110, bench: 82 }, avg);
    expect(rows[0].assessment).toBe("balanced");
    expect(Math.abs(rows[0].diff)).toBeLessThan(1e-9);
  });

  it("flags a lift far above its median ratio as strong, below as weak", () => {
    // Same squat as median; bench way over -> strong, deadlift way under -> weak.
    const rows = buildRatioRows({ squat: 110, bench: 110, deadlift: 100 }, avg);
    expect(rows.find((r) => r.key === "bench").assessment).toBe("strong");
    expect(rows.find((r) => r.key === "deadlift").assessment).toBe("weak");
  });
});

describe("overallScore / scoreRating", () => {
  it("scores a perfectly proportioned lifter at 100 (Excellent)", () => {
    const rows = buildRatioRows(
      { squat: 220, bench: 164, deadlift: 264, ohp: 106, row: 146 },
      avg,
    );
    const s = overallScore(rows);
    expect(s).toBe(100);
    expect(scoreRating(s)).toBe("Excellent");
  });

  it("drops the score as ratios drift from the median", () => {
    const rows = buildRatioRows({ squat: 110, bench: 110 }, avg); // bench +48%
    expect(overallScore(rows)).toBeLessThan(100);
  });

  it("returns null for an empty set", () => {
    expect(overallScore([])).toBeNull();
    expect(scoreRating(null)).toBeNull();
  });

  it("maps score bands to words", () => {
    expect(scoreRating(95)).toBe("Excellent");
    expect(scoreRating(80)).toBe("Good");
    expect(scoreRating(65)).toBe("Fair");
    expect(scoreRating(40)).toBe("Imbalanced");
  });
});

describe("focusAreas", () => {
  it("names the most-lagging and most-leading lifts", () => {
    const rows = buildRatioRows(
      { squat: 110, bench: 110, deadlift: 100, ohp: 53 },
      avg,
    );
    const { weakest, strongest } = focusAreas(rows);
    expect(strongest.key).toBe("bench");
    expect(weakest.key).toBe("deadlift");
  });

  it("returns nulls when everything is balanced", () => {
    const rows = buildRatioRows({ squat: 220, bench: 164, deadlift: 264 }, avg);
    expect(focusAreas(rows)).toEqual({ weakest: null, strongest: null });
  });
});
