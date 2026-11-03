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
  meal: "lunch",
  grams: 100,
  per100: { kcal, protein, carb: 0, fat: 0 },
});

afterEach(() => vi.useRealTimers());

describe("FoodSummaryCard", () => {
  it("shows today's kcal against target and links to /food", () => {
    saveLS(K_FOOD_TARGETS, [TARGET]);
    saveLS(K_FOOD_ENTRIES, [entry(todayLocal(), 500, 40)]);
    render(<FoodSummaryCard />);
    expect(screen.getByText("Food today")).toBeInTheDocument();
    expect(screen.getByText("500 / 2000 kcal")).toBeInTheDocument();
    expect(screen.getByText("Protein 40 / 150 g")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/food");
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
    [1700, "bg-blue-600", "85%"],
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

  it("counts an entry logged late in the local day for that day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 23, 59, 30));
    saveLS(K_FOOD_TARGETS, [TARGET]);
    saveLS(K_FOOD_ENTRIES, [
      entry("2026-06-15", 400),
      entry("2026-06-16", 700),
    ]);
    render(<FoodSummaryCard />);
    expect(screen.getByText("400 / 2000 kcal")).toBeInTheDocument();
  });
});
