import { averageWeightInRange } from "./weightUtils";

describe("averageWeightInRange", () => {
  it("returns null when no entries fall in the range", () => {
    expect(
      averageWeightInRange({}, new Date(2026, 5, 1), new Date(2026, 5, 7)),
    ).toBeNull();
  });

  it("averages entries within the inclusive range, rounded to 1 decimal", () => {
    const logs = {
      "2026-06-01": 80, // range start (inclusive)
      "2026-06-04": 81,
      "2026-06-07": 82.5, // range end (inclusive)
      "2026-06-08": 999, // outside
    };
    expect(
      averageWeightInRange(logs, new Date(2026, 5, 1), new Date(2026, 5, 7)),
    ).toBe(81.2); // (80 + 81 + 82.5) / 3 = 81.166…
  });

  it("skips non-numeric and non-finite values", () => {
    const logs = {
      "2026-06-01": "80",
      "2026-06-02": NaN,
      "2026-06-03": 80,
    };
    expect(
      averageWeightInRange(logs, new Date(2026, 5, 1), new Date(2026, 5, 7)),
    ).toBe(80);
  });

  it("handles a range spanning a month boundary", () => {
    const logs = { "2026-05-31": 80, "2026-06-01": 82 };
    expect(
      averageWeightInRange(logs, new Date(2026, 4, 31), new Date(2026, 5, 1)),
    ).toBe(81);
  });
});
