import { act, renderHook } from "@testing-library/react";
import { loadLS, saveLS } from "../../lib/storage";
import {
  K_FOOD_CUSTOM,
  K_FOOD_ENTRIES,
  K_FOOD_MEALS,
  K_FOOD_RECENT,
  K_FOOD_TARGETS,
} from "../lib/keys";
import { FoodProvider, useFood } from "./FoodContext";

const PER100 = { kcal: 155, protein: 13, carb: 1.1, fat: 11 };
const FOOD = { kind: "db", id: "egg" };
const MEAL_ITEM = { name: "Egg", grams: 50, per100: PER100, food: FOOD };

const draft = (overrides = {}) => ({
  date: "2026-11-02",
  slot: "breakfast",
  name: "Egg",
  grams: 50,
  per100: PER100,
  food: FOOD,
  portionLabel: "1 large egg",
  ...overrides,
});

const storedEntry = (id, overrides = {}) => ({
  id,
  ...draft(),
  createdAt: 1000,
  ...overrides,
});

const targetRow = (from, kcal = 2000) => ({
  from,
  kcal,
  protein: 150,
  carb: 200,
  fat: 60,
});

const customRow = (id) => ({
  id,
  name: `Food ${id}`,
  barcode: "8934563138165",
  per100: PER100,
  portions: [{ label: "1 bar", grams: 45 }],
  createdAt: 1000,
});

const mealRow = (id) => ({
  id,
  name: `Meal ${id}`,
  items: [MEAL_ITEM],
  createdAt: 1000,
});

const recentRow = (id, lastAt) => ({
  food: { kind: "db", id },
  name: `Food ${id}`,
  per100: PER100,
  lastGrams: 50,
  lastAt,
});

// name, key, valid rows, a row that fails the shape rules
const LIST_KEYS = [
  [
    "entries",
    K_FOOD_ENTRIES,
    [storedEntry("a"), storedEntry("b")],
    { id: "bad" },
  ],
  [
    "targets",
    K_FOOD_TARGETS,
    [targetRow("2026-11-01"), targetRow("2026-11-02")],
    { from: "2026-11-03" },
  ],
  [
    "customFoods",
    K_FOOD_CUSTOM,
    [customRow("a"), customRow("b")],
    { id: "bad" },
  ],
  [
    "savedMeals",
    K_FOOD_MEALS,
    [mealRow("a"), mealRow("b")],
    { id: "bad", items: [] },
  ],
  [
    "recent",
    K_FOOD_RECENT,
    [recentRow("egg", 2), recentRow("rice", 1)],
    { food: FOOD },
  ],
];

const setup = () => renderHook(() => useFood(), { wrapper: FoodProvider });

describe("FoodProvider loading", () => {
  it.each(LIST_KEYS)(
    "loads %s from storage when it holds an array",
    (name, key, rows) => {
      saveLS(key, rows);
      const { result } = setup();
      expect(result.current[name]).toEqual(rows);
      expect(loadLS(key)).toEqual(rows);
    },
  );

  it.each(LIST_KEYS)(
    "falls back to [] for a non-array object in %s and rewrites storage",
    (name, key) => {
      saveLS(key, { not: "an array" });
      const { result } = setup();
      expect(result.current[name]).toEqual([]);
      expect(loadLS(key)).toEqual([]);
    },
  );

  it.each([["a string"], [null]])(
    "falls back to [] for the entries value %j and rewrites storage",
    (stored) => {
      saveLS(K_FOOD_ENTRIES, stored);
      const { result } = setup();
      expect(result.current.entries).toEqual([]);
      expect(loadLS(K_FOOD_ENTRIES)).toEqual([]);
    },
  );

  it("falls back to [] for unparseable entries JSON and rewrites storage", () => {
    localStorage.setItem(K_FOOD_ENTRIES, "{not json");
    const { result } = setup();
    expect(result.current.entries).toEqual([]);
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([]);
  });
});

