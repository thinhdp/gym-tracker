import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkoutsTab from "./WorkoutsTab";

vi.mock("./WorkoutPlanner", () => ({ default: () => <div>PLANNER</div> }));
vi.mock("./WorkoutHistory", () => ({ default: () => <div>HISTORY</div> }));
vi.mock("./CalendarView", () => ({ default: () => <div>CALENDAR</div> }));

describe("WorkoutsTab", () => {
  it("shows the planner + history list by default", () => {
    render(<WorkoutsTab />);
    expect(screen.getByText("PLANNER")).toBeInTheDocument();
    expect(screen.getByText("HISTORY")).toBeInTheDocument();
    expect(screen.queryByText("CALENDAR")).not.toBeInTheDocument();
  });

  it("switches to the calendar view via the toggle", async () => {
    const user = userEvent.setup();
    render(<WorkoutsTab />);
    await user.click(screen.getByRole("button", { name: "Calendar" }));
    expect(screen.getByText("CALENDAR")).toBeInTheDocument();
    expect(screen.queryByText("PLANNER")).not.toBeInTheDocument();
  });
});
