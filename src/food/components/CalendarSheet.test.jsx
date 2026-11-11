import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
});
