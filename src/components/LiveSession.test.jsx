import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { saveLS, K_WO, K_SESSION } from "../lib/storage";
import LiveSession from "./LiveSession";

function seedAndRender() {
  saveLS(K_WO, [
    {
      id: "w1",
      date: "2026-06-13",
      name: "Push Day",
      exercises: [
        { exerciseName: "Bench", sets: [{ set: 1, weight: 80, reps: 8 }] },
      ],
    },
  ]);
  saveLS(K_SESSION, {
    workoutId: "w1",
    startedAt: Date.now(),
    currentIdx: 0,
    done: {},
  });
  return render(
    <AppProvider>
      <LiveSession />
    </AppProvider>,
  );
}

describe("LiveSession", () => {
  it("renders the current exercise and a sets/elapsed readout", () => {
    seedAndRender();
    expect(screen.getByText("Bench")).toBeInTheDocument();
    expect(screen.getByText(/Exercise 1 of 1/)).toBeInTheDocument();
    expect(screen.getByText(/0\/1 sets/)).toBeInTheDocument();
  });

  it("marks a set done and updates the counter", async () => {
    const user = userEvent.setup();
    seedAndRender();
    const doneBtn = screen.getByRole("button", { name: /Mark set 1 done/i });
    expect(doneBtn).toHaveAttribute("aria-pressed", "false");
    await user.click(doneBtn);
    expect(doneBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/1\/1 sets/)).toBeInTheDocument();
  });

  it("adds a set", async () => {
    const user = userEvent.setup();
    seedAndRender();
    // Two number inputs (weight + reps) before adding.
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /Add set/i }));
    expect(screen.getAllByRole("spinbutton")).toHaveLength(4);
  });

  it("starts and skips the manual rest timer", async () => {
    const user = userEvent.setup();
    seedAndRender();
    await user.click(screen.getByRole("button", { name: /Start rest timer/i }));
    expect(screen.getByText(/Rest ·/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByText(/Rest ·/)).not.toBeInTheDocument();
  });

  it("closes the session when finished", async () => {
    const user = userEvent.setup();
    seedAndRender();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.queryByText("Bench")).not.toBeInTheDocument();
  });
});
