import { describe, it, expect } from "vitest";
import {
  fillDailyWeights,
  buildWeightSeries,
  rangeForPeriod,
} from "./weightSeries";

const d = (s) => new Date(s + "T00:00:00");

describe("fillDailyWeights", () => {
  it("emits one entry per day in the range", () => {
    const logs = { "2026-01-01": 80 };
    const out = fillDailyWeights(logs, d("2026-01-01"), d("2026-01-03"));
    expect(out).toEqual([
      { date: "2026-01-01", weight: 80 },
      { date: "2026-01-02", weight: 80 },
      { date: "2026-01-03", weight: 80 },
    ]);
  });

  it("forward-fills gaps with the last logged weight", () => {
    const logs = { "2026-01-01": 80, "2026-01-04": 82 };
    const out = fillDailyWeights(logs, d("2026-01-01"), d("2026-01-05"));
    expect(out.map((p) => p.weight)).toEqual([80, 80, 80, 82, 82]);
  });

  it("carries a weight logged before the range start", () => {
    const logs = { "2025-12-20": 79 };
    const out = fillDailyWeights(logs, d("2026-01-01"), d("2026-01-02"));
    expect(out).toEqual([
      { date: "2026-01-01", weight: 79 },
      { date: "2026-01-02", weight: 79 },
    ]);
  });

  it("omits leading days that have no prior weight", () => {
    const logs = { "2026-01-03": 81 };
    const out = fillDailyWeights(logs, d("2026-01-01"), d("2026-01-04"));
    expect(out).toEqual([
      { date: "2026-01-03", weight: 81 },
      { date: "2026-01-04", weight: 81 },
    ]);
  });

  it("ignores non-numeric / non-finite values", () => {
    const logs = { "2026-01-01": 80, "2026-01-02": NaN, "2026-01-03": null };
    const out = fillDailyWeights(logs, d("2026-01-01"), d("2026-01-03"));
    expect(out.map((p) => p.weight)).toEqual([80, 80, 80]);
  });

  it("returns [] when range is missing", () => {
    expect(
      fillDailyWeights({ "2026-01-01": 80 }, null, d("2026-01-02")),
    ).toEqual([]);
  });
});

describe("buildWeightSeries weekly", () => {
  it("averages filled days per ISO week", () => {
    // Mon 2026-01-05 .. Sun 2026-01-11 is one week.
    const logs = { "2026-01-05": 80, "2026-01-08": 84 };
    const out = buildWeightSeries(
      logs,
      d("2026-01-05"),
      d("2026-01-11"),
      "weekly",
    );
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-01-05");
    // 80,80,80,84,84,84,84 -> avg
    expect(out[0].weight).toBeCloseTo((80 * 3 + 84 * 4) / 7, 2);
  });

  it("represents every week in the range via forward-fill", () => {
    const logs = { "2026-01-05": 80 };
    const out = buildWeightSeries(
      logs,
      d("2026-01-05"),
      d("2026-01-18"),
      "weekly",
    );
    expect(out.map((p) => p.weight)).toEqual([80, 80]);
  });
});

describe("rangeForPeriod", () => {
  const today = d("2026-06-13");
  it("computes 1m / 3m / 6m / 1y back from today", () => {
    expect(rangeForPeriod("1m", today).from).toEqual(d("2026-05-13"));
    expect(rangeForPeriod("3m", today).from).toEqual(d("2026-03-13"));
    expect(rangeForPeriod("6m", today).from).toEqual(d("2025-12-13"));
    expect(rangeForPeriod("1y", today).from).toEqual(d("2025-06-13"));
  });
  it("ends at today", () => {
    expect(rangeForPeriod("3m", today).to).toEqual(today);
  });
});
