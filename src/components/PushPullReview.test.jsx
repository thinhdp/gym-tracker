import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { K_WO } from "../lib/storage";
import fixture from "../lib/review/pp21/fixture.pp21.json";
import PushPullReview from "./PushPullReview";

const renderReview = () =>
  render(
    <AppProvider>
      <PushPullReview />
    </AppProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(K_WO, JSON.stringify(fixture.workouts));
});

describe("PushPullReview", () => {
  it("opens on the latest rotation with the deload call", () => {
    renderReview();
    expect(screen.getByLabelText("Rotation")).toHaveValue("4");
    expect(
      screen.getByText(/Rotation 4 · 15 Nov–19 Nov · 4\/4 sessions/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Deload: 1 set per exercise/)).toBeInTheDocument();
    expect(screen.getByText("Rest day first")).toBeInTheDocument();
  });

  it("shows each exercise's decision for the selected rotation", async () => {
    const user = userEvent.setup();
    renderReview();
    await user.selectOptions(screen.getByLabelText("Rotation"), "3");
    expect(
      screen.getByText(/Rotation 3 · 9 Nov–13 Nov · 4\/4 sessions/),
    ).toBeInTheDocument();
    const benchRow = screen
      .getAllByText("Bench Press Barbell")
      .map((el) => el.closest("tr"))
      .find((tr) => within(tr).queryByText(/Next:/));
    expect(within(benchRow).getByText("ADD")).toBeInTheDocument();
    expect(within(benchRow).getByText(/47\.5×5/)).toBeInTheDocument();
  });

  it("shows an empty state before any PP21 session", () => {
    localStorage.setItem(
      K_WO,
      JSON.stringify(fixture.workouts.filter((w) => w.date < "2026-10-28")),
    );
    renderReview();
    expect(
      screen.getByText(/No Push·Pull sessions to review yet/),
    ).toBeInTheDocument();
  });
});
