import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Progress from "./Progress";

vi.mock("./WeightTracker", () => ({ default: () => <div>WEIGHT</div> }));
vi.mock("./StrengthAnalysis", () => ({ default: () => <div>SUMMARY</div> }));

describe("Progress", () => {
  it("shows bodyweight by default", () => {
    render(<Progress />);
    expect(screen.getByText("WEIGHT")).toBeInTheDocument();
    expect(screen.queryByText("SUMMARY")).not.toBeInTheDocument();
  });

  it("switches to strength analytics via the toggle", async () => {
    const user = userEvent.setup();
    render(<Progress />);
    await user.click(screen.getByRole("button", { name: "Strength" }));
    expect(screen.getByText("SUMMARY")).toBeInTheDocument();
    expect(screen.queryByText("WEIGHT")).not.toBeInTheDocument();
  });
});
