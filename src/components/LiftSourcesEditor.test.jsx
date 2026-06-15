import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LiftSourcesEditor from "./LiftSourcesEditor";

const NAMES = ["Bench Press Barbell", "Deadlift", "My Squat"];

// Controlled wrapper so onChange round-trips into the rendered value.
function Harness({ initial = {} }) {
  const [value, setValue] = useState(initial);
  return (
    <LiftSourcesEditor
      value={value}
      onChange={setValue}
      exerciseNames={NAMES}
    />
  );
}

describe("LiftSourcesEditor", () => {
  it("renders a row for every standard lift", () => {
    render(<Harness />);
    for (const label of [
      "Squat",
      "Bench",
      "Deadlift",
      "Overhead Press",
      "Pull-up",
      "Row",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("checking Add bar reveals the kg input defaulted to 20", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const boxes = screen.getAllByRole("checkbox");
    expect(screen.queryByDisplayValue("20")).not.toBeInTheDocument();
    await user.click(boxes[0]); // Squat row
    expect(screen.getByDisplayValue("20")).toBeInTheDocument();
  });

  it("prunes a row back out once its bar is unchecked and exercise cleared", async () => {
    const onChange = vi.fn();
    render(
      <LiftSourcesEditor
        value={{ bench: { addBar: true, barKg: 20 } }}
        onChange={onChange}
        exerciseNames={NAMES}
      />,
    );
    // The bench row's checkbox is the 2nd one and starts checked.
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes[1]).toBeChecked();
    await userEvent.setup().click(boxes[1]);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it("pins an exercise via the picker", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // First combobox is the Squat row.
    const combos = screen.getAllByRole("combobox");
    await user.type(combos[0], "My Squat");
    expect(combos[0]).toHaveValue("My Squat");
  });
});
