import React from "react";
import { render, screen } from "@testing-library/react";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { loadLS, saveLS, K_SESSION, K_WO } from "./lib/storage";
import App, { isFoodPath } from "./App";

function renderApp() {
  return render(
    <ConfirmProvider>
      <App />
    </ConfirmProvider>,
  );
}

function seedLiveSession() {
  saveLS(K_WO, [
    {
      id: "w1",
      date: "2026-06-13",
      name: "Push Day",
      exercises: [
        { exerciseName: "Bench", sets: [{ set: 1, weight: 80, reps: 8 }] },
      ],
    },
  ]);
  saveLS(K_SESSION, {
    workoutId: "w1",
    startedAt: Date.now(),
    currentIdx: 0,
  });
}

describe("App path routing", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("renders the food app at /food and the gym app at /", () => {
    window.history.pushState({}, "", "/food");
    const { unmount } = renderApp();
    expect(
      screen.getByRole("navigation", { name: "Food" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
    unmount();

    window.history.pushState({}, "", "/");
    renderApp();
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Food" })).toBeNull();
  });

  it("renders the food app at /food even when a live session is stored", () => {
    const stored = { workoutId: "x", startedAt: 1, currentIdx: 0 };
    saveLS(K_SESSION, stored);
    window.history.pushState({}, "", "/food");
    renderApp();
    expect(
      screen.getByRole("navigation", { name: "Food" }),
    ).toBeInTheDocument();
    // LiveSession ends a session whose workout is missing, so mounting it here
    // would delete the stored session even though the Food nav still appears.
    expect(loadLS(K_SESSION)).toEqual(stored);
  });

  it("renders the food app at /food when a real live session is stored", () => {
    seedLiveSession();
    window.history.pushState({}, "", "/food");
    renderApp();
    expect(
      screen.getByRole("navigation", { name: "Food" }),
    ).toBeInTheDocument();
  });

  it("lets a live session take over the screen at /", () => {
    seedLiveSession();
    window.history.pushState({}, "", "/");
    renderApp();
    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Food" })).toBeNull();
    expect(screen.getAllByText("Bench").length).toBeGreaterThan(0);
  });

  it("isFoodPath matches /food and /food/ but not /foods", () => {
    expect(isFoodPath("/food")).toBe(true);
    expect(isFoodPath("/food/")).toBe(true);
    expect(isFoodPath("/foods")).toBe(false);
  });
});