describe("FoodProvider load normalising", () => {
  it.each(LIST_KEYS)(
    "removes a null row and a malformed row from %s, in state and in storage",
    (name, key, rows, malformed) => {
      saveLS(key, [null, rows[0], malformed, rows[1]]);
      const { result } = setup();
      expect(result.current[name]).toEqual(rows);
      expect(loadLS(key)).toEqual(rows);
      expect(result.current.droppedRows).toBe(2);
    },
  );

  it.each(LIST_KEYS)(
    "keeps valid %s rows byte for byte and counts 0",
    (name, key, rows) => {
      saveLS(key, rows);
      const before = localStorage.getItem(key);
      const { result } = setup();
      expect(result.current.droppedRows).toBe(0);
      expect(localStorage.getItem(key)).toBe(before);
    },
  );

  it("counts 0 with empty storage", () => {
    expect(setup().result.current.droppedRows).toBe(0);
  });

  it("sums the removed rows over the five lists", () => {
    LIST_KEYS.forEach(([, key, rows, malformed]) =>
      saveLS(key, [null, rows[0], malformed]),
    );
    expect(setup().result.current.droppedRows).toBe(10);
  });

  it("counts a duplicate as removed and keeps the first row", () => {
    const first = storedEntry("a", { grams: 10 });
    saveLS(K_FOOD_ENTRIES, [first, storedEntry("a", { grams: 20 })]);
    const { result } = setup();
    expect(result.current.entries).toEqual([first]);
    expect(result.current.droppedRows).toBe(1);
  });

  it("counts a stored non-array as 0, beside a list that lost a row", () => {
    saveLS(K_FOOD_ENTRIES, { 0: "x", length: 5 });
    saveLS(K_FOOD_CUSTOM, "a string of text");
    saveLS(K_FOOD_TARGETS, [null]);
    const { result } = setup();
    expect(result.current.droppedRows).toBe(1);
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([]);
    expect(loadLS(K_FOOD_CUSTOM)).toEqual([]);
  });

  it("counts a saved meal that loses some items but stays as 0", () => {
    saveLS(K_FOOD_MEALS, [
      { ...mealRow("a"), items: [null, MEAL_ITEM, { name: "No grams" }] },
    ]);
    const { result } = setup();
    expect(result.current.savedMeals).toEqual([mealRow("a")]);
    expect(loadLS(K_FOOD_MEALS)).toEqual([mealRow("a")]);
    expect(result.current.droppedRows).toBe(0);
  });

  it("counts a repaired row as 0 and saves it repaired", () => {
    const noCreatedAt = storedEntry("a");
    delete noCreatedAt.createdAt;
    const noBarcode = customRow("c");
    delete noBarcode.barcode;
    saveLS(K_FOOD_ENTRIES, [noCreatedAt]);
    saveLS(K_FOOD_CUSTOM, [{ ...noBarcode, barcode: 123 }]);
    const { result } = setup();
    expect(result.current.droppedRows).toBe(0);
    const [entry] = loadLS(K_FOOD_ENTRIES);
    expect(entry).toEqual({ ...noCreatedAt, createdAt: entry.createdAt });
    expect(Number.isFinite(entry.createdAt)).toBe(true);
    expect(loadLS(K_FOOD_CUSTOM)).toEqual([noBarcode]);
  });

  it("counts 0 on a second mount, because the write-back removed the rows", () => {
    saveLS(K_FOOD_ENTRIES, [null, storedEntry("a")]);
    const first = setup();
    expect(first.result.current.droppedRows).toBe(1);
    first.unmount();
    expect(setup().result.current.droppedRows).toBe(0);
  });

  it("keeps the load-time count after a later change to a list", () => {
    saveLS(K_FOOD_ENTRIES, [null, storedEntry("a")]);
    const { result } = setup();
    act(() => {
      result.current.deleteEntry("a");
    });
    expect(result.current.entries).toEqual([]);
    expect(result.current.droppedRows).toBe(1);
  });
});

