import { loadLS, saveLS } from "../../lib/storage";
import { exportFoodData, importFoodData } from "./backupFood";
import {
  K_FOOD_COMPLETED,
  K_FOOD_CUSTOM,
  K_FOOD_ENTRIES,
  K_FOOD_MEALS,
  K_FOOD_RECENT,
  K_FOOD_SEARCH_CACHE,
  K_FOOD_TAB,
  K_FOOD_TARGETS,
} from "./keys";

const per100 = { kcal: 100, protein: 10, carb: 10, fat: 1 };

const entry = (id, overrides = {}) => ({
  id,
  date: "2026-03-01",
  slot: "lunch",
  name: `Entry ${id}`,
  grams: 50,
  per100,
  food: { kind: "db", id: "egg" },
  createdAt: 1000,
  ...overrides,
});

const target = (from, overrides = {}) => ({
  from,
  kcal: 2000,
  protein: 150,
  carb: 200,
  fat: 60,
  ...overrides,
});

const custom = (id, overrides = {}) => ({
  id,
  name: `Custom ${id}`,
  per100,
  createdAt: 1000,
  ...overrides,
});

const meal = (id, overrides = {}) => ({
  id,
  name: `Meal ${id}`,
  items: [
    {
      name: "Egg",
      grams: 50,
      per100,
      food: { kind: "db", id: "egg" },
    },
  ],
  createdAt: 1000,
  ...overrides,
});

const recent = (id, overrides = {}) => ({
  food: { kind: "db", id },
  name: `Recent ${id}`,
  per100,
  portions: [],
  lastGrams: 100,
  lastAt: 1000,
  ...overrides,
});

const LIST_KEYS = [
  K_FOOD_ENTRIES,
  K_FOOD_TARGETS,
  K_FOOD_CUSTOM,
  K_FOOD_MEALS,
  K_FOOD_RECENT,
];

const seed = () => {
  saveLS(K_FOOD_ENTRIES, [entry("old")]);
  saveLS(K_FOOD_TARGETS, [target("2026-01-01")]);
  saveLS(K_FOOD_CUSTOM, [custom("old")]);
  saveLS(K_FOOD_MEALS, [meal("old")]);
  saveLS(K_FOOD_RECENT, [recent("old")]);
};

const seededLists = () => ({
  [K_FOOD_ENTRIES]: [entry("old")],
  [K_FOOD_TARGETS]: [target("2026-01-01")],
  [K_FOOD_CUSTOM]: [custom("old")],
  [K_FOOD_MEALS]: [meal("old")],
  [K_FOOD_RECENT]: [recent("old")],
});

const storedLists = () =>
  Object.fromEntries(LIST_KEYS.map((key) => [key, loadLS(key, "unset")]));

const incoming = () => ({
  entries: [entry("new")],
  targets: [target("2026-02-01")],
  customFoods: [custom("new")],
  savedMeals: [meal("new")],
  recent: [recent("new", { lastAt: 2000 })],
});

describe("exportFoodData", () => {
  it("returns the six stored lists", () => {
    seed();
    expect(exportFoodData()).toEqual({
      entries: [entry("old")],
      targets: [target("2026-01-01")],
      customFoods: [custom("old")],
      savedMeals: [meal("old")],
      recent: [recent("old")],
      completedDays: [],
    });
  });

  it("returns [] for missing lists and for a stored value that is not an array", () => {
    saveLS(K_FOOD_ENTRIES, { not: "a list" });
    saveLS(K_FOOD_RECENT, "nope");
    expect(exportFoodData()).toEqual({
      entries: [],
      targets: [],
      customFoods: [],
      savedMeals: [],
      recent: [],
      completedDays: [],
    });
  });

  it("returns the stored completedDays as they are", () => {
    saveLS(K_FOOD_COMPLETED, ["2026-11-01", "2026-11-03"]);
    expect(exportFoodData().completedDays).toEqual([
      "2026-11-01",
      "2026-11-03",
    ]);
  });

  it("returns [] for completedDays when the key holds a non-array", () => {
    saveLS(K_FOOD_COMPLETED, { not: "a list" });
    expect(exportFoodData().completedDays).toEqual([]);
  });
});

describe("importFoodData completedDays", () => {
  const storedDays = () => loadLS(K_FOOD_COMPLETED, "unset");

  it("replace overwrites the stored list with the incoming one", () => {
    saveLS(K_FOOD_COMPLETED, ["2026-11-01"]);
    expect(
      importFoodData({ food: { completedDays: ["2026-11-02"] } }, "replace"),
    ).toBe(true);
    expect(storedDays()).toEqual(["2026-11-02"]);
  });

  it("replace with a food object that has no completedDays empties the list", () => {
    saveLS(K_FOOD_COMPLETED, ["2026-11-01"]);
    expect(importFoodData({ food: incoming() }, "replace")).toBe(true);
    expect(storedDays()).toEqual([]);
  });

  it("merge with a food object that has no completedDays keeps the list", () => {
    saveLS(K_FOOD_COMPLETED, ["2026-11-01"]);
    expect(importFoodData({ food: incoming() }, "merge")).toBe(true);
    expect(storedDays()).toEqual(["2026-11-01"]);
  });

  it("merge unions stored and incoming dates, sorted", () => {
    saveLS(K_FOOD_COMPLETED, ["2026-11-01"]);
    expect(
      importFoodData({ food: { completedDays: ["2026-11-02"] } }, "merge"),
    ).toBe(true);
    expect(storedDays()).toEqual(["2026-11-01", "2026-11-02"]);
  });

  it.each(["merge", "replace"])(
    "a backup with no food field leaves the list untouched (%s)",
    (mode) => {
      saveLS(K_FOOD_COMPLETED, ["2026-11-01"]);
      expect(importFoodData({ exercises: [] }, mode)).toBe(false);
      expect(storedDays()).toEqual(["2026-11-01"]);
    },
  );
});

