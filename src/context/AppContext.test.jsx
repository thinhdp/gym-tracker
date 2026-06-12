import React from "react";
import { render, screen, act } from "@testing-library/react";
import { AppProvider, useApp } from "./AppContext";
import { saveLS, loadLS, K_WO, K_UNIT } from "../lib/storage";

/** Exposes context state for assertions and a setter capture for actions. */
let captured;
function Probe() {
  // Test-only escape hatch to read the context value from assertions.
  // eslint-disable-next-line react-hooks/globals
  captured = useApp();
  return (
    <div>
      <span data-testid="unit">{captured.unit}</span>
      <span data-testid="workout-count">{captured.workouts.length}</span>
    </div>
  );
}

const benchWorkout = (date, weight) => ({
  id: `w-${date}`,
  date,
  name: date,
  exercises: [
    { exerciseName: "Bench Press", sets: [{ set: 1, weight, reps: 5 }] },
  ],
});

describe("AppProvider persistence", () => {
  it("initializes from pre-seeded localStorage", () => {
    saveLS(K_UNIT, "lb");
    saveLS(K_WO, [benchWorkout("2026-06-01", 100)]);

    render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );

    expect(screen.getByTestId("unit")).toHaveTextContent("lb");
    expect(screen.getByTestId("workout-count")).toHaveTextContent("1");
  });

  it("writes state changes back to localStorage", () => {
    render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );

    act(() => {
      captured.setWorkouts([benchWorkout("2026-06-02", 80)]);
    });

    expect(loadLS(K_WO, [])).toHaveLength(1);
    expect(loadLS(K_WO, [])[0].date).toBe("2026-06-02");
  });

  it("derives each exercise's lastWorkout from the latest workout", () => {
    render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );

    act(() => {
      captured.setExercises([
        { name: "Bench Press", lastWorkout: null },
        { name: "Squat", lastWorkout: null },
      ]);
    });
    act(() => {
      captured.setWorkouts([
        benchWorkout("2026-06-01", 100),
        benchWorkout("2026-06-08", 105),
      ]);
    });

    const bench = captured.exercises.find((e) => e.name === "Bench Press");
    expect(bench.lastWorkout).toEqual({
      date: "2026-06-08",
      sets: [{ set: 1, weight: 105, reps: 5 }],
    });

    // Never-performed exercises keep lastWorkout: null.
    const squat = captured.exercises.find((e) => e.name === "Squat");
    expect(squat.lastWorkout).toBeNull();
  });
});
