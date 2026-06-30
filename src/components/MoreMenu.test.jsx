import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import MoreMenu from "./MoreMenu";

vi.mock("./Notepad", () => ({ default: () => <div>NOTEPAD</div> }));
vi.mock("./DataManagementMenu", () => ({ default: () => <div>DATA</div> }));
vi.mock("./CycleReview", () => ({ default: () => <div>CYCLE_REVIEW</div> }));

const renderMore = () =>
  render(
    <AppProvider>
      <MoreMenu />
    </AppProvider>,
  );

describe("MoreMenu", () => {
  it("renders the settings sections", () => {
    renderMore();
    expect(screen.getByRole("heading", { name: "More" })).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("DATA")).toBeInTheDocument();
  });

  it("does not show the units toggle while it is hidden", () => {
    renderMore();
    expect(screen.queryByText("Units")).not.toBeInTheDocument();
  });

  it("opens the notepad as a sub-screen and returns", async () => {
    const user = userEvent.setup();
    renderMore();
    await user.click(screen.getByRole("button", { name: "Notepad" }));
    expect(screen.getByText("NOTEPAD")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /More/ }));
    expect(screen.getByRole("heading", { name: "More" })).toBeInTheDocument();
  });

  it("opens the cycle review as a sub-screen and returns", async () => {
    const user = userEvent.setup();
    renderMore();
    await user.click(screen.getByRole("button", { name: /Cycle Review/i }));
    expect(screen.getByText("CYCLE_REVIEW")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /More/ }));
    expect(screen.getByRole("heading", { name: "More" })).toBeInTheDocument();
  });
});