describe("importFoodData", () => {
  it.each(["merge", "replace"])(
    "importFoodData returns false and writes nothing when raw.food is absent (%s)",
    (mode) => {
      seed();
      expect(importFoodData({ exercises: [] }, mode)).toBe(false);
      expect(storedLists()).toEqual(seededLists());
    },
  );

  it.each(["merge", "replace"])(
    "returns false and writes nothing to empty storage when raw is null (%s)",
    (mode) => {
      expect(importFoodData(null, mode)).toBe(false);
      expect(importFoodData(undefined, mode)).toBe(false);
      for (const value of Object.values(storedLists())) {
        expect(value).toBe("unset");
      }
    },
  );

  it.each([
    ["null", null],
    ["a string", "food"],
    ["a number", 7],
    ["an array", [entry("new")]],
  ])("treats raw.food of %s as absent in replace mode", (_label, food) => {
    seed();
    expect(importFoodData({ food }, "replace")).toBe(false);
    expect(storedLists()).toEqual(seededLists());
  });

  it("replace overwrites each list", () => {
    seed();
    expect(importFoodData({ food: incoming() }, "replace")).toBe(true);
    expect(storedLists()).toEqual({
      [K_FOOD_ENTRIES]: [entry("new")],
      [K_FOOD_TARGETS]: [target("2026-02-01")],
      [K_FOOD_CUSTOM]: [custom("new")],
      [K_FOOD_MEALS]: [meal("new")],
      [K_FOOD_RECENT]: [recent("new", { lastAt: 2000 })],
    });
  });

  it("merge unions each list", () => {
    seed();
    expect(importFoodData({ food: incoming() }, "merge")).toBe(true);
    expect(storedLists()).toEqual({
      [K_FOOD_ENTRIES]: [entry("old"), entry("new")],
      [K_FOOD_TARGETS]: [target("2026-01-01"), target("2026-02-01")],
      [K_FOOD_CUSTOM]: [custom("old"), custom("new")],
      [K_FOOD_MEALS]: [meal("old"), meal("new")],
      [K_FOOD_RECENT]: [recent("new", { lastAt: 2000 }), recent("old")],
    });
  });

  it.each([
    ["missing", undefined],
    ["unknown", "overwrite"],
  ])(
    "acts as merge and keeps existing rows when mode is %s",
    (_label, mode) => {
      seed();
      expect(importFoodData({ food: incoming() }, mode)).toBe(true);
      expect(storedLists()).toEqual({
        [K_FOOD_ENTRIES]: [entry("old"), entry("new")],
        [K_FOOD_TARGETS]: [target("2026-01-01"), target("2026-02-01")],
        [K_FOOD_CUSTOM]: [custom("old"), custom("new")],
        [K_FOOD_MEALS]: [meal("old"), meal("new")],
        [K_FOOD_RECENT]: [recent("new", { lastAt: 2000 }), recent("old")],
      });
    },
  );

  it("replace mode overwrites a list that is missing from a plain-object food with []", () => {
    seed();
    expect(
      importFoodData({ food: { entries: [entry("new")] } }, "replace"),
    ).toBe(true);
    expect(storedLists()).toEqual({
      [K_FOOD_ENTRIES]: [entry("new")],
      [K_FOOD_TARGETS]: [],
      [K_FOOD_CUSTOM]: [],
      [K_FOOD_MEALS]: [],
      [K_FOOD_RECENT]: [],
    });
  });

  it("merge mode keeps existing lists when food is an empty object", () => {
    seed();
    expect(importFoodData({ food: {} }, "merge")).toBe(true);
    expect(storedLists()).toEqual(seededLists());
  });

  it("merge keeps stored rows that would fail normalising and counts a non-array list as []", () => {
    const badEntry = entry("bad", { grams: 0 });
    saveLS(K_FOOD_ENTRIES, [null, entry("old"), badEntry]);
    saveLS(K_FOOD_TARGETS, { not: "a list" });
    saveLS(K_FOOD_RECENT, [{ junk: true }, recent("old")]);
    expect(importFoodData({ food: incoming() }, "merge")).toBe(true);
    expect(loadLS(K_FOOD_ENTRIES, [])).toEqual([
      null,
      entry("old"),
      badEntry,
      entry("new"),
    ]);
    expect(loadLS(K_FOOD_TARGETS, [])).toEqual([target("2026-02-01")]);
    expect(loadLS(K_FOOD_RECENT, [])).toEqual([
      recent("new", { lastAt: 2000 }),
      recent("old"),
      { junk: true },
    ]);
  });

  it("merge keeps a stored entry with no food and a stored meal with one bad item byte for byte", () => {
    const noFood = entry("nofood");
    delete noFood.food;
    const badItemMeal = meal("badmeal", {
      items: [...meal("x").items, { name: "Bad", grams: 0 }],
    });
    saveLS(K_FOOD_ENTRIES, [noFood]);
    saveLS(K_FOOD_MEALS, [badItemMeal]);
    expect(importFoodData({ food: incoming() }, "merge")).toBe(true);
    const [storedEntry] = loadLS(K_FOOD_ENTRIES, []);
    const [storedMeal] = loadLS(K_FOOD_MEALS, []);
    expect(JSON.stringify(storedEntry)).toBe(JSON.stringify(noFood));
    expect(JSON.stringify(storedMeal)).toBe(JSON.stringify(badItemMeal));
  });

  it("merge keeps a null row in stored entries and targets", () => {
    saveLS(K_FOOD_ENTRIES, [null]);
    saveLS(K_FOOD_TARGETS, [null]);
    expect(importFoodData({ food: incoming() }, "merge")).toBe(true);
    expect(loadLS(K_FOOD_ENTRIES, [])).toEqual([null, entry("new")]);
    expect(loadLS(K_FOOD_TARGETS, [])).toEqual([target("2026-02-01"), null]);
  });

  it("merge keeps a stored recent row with no food", () => {
    const noFood = recent("x");
    delete noFood.food;
    saveLS(K_FOOD_RECENT, [noFood]);
    expect(importFoodData({ food: incoming() }, "merge")).toBe(true);
    expect(loadLS(K_FOOD_RECENT, [])).toEqual([
      recent("new", { lastAt: 2000 }),
      noFood,
    ]);
  });

  it("merge normalises incoming rows: invalid and null rows drop, the first of two rows with one key wins", () => {
    seed();
    importFoodData(
      {
        food: {
          entries: [
            entry("bad", { grams: 0 }),
            null,
            entry("dup"),
            entry("dup", { grams: 99 }),
            entry("barcode", { food: { kind: "db", id: "egg", barcode: 7 } }),
          ],
          targets: [
            target("not-a-date"),
            null,
            target("2026-02-01"),
            target("2026-02-01", { kcal: 1 }),
          ],
          customFoods: [
            custom("bad", { name: "" }),
            null,
            custom("dup"),
            custom("dup", { name: "Second" }),
          ],
          savedMeals: [
            meal("bad", { items: [] }),
            null,
            meal("dup"),
            meal("dup", { name: "Second" }),
          ],
          recent: [
            recent("bad", { lastGrams: 0 }),
            null,
            recent("dup", { lastAt: 2000 }),
            recent("dup", { lastAt: 1500 }),
          ],
        },
      },
      "merge",
    );
    expect(storedLists()).toEqual({
      [K_FOOD_ENTRIES]: [
        entry("old"),
        entry("dup"),
        entry("barcode", { food: { kind: "db", id: "egg" } }),
      ],
      [K_FOOD_TARGETS]: [target("2026-01-01"), target("2026-02-01")],
      [K_FOOD_CUSTOM]: [custom("old"), custom("dup")],
      [K_FOOD_MEALS]: [meal("old"), meal("dup")],
      [K_FOOD_RECENT]: [recent("dup", { lastAt: 2000 }), recent("old")],
    });
  });

  it("replace still drops invalid incoming rows and ignores the stored rows", () => {
    saveLS(K_FOOD_ENTRIES, [null, entry("old")]);
    importFoodData(
      { food: { entries: [entry("bad", { grams: 0 }), entry("new")] } },
      "replace",
    );
    expect(loadLS(K_FOOD_ENTRIES, [])).toEqual([entry("new")]);
  });

  it("drops invalid incoming rows in replace mode", () => {
    seed();
    importFoodData(
      {
        food: {
          entries: [entry("bad", { date: "2026-02-31" }), entry("good"), null],
        },
      },
      "replace",
    );
    expect(loadLS(K_FOOD_ENTRIES, []).map((r) => r.id)).toEqual(["good"]);
  });

  it.each(["merge", "replace"])(
    "does not touch the search cache or the food tab key (%s)",
    (mode) => {
      const cache = { egg: { at: 1, results: [] } };
      saveLS(K_FOOD_SEARCH_CACHE, cache);
      saveLS(K_FOOD_TAB, "search");
      const food = {
        ...incoming(),
        searchCache: { other: { at: 2, results: [] } },
        tab: "trends",
      };
      expect(importFoodData({ food }, mode)).toBe(true);
      expect(loadLS(K_FOOD_SEARCH_CACHE, null)).toEqual(cache);
      expect(loadLS(K_FOOD_TAB, null)).toBe("search");
    },
  );
});
