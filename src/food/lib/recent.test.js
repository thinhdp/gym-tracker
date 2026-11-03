import { RECENT_MAX, recentKey, recentToFood, touchRecent } from "./recent";

const row = (id, overrides = {}) => ({
  food: { kind: "db", id },
  name: `Food ${id}`,
  per100: { kcal: 100, protein: 10, carb: 10, fat: 1 },
  portions: [],
  lastGrams: 100,
  lastPortionLabel: null,
  lastAt: 1000,
  ...overrides,
});

const fullList = () =>
  Array.from({ length: RECENT_MAX }, (_, i) => row(`food${i}`));

describe("RECENT_MAX", () => {
  it("is the cap from the plan", () => {
    expect(RECENT_MAX).toBe(50);
  });
});

describe("recentKey", () => {
  it("joins kind and id", () => {
    expect(recentKey({ kind: "db", id: "abc" })).toBe("db:abc");
  });
});

describe("recentToFood", () => {
  it("gives a db food the db source and its id, name, per100 and portions", () => {
    const portions = [{ label: "1 egg", grams: 50, isDefault: true }];
    const recent = row("a", { portions });
    expect(recentToFood(recent)).toStrictEqual({
      id: "a",
      name: "Food a",
      per100: recent.per100,
      portions,
      source: "db",
    });
  });

  it("gives a custom food the custom source", () => {
    const food = recentToFood(row("a", { food: { kind: "custom", id: "a" } }));
    expect(food.source).toBe("custom");
    expect(food.id).toBe("a");
  });

  it("keeps a barcode on the FoodRef", () => {
    const recent = row("a", { food: { kind: "db", id: "a", barcode: "123" } });
    expect(recentToFood(recent).barcode).toBe("123");
  });

  it("gives [] for a row with no portions", () => {
    const recent = row("a");
    delete recent.portions;
    expect(recentToFood(recent).portions).toEqual([]);
  });
});

describe("touchRecent", () => {
  it("gives one row on an empty list", () => {
    const item = row("a");
    expect(touchRecent([], item)).toEqual([item]);
  });

  it("moves an existing food to the front with the new row's values", () => {
    const list = [row("a"), row("b"), row("c")];
    const snapshot = structuredClone(list);
    const item = row("c", { lastGrams: 250, lastAt: 2000 });

    const result = touchRecent(list, item);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(item);
    expect(result.map((r) => r.food.id)).toEqual(["c", "a", "b"]);
    expect(list).toEqual(snapshot);
    expect(result).not.toBe(list);
  });

  it("keeps rows with the same id and a different kind separate", () => {
    const custom = row("a", { food: { kind: "custom", id: "a" } });
    const result = touchRecent([custom], row("a"));
    expect(result.map((r) => recentKey(r.food))).toEqual(["db:a", "custom:a"]);
  });

  it("replaces the row with the same kind and id when the FoodRef has a barcode", () => {
    const scanned = row("a", { food: { kind: "db", id: "a", barcode: "123" } });
    const result = touchRecent([row("b"), row("a")], scanned);
    expect(result).toEqual([scanned, row("b")]);
  });

  it("drops the oldest row when a new food is added to a full list", () => {
    const list = fullList();
    const item = row("new");

    const result = touchRecent(list, item);

    expect(result).toHaveLength(RECENT_MAX);
    expect(result[0]).toEqual(item);
    expect(result.map((r) => r.food.id)).not.toContain(`food${RECENT_MAX - 1}`);
  });

  it("loses no other row when a listed food is touched on a full list", () => {
    const list = fullList();
    const item = row("food25", { lastAt: 2000 });

    const result = touchRecent(list, item);

    expect(result).toHaveLength(RECENT_MAX);
    expect(result[0]).toEqual(item);
    expect(new Set(result.map((r) => r.food.id))).toEqual(
      new Set(list.map((r) => r.food.id)),
    );
  });
});
