import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { K_WO } from "../lib/storage";
import CycleReview from "./CycleReview";

const sets = (w, ...reps) => reps.map((r, i) => ({ set: i + 1, weight: w, reps: r }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    K_WO,
    JSON.stringify([
      {
        id: "p2",
        date: "2026-06-09",
        name: "Push",
        exercises: [{ exerciseName: "Bench Press Barbell", sets: sets(40, 9, 8, 7, 6, 5) }],
      },
    ]),
  );
});

const renderReview = () =>
  render(
    <AppProvider>
      <CycleReview />
    </AppProvider>,
  );

describe("CycleReview", () => {
  it("renders the headline and the next-cycle plan", () => {
    renderReview();
    expect(screen.getByText(/Week/)).toBeInTheDocument();
    expect(screen.getByText("Bench Press Barbell")).toBeInTheDocument();
  });

  it("switches plan grouping between session and block", async () => {
    const user = userEvent.setup();
    renderReview();
    expect(screen.getByText("Push")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Block/i }));
    expect(screen.getByText(/Block A/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no workouts", () => {
    localStorage.setItem(K_WO, JSON.stringify([]));
    renderReview();
    expect(screen.getByText(/No .*review/i)).toBeInTheDocument();
  });
});