describe("FoodProvider entries", () => {
  it("addEntry returns a row with id and createdAt and persists its per100 snapshot", () => {
    const { result } = setup();
    let row;
    act(() => {
      row = result.current.addEntry(draft());
    });
    expect(typeof row.id).toBe("string");
    expect(row.id).not.toBe("");
    expect(typeof row.createdAt).toBe("number");
    expect(row).toMatchObject(draft());
    expect(result.current.entries).toEqual([row]);
    const stored = loadLS(K_FOOD_ENTRIES);
    expect(stored).toEqual([row]);
    expect(stored[0].per100).toEqual(PER100);
  });

  it("addEntry keeps only the named fields", () => {
    const { result } = setup();
    let row;
    act(() => {
      row = result.current.addEntry({ ...draft(), id: "mine", extra: true });
    });
    expect(row.id).not.toBe("mine");
    expect(row).not.toHaveProperty("extra");
  });

  it("addEntry appends, so a second row lands after the first", () => {
    const { result } = setup();
    let first;
    let second;
    act(() => {
      first = result.current.addEntry(draft({ name: "First" }));
    });
    act(() => {
      second = result.current.addEntry(draft({ name: "Second" }));
    });
    expect(result.current.entries).toEqual([first, second]);
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([first, second]);
  });

  it("updateEntry changes only the targeted row", () => {
    const a = storedEntry("a");
    const b = storedEntry("b");
    saveLS(K_FOOD_ENTRIES, [a, b]);
    const { result } = setup();
    act(() => {
      result.current.updateEntry("a", { grams: 120 });
    });
    expect(result.current.entries[0]).toEqual({ ...a, grams: 120 });
    expect(result.current.entries[1]).toEqual(b);
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([{ ...a, grams: 120 }, b]);
  });

  it("deleteEntry removes only the targeted row", () => {
    const a = storedEntry("a");
    const b = storedEntry("b");
    saveLS(K_FOOD_ENTRIES, [a, b]);
    const { result } = setup();
    act(() => {
      result.current.deleteEntry("a");
    });
    expect(result.current.entries).toEqual([b]);
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([b]);
  });
});

describe("FoodProvider targets", () => {
  it("upsertTarget adds, replaces a same-from row, and deleteTarget removes it", () => {
    const { result } = setup();
    const row = {
      from: "2026-11-01",
      kcal: 2000,
      protein: 150,
      carb: 200,
      fat: 60,
    };
    act(() => {
      result.current.upsertTarget(row);
    });
    expect(result.current.targets).toEqual([row]);
    expect(loadLS(K_FOOD_TARGETS)).toEqual([row]);

    const replacement = { ...row, kcal: 2500 };
    act(() => {
      result.current.upsertTarget(replacement);
    });
    expect(result.current.targets).toEqual([replacement]);
    expect(loadLS(K_FOOD_TARGETS)).toEqual([replacement]);

    act(() => {
      result.current.deleteTarget(row.from);
    });
    expect(result.current.targets).toEqual([]);
    expect(loadLS(K_FOOD_TARGETS)).toEqual([]);
  });

  it("upsertTarget keeps the other rows, sorted by from", () => {
    const early = targetRow("2026-10-01", 2000);
    const late = targetRow("2026-12-01", 2200);
    const middle = targetRow("2026-11-01", 2100);
    saveLS(K_FOOD_TARGETS, [early, late]);
    const { result } = setup();
    act(() => {
      result.current.upsertTarget(middle);
    });
    expect(result.current.targets).toEqual([early, middle, late]);
    expect(loadLS(K_FOOD_TARGETS)).toEqual([early, middle, late]);
  });

  it("deleteTarget keeps the other rows", () => {
    const early = targetRow("2026-10-01", 2000);
    const late = targetRow("2026-12-01", 2200);
    saveLS(K_FOOD_TARGETS, [early, late]);
    const { result } = setup();
    act(() => {
      result.current.deleteTarget(early.from);
    });
    expect(result.current.targets).toEqual([late]);
    expect(loadLS(K_FOOD_TARGETS)).toEqual([late]);
  });
});

