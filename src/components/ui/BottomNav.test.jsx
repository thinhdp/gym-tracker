import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomNav from "./BottomNav";

describe("BottomNav", () => {
  it("renders all five destinations", () => {
    render(<BottomNav active="home" onSelect={() => {}} />);
    for (const label of ["Home", "Workouts", "Progress", "Exercises", "More"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the active tab with aria-current", () => {
    render(<BottomNav active="progress" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Progress" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("calls onSelect with the tab key when tapped", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BottomNav active="home" onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: "Exercises" }));
    expect(onSelect).toHaveBeenCalledWith("exercises");
  });
});
