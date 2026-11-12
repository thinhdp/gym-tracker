import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { todayLocal } from "../lib/localDate";
import CalendarSheet from "./CalendarSheet";

const entry = (date, kcal) => ({
  date,
  grams: 100,
  per100: { kcal, protein: 0, carb: 0, fat: 0 },
});

const setup = (overrides = {}) => {
  const props = {
    date: "2026-11-11",
    entries: [entry("2026-11-05", 1000), entry("2026-11-05", 850)],
    completedDays: ["2026-11-05", "2026-11-06"],
    onPick: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<CalendarSheet {...props} />);
  return props;
};

describe("CalendarSheet", () => {
  it("shows kcal and the completed mark on a logged completed day", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "2026-11-05, 1850 kcal, completed" }),
    ).toBeInTheDocument();
  });

  it("opens on the month of the date prop, not today's", () => {
    setup({ date: "2026-09-15" });
    expect(
      screen.getByRole("button", { name: "2026-09-01" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "2026-11-01" }),
    ).not.toBeInTheDocument();
  });

  it("styles a completed day green", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "2026-11-05, 1850 kcal, completed" }),
    ).toHaveClass("bg-green-100");
  });

  it("shows 0 kcal on a completed day with no entries", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "2026-11-06, 0 kcal, completed" }),
    ).toBeInTheDocument();
  });

  it("shows no number on an empty unmarked day", () => {
    setup();
    const cell = screen.getByRole("button", { name: "2026-11-07" });
    expect(cell).toHaveTextContent(/^7$/);
  });

  it("marks the shown date with aria-current", () => {
    setup();
    expect(screen.getByRole("button", { name: "2026-11-11" })).toHaveAttribute(
      "aria-current",
      "date",
    );
  });

  it("navigates between months", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(
      screen.getByRole("button", { name: "2026-12-01" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(
      screen.getByRole("button", { name: "2026-10-01" }),
    ).toBeInTheDocument();
  });

  it("calls onPick with the tapped day and onClose from Close", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "2026-11-07" }));
    expect(props.onPick).toHaveBeenCalledWith("2026-11-07");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalled();
  });

  describe("over-target kcal", () => {
    const target = (from, kcal) => ({
      from,
      kcal,
      protein: 100,
      carb: 200,
      fat: 50,
    });
    const kcalSpan = (name) =>
      screen.getByRole("button", { name }).querySelector("span:last-child");

    it("shows an over-target day in red and labels it", () => {
      setup({ targets: [target("2026-01-01", 1800)] });
      const name = "2026-11-05, 1850 kcal, over target, completed";
      expect(kcalSpan(name)).toHaveClass("text-red-700", "dark:text-red-300");
    });

    it("uses the normal red on an incomplete over-target day", () => {
      setup({
        entries: [entry("2026-11-05", 2000)],
        completedDays: [],
        targets: [target("2026-01-01", 1800)],
      });
      const name = "2026-11-05, 2000 kcal, over target";
      expect(kcalSpan(name)).toHaveClass("text-red-600", "dark:text-red-400");
      expect(screen.getByRole("button", { name })).not.toHaveClass(
        "text-red-600",
      );
    });

    it("does not flag a day equal to the target", () => {
      setup({
        completedDays: [],
        targets: [target("2026-01-01", 1850)],
      });
      const name = "2026-11-05, 1850 kcal";
      expect(kcalSpan(name).className).not.toMatch(/text-red/);
    });

    it("does not flag a day before the first target row", () => {
      setup({
        completedDays: [],
        targets: [target("2026-11-06", 1000)],
      });
      const name = "2026-11-05, 1850 kcal";
      expect(kcalSpan(name).className).not.toMatch(/text-red/);
    });

    it("uses the target in force on that date", () => {
      setup({
        entries: [entry("2026-11-05", 1500), entry("2026-11-08", 1500)],
        completedDays: [],
        targets: [target("2026-01-01", 1400), target("2026-11-07", 2000)],
      });
      expect(kcalSpan("2026-11-05, 1500 kcal, over target")).toHaveClass(
        "text-red-600",
      );
      expect(kcalSpan("2026-11-08, 1500 kcal").className).not.toMatch(
        /text-red/,
      );
    });
  });

  describe("today and shown-date styling", () => {
    const today = todayLocal();
    // A different day in today's month, so the sheet opens on today's month.
    const other = `${today.slice(0, 8)}${today.endsWith("-01") ? "02" : "01"}`;

    it("bolds today's day number and no other day", () => {
      setup({ date: other, entries: [], completedDays: [] });
      expect(screen.getByRole("button", { name: today })).toHaveClass(
        "font-bold",
      );
      expect(screen.getByRole("button", { name: other })).not.toHaveClass(
        "font-bold",
      );
    });

    it("outlines the shown date and no other day", () => {
      setup({ date: other, entries: [], completedDays: [] });
      expect(screen.getByRole("button", { name: other })).toHaveClass(
        "outline",
        "outline-2",
      );
      expect(screen.getByRole("button", { name: today })).not.toHaveClass(
        "outline",
      );
    });
  });
});
