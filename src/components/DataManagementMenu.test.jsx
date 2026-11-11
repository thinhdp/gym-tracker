import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DataManagementMenu from "./DataManagementMenu";
import { downloadJSON } from "../lib/backup";
import { loadLS, saveLS } from "../lib/storage";
import { importFoodData } from "../food/lib/backupFood";
import {
  K_FOOD_CUSTOM,
  K_FOOD_ENTRIES,
  K_FOOD_MEALS,
  K_FOOD_RECENT,
  K_FOOD_SEARCH_CACHE,
  K_FOOD_TAB,
  K_FOOD_TARGETS,
} from "../food/lib/keys";

vi.mock("../context/AppContext", () => ({
  useApp: () => ({
    exercises: [],
    workouts: [],
    routines: [],
    setExercises: vi.fn(),
    setWorkouts: vi.fn(),
    setRoutines: vi.fn(),
  }),
}));

// downloadJSON builds a Blob, so the export test reads the payload from the mock.
vi.mock("../lib/backup", async (importOriginal) => ({
  ...(await importOriginal()),
  downloadJSON: vi.fn(),
}));

// The real import runs; the spy shows the menu called it and with which mode.
vi.mock("../food/lib/backupFood", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, importFoodData: vi.fn(actual.importFoodData) };
});

const per100 = { kcal: 100, protein: 10, carb: 10, fat: 1 };
const food = { kind: "db", id: "egg" };

const entry = (id, name = `Entry ${id}`) => ({
  id,
  date: "2026-03-01",
  slot: "lunch",
  name,
  grams: 50,
  per100,
  food,
  createdAt: 1000,
});
const target = {
  from: "2026-03-01",
  kcal: 2000,
  protein: 150,
  carb: 200,
  fat: 60,
};
const customFood = { id: "c1", name: "Custom", per100, createdAt: 1000 };
const savedMeal = {
  id: "m1",
  name: "Meal",
  items: [{ food, name: "Egg", grams: 50, per100 }],
  createdAt: 1000,
};
const recent = { food, name: "Egg", per100, lastGrams: 50, lastAt: 1000 };

const seedFood = () => {
  saveLS(K_FOOD_ENTRIES, [entry("e1")]);
  saveLS(K_FOOD_TARGETS, [target]);
  saveLS(K_FOOD_CUSTOM, [customFood]);
  saveLS(K_FOOD_MEALS, [savedMeal]);
  saveLS(K_FOOD_RECENT, [recent]);
};

const readFood = () => ({
  entries: loadLS(K_FOOD_ENTRIES, null),
  targets: loadLS(K_FOOD_TARGETS, null),
  customFoods: loadLS(K_FOOD_CUSTOM, null),
  savedMeals: loadLS(K_FOOD_MEALS, null),
  recent: loadLS(K_FOOD_RECENT, null),
});

describe("DataManagementMenu", () => {
  let alertSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  const openMenu = () =>
    fireEvent.click(screen.getByRole("button", { name: /data/i }));

  // The menu button sets the mode; the change event stands in for the file picker.
  const importBackup = async (backup, mode) => {
    const { container } = render(<DataManagementMenu />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: `Import (${mode})` }));
    const file = new File([JSON.stringify(backup)], "backup.json", {
      type: "application/json",
    });
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Import complete."),
    );
  };

  it("opens the menu upward so all options stay above the bottom nav", () => {
    render(<DataManagementMenu />);
    openMenu();
    const replace = screen.getByRole("button", { name: "Import (replace)" });
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import (merge)" }),
    ).toBeInTheDocument();
    expect(replace.parentElement.className).toContain("bottom-full");
  });

  it("export payload includes food with the six lists", () => {
    seedFood();
    saveLS(K_FOOD_SEARCH_CACHE, { egg: { at: 1, results: [] } });
    saveLS(K_FOOD_TAB, "search");
    render(<DataManagementMenu />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(downloadJSON).toHaveBeenCalledTimes(1);
    const payload = downloadJSON.mock.calls[0][1];
    expect(payload.schema).toBe("mgym.v1");
    expect(payload.food).toEqual({
      entries: [entry("e1")],
      targets: [target],
      customFoods: [customFood],
      savedMeals: [savedMeal],
      recent: [recent],
      completedDays: [],
    });
  });

  it.each(["merge", "replace"])(
    "import with no food field leaves stored food data untouched (%s)",
    async (mode) => {
      seedFood();
      const before = readFood();
      const backup = { schema: "mgym.v1" };

      await importBackup(backup, mode);

      expect(importFoodData).toHaveBeenCalledWith(backup, mode);
      expect(readFood()).toEqual(before);
    },
  );

  it("import with a food field in merge mode adds rows and keeps stored rows", async () => {
    seedFood();

    await importBackup(
      {
        schema: "mgym.v1",
        food: { entries: [entry("e1", "Incoming name"), entry("e2")] },
      },
      "merge",
    );

    expect(readFood()).toEqual({
      entries: [entry("e1"), entry("e2")],
      targets: [target],
      customFoods: [customFood],
      savedMeals: [savedMeal],
      recent: [recent],
    });
  });

  it("import with a food field in replace mode overwrites each list", async () => {
    seedFood();

    await importBackup(
      { schema: "mgym.v1", food: { entries: [entry("e2")] } },
      "replace",
    );

    expect(readFood()).toEqual({
      entries: [entry("e2")],
      targets: [],
      customFoods: [],
      savedMeals: [],
      recent: [],
    });
  });
});