describe("FoodProvider saved meals", () => {
  it("saveMealFromSlot copies only the matching date and slot, in list order", () => {
    const first = storedEntry("a", { name: "First" });
    const noLabel = storedEntry("b", { name: "Second" });
    delete noLabel.portionLabel;
    const otherSlot = storedEntry("c", { slot: "lunch" });
    const otherDate = storedEntry("d", { date: "2026-11-01" });
    saveLS(K_FOOD_ENTRIES, [first, otherSlot, noLabel, otherDate]);
    const { result } = setup();
    let meal;
    act(() => {
      meal = result.current.saveMealFromSlot(
        "Breakfast",
        "2026-11-02",
        "breakfast",
      );
    });
    expect(typeof meal.id).toBe("string");
    expect(typeof meal.createdAt).toBe("number");
    expect(meal.name).toBe("Breakfast");
    expect(meal.items).toEqual([
      {
        name: "First",
        grams: 50,
        per100: PER100,
        food: FOOD,
        portionLabel: "1 large egg",
      },
      { name: "Second", grams: 50, per100: PER100, food: FOOD },
    ]);
    expect(meal.items[1]).not.toHaveProperty("portionLabel");
    for (const item of meal.items) {
      for (const field of ["id", "date", "slot", "createdAt"]) {
        expect(item).not.toHaveProperty(field);
      }
    }
    expect(result.current.savedMeals).toEqual([meal]);
    expect(loadLS(K_FOOD_MEALS)).toEqual([meal]);
  });

  it("saveMealFromSlot appends after the meals already saved", () => {
    const existing = { id: "m", name: "Old", items: [MEAL_ITEM], createdAt: 1 };
    saveLS(K_FOOD_ENTRIES, [storedEntry("a")]);
    saveLS(K_FOOD_MEALS, [existing]);
    const { result } = setup();
    let meal;
    act(() => {
      meal = result.current.saveMealFromSlot("New", "2026-11-02", "breakfast");
    });
    expect(result.current.savedMeals).toEqual([existing, meal]);
    expect(loadLS(K_FOOD_MEALS)).toEqual([existing, meal]);
  });

  it("saveMealFromSlot sees an entry added earlier in the same batch", () => {
    const { result } = setup();
    let meal;
    act(() => {
      result.current.addEntry(draft());
      meal = result.current.saveMealFromSlot("Eggs", "2026-11-02", "breakfast");
    });
    expect(meal.items).toHaveLength(1);
    expect(loadLS(K_FOOD_MEALS)).toEqual([meal]);
  });

  it("logSavedMeal sees a meal saved earlier in the same batch", () => {
    saveLS(K_FOOD_ENTRIES, [storedEntry("a")]);
    const { result } = setup();
    let added;
    act(() => {
      const meal = result.current.saveMealFromSlot(
        "Eggs",
        "2026-11-02",
        "breakfast",
      );
      added = result.current.logSavedMeal(meal.id, "2026-11-03", "dinner");
    });
    expect(added).toHaveLength(1);
    expect(result.current.entries).toHaveLength(2);
    expect(loadLS(K_FOOD_ENTRIES)).toHaveLength(2);
  });

  it("a saveMealFromSlot held across an await sees entries added after that render", async () => {
    saveLS(K_FOOD_ENTRIES, [storedEntry("a", { name: "First" })]);
    const { result } = setup();
    const held = result.current.saveMealFromSlot;
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.addEntry(draft({ name: "Second" }));
    });
    let meal;
    act(() => {
      meal = held("Eggs", "2026-11-02", "breakfast");
    });
    expect(meal.items.map((i) => i.name)).toEqual(["First", "Second"]);
  });

  it("a logSavedMeal held across an await sees a meal saved after that render", async () => {
    saveLS(K_FOOD_ENTRIES, [storedEntry("a")]);
    const { result } = setup();
    const held = result.current.logSavedMeal;
    await act(async () => {
      await Promise.resolve();
    });
    let meal;
    act(() => {
      meal = result.current.saveMealFromSlot("Eggs", "2026-11-02", "breakfast");
    });
    let added;
    act(() => {
      added = held(meal.id, "2026-11-03", "dinner");
    });
    expect(added).toHaveLength(1);
    expect(result.current.entries).toHaveLength(2);
  });

  it("saveMealFromSlot sees an entry committed by an earlier act", () => {
    const { result } = setup();
    act(() => {
      result.current.addEntry(draft());
    });
    let meal;
    act(() => {
      meal = result.current.saveMealFromSlot("Eggs", "2026-11-02", "breakfast");
    });
    expect(meal.items).toHaveLength(1);
  });

  it("saveMealFromSlot on an empty slot returns null and stores nothing", () => {
    const existing = { id: "m", name: "Old", items: [MEAL_ITEM], createdAt: 1 };
    saveLS(K_FOOD_ENTRIES, [storedEntry("a")]);
    saveLS(K_FOOD_MEALS, [existing]);
    const { result } = setup();
    let meal;
    act(() => {
      meal = result.current.saveMealFromSlot("Nothing", "2026-11-02", "lunch");
    });
    expect(meal).toBeNull();
    expect(result.current.savedMeals).toEqual([existing]);
    expect(loadLS(K_FOOD_MEALS)).toEqual([existing]);
  });

  it("logSavedMeal creates new entries at the chosen date and slot with fresh ids", () => {
    const source = storedEntry("source", { name: "First" });
    const second = storedEntry("second", { name: "Second" });
    saveLS(K_FOOD_ENTRIES, [source, second]);
    const { result } = setup();
    let meal;
    act(() => {
      meal = result.current.saveMealFromSlot(
        "Breakfast",
        "2026-11-02",
        "breakfast",
      );
    });
    let added;
    act(() => {
      added = result.current.logSavedMeal(meal.id, "2026-11-03", "dinner");
    });
    expect(added.map((e) => e.name)).toEqual(["First", "Second"]);
    for (const row of added) {
      expect(row.date).toBe("2026-11-03");
      expect(row.slot).toBe("dinner");
      expect(row.grams).toBe(50);
      expect(row.per100).toEqual(PER100);
      expect(row.food).toEqual(FOOD);
      expect(row.portionLabel).toBe("1 large egg");
      expect(typeof row.id).toBe("string");
      expect(typeof row.createdAt).toBe("number");
    }
    const ids = added.map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).not.toContain("source");
    expect(ids).not.toContain("second");
    expect(result.current.entries).toEqual([source, second, ...added]);
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([source, second, ...added]);
  });

  it("logSavedMeal with an unknown id returns [] and leaves entries unchanged", () => {
    const a = storedEntry("a");
    saveLS(K_FOOD_ENTRIES, [a]);
    const { result } = setup();
    let added;
    act(() => {
      added = result.current.logSavedMeal("missing", "2026-11-03", "dinner");
    });
    expect(added).toEqual([]);
    expect(result.current.entries).toEqual([a]);
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([a]);
  });
});

