import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { ConfirmProvider } from "./ConfirmDialog";
import { saveLS, K_WO, K_SESSION } from "../lib/storage";
import LiveSession from "./LiveSession";

function renderLive() {
  return render(
    <ConfirmProvider>
      <AppProvider>
        <LiveSession />
      </AppProvider>
    </ConfirmProvider>,
  );
}

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
  saveLS(K_SESSION, { workoutId: "w1", startedAt: Date.now(), currentIdx: 0 });
  return renderLive();
}

function seedTwo() {
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
  saveLS(K_SESSION, { workoutId: "w2", startedAt: Date.now(), currentIdx: 0 });
  return renderLive();
}

describe("LiveSession", () => {
  it("renders the current exercise and a sets/elapsed readout", () => {
    seedAndRender();
    expect(screen.getByText("Bench")).toBeInTheDocument();
    expect(screen.getByText(/Exercise 1 of 1/)).toBeInTheDocument();
    // The seeded set has reps, so it already counts as logged.
    expect(screen.getByText(/1\/1 sets/)).toBeInTheDocument();
  });

  it("shows the running rep total for the current exercise", async () => {
    const user = userEvent.setup();
    seedAndRender();
    // The seeded set already has 8 reps logged.
    expect(screen.getByText("8 reps so far")).toBeInTheDocument();

    // Add a set and log it; the total should grow.
    await user.click(screen.getByRole("button", { name: /Add set/i }));
    const repsInputs = screen.getAllByRole("spinbutton");
    const newRepsInput = repsInputs[repsInputs.length - 1];
    await user.clear(newRepsInput);
    await user.type(newRepsInput, "5");

    expect(screen.getByText("13 reps so far")).toBeInTheDocument();
  });

  it("an added set starts unlogged until reps are entered", async () => {
    const user = userEvent.setup();
    seedAndRender();
    await user.click(screen.getByRole("button", { name: /Add set/i }));
    // Two sets now, but the new one has no reps yet → still 1 logged of 2.
    expect(screen.getByText(/1\/2 sets/)).toBeInTheDocument();
  });

  it("adds a set", async () => {
    const user = userEvent.setup();
    seedAndRender();
    // Two number inputs (weight + reps) before adding.
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /Add set/i }));
    expect(screen.getAllByRole("spinbutton")).toHaveLength(4);
  });

  it("offers an RPE / feedback control for the exercise", () => {
    seedAndRender();
    expect(
      screen.getByRole("button", { name: /RPE \/ note/i }),
    ).toBeInTheDocument();
  });

  it("starts a rest timer from a preset and skips it", async () => {
    const user = userEvent.setup();
    seedAndRender();
    await user.click(screen.getByRole("button", { name: "2 min" }));
    expect(screen.getByText("Rest · 2:00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByText(/Rest ·/)).not.toBeInTheDocument();
  });

  it("reorders exercises and keeps the pointer on the moved one", async () => {
    const user = userEvent.setup();
    seedTwo();

    expect(screen.getByText("Exercise 1 of 2")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Move exercise later/i }),
    );

    // The view follows Bench to position 2; the first chip is now Squat.
    expect(screen.getByText("Exercise 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Bench")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /1\. Squat/ }),
    ).toBeInTheDocument();
  });

  it("replaces the current exercise in place", async () => {
    const user = userEvent.setup();
    seedTwo();
    await user.click(screen.getByRole("button", { name: "Replace exercise" }));
    // The swap picker is the first exercise search box on screen.
    const search = screen.getAllByPlaceholderText(/Search by name/i)[0];
    await user.type(search, "Dips");
    await user.click(screen.getAllByRole("button", { name: /^Add$/ })[0]);

    // Bench (exercise 1) becomes Dips; Squat is untouched at position 2.
    expect(
      screen.getByRole("button", { name: /1\. Dips/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /1\. Bench/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /2\. Squat/ }),
    ).toBeInTheDocument();
  });

  it("removes the current exercise after confirming", async () => {
    const user = userEvent.setup();
    seedTwo();
    expect(screen.getByText("Exercise 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove exercise" }));
    // Confirm in the dialog.
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByText("Exercise 1 of 1")).toBeInTheDocument();
    expect(screen.queryByText(/Bench/)).not.toBeInTheDocument();
    expect(screen.getByText("Squat")).toBeInTheDocument();
  });

  it("opens past logs for the current exercise, excluding the live workout", async () => {
    const user = userEvent.setup();
    saveLS(K_WO, [
      {
        id: "past",
        date: "2026-06-06",
        name: "Last week",
        exercises: [
          { exerciseName: "Bench", sets: [{ set: 1, weight: 75, reps: 10 }] },
        ],
      },
      {
        id: "live",
        date: "2026-06-13",
        name: "Push Day",
        exercises: [
          { exerciseName: "Bench", sets: [{ set: 1, weight: 80, reps: 8 }] },
        ],
      },
    ]);
    saveLS(K_SESSION, {
      workoutId: "live",
      startedAt: Date.now(),
      currentIdx: 0,
    });
    renderLive();

    await user.click(screen.getByRole("button", { name: "Bench" }));

    // Modal shows the prior workout's set, not the in-progress one.
    expect(screen.getByText(/Past workouts/i)).toBeInTheDocument();
    expect(screen.getByText("Last week")).toBeInTheDocument();
    expect(screen.getByText(/Set 1: 75 kg × 10/)).toBeInTheDocument();
    expect(screen.queryByText(/Set 1: 80 kg × 8/)).not.toBeInTheDocument();
  });

  it("closes the session when finished", async () => {
    const user = userEvent.setup();
    seedAndRender();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.queryByText("Bench")).not.toBeInTheDocument();
  });
});
