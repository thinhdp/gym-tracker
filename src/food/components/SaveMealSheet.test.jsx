import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadLS, saveLS } from "../../lib/storage";
import { FoodProvider } from "../context/FoodContext";
import { K_FOOD_ENTRIES, K_FOOD_MEALS } from "../lib/keys";
import { formatDayHeader } from "../lib/localDate";
import SaveMealSheet from "./SaveMealSheet";

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

const MEAL = {
  id: "m1",
  name: "Rice bowl",
  items: [
    {
      name: "rice",
      grams: 200,
      per100: PER100,
      food: { kind: "db", id: "food-rice" },
    },
  ],
  createdAt: 500,
};

function setup(props = {}) {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <FoodProvider>
      <SaveMealSheet date={DATE} slot="lunch" onClose={onClose} {...props} />
    </FoodProvider>,
  );
  return { onClose, user };
}

const nameInput = () => screen.getByLabelText("Save as meal");
const saveButton = () => screen.getByRole("button", { name: "Save" });

describe("SaveMealSheet", () => {
  it("states the slot and the day in its header", () => {
    setup({ slot: "snack2" });
    const dialog = screen.getByRole("dialog", { name: "Save meal" });
    expect(
      within(dialog).getByText(`Afternoon snack · ${formatDayHeader(DATE)}`),
    ).toBeVisible();
  });

  it("creates a meal from the slot's entries", async () => {
    saveLS(K_FOOD_ENTRIES, [
      entry("rice", { portionLabel: "1 bowl", grams: 200 }),
      entry("egg", { grams: 50 }),
      entry("other-slot", { slot: "dinner" }),
      entry("other-day", { date: "2026-11-02" }),
    ]);
    const { user, onClose } = setup();
    await user.type(nameInput(), "  Usual lunch  ");
    await user.click(saveButton());

    const stored = loadLS(K_FOOD_MEALS);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Usual lunch");
    expect(stored[0].items).toEqual([
      {
        name: "rice",
        grams: 200,
        per100: PER100,
        food: { kind: "db", id: "food-rice" },
        portionLabel: "1 bowl",
      },
      {
        name: "egg",
        grams: 50,
        per100: PER100,
        food: { kind: "db", id: "food-egg" },
      },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(loadLS(K_FOOD_ENTRIES)).toHaveLength(4);
  });

  it("a blank or whitespace name blocks Save", async () => {
    saveLS(K_FOOD_ENTRIES, [entry("rice")]);
    const { user, onClose } = setup();
    expect(saveButton()).toBeDisabled();
    await user.type(nameInput(), "   ");
    expect(saveButton()).toBeDisabled();
    await user.click(saveButton());

    expect(loadLS(K_FOOD_MEALS)).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a duplicate name inserts a new meal and leaves the old one", async () => {
    saveLS(K_FOOD_MEALS, [MEAL]);
    saveLS(K_FOOD_ENTRIES, [entry("soup")]);
    const { user } = setup();
    await user.type(nameInput(), MEAL.name);
    await user.click(saveButton());

    const stored = loadLS(K_FOOD_MEALS);
    expect(stored).toHaveLength(2);
    expect(stored[0]).toEqual(MEAL);
    expect(stored[1].name).toBe(MEAL.name);
    expect(stored[1].id).not.toBe(MEAL.id);
    expect(stored[1].items.map((row) => row.name)).toEqual(["soup"]);
  });

  it("Close calls onClose and writes nothing", async () => {
    saveLS(K_FOOD_MEALS, [MEAL]);
    saveLS(K_FOOD_ENTRIES, [entry("rice")]);
    const { user, onClose } = setup();
    await user.type(nameInput(), "Unsaved");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(loadLS(K_FOOD_MEALS)).toEqual([MEAL]);
    expect(loadLS(K_FOOD_ENTRIES)).toHaveLength(1);
  });
});
