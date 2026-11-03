import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FoodBottomNav from "./FoodBottomNav";

describe("FoodBottomNav", () => {
  it("renders the four tabs in order", () => {
    render(<FoodBottomNav active="today" onSelect={() => {}} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Today",
      "Search",
      "Trends",
      "Settings",
    ]);
  });

  it("marks the active tab with aria-current", () => {
    render(<FoodBottomNav active="search" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Today" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("calls onSelect with the tab key when tapped", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<FoodBottomNav active="today" onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: "Trends" }));
    expect(onSelect).toHaveBeenCalledWith("trends");
  });

  it("names the nav Food", () => {
    render(<FoodBottomNav active="today" onSelect={() => {}} />);
    expect(
      screen.getByRole("navigation", { name: "Food" }),
    ).toBeInTheDocument();
  });
});