describe("FoodProvider saved meal edits", () => {
  it("updateSavedMeal merges the patch into that meal only and persists", () => {
    const first = mealRow("a");
    const second = mealRow("b");
    saveLS(K_FOOD_MEALS, [first, second]);
    const { result } = setup();
    act(() => {
      result.current.updateSavedMeal("a", { name: "Renamed" });
    });
    const expected = [{ ...first, name: "Renamed" }, second];
    expect(result.current.savedMeals).toEqual(expected);
    expect(loadLS(K_FOOD_MEALS)).toEqual(expected);
  });

  it("updateSavedMeal with an unknown id changes nothing", () => {
    const first = mealRow("a");
    saveLS(K_FOOD_MEALS, [first]);
    const { result } = setup();
    act(() => {
      result.current.updateSavedMeal("missing", { name: "Renamed" });
    });
    expect(result.current.savedMeals).toEqual([first]);
    expect(loadLS(K_FOOD_MEALS)).toEqual([first]);
  });

  it("deleteSavedMeal removes that meal only and persists", () => {
    const first = mealRow("a");
    const second = mealRow("b");
    saveLS(K_FOOD_MEALS, [first, second]);
    const { result } = setup();
    act(() => {
      result.current.deleteSavedMeal("a");
    });
    expect(result.current.savedMeals).toEqual([second]);
    expect(loadLS(K_FOOD_MEALS)).toEqual([second]);
  });

  it("deleteSavedMeal leaves logged entries alone", () => {
    const logged = storedEntry("e");
    saveLS(K_FOOD_MEALS, [mealRow("a")]);
    saveLS(K_FOOD_ENTRIES, [logged]);
    const { result } = setup();
    act(() => {
      result.current.deleteSavedMeal("a");
    });
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([logged]);
  });

  it("logSavedMeal does not find a meal deleted earlier in the same batch", () => {
    saveLS(K_FOOD_MEALS, [mealRow("a")]);
    const { result } = setup();
    let added;
    act(() => {
      result.current.deleteSavedMeal("a");
      added = result.current.logSavedMeal("a", "2026-11-03", "dinner");
    });
    expect(added).toEqual([]);
  });
});

