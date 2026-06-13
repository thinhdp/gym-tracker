import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import MoreMenu from "./MoreMenu";

vi.mock("./Notepad", () => ({ default: () => <div>NOTEPAD</div> }));
vi.mock("./DataManagementMenu", () => ({ default: () => <div>DATA</div> }));

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
    expect(screen.getByText("Units")).toBeInTheDocument();
    expect(screen.getByText("DATA")).toBeInTheDocument();
  });

  it("opens the notepad as a sub-screen and returns", async () => {
    const user = userEvent.setup();
    renderMore();
    await user.click(screen.getByRole("button", { name: "Notepad" }));
    expect(screen.getByText("NOTEPAD")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /More/ }));
    expect(screen.getByRole("heading", { name: "More" })).toBeInTheDocument();
  });
});
