import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { loadLS, saveLS } from "../../lib/storage";
import { FoodProvider } from "../context/FoodContext";
import { K_FOOD_CUSTOM, K_FOOD_ENTRIES } from "../lib/keys";
import SettingsView from "./SettingsView";

const BAR = {
  id: "c1",
  name: "Oat bar",
  per100: { kcal: 400, protein: 10, carb: 60, fat: 12 },
  createdAt: 111,
};
const SOUP = {
  id: "c2",
  name: "Soup",
  per100: { kcal: 50, protein: 2, carb: 6, fat: 1 },
  createdAt: 222,
};
const ENTRY = {
  id: "e1",
  date: "2026-11-03",
  slot: "lunch",
  name: "Oat bar",
  grams: 45,
  per100: BAR.per100,
  food: { kind: "custom", id: "c1" },
  createdAt: 333,
};

function setup() {
  const user = userEvent.setup();
  render(
    <ConfirmProvider>
      <FoodProvider>
        <SettingsView />
      </FoodProvider>
    </ConfirmProvider>,
  );
  return user;
}

const section = () => screen.getByRole("region", { name: "Custom foods" });

describe("SettingsView custom foods", () => {
  it("shows one line and no create button when the list is empty", () => {
    setup();
    expect(
      within(section()).getByText(
        "No custom foods yet. Create one from Search.",
      ),
    ).toBeVisible();
    expect(within(section()).queryAllByRole("button")).toEqual([]);
  });

  it("places the section after Targets and before the Back to Gym link", () => {
    setup();
    const targets = screen.getByRole("region", { name: "Targets" });
    const back = screen.getByRole("link", { name: "Back to Gym" });
    expect(
      targets.compareDocumentPosition(section()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      section().compareDocumentPosition(back) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("lists each food with its kcal per 100 g and named buttons", () => {
    saveLS(K_FOOD_CUSTOM, [BAR, SOUP]);
    setup();
    const rows = within(section()).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Oat bar")).toBeVisible();
    expect(within(rows[0]).getByText("400 kcal / 100 g")).toBeVisible();
    expect(within(rows[1]).getByText("Soup")).toBeVisible();
    expect(within(rows[1]).getByText("50 kcal / 100 g")).toBeVisible();
    expect(
      within(rows[1]).getByRole("button", { name: "Edit Soup" }),
    ).toBeVisible();
    expect(
      within(rows[1]).getByRole("button", { name: "Delete Soup" }),
    ).toBeVisible();
  });

  it("a stored row with no per100 is removed at load and leaves the view working", () => {
    saveLS(K_FOOD_CUSTOM, [{ id: "a", name: "Broken" }, SOUP]);
    setup();
    const rows = within(section()).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(screen.queryByText("Broken")).toBeNull();
    expect(within(rows[0]).getByText("Soup")).toBeVisible();
    expect(within(rows[0]).getByText("50 kcal / 100 g")).toBeVisible();
    expect(screen.getByRole("region", { name: "Targets" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Gym" })).toBeVisible();
  });

  it("shows 0 kcal / 100 g for a custom food with 0 kcal", () => {
    saveLS(K_FOOD_CUSTOM, [{ ...BAR, per100: { ...BAR.per100, kcal: 0 } }]);
    setup();
    expect(within(section()).getByText("0 kcal / 100 g")).toBeVisible();
  });

  it("a stored row with an empty per100 is removed at load and leaves the view working", () => {
    saveLS(K_FOOD_CUSTOM, [{ id: "a", name: "Empty", per100: {} }, SOUP]);
    setup();
    const row = within(section()).getByRole("listitem");
    expect(screen.queryByText("Empty")).toBeNull();
    expect(within(row).getByText("Soup")).toBeVisible();
    expect(within(row).getByText("50 kcal / 100 g")).toBeVisible();
    expect(screen.getByRole("region", { name: "Targets" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Gym" })).toBeVisible();
  });

  it("edit opens the form on that food and updates the row", async () => {
    saveLS(K_FOOD_CUSTOM, [BAR, SOUP]);
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Edit Oat bar" }));

    const dialog = screen.getByRole("dialog", { name: "Edit custom food" });
    const name = within(dialog).getByLabelText("Name");
    expect(name).toHaveValue("Oat bar");
    await user.clear(name);
    await user.type(name, "Big bar");
    const kcal = within(dialog).getByLabelText("Calories");
    await user.clear(kcal);
    await user.type(kcal, "500");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(section()).getByText("Big bar")).toBeVisible();
    expect(within(section()).getByText("500 kcal / 100 g")).toBeVisible();
    expect(loadLS(K_FOOD_CUSTOM)).toEqual([
      {
        ...BAR,
        name: "Big bar",
        per100: { ...BAR.per100, kcal: 500 },
      },
      SOUP,
    ]);
  });

  it("closing the edit form leaves the row unchanged", async () => {
    saveLS(K_FOOD_CUSTOM, [BAR]);
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Edit Oat bar" }));
    const dialog = screen.getByRole("dialog", { name: "Edit custom food" });
    await user.type(within(dialog).getByLabelText("Name"), "x");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(loadLS(K_FOOD_CUSTOM)).toEqual([BAR]);
  });

  it("deletes only after confirm, and logged entries stay", async () => {
    saveLS(K_FOOD_CUSTOM, [BAR, SOUP]);
    saveLS(K_FOOD_ENTRIES, [ENTRY]);
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Delete Oat bar" }));

    expect(loadLS(K_FOOD_CUSTOM)).toEqual([BAR, SOUP]);
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Soup")).toBeVisible();
    expect(screen.queryByText("Oat bar")).toBeNull();
    expect(loadLS(K_FOOD_CUSTOM)).toEqual([SOUP]);
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([ENTRY]);
  });

  it("the delete confirm is destructive and names the food", async () => {
    saveLS(K_FOOD_CUSTOM, [BAR]);
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Delete Oat bar" }));

    expect(screen.getByText(/^Oat bar will be removed\./)).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "bg-red-600",
    );
  });

  it("cancelling the confirm keeps the row", async () => {
    saveLS(K_FOOD_CUSTOM, [BAR]);
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Delete Oat bar" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(within(section()).getByText("Oat bar")).toBeVisible();
    expect(loadLS(K_FOOD_CUSTOM)).toEqual([BAR]);
  });
});
