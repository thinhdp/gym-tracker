import { loadLS, saveLS } from "../../lib/storage";
import { exportFoodData, importFoodData } from "./backupFood";
import {
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
  it("returns the five stored lists", () => {
    seed();
    expect(exportFoodData()).toEqual({
      entries: [entry("old")],
      targets: [target("2026-01-01")],
      customFoods: [custom("old")],
      savedMeals: [meal("old")],
      recent: [recent("old")],
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
    });
  });
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

  it("merge mode normalises the current lists before merging", () => {
    saveLS(K_FOOD_ENTRIES, [null, entry("old"), entry("bad", { grams: 0 })]);
    saveLS(K_FOOD_TARGETS, { not: "a list" });
    saveLS(K_FOOD_RECENT, [{ junk: true }, recent("old")]);
    expect(importFoodData({ food: incoming() }, "merge")).toBe(true);
    expect(loadLS(K_FOOD_ENTRIES, []).map((r) => r.id)).toEqual(["old", "new"]);
    expect(loadLS(K_FOOD_TARGETS, []).map((r) => r.from)).toEqual([
      "2026-02-01",
    ]);
    expect(loadLS(K_FOOD_RECENT, []).map((r) => r.food.id)).toEqual([
      "new",
      "old",
    ]);
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
