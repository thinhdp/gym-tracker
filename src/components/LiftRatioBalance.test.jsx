import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import LiftRatioBalance from "./LiftRatioBalance";

const fetchStandards = vi.fn();
vi.mock("../lib/fvApi", () => ({
  fetchStandards: (...args) => fetchStandards(...args),
}));

// Median p50 lifts: squat 110, bench 82, deadlift 132 (real-ish male @70kg).
const P50 = { squat: 110, bench: 82, deadlift: 132 };

beforeEach(() => {
  fetchStandards.mockReset();
  fetchStandards.mockImplementation(async (reqs) => {
    const out = {};
    for (const r of reqs) out[r.key] = { p50: P50[r.key] ?? null };
    return out;
  });
});

const props = { bodyweight: 70, sex: "male", age: 30 };

describe("LiftRatioBalance gating", () => {
  it("asks for a squat when none is logged", () => {
    render(<LiftRatioBalance {...props} e1rmBySlug={{ bench_press: 80 }} />);
    expect(screen.getByText(/back squat/i)).toBeInTheDocument();
    expect(fetchStandards).not.toHaveBeenCalled();
  });

  it("asks for a second lift when only the squat is logged", () => {
    render(<LiftRatioBalance {...props} e1rmBySlug={{ back_squat: 110 }} />);
    expect(screen.getByText(/at least one more big lift/i)).toBeInTheDocument();
    expect(fetchStandards).not.toHaveBeenCalled();
  });
});

describe("LiftRatioBalance scoring", () => {
  it("scores a median-proportioned lifter at 100 and labels lifts balanced", async () => {
    render(
      <LiftRatioBalance
        {...props}
        e1rmBySlug={{ back_squat: 110, bench_press: 82, deadlift: 132 }}
      />,
    );
    expect(await screen.findByText("100")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    // Both non-base lifts read as balanced; squat is the reference, not a row.
    expect(screen.getAllByText("Balanced").length).toBe(2);
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Deadlift")).toBeInTheDocument();
    expect(screen.queryByText("Squat")).not.toBeInTheDocument();
  });

  it("flags a lagging lift and queries the right standards slugs", async () => {
    render(
      <LiftRatioBalance
        {...props}
        // Bench is well below its median share of the squat -> lagging.
        e1rmBySlug={{ back_squat: 110, bench_press: 50 }}
      />,
    );
    expect(await screen.findByText("Lagging")).toBeInTheDocument();
    const reqs = fetchStandards.mock.calls[0][0];
    expect(reqs.map((r) => r.lift).sort()).toEqual([
      "back_squat",
      "bench_press",
    ]);
    expect(reqs[0]).toMatchObject({ sex: "male", age: 30, source: "gym" });
  });
});