describe("FoodProvider custom foods", () => {
  it("upsertCustomFood adds id and createdAt when missing", () => {
    const { result } = setup();
    let row;
    act(() => {
      row = result.current.upsertCustomFood({ name: "Bar", per100: PER100 });
    });
    expect(typeof row.id).toBe("string");
    expect(typeof row.createdAt).toBe("number");
    expect(row).toMatchObject({ name: "Bar", per100: PER100 });
    expect(result.current.customFoods).toEqual([row]);
    expect(loadLS(K_FOOD_CUSTOM)).toEqual([row]);
  });

  it("upsertCustomFood appends a new food after the existing ones", () => {
    const first = { id: "x", name: "Bar", per100: PER100, createdAt: 111 };
    saveLS(K_FOOD_CUSTOM, [first]);
    const { result } = setup();
    let row;
    act(() => {
      row = result.current.upsertCustomFood({ name: "New", per100: PER100 });
    });
    expect(result.current.customFoods).toEqual([first, row]);
    expect(loadLS(K_FOOD_CUSTOM)).toEqual([first, row]);
  });

  it("upsertCustomFood replaces the same id in place, keeps createdAt, and leaves entries alone", () => {
    const first = { id: "x", name: "Bar", per100: PER100, createdAt: 111 };
    const other = { id: "y", name: "Other", per100: PER100, createdAt: 222 };
    const entry = storedEntry("a", { food: { kind: "custom", id: "x" } });
    saveLS(K_FOOD_CUSTOM, [first, other]);
    saveLS(K_FOOD_ENTRIES, [entry]);
    const { result } = setup();
    const per100 = { kcal: 1, protein: 1, carb: 1, fat: 1 };
    let row;
    act(() => {
      row = result.current.upsertCustomFood({
        ...first,
        name: "New bar",
        per100,
      });
    });
    expect(row).toEqual({ ...first, name: "New bar", per100 });
    expect(row.createdAt).toBe(111);
    expect(result.current.customFoods).toEqual([row, other]);
    expect(loadLS(K_FOOD_CUSTOM)).toEqual([row, other]);
    expect(result.current.entries).toEqual([entry]);
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([entry]);
  });

  it("editing a custom food does not change an existing entry's per100", () => {
    const original = { id: "x", name: "Bar", per100: PER100, createdAt: 111 };
    saveLS(K_FOOD_CUSTOM, [original]);
    const { result } = setup();
    let entry;
    act(() => {
      entry = result.current.addEntry(
        draft({ per100: PER100, food: { kind: "custom", id: "x" } }),
      );
    });
    act(() => {
      result.current.upsertCustomFood({
        ...original,
        per100: { kcal: 1, protein: 1, carb: 1, fat: 1 },
      });
    });
    expect(result.current.entries).toEqual([entry]);
    expect(loadLS(K_FOOD_ENTRIES)[0].per100).toEqual(PER100);
  });

  it("deleting a custom food keeps an entry's per100 and food ref", () => {
    const original = { id: "x", name: "Bar", per100: PER100, createdAt: 111 };
    const entry = storedEntry("a", { food: { kind: "custom", id: "x" } });
    saveLS(K_FOOD_CUSTOM, [original]);
    saveLS(K_FOOD_ENTRIES, [entry]);
    const { result } = setup();
    act(() => {
      result.current.deleteCustomFood("x");
    });
    expect(result.current.entries).toEqual([entry]);
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([entry]);
  });

  it("deleteCustomFood removes the row", () => {
    const first = { id: "x", name: "Bar", per100: PER100, createdAt: 111 };
    const other = { id: "y", name: "Other", per100: PER100, createdAt: 222 };
    saveLS(K_FOOD_CUSTOM, [first, other]);
    const { result } = setup();
    act(() => {
      result.current.deleteCustomFood("x");
    });
    expect(result.current.customFoods).toEqual([other]);
    expect(loadLS(K_FOOD_CUSTOM)).toEqual([other]);
  });
});

describe("FoodProvider recent", () => {
  // Task 11b replaces this test when touchRecent gets its real implementation.
  it("touchRecent is a stub that leaves recent unchanged", () => {
    const seeded = [recentRow("egg", 1)];
    saveLS(K_FOOD_RECENT, seeded);
    const { result } = setup();
    act(() => {
      result.current.touchRecent({
        food: { kind: "db", id: "new" },
        name: "New",
      });
    });
    expect(result.current.recent).toEqual(seeded);
    expect(loadLS(K_FOOD_RECENT)).toEqual(seeded);
  });
});
