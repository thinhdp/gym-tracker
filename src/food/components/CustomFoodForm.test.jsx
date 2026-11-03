import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadLS, saveLS } from "../../lib/storage";
import { FoodProvider } from "../context/FoodContext";
import { K_FOOD_CUSTOM } from "../lib/keys";
import { normalizeCustomFood } from "../lib/normalize";
import CustomFoodForm from "./CustomFoodForm";

const SAVED = {
  id: "c1",
  name: "Oat bar",
  barcode: "12345",
  per100: { kcal: 400, protein: 10, carb: 60, fat: 12 },
  portions: [{ label: "1 bar", grams: 45 }],
  createdAt: 111,
};

function setup(initial) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  if (initial) saveLS(K_FOOD_CUSTOM, [initial]);
  render(
    <FoodProvider>
      <CustomFoodForm initial={initial} onSaved={onSaved} onClose={onClose} />
    </FoodProvider>,
  );
  return { user: userEvent.setup(), onSaved, onClose };
}

const saveButton = () => screen.getByRole("button", { name: "Save" });

async function fill(user, label, value) {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  if (value !== "") await user.type(field, value);
}

async function fillValid(user) {
  await fill(user, "Name", "Bar");
  await fill(user, "Protein (g)", "10");
  await fill(user, "Carbs (g)", "10");
  await fill(user, "Fat (g)", "10");
}

