import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { ConfirmProvider } from "./ConfirmDialog";
import { saveLS, K_EX } from "../lib/storage";
import ExerciseManager from "./ExerciseManager";

function seedAndRender() {
  saveLS(K_EX, [
    { name: "Bench Press", mainMuscle: "Chest" },
    { name: "Back Squat", mainMuscle: "Legs" },
  ]);
  return render(
    <ConfirmProvider>
      <AppProvider>
        <ExerciseManager />
      </AppProvider>
    </ConfirmProvider>,
  );
}

describe("ExerciseManager", () => {
  it("shows the header with a count and lists exercises", () => {
    seedAndRender();
    expect(
      screen.getByRole("heading", { name: /Exercises/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Back Squat")).toBeInTheDocument();
  });

  it("filters by muscle-group chip", async () => {
    const user = userEvent.setup();
    seedAndRender();
    await user.click(screen.getByRole("button", { name: "Legs" }));
    expect(screen.getByText("Back Squat")).toBeInTheDocument();
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument();
  });

  it("filters by search query", async () => {
    const user = userEvent.setup();
    seedAndRender();
    await user.type(screen.getByPlaceholderText(/Search/), "bench");
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.queryByText("Back Squat")).not.toBeInTheDocument();
  });

  it("toggles the create form via the New button", async () => {
    const user = userEvent.setup();
    seedAndRender();
    const newBtn = screen.getByRole("button", { name: "New exercise" });
    expect(newBtn).toHaveTextContent("+");
    await user.click(newBtn);
    expect(newBtn).toHaveTextContent("×");
  });
});
