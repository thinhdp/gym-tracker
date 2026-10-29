import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, useApp } from "../context/AppContext";
import { saveLS, K_WO, K_UNIT } from "../lib/storage";
import fixture from "../lib/review/pp21/fixture.pp21.json";
import NextSessionCard from "./NextSessionCard";

// Exposes the live session + workouts so tests can assert what Start created.
function Probe() {
  const { session, workouts } = useApp();
  const w = workouts.find((x) => x.id === session?.workoutId);
  return <pre data-testid="probe">{JSON.stringify(w ?? null)}</pre>;
}

const renderCard = (today) =>
  render(
    <AppProvider>
      <NextSessionCard today={today} />
      <Probe />
    </AppProvider>,
  );

const started = () => JSON.parse(screen.getByTestId("probe").textContent);

// A pre-program bench session the start weights are estimated from:
// 50×6 -> 45 kg top set, 40 kg back-off (see engine start prescription).
const seedBench = () =>
  saveLS(K_WO, [
    {
      id: "old",
      date: "2026-10-20",
      name: "Old program",
      exercises: [
        {
          exerciseName: "Bench Press Barbell",
          sets: [{ set: 1, weight: 50, reps: 6 }],
        },
      ],
    },
  ]);

describe("NextSessionCard", () => {
  it("asks a new user to pick weights for Push A", () => {
    renderCard("2026-10-29");
    expect(screen.getByText("Push A")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    const bench = screen.getByText("Bench Press Barbell").closest("li");
    expect(
      within(bench).getByText("Pick a weight: 5 / 7 reps @ RPE 8–9"),
    ).toBeInTheDocument();
    expect(within(bench).getByText("START")).toBeInTheDocument();
    expect(screen.queryByText(/Rest day today/)).not.toBeInTheDocument();
  });

  it("shows weights estimated from recent history", () => {
    seedBench();
    renderCard("2026-10-29");
    const bench = screen.getByText("Bench Press Barbell").closest("li");
    expect(within(bench).getByText("45×5 · 40×7 kg")).toBeInTheDocument();
    expect(
      within(bench).getByText(/Estimated from your best recent set/),
    ).toBeInTheDocument();
  });

  it("Start opens a live session prefilled with the prescription", async () => {
    seedBench();
    renderCard("2026-10-29");
    await userEvent.click(screen.getByRole("button", { name: "Start Push A" }));
    const w = started();
    expect(w.name).toBe("Push A");
    expect(w.date).toBe("2026-10-29");
    expect(w.exercises[0].exerciseName).toBe("Bench Press Barbell");
    expect(w.exercises[0].sets).toEqual([
      { set: 1, weight: 45, reps: 0, targetReps: 5 },
      { set: 2, weight: 40, reps: 0, targetReps: 7 },
    ]);
    // no history: the weight is left at 0 for the lifter to fill in
    expect(w.exercises[1].sets[0].weight).toBe(0);
  });

  it("shows a rest-day banner but still allows starting", async () => {
    // fixture ends with Pull B on 19 Nov: the 20th is a rest day
    saveLS(K_WO, fixture.workouts);
    renderCard("2026-11-20");
    expect(screen.getByText(/Rest day today/)).toBeInTheDocument();
    expect(screen.getAllByText("Sat 21 Nov").length).toBeGreaterThan(0);
    await userEvent.click(
      screen.getByRole("button", { name: "Start Push A anyway" }),
    );
    // logged today, not on the planned date
    expect(started().date).toBe("2026-11-20");
  });

  it("displays weights in the chosen unit", () => {
    saveLS(K_UNIT, "lb");
    seedBench();
    renderCard("2026-10-29");
    const bench = screen.getByText("Bench Press Barbell").closest("li");
    expect(within(bench).getByText("99.2×5 · 88.2×7 lb")).toBeInTheDocument();
  });

  it("can start an empty workout instead", async () => {
    renderCard("2026-10-29");
    await userEvent.click(
      screen.getByRole("button", { name: "Empty workout" }),
    );
    expect(started().exercises).toEqual([]);
  });
});
