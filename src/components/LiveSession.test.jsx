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

  it("starts a rest timer from a preset and skips it", async () => {
    const user = userEvent.setup();
    seedAndRender();
    await user.click(screen.getByRole("button", { name: "2 min" }));
    expect(screen.getByText("Rest · 2:00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByText(/Rest ·/)).not.toBeInTheDocument();
  });

  it("reorders exercises, keeping the done flag and pointer on the moved one", async () => {
    const user = userEvent.setup();
    saveLS(K_WO, [
      {
        id: "w2",
        date: "2026-06-13",
        name: "Push Day",
        exercises: [
          { exerciseName: "Bench", sets: [{ set: 1, weight: 80, reps: 8 }] },
          { exerciseName: "Squat", sets: [{ set: 1, weight: 100, reps: 5 }] },
        ],
      },
    ]);
    saveLS(K_SESSION, {
      workoutId: "w2",
      startedAt: Date.now(),
      currentIdx: 0,
      done: {},
    });
    render(
      <AppProvider>
        <LiveSession />
      </AppProvider>,
    );

    expect(screen.getByText("Exercise 1 of 2")).toBeInTheDocument();
    // Complete Bench's set, then move Bench later.
    await user.click(screen.getByRole("button", { name: /Mark set 1 done/i }));
    await user.click(
      screen.getByRole("button", { name: /Move exercise later/i }),
    );

    // The view follows Bench to position 2, and its done flag came along.
    expect(screen.getByText("Exercise 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Bench")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Mark set 1 done/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("closes the session when finished", async () => {
    const user = userEvent.setup();
    seedAndRender();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.queryByText("Bench")).not.toBeInTheDocument();
  });
});
