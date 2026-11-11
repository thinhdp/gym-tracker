import { describe, expect, it } from "vitest";
import { dayTotals, monthGrid } from "./calendar";

describe("monthGrid", () => {
  it("pads a Sunday-start month with six leading nulls", () => {
    const grid = monthGrid(2026, 10);
    expect(grid).toHaveLength(6);
    expect(grid[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    const last = grid[5];
    expect(last[last.indexOf("2026-11-30") + 1]).toBeNull();
  });

  it("starts at once when the month begins on Monday", () => {
    const grid = monthGrid(2026, 5);
    expect(grid[0][0]).toBe("2026-06-01");
    expect(grid).toHaveLength(5);
  });

  it("handles leap and non-leap February", () => {
    expect(monthGrid(2024, 1).flat()).toContain("2024-02-29");
    const feb = monthGrid(2026, 1);
    expect(feb).toHaveLength(5);
    expect(feb.flat()).not.toContain("2026-02-29");
  });
});

describe("dayTotals", () => {
  const e = (date, kcal) => ({
    date,
    grams: 100,
    per100: { kcal, protein: 0, carb: 0, fat: 0 },
  });

  it("sums entries on one date and keeps dates separate", () => {
    const m = dayTotals([
      e("2026-11-01", 100),
      e("2026-11-01", 50),
      e("2026-11-02", 70),
    ]);
    expect(m.get("2026-11-01")).toBe(150);
    expect(m.get("2026-11-02")).toBe(70);
  });

  it("returns an empty map for a non-array", () => {
    expect(dayTotals(null).size).toBe(0);
  });
});
