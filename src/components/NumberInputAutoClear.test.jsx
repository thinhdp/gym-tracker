import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NumberInputAutoClear from "./NumberInputAutoClear";

/** Controlled harness mirroring how the app uses this input. */
function Harness({ initial = 0, spy }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberInputAutoClear
      valueNumber={value}
      onNumberChange={(n) => {
        spy?.(n);
        setValue(n);
      }}
    />
  );
}

describe("NumberInputAutoClear", () => {
  it("shows the value initially", () => {
    render(<Harness initial={0} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(0);
  });

  it("clears the displayed 0 on focus and restores it on blur", async () => {
    const user = userEvent.setup();
    render(<Harness initial={0} />);
    const input = screen.getByRole("spinbutton");

    await user.click(input);
    expect(input).toHaveValue(null); // displayed as empty while focused

    await user.tab(); // blur
    expect(input).toHaveValue(0);
  });

  it("does not clear a non-zero value on focus", async () => {
    const user = userEvent.setup();
    render(<Harness initial={5} />);
    const input = screen.getByRole("spinbutton");
    await user.click(input);
    expect(input).toHaveValue(5);
  });

  it("reports typed decimal values through onNumberChange", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial={0} spy={spy} />);
    const input = screen.getByRole("spinbutton");

    await user.click(input); // clears the 0
    await user.type(input, "12.5");
    expect(spy).toHaveBeenLastCalledWith(12.5);
    expect(input).toHaveValue(12.5);
  });

  it("treats clearing the field as 0", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial={42} spy={spy} />);
    const input = screen.getByRole("spinbutton");

    await user.clear(input);
    expect(spy).toHaveBeenLastCalledWith(0);
  });
});
