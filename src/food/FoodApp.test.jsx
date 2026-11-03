import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "../components/ConfirmDialog";
import { loadLS, saveLS } from "../lib/storage";
import { K_FOOD_ENTRIES, K_FOOD_TAB } from "./lib/keys";
import { todayLocal } from "./lib/localDate";
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
    expect(screen.getByRole("button", { name: "Trends" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Today" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(loadLS(K_FOOD_TAB)).toBe("trends");
  });

  it("restores a stored tab", () => {
    saveLS(K_FOOD_TAB, "settings");
    render(
      <ConfirmProvider>
        <FoodApp />
      </ConfirmProvider>,
    );
    expect(heading()).toHaveTextContent("Settings");
    expect(screen.getByRole("button", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
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

  it("mounts FoodProvider, which replaces corrupt entries with an empty list", () => {
    saveLS(K_FOOD_ENTRIES, { not: "an array" });
    render(<FoodApp />);
    expect(heading()).toHaveTextContent("Today");
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([]);
  });

  it("links back to the gym app", () => {
    render(<FoodApp />);
    expect(screen.getByRole("link", { name: "Gym" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("renders the search view below the heading on the search tab only", async () => {
    const user = userEvent.setup();
    render(<FoodApp />);
    expect(screen.queryByRole("searchbox")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(heading()).toHaveTextContent("Search");
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("renders the targets editor on the settings tab", () => {
    saveLS(K_FOOD_TAB, "settings");
    render(
      <ConfirmProvider>
        <FoodApp />
      </ConfirmProvider>,
    );
    expect(screen.getByLabelText("Calories")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Gym" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("logs today's date and switches to the today tab after Add", async () => {
    saveLS(K_FOOD_TAB, "search");
    const user = userEvent.setup();
    render(<FoodApp />);

    await user.type(screen.getByRole("searchbox"), "banana");
    await user.click(await screen.findByRole("button", { name: /banana/ }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(heading()).toHaveTextContent("Today");
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(loadLS(K_FOOD_TAB)).toBe("today");
    const entries = loadLS(K_FOOD_ENTRIES);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe(todayLocal());
    expect(entries[0].name).toBe("banana, raw");
  });
});
