import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import StrengthStandards from "./StrengthStandards";
import { saveLS, K_PROFILE, K_WEIGHT_LOGS } from "../lib/storage";

const mockApp = { workouts: [] };
vi.mock("../context/AppContext", () => ({ useApp: () => mockApp }));

vi.mock("recharts", async (importOriginal) => {
  const { withFixedResponsiveContainer } =
    await import("../test/rechartsTestUtils");
  return withFixedResponsiveContainer(await importOriginal());
});

const fetchPercentiles = vi.fn();
vi.mock("../lib/fvApi", () => ({
  fetchPercentiles: (...args) => fetchPercentiles(...args),
  FV_ATTRIBUTION_URL: "https://fitnessvolt.com/strength-standards/",
}));

const today = new Date().toISOString().slice(0, 10);
const workout = (date, exercises) => ({
  id: date,
  date,
  name: date,
  exercises,
});
const ex = (exerciseName, sets) => ({ exerciseName, sets });
const set = (weight, reps) => ({ set: 1, weight, reps });

beforeEach(() => {
  localStorage.clear();
  mockApp.workouts = [];
  fetchPercentiles.mockReset();
  fetchPercentiles.mockImplementation(async (reqs) => {
    const out = {};
    for (const r of reqs) {
      out[r.key] = r.key.startsWith("ver:")
        ? { verified: { percentile: 80, tier: "advanced" }, gym: null }
        : { gym: { percentile: 60, tier: "intermediate" }, verified: null };
    }
    return out;
  });
});

describe("StrengthStandards gating", () => {
  it("prompts for sex when no profile is set", () => {
    render(<StrengthStandards />);
    expect(screen.getByText(/set your/i)).toHaveTextContent(/sex/i);
    expect(fetchPercentiles).not.toHaveBeenCalled();
  });

  it("prompts for bodyweight when sex is set but no weight is logged", () => {
    saveLS(K_PROFILE, { sex: "male" });
    render(<StrengthStandards />);
    expect(screen.getByText(/log your/i)).toHaveTextContent(/bodyweight/i);
  });

  it("prompts to log barbell lifts when there is no mappable data", () => {
    saveLS(K_PROFILE, { sex: "male" });
    saveLS(K_WEIGHT_LOGS, { [today]: 70 });
    mockApp.workouts = [workout(today, [ex("Leg Press", [set(200, 5)])])];
    render(<StrengthStandards />);
    expect(screen.getByText(/no standard barbell lifts/i)).toBeInTheDocument();
  });
});

describe("StrengthStandards radar", () => {
  beforeEach(() => {
    saveLS(K_PROFILE, { sex: "male", birthYear: 1996 });
    saveLS(K_WEIGHT_LOGS, { [today]: 70 });
    mockApp.workouts = [
      workout(today, [
        ex("Squat Barbell", [set(140, 1)]),
        ex("Bench Press Barbell", [set(100, 1)]),
      ]),
    ];
  });

  it("renders the overall level, radar, and per-axis percentiles", async () => {
    const { container } = render(<StrengthStandards />);
    // Overall tier derived from the average gym percentile (60 -> Advanced).
    expect(await screen.findByText("Advanced")).toBeInTheDocument();
    // Per-axis tier badges reflect the API's own tier label.
    expect(screen.getAllByText("Intermediate").length).toBeGreaterThan(0);
    // Radar polygons drawn for the "Now" series.
    expect(
      container.querySelectorAll(".recharts-radar").length,
    ).toBeGreaterThan(0);
    // Axis labels + gym percentile cells.
    expect(screen.getAllByText("Squat").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bench").length).toBeGreaterThan(0);
    expect(screen.getAllByText("60%").length).toBeGreaterThan(0);
    // Verified bonus column populated for squat/bench.
    expect(screen.getAllByText("80%").length).toBeGreaterThan(0);
    expect(screen.getByText(/powered by fitnessvolt/i)).toBeInTheDocument();
  });

  it("queries the API with the lifter's sex and age", async () => {
    render(<StrengthStandards />);
    await screen.findByText("Advanced");
    expect(fetchPercentiles).toHaveBeenCalled();
    const reqs = fetchPercentiles.mock.calls[0][0];
    const squat = reqs.find((r) => r.key === "now:squat");
    expect(squat).toMatchObject({ lift: "back_squat", sex: "male", age: 30 });
  });
});
