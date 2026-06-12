import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkoutExerciseEditor from "./WorkoutExerciseEditor";
import { ConfirmProvider } from "./ConfirmDialog";
import { MAX_SETS } from "../lib/constants";

/** Controlled harness: applies onChange patches like the planner/history do. */
function Harness({ initialSets, unit = "kg", spy }) {
  const [item, setItem] = useState({
    exerciseName: "Bench Press",
    sets: initialSets,
  });
  return (
    <ConfirmProvider>
      <WorkoutExerciseEditor
        item={item}
        unit={unit}
        onChange={(patch) => {
          spy?.(patch);
          setItem((prev) => ({ ...prev, ...patch }));
        }}
        onRemove={() => {}}
      />
    </ConfirmProvider>
  );
}

const sets = (n, weight = 0, reps = 0) =>
  Array.from({ length: n }, (_, i) => ({ set: i + 1, weight, reps }));

describe("WorkoutExerciseEditor", () => {
  it("renders one labeled row per set", () => {
    render(<Harness initialSets={sets(3)} />);
    expect(screen.getByText("Set 1")).toBeInTheDocument();
    expect(screen.getByText("Set 2")).toBeInTheDocument();
    expect(screen.getByText("Set 3")).toBeInTheDocument();
  });

  it("appends a new default set via the add button", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initialSets={sets(2, 100, 5)} spy={spy} />);

    await user.click(screen.getByRole("button", { name: /set/i }));
    expect(spy).toHaveBeenCalledWith({
      sets: [...sets(2, 100, 5), { set: 3, weight: 0, reps: 0 }],
    });
    expect(screen.getByText("Set 3")).toBeInTheDocument();
  });

  it("disables the add button at MAX_SETS", () => {
    render(<Harness initialSets={sets(MAX_SETS)} />);
    expect(screen.getByRole("button", { name: /set/i })).toBeDisabled();
  });

  it("deletes a set through the confirm dialog and renumbers the rest", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initialSets={sets(3, 100, 5)} spy={spy} />);

    // Per-set delete buttons follow the header remove button.
    const deleteButtons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent.includes("🗑"));
    await user.click(deleteButtons[1]); // delete button of Set 1

    expect(screen.getByText("Delete this set?")).toBeInTheDocument();
    await user.click(screen.getByText("Delete"));

    expect(spy).toHaveBeenCalledWith({
      sets: [
        { set: 1, weight: 100, reps: 5 },
        { set: 2, weight: 100, reps: 5 },
      ],
    });
    expect(screen.queryByText("Set 3")).not.toBeInTheDocument();
  });

  it("keeps the last remaining set's delete button disabled", () => {
    render(<Harness initialSets={sets(1)} />);
    const deleteButtons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent.includes("🗑"));
    expect(deleteButtons[1]).toBeDisabled();
  });

  it("displays stored kg in lb and converts edits back to kg (kg-storage invariant)", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    // 45.36 kg ≈ 100 lb
    render(<Harness initialSets={sets(1, 45.36, 5)} unit="lb" spy={spy} />);

    const [weightInput] = screen.getAllByRole("spinbutton");
    expect(weightInput).toHaveValue(100);

    await user.clear(weightInput);
    await user.type(weightInput, "105");

    // The patch must carry kilograms: fromDisplayWeight(105, "lb") = 47.63.
    const lastPatch = spy.mock.calls.at(-1)[0];
    expect(lastPatch.sets[0].weight).toBe(47.63);
    expect(weightInput).toHaveValue(105);
  });
});