describe("CustomFoodForm", () => {
  it("renders a modal dialog that closes without writing", async () => {
    const { user, onClose, onSaved } = setup();
    expect(
      screen.getByRole("dialog", { name: "Create custom food" }),
    ).toHaveAttribute("aria-modal", "true");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(loadLS(K_FOOD_CUSTOM)).toEqual([]);
  });

  it("does not show the macros-too-large message on a new empty form", () => {
    setup();
    expect(screen.queryByText(/Macros are too large/)).toBeNull();
  });

  describe("saving", () => {
    it("computes kcal from macros when left blank and saves to mgym.food.customFoods.v1", async () => {
      const { user, onSaved } = setup();
      await fillValid(user);
      await user.click(saveButton());

      const [row] = loadLS(K_FOOD_CUSTOM);
      expect(row.per100).toEqual({ kcal: 170, protein: 10, carb: 10, fat: 10 });
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onSaved).toHaveBeenCalledWith(row);
    });

    it("stores given calories as typed, including 0", async () => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, "Calories", "0");
      await user.click(saveButton());
      expect(loadLS(K_FOOD_CUSTOM)[0].per100.kcal).toBe(0);
    });

    it("accepts 0 for a macro", async () => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, "Fat (g)", "0");
      await user.click(saveButton());
      expect(loadLS(K_FOOD_CUSTOM)[0].per100.fat).toBe(0);
    });

    it("saves a minimal row with no barcode or portions key, that a restore keeps", async () => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, "Name", "  Bar  ");
      await user.click(saveButton());

      const [row] = loadLS(K_FOOD_CUSTOM);
      expect(row.name).toBe("Bar");
      expect(row).not.toHaveProperty("barcode");
      expect(row).not.toHaveProperty("portions");
      expect(normalizeCustomFood(row)).toEqual(row);
    });

    it("saves a trimmed barcode and one portion, in a row that a restore keeps", async () => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, "Barcode", " 0123 ");
      await fill(user, "Portion label", " 1 bar ");
      await fill(user, "Portion grams", "45");
      await user.click(saveButton());

      const [row] = loadLS(K_FOOD_CUSTOM);
      expect(row.barcode).toBe("0123");
      expect(row.portions).toStrictEqual([{ label: "1 bar", grams: 45 }]);
      expect(normalizeCustomFood(row)).toEqual(row);
    });

    it("saves no barcode key for a whitespace-only barcode", async () => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, "Barcode", "   ");
      await user.click(saveButton());
      expect(loadLS(K_FOOD_CUSTOM)[0]).not.toHaveProperty("barcode");
    });

    it("saves no portions key for a whitespace-only label with blank grams", async () => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, "Portion label", "   ");
      await user.click(saveButton());
      expect(loadLS(K_FOOD_CUSTOM)[0]).not.toHaveProperty("portions");
    });

    it("saves macros too large to compute from when calories are given, in a row that a restore keeps", async () => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, "Protein (g)", "1e308");
      await fill(user, "Calories", "100");
      await user.click(saveButton());

      const [row] = loadLS(K_FOOD_CUSTOM);
      expect(row.per100.kcal).toBe(100);
      expect(normalizeCustomFood(row)).toEqual(row);
    });
  });

  describe("validation", () => {
    it("starts with messages showing and Save disabled", () => {
      setup();
      expect(screen.getByText("Name is required")).toBeVisible();
      expect(saveButton()).toBeDisabled();
    });

    it("requires a name and non-negative macros", async () => {
      const { user } = setup();
      await fillValid(user);
      expect(saveButton()).toBeEnabled();

      await fill(user, "Name", "   ");
      expect(screen.getByText("Name is required")).toBeVisible();
      expect(saveButton()).toBeDisabled();
      await fill(user, "Name", "Bar");

      await fill(user, "Carbs (g)", "-1");
      expect(
        screen.getByText("Carbs is required and must be 0 or more"),
      ).toBeVisible();
      expect(saveButton()).toBeDisabled();
    });

    it.each([
      ["Protein (g)", "Protein"],
      ["Carbs (g)", "Carbs"],
      ["Fat (g)", "Fat"],
    ])("a blank %s blocks Save instead of becoming 0", async (label, name) => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, label, "");
      expect(
        screen.getByText(`${name} is required and must be 0 or more`),
      ).toBeVisible();
      expect(saveButton()).toBeDisabled();
    });

    it("blocks negative calories", async () => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, "Calories", "-5");
      expect(screen.getByText("Calories must be 0 or more")).toBeVisible();
      expect(saveButton()).toBeDisabled();
    });

    it("blocks blank calories when the macros compute to Infinity", async () => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, "Protein (g)", "1e308");
      expect(
        screen.getByText("Macros are too large to compute calories"),
      ).toBeVisible();
      expect(saveButton()).toBeDisabled();
    });

    it.each(["12a", "a12", "1a2"])("blocks the barcode %s", async (barcode) => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, "Barcode", barcode);
      expect(screen.getByText("Barcode must be digits only")).toBeVisible();
      expect(saveButton()).toBeDisabled();
    });

    it("blocks a half-filled portion, either way round", async () => {
      const { user } = setup();
      await fillValid(user);

      await fill(user, "Portion label", "1 bar");
      expect(
        screen.getByText("Portion needs both a label and grams"),
      ).toBeVisible();
      expect(saveButton()).toBeDisabled();

      await fill(user, "Portion label", "   ");
      await fill(user, "Portion grams", "45");
      expect(
        screen.getByText("Portion needs both a label and grams"),
      ).toBeVisible();
      expect(saveButton()).toBeDisabled();

      await fill(user, "Portion label", "1 bar");
      expect(saveButton()).toBeEnabled();
    });

    it("blocks portion grams of 0 and outlines the field", async () => {
      const { user } = setup();
      await fillValid(user);
      await fill(user, "Portion label", "1 bar");
      await fill(user, "Portion grams", "0");
      expect(screen.getByText("Portion grams must be above 0")).toBeVisible();
      expect(screen.getByLabelText("Portion grams")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(saveButton()).toBeDisabled();
    });
  });

  describe("editing", () => {
    it("starts from initial and keeps id and createdAt", async () => {
      const { user, onSaved } = setup(SAVED);
      expect(
        screen.getByRole("dialog", { name: "Edit custom food" }),
      ).toBeVisible();
      expect(screen.getByLabelText("Name")).toHaveValue("Oat bar");
      expect(screen.getByLabelText("Barcode")).toHaveValue("12345");
      expect(screen.getByLabelText("Calories")).toHaveValue(400);
      expect(screen.getByLabelText("Protein (g)")).toHaveValue(10);
      expect(screen.getByLabelText("Carbs (g)")).toHaveValue(60);
      expect(screen.getByLabelText("Fat (g)")).toHaveValue(12);
      expect(screen.getByLabelText("Portion label")).toHaveValue("1 bar");
      expect(screen.getByLabelText("Portion grams")).toHaveValue(45);

      await fill(user, "Name", "New bar");
      await user.click(saveButton());

      const expected = { ...SAVED, name: "New bar" };
      expect(loadLS(K_FOOD_CUSTOM)).toEqual([expected]);
      expect(onSaved).toHaveBeenCalledWith(expected);
    });

    it("removes a cleared barcode, keeping id and createdAt", async () => {
      const { user } = setup(SAVED);
      await fill(user, "Barcode", "");
      await user.click(saveButton());

      const [row] = loadLS(K_FOOD_CUSTOM);
      expect(row).not.toHaveProperty("barcode");
      expect(row.id).toBe("c1");
      expect(row.createdAt).toBe(111);
    });

    it("removes the portions key when the only portion is blanked", async () => {
      const { user } = setup(SAVED);
      await fill(user, "Portion label", "");
      await fill(user, "Portion grams", "");
      await user.click(saveButton());
      expect(loadLS(K_FOOD_CUSTOM)[0]).not.toHaveProperty("portions");
    });

    describe("with further portions", () => {
      const second = { label: "2 bars", grams: 90 };
      const third = { label: "Box", grams: 270 };
      const many = {
        ...SAVED,
        portions: [{ label: "1 bar", grams: 45 }, second, third],
      };

      it("edits the first portion and leaves the others unchanged", async () => {
        const { user } = setup(many);
        await fill(user, "Portion label", "Small bar");
        await fill(user, "Portion grams", "30");
        await user.click(saveButton());
        expect(loadLS(K_FOOD_CUSTOM)[0].portions).toEqual([
          { label: "Small bar", grams: 30 },
          second,
          third,
        ]);
      });

      it("removes only the first portion when its fields are blanked", async () => {
        const { user } = setup(many);
        await fill(user, "Portion label", "");
        await fill(user, "Portion grams", "");
        await user.click(saveButton());
        expect(loadLS(K_FOOD_CUSTOM)[0].portions).toEqual([second, third]);
      });
    });
  });
});
