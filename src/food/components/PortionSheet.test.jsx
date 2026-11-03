import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatDayHeader } from "../lib/localDate";
import PortionSheet from "./PortionSheet";

const CHICKEN = {
  id: "food-1",
  name: "chicken, breast, roasted",
  prepState: "roasted",
  source: "usda_fdc",
  isVerified: true,
  barcode: null,
  per100: { kcal: 165, protein: 31, carb: 0, fat: 3.6, extra: 99 },
  portions: [
    { label: "1 oz", grams: 28.35, isDefault: false },
    { label: "1 breast", grams: 172, isDefault: true },
  ],
};

function setup(props = {}) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  render(
    <PortionSheet
      food={CHICKEN}
      date="2026-11-03"
      defaultSlot="lunch"
      onAdd={onAdd}
      onClose={onClose}
      {...props}
    />,
  );
  return { onAdd, onClose, user: userEvent.setup() };
}

const grams = () => screen.getByRole("spinbutton", { name: "Grams" });
const chip = (name) => screen.getByRole("button", { name });
const addButton = () => screen.getByRole("button", { name: "Add" });

describe("PortionSheet", () => {
  it("selects the default portion and sets grams from a chip", async () => {
    const { user } = setup();
    expect(chip("1 breast")).toHaveAttribute("aria-pressed", "true");
    expect(chip("1 oz")).toHaveAttribute("aria-pressed", "false");
    expect(grams()).toHaveValue(172);

    await user.click(chip("1 oz"));
    expect(grams()).toHaveValue(28.35);
    expect(chip("1 oz")).toHaveAttribute("aria-pressed", "true");
    expect(chip("1 breast")).toHaveAttribute("aria-pressed", "false");
  });

  it("selects the first portion when none is marked default", () => {
    setup({
      food: {
        ...CHICKEN,
        portions: [
          { label: "1 serving", grams: 45 },
          { label: "1 box", grams: 300 },
        ],
      },
    });
    expect(chip("1 serving")).toHaveAttribute("aria-pressed", "true");
    expect(grams()).toHaveValue(45);
  });

  it.each([
    ["an empty list", []],
    ["a missing list", undefined],
  ])(
    "shows an empty grams field and disables Add with %s of portions",
    (_label, portions) => {
      setup({ food: { ...CHICKEN, portions } });
      expect(grams()).toHaveValue(null);
      expect(addButton()).toBeDisabled();
      expect(chip("Close")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "1 breast" })).toBeNull();
    },
  );

  it("starts from defaultGrams and selects no chip when none equals it", () => {
    setup({ defaultGrams: 100 });
    expect(grams()).toHaveValue(100);
    expect(chip("1 breast")).toHaveAttribute("aria-pressed", "false");
    expect(chip("1 oz")).toHaveAttribute("aria-pressed", "false");
  });

  it("starts from defaultGrams and selects the chip that equals it", () => {
    setup({ defaultGrams: 28.35 });
    expect(grams()).toHaveValue(28.35);
    expect(chip("1 oz")).toHaveAttribute("aria-pressed", "true");
    expect(chip("1 breast")).toHaveAttribute("aria-pressed", "false");
  });

  it("updates the computed kcal when grams change and disables Add for 0", async () => {
    const { user } = setup();
    expect(screen.getByText(/284 kcal/)).toBeInTheDocument();
    expect(addButton()).toBeEnabled();

    await user.clear(grams());
    await user.type(grams(), "200");
    expect(screen.getByText(/330 kcal/)).toBeInTheDocument();
    expect(addButton()).toBeEnabled();

    await user.clear(grams());
    await user.type(grams(), "0");
    expect(screen.getByText(/0 kcal/)).toBeInTheDocument();
    expect(addButton()).toBeDisabled();
  });

  it("disables Add and outlines the field for empty or negative grams", async () => {
    const { user } = setup();
    expect(grams()).toHaveAttribute("aria-invalid", "false");
    expect(grams().parentElement).not.toHaveClass("ring-2");

    await user.clear(grams());
    expect(addButton()).toBeDisabled();
    expect(grams()).toHaveAttribute("aria-invalid", "true");
    expect(grams().parentElement).toHaveClass("ring-2");

    await user.type(grams(), "-5");
    expect(addButton()).toBeDisabled();
    expect(grams()).toHaveAttribute("aria-invalid", "true");
    expect(grams().parentElement).toHaveClass("ring-2");
  });

  it("clears the chip and its label when typed grams differ from it", async () => {
    const { user, onAdd } = setup();
    await user.clear(grams());
    await user.type(grams(), "150");
    expect(chip("1 breast")).toHaveAttribute("aria-pressed", "false");

    await user.click(addButton());
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].grams).toBe(150);
    expect(onAdd.mock.calls[0][0].portionLabel).toBeUndefined();
  });

  it("keeps the chip when the grams are edited to the same value", async () => {
    const { user, onAdd } = setup({
      food: {
        ...CHICKEN,
        portions: [{ label: "1 slice", grams: 30, isDefault: true }],
      },
    });
    await user.type(grams(), ".0");
    expect(chip("1 slice")).toHaveAttribute("aria-pressed", "true");
    await user.click(addButton());
    expect(onAdd.mock.calls[0][0].portionLabel).toBe("1 slice");
  });

  it("adds the planned payload for an API food, without a date", async () => {
    const { user, onAdd } = setup();
    await user.click(chip("1 oz"));
    await user.click(chip("Dinner"));
    await user.click(addButton());

    expect(onAdd).toHaveBeenCalledTimes(1);
    const payload = onAdd.mock.calls[0][0];
    expect(payload).toStrictEqual({
      name: "chicken, breast, roasted",
      grams: 28.35,
      per100: { kcal: 165, protein: 31, carb: 0, fat: 3.6 },
      food: { kind: "db", id: "food-1" },
      portionLabel: "1 oz",
      slot: "dinner",
    });
    expect(payload.per100).not.toBe(CHICKEN.per100);
  });

  it("carries the food's barcode when it has one", async () => {
    const { user, onAdd } = setup({
      food: { ...CHICKEN, barcode: "8934563138165" },
    });
    await user.click(addButton());
    expect(onAdd.mock.calls[0][0].food).toStrictEqual({
      kind: "db",
      id: "food-1",
      barcode: "8934563138165",
    });
  });

  it("uses kind custom for a custom food", async () => {
    const { user, onAdd } = setup({
      food: {
        id: "custom-1",
        name: "Protein bar",
        source: "custom",
        per100: { kcal: 400, protein: 30, carb: 40, fat: 10 },
        portions: [{ label: "1 bar", grams: 45 }],
      },
    });
    await user.click(addButton());
    expect(onAdd.mock.calls[0][0].food).toStrictEqual({
      kind: "custom",
      id: "custom-1",
    });
    expect(onAdd.mock.calls[0][0].portionLabel).toBe("1 bar");
  });

  it("offers the six slots with the default one selected", () => {
    setup();
    for (const label of [
      "Breakfast",
      "Morning snack",
      "Lunch",
      "Afternoon snack",
      "Dinner",
      "Evening snack",
    ]) {
      expect(chip(label)).toBeInTheDocument();
    }
    expect(chip("Lunch")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the day being logged", () => {
    setup();
    expect(screen.getByText(formatDayHeader("2026-11-03"))).toBeInTheDocument();
  });

  it("calls onClose from the close button", async () => {
    const { user, onClose } = setup();
    await user.click(chip("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
