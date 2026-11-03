import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadLS, saveLS } from "../../lib/storage";
import { FoodProvider } from "../context/FoodContext";
import { K_FOOD_ENTRIES, K_FOOD_MEALS } from "../lib/keys";
import { formatDayHeader } from "../lib/localDate";
import SavedMealsPanel from "./SavedMealsPanel";

const DATE = "2026-11-03";
const PER100 = { kcal: 100, protein: 10, carb: 20, fat: 5 };

const entry = (id, overrides = {}) => ({
  id,
  date: DATE,
  slot: "lunch",
  name: id,
  grams: 100,
  per100: PER100,
  food: { kind: "db", id: `food-${id}` },
  createdAt: 1000,
  ...overrides,
});

const item = (name, grams, extra = {}) => ({
  name,
  grams,
  per100: PER100,
  food: { kind: "db", id: `food-${name}` },
  ...extra,
});

const MEAL = {
  id: "m1",
  name: "Rice bowl",
  items: [item("rice", 200, { portionLabel: "1 bowl" }), item("egg", 50)],
  createdAt: 500,
};
const ONE_ITEM = {
  id: "m2",
  name: "Toast",
  items: [item("toast", 30)],
  createdAt: 600,
};

function setup(props = {}) {
  const onLogged = vi.fn();
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <FoodProvider>
      <SavedMealsPanel
        date={DATE}
        slot="lunch"
        onLogged={onLogged}
        onClose={onClose}
        {...props}
      />
    </FoodProvider>,
  );
  return { onLogged, onClose, user };
}

describe("SavedMealsPanel", () => {
  it("states the slot and the day in its header", () => {
    setup({ slot: "snack2" });
    const dialog = screen.getByRole("dialog", { name: "Saved meals" });
    expect(
      within(dialog).getByText(`Afternoon snack · ${formatDayHeader(DATE)}`),
    ).toBeVisible();
  });

  it("lists each meal with its item count and total kcal", () => {
    saveLS(K_FOOD_MEALS, [MEAL, ONE_ITEM]);
    setup();
    const meal = screen.getByRole("button", { name: /Rice bowl/ });
    expect(within(meal).getByText("2 items · 250 kcal")).toBeVisible();
    const single = screen.getByRole("button", { name: /Toast/ });
    expect(within(single).getByText("1 item · 30 kcal")).toBeVisible();
  });

  it("logging a meal copies its items into the chosen date and slot with fresh ids", async () => {
    saveLS(K_FOOD_MEALS, [MEAL]);
    saveLS(K_FOOD_ENTRIES, [entry("old", { date: "2026-11-01" })]);
    const { user, onLogged, onClose } = setup({ slot: "dinner" });
    await user.click(screen.getByRole("button", { name: /Rice bowl/ }));

    const stored = loadLS(K_FOOD_ENTRIES);
    expect(stored).toHaveLength(3);
    const [, rice, egg] = stored;
    expect(rice).toMatchObject({
      ...MEAL.items[0],
      date: DATE,
      slot: "dinner",
    });
    expect(egg).toMatchObject({ ...MEAL.items[1], date: DATE, slot: "dinner" });
    expect(new Set(stored.map((row) => row.id)).size).toBe(3);
    expect(rice).not.toHaveProperty("kcal");

    expect(loadLS(K_FOOD_MEALS)).toEqual([MEAL]);
    expect(onLogged).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("logging the same meal twice gives each copy its own ids", async () => {
    saveLS(K_FOOD_MEALS, [ONE_ITEM]);
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Toast/ }));
    await user.click(screen.getByRole("button", { name: /Toast/ }));

    const ids = loadLS(K_FOOD_ENTRIES).map((row) => row.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("an empty meal list shows one line and no Save as meal field", () => {
    saveLS(K_FOOD_ENTRIES, [entry("rice")]);
    setup();
    expect(screen.getByText("No saved meals yet")).toBeVisible();
    expect(screen.queryByLabelText("Save as meal")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("Close calls onClose and writes nothing", async () => {
    saveLS(K_FOOD_MEALS, [MEAL]);
    saveLS(K_FOOD_ENTRIES, [entry("rice")]);
    const { user, onLogged, onClose } = setup();
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onLogged).not.toHaveBeenCalled();
    expect(loadLS(K_FOOD_MEALS)).toEqual([MEAL]);
    expect(loadLS(K_FOOD_ENTRIES)).toHaveLength(1);
  });
});
