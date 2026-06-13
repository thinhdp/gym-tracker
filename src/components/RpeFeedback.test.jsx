import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RpeFeedback from "./RpeFeedback";

/** Controlled harness: applies { rpe } / { feedback } patches like the editors. */
function Harness({ initialRpe = null, initialFeedback = "", spy }) {
  const [state, setState] = useState({
    rpe: initialRpe,
    feedback: initialFeedback,
  });
  return (
    <RpeFeedback
      rpe={state.rpe}
      feedback={state.feedback}
      onChange={(patch) => {
        spy?.(patch);
        setState((prev) => ({ ...prev, ...patch }));
      }}
    />
  );
}

describe("RpeFeedback (edit mode)", () => {
  it("starts collapsed with a trigger when there is no data", () => {
    render(<Harness />);
    expect(
      screen.getByRole("button", { name: /RPE \/ note/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("expands to a dropdown offering 6–10 in 0.5 steps and records a pick", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);

    await user.click(screen.getByRole("button", { name: /RPE \/ note/i }));
    const select = screen.getByRole("combobox");
    // Blank + 9 options (6 … 10).
    expect(screen.getAllByRole("option")).toHaveLength(10);

    await user.selectOptions(select, "7.5");
    expect(spy).toHaveBeenCalledWith({ rpe: 7.5 });
  });

  it("sends a feedback patch as the user types", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);

    await user.click(screen.getByRole("button", { name: /RPE \/ note/i }));
    await user.type(screen.getByPlaceholderText(/feedback/i), "tough");

    expect(spy.mock.calls.at(-1)[0]).toEqual({ feedback: "tough" });
  });

  it("shows a summary chip when collapsed with data present", () => {
    render(<Harness initialRpe={9} initialFeedback="back rounded" />);
    expect(screen.getByText("RPE 9")).toBeInTheDocument();
    expect(screen.getByText("back rounded")).toBeInTheDocument();
    // Still collapsed — no dropdown yet.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("clears the rpe back to null when the blank option is chosen", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initialRpe={8} spy={spy} />);

    await user.click(screen.getByText("RPE 8"));
    await user.selectOptions(screen.getByRole("combobox"), "—");
    expect(spy).toHaveBeenCalledWith({ rpe: null });
  });
});

describe("RpeFeedback (read mode)", () => {
  it("renders nothing when there is no data", () => {
    const { container } = render(
      <RpeFeedback mode="read" rpe={null} feedback="" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the badge and feedback text when present", () => {
    render(<RpeFeedback mode="read" rpe={8.5} feedback="grind on last set" />);
    expect(screen.getByText("RPE 8.5")).toBeInTheDocument();
    expect(screen.getByText("grind on last set")).toBeInTheDocument();
    // Read mode is static — no inputs.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
