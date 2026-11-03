import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadLS, saveLS } from "../lib/storage";
import { K_FOOD_TAB } from "./lib/keys";
import FoodApp from "./FoodApp";

function heading() {
  return screen.getByRole("heading", { level: 1 });
}

describe("FoodApp", () => {
  const originalTitle = document.title;
  afterEach(() => {
    document.title = originalTitle;
  });

  it("defaults to Today and stores that tab when nothing is stored", () => {
    render(<FoodApp />);
    expect(heading()).toHaveTextContent("Today");
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(loadLS(K_FOOD_TAB)).toBe("today");
  });

  it("switches tab on click and persists it", async () => {
    const user = userEvent.setup();
    render(<FoodApp />);
    await user.click(screen.getByRole("button", { name: "Trends" }));
    expect(heading()).toHaveTextContent("Trends");
    expect(loadLS(K_FOOD_TAB)).toBe("trends");
  });

  it("restores a stored tab", () => {
    saveLS(K_FOOD_TAB, "settings");
    render(<FoodApp />);
    expect(heading()).toHaveTextContent("Settings");
  });

  it.each([["bogus"], ["constructor"], [["trends"]]])(
    "falls back to Today and rewrites storage on an invalid stored tab %j",
    (stored) => {
      saveLS(K_FOOD_TAB, stored);
      render(<FoodApp />);
      expect(heading()).toHaveTextContent("Today");
      expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(loadLS(K_FOOD_TAB)).toBe("today");
    },
  );

  it("sets the page title to Food Tracker", () => {
    document.title = "Gym Tracker";
    render(<FoodApp />);
    expect(document.title).toBe("Food Tracker");
  });

  it("links back to the gym app", () => {
    render(<FoodApp />);
    expect(screen.getByRole("link", { name: "Gym" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
