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

  it("shows the PP21 next-session card when no workout is logged today", () => {
    renderHome();
    expect(screen.getByText(/Next session/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start Push A/i }),
    ).toBeInTheDocument();
  });

  it("hides the streak pill at a zero streak", () => {
    renderHome();
    expect(screen.queryByText(/day streak/i)).not.toBeInTheDocument();
  });
});
