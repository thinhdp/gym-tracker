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

  it("offers to start or plan a workout when none is logged today", () => {
    renderHome();
    expect(
      screen.getByRole("button", { name: /Start workout/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Plan ahead/i }),
    ).toBeInTheDocument();
  });

  it("hides the streak pill at a zero streak", () => {
    renderHome();
    expect(screen.queryByText(/day streak/i)).not.toBeInTheDocument();
  });
});
