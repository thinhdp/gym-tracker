import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DataManagementMenu from "./DataManagementMenu";

vi.mock("../context/AppContext", () => ({
  useApp: () => ({
    exercises: [],
    workouts: [],
    routines: [],
    setExercises: vi.fn(),
    setWorkouts: vi.fn(),
    setRoutines: vi.fn(),
  }),
}));

describe("DataManagementMenu", () => {
  it("opens the menu upward so all options stay above the bottom nav", () => {
    render(<DataManagementMenu />);
    fireEvent.click(screen.getByRole("button", { name: /data/i }));
    const replace = screen.getByRole("button", { name: "Import (replace)" });
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import (merge)" }),
    ).toBeInTheDocument();
    expect(replace.parentElement.className).toContain("bottom-full");
  });
});
