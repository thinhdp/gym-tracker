import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveLS } from "../lib/storage";
import { K_FOOD_ENTRIES, K_FOOD_TARGETS } from "../food/lib/keys";
import { todayLocal, addDays } from "../food/lib/localDate";
import FoodSummaryCard from "./FoodSummaryCard";

const TARGET = {
  from: "2020-01-01",
  kcal: 2000,
  protein: 150,
  carb: 200,
  fat: 60,
};
const entry = (date, kcal, protein = 0) => ({
  id: `${date}-${kcal}`,
  date,
  slot: "lunch",
  grams: 100,
  per100: { kcal, protein, carb: 0, fat: 0 },
  food: { kind: "db", id: "rice" },
});

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  vi.useRealTimers();
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe("FoodSummaryCard", () => {
  it("shows today's kcal against target and links to /food", () => {
    saveLS(K_FOOD_TARGETS, [TARGET]);
    saveLS(K_FOOD_ENTRIES, [entry(todayLocal(), 500, 40)]);
    render(<FoodSummaryCard />);
    expect(screen.getByText("Food today")).toBeInTheDocument();
    expect(screen.getByText("500 / 2000 kcal")).toBeInTheDocument();
    expect(screen.getByText("Protein 40 / 150 g")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/food");
    expect(screen.getByText("›")).toBeInTheDocument();
  });

  it("ignores entries from other days", () => {
    saveLS(K_FOOD_TARGETS, [TARGET]);
    saveLS(K_FOOD_ENTRIES, [
      entry(todayLocal(), 300),
      entry(addDays(todayLocal(), -1), 900),
    ]);
    render(<FoodSummaryCard />);
    expect(screen.getByText("300 / 2000 kcal")).toBeInTheDocument();
  });

  it("shows the set-up prompt without a target", () => {
    render(<FoodSummaryCard />);
    expect(
      screen.getByRole("link", { name: "Set up food tracking →" }),
    ).toHaveAttribute("href", "/food");
  });

  it("shows the set-up prompt for non-array stored targets", () => {
    saveLS(K_FOOD_TARGETS, { from: "2020-01-01" });
    render(<FoodSummaryCard />);
    expect(screen.getByText(/Set up food tracking/)).toBeInTheDocument();
  });

  it("shows 0 eaten for non-array stored entries", () => {
    saveLS(K_FOOD_TARGETS, [TARGET]);
    saveLS(K_FOOD_ENTRIES, { not: "a list" });
    render(<FoodSummaryCard />);
    expect(screen.getByText("0 / 2000 kcal")).toBeInTheDocument();
  });

  it("shows 0 eaten for a target with no entries", () => {
    saveLS(K_FOOD_TARGETS, [TARGET]);
    render(<FoodSummaryCard />);
    expect(screen.getByText("0 / 2000 kcal")).toBeInTheDocument();
  });

  it("shows the set-up prompt when the target starts after today", () => {
    saveLS(K_FOOD_TARGETS, [{ ...TARGET, from: addDays(todayLocal(), 1) }]);
    render(<FoodSummaryCard />);
    expect(screen.getByText(/Set up food tracking/)).toBeInTheDocument();
  });

  it.each([
    [1799, "bg-blue-600", "89.95%"],
    [1800, "bg-amber-500", "90%"],
    [2000, "bg-amber-500", "100%"],
    [2020, "bg-red-600", "100%"],
  ])("bar at %i kcal uses %s and width %s", (kcal, tone, width) => {
    saveLS(K_FOOD_TARGETS, [TARGET]);
    saveLS(K_FOOD_ENTRIES, [entry(todayLocal(), kcal)]);
    render(<FoodSummaryCard />);
    const bar = screen.getByTestId("food-summary-bar");
    expect(bar).toHaveClass(tone);
    expect(bar.style.width).toBe(width);
  });

  it("counts stored rows dated for the local day just after local midnight", () => {
    // UTC+7: 00:30 local is still the previous day in UTC, so a UTC-derived
    // today would pick the wrong date regardless of the machine's zone.
    process.env.TZ = "Asia/Ho_Chi_Minh";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 0, 30, 0));
    saveLS(K_FOOD_TARGETS, [TARGET]);
    saveLS(K_FOOD_ENTRIES, [
      entry("2026-06-14", 900),
      entry("2026-06-15", 400),
      entry("2026-06-16", 700),
    ]);
    render(<FoodSummaryCard />);
    expect(screen.getByText("400 / 2000 kcal")).toBeInTheDocument();
  });

  it("counts an entry dated today late in the local day", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 23, 59, 30));
    saveLS(K_FOOD_TARGETS, [TARGET]);
    saveLS(K_FOOD_ENTRIES, [
      entry("2026-06-14", 900),
      entry("2026-06-15", 400),
      entry("2026-06-16", 700),
    ]);
    render(<FoodSummaryCard />);
    expect(screen.getByText("400 / 2000 kcal")).toBeInTheDocument();
  });

  describe("malformed stored rows", () => {
    const stored = () => [
      localStorage.getItem(K_FOOD_ENTRIES),
      localStorage.getItem(K_FOOD_TARGETS),
    ];

    it("renders with [null] in entries, counts the valid rows and writes nothing", () => {
      saveLS(K_FOOD_TARGETS, [TARGET]);
      saveLS(K_FOOD_ENTRIES, [null, entry(todayLocal(), 300)]);
      const before = stored();
      render(<FoodSummaryCard />);
      expect(screen.getByText("300 / 2000 kcal")).toBeInTheDocument();
      expect(stored()).toEqual(before);
    });

    it("renders with [null] in targets, uses the valid row and writes nothing", () => {
      saveLS(K_FOOD_TARGETS, [null, TARGET]);
      const before = stored();
      render(<FoodSummaryCard />);
      expect(screen.getByText("0 / 2000 kcal")).toBeInTheDocument();
      expect(stored()).toEqual(before);
    });

    it("shows the set-up prompt when targets holds only [null]", () => {
      saveLS(K_FOOD_TARGETS, [null]);
      const before = stored();
      render(<FoodSummaryCard />);
      expect(screen.getByText(/Set up food tracking/)).toBeInTheDocument();
      expect(stored()).toEqual(before);
    });

    it("renders with an entry dated today with no per100 and writes nothing", () => {
      const noPer100 = { ...entry(todayLocal(), 900), per100: undefined };
      saveLS(K_FOOD_TARGETS, [TARGET]);
      saveLS(K_FOOD_ENTRIES, [noPer100, entry(todayLocal(), 300)]);
      const before = stored();
      render(<FoodSummaryCard />);
      expect(screen.getByText("300 / 2000 kcal")).toBeInTheDocument();
      expect(stored()).toEqual(before);
    });

    it("counts a duplicate entry once, the same total /food shows", () => {
      saveLS(K_FOOD_TARGETS, [TARGET]);
      saveLS(K_FOOD_ENTRIES, [
        entry(todayLocal(), 300),
        entry(todayLocal(), 300),
      ]);
      render(<FoodSummaryCard />);
      expect(screen.getByText("300 / 2000 kcal")).toBeInTheDocument();
    });
  });

  it("is back on the machine zone after the UTC+7 tests", () => {
    expect(process.env.TZ).toBe(ORIGINAL_TZ);
  });
});
