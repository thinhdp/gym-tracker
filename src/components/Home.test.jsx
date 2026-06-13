import React from "react";
import { render, screen } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import Home from "./Home";

const renderHome = () =>
  render(
    <AppProvider>
      <Home />
    </AppProvider>,
  );

describe("Home", () => {
  it("greets the user", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }),
    ).toBeInTheDocument();
  });

  it("prompts to plan a workout when none is logged today", () => {
    renderHome();
    expect(
      screen.getByRole("button", { name: /Plan a workout/i }),
    ).toBeInTheDocument();
  });

  it("hides the streak pill at a zero streak", () => {
    renderHome();
    expect(screen.queryByText(/day streak/i)).not.toBeInTheDocument();
  });
});
