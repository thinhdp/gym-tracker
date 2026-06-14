import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StrengthAnalysis from "./StrengthAnalysis";

const mockApp = { workouts: [], exercises: [], unit: "kg" };
vi.mock("../context/AppContext", () => ({
  useApp: () => mockApp,
}));

vi.mock("recharts", async (importOriginal) => {
  const { withFixedResponsiveContainer } =
    await import("../test/rechartsTestUtils");
  return withFixedResponsiveContainer(await importOriginal());
});

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const workout = (date, exercises) => ({
  id: date,
  date,
  name: date,
  exercises,
});
const ex = (exerciseName, sets) => ({ exerciseName, sets });
const set = (weight, reps) => ({ set: 1, weight, reps });

const seed = () => {
  mockApp.exercises = [{ name: "Squat", mainMuscle: "Quads" }];
  mockApp.workouts = [
    workout(daysAgo(20), [ex("Squat", [set(100, 5)])]),
    workout(daysAgo(5), [ex("Squat", [set(110, 5)])]), // weight + e1RM PR
  ];
};

describe("StrengthAnalysis", () => {
  it("shows an empty state when there is no logged data", () => {
    mockApp.workouts = [];
    mockApp.exercises = [];
    render(<StrengthAnalysis />);
    expect(screen.getByText(/no strength data yet/i)).toBeInTheDocument();
  });

  it("renders KPIs, the PR feed, and a progression chart", () => {
    seed();
    const { container } = render(<StrengthAnalysis />);
    expect(screen.getAllByText("Volume").length).toBeGreaterThan(0);
    expect(screen.getByText("Workouts")).toBeInTheDocument();
    expect(screen.getByText("New PRs")).toBeInTheDocument();
    expect(screen.getByText("Recent PRs")).toBeInTheDocument();
    // The PR feed lists the squat that beat the prior best.
    expect(screen.getAllByText("Squat").length).toBeGreaterThan(0);
    // A chart line is drawn (muscle trend and/or per-exercise curve).
    expect(container.querySelectorAll(".recharts-line").length).toBeGreaterThan(
      0,
    );
  });

  it("switches the per-exercise chart metric without crashing", async () => {
    seed();
    const user = userEvent.setup();
    const { container } = render(<StrengthAnalysis />);
    await user.click(screen.getByRole("button", { name: "Volume" }));
    expect(container.querySelectorAll(".recharts-line").length).toBeGreaterThan(
      0,
    );
  });

  it("switches the time range", async () => {
    seed();
    const user = userEvent.setup();
    render(<StrengthAnalysis />);
    await user.click(screen.getByRole("button", { name: "All" }));
    // Still renders the overview after re-windowing.
    expect(screen.getByText("Recent PRs")).toBeInTheDocument();
  });

  it("keeps the exercise field clearable instead of refilling a default", async () => {
    seed();
    const user = userEvent.setup();
    render(<StrengthAnalysis />);
    const input = screen.getByPlaceholderText("Pick an exercise");
    // Seeded with the most-recent lift, but the user can empty it...
    expect(input).toHaveValue("Squat");
    await user.clear(input);
    expect(input).toHaveValue("");
    // ...and type a fresh value without it snapping back.
    await user.type(input, "Bench");
    expect(input).toHaveValue("Bench");
  });
});
