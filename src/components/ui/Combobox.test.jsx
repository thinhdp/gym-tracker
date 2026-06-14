import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Combobox from "./Combobox";

const OPTIONS = ["Bench Press Barbell", "Deadlift", "Squat Barbell"];

// Controlled wrapper so onChange actually updates the displayed value.
function Harness({ initial = "", options = OPTIONS }) {
  const [value, setValue] = useState(initial);
  return (
    <Combobox
      value={value}
      onChange={setValue}
      options={options}
      placeholder="Pick an exercise"
    />
  );
}

const optionsListed = () =>
  screen.queryAllByRole("option").map((o) => o.textContent);

describe("Combobox", () => {
  it("shows every option when opened, even with a value already selected", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Squat Barbell" />);
    await user.click(screen.getByRole("button", { name: /show all options/i }));
    expect(optionsListed()).toEqual(OPTIONS);
  });

  it("filters the list as you type", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole("combobox"), "bench");
    expect(optionsListed()).toEqual(["Bench Press Barbell"]);
  });

  it("commits the clicked option and closes the list", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /show all options/i }));
    await user.click(screen.getByRole("option", { name: "Deadlift" }));
    expect(screen.getByRole("combobox")).toHaveValue("Deadlift");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selects with keyboard arrows and Enter", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(input).toHaveValue("Deadlift");
  });

  it("allows free text that matches nothing", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox");
    await user.type(input, "Cable Fly");
    expect(input).toHaveValue("Cable Fly");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /show all options/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
