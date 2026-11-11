import {
  mergeFoodData,
  normalizeCompletedDays,
  normalizeCustomFood,
  normalizeEntry,
  normalizeFoodData,
  normalizeRecent,
  normalizeSavedMeal,
  normalizeTarget,
} from "./normalize";
import { RECENT_MAX } from "./recent";

const per100 = { kcal: 100, protein: 10, carb: 10, fat: 1 };

const entry = (overrides = {}) => ({
  id: "e1",
  date: "2026-03-01",
  slot: "lunch",
  name: "Egg",
  grams: 50,
  per100,
  food: { kind: "db", id: "egg" },
  createdAt: 1000,
  ...overrides,
});

const target = (overrides = {}) => ({
  from: "2026-03-01",
  kcal: 2000,
  protein: 150,
  carb: 200,
  fat: 60,
  ...overrides,
});

const custom = (overrides = {}) => ({
  id: "c1",
  name: "Bar",
  per100,
  createdAt: 1000,
  ...overrides,
});

const item = (overrides = {}) => ({
  name: "Egg",
  grams: 50,
  per100,
  food: { kind: "db", id: "egg" },
  ...overrides,
});

const meal = (overrides = {}) => ({
  id: "m1",
  name: "Breakfast",
  items: [item()],
  createdAt: 1000,
  ...overrides,
});

const recent = (id, overrides = {}) => ({
  food: { kind: "db", id },
  name: `Food ${id}`,
  per100,
  portions: [],
  lastGrams: 100,
  lastAt: 1000,
  ...overrides,
});

/** Parsed JSON that String() throws on. */
const unprintable = () => JSON.parse('{"toString":null}');

/** Values that are not a valid FoodRef. */
const BAD_FOOD_REFS = [
  ["missing", undefined],
  ["null", null],
  ["a string", "egg"],
  ["an array", []],
  ["without a kind", { id: "egg" }],
  ["of an unknown kind", { kind: "api", id: "egg" }],
  ["without an id", { kind: "db" }],
  ["with a numeric id", { kind: "db", id: 7 }],
  ["with an empty id", { kind: "db", id: "" }],
];

/** Values that are not a string, for optional string fields. */
const NON_STRINGS = [
  ["a number", 42],
  ["null", null],
  ["a boolean", true],
  ["an object", { a: 1 }],
  ["an array", ["x"]],
];

/** Values that are not a plain object. */
const NON_OBJECTS = [
  ["null", null],
  ["undefined", undefined],
  ["a string", "row"],
  ["a number", 7],
  ["an array", []],
];

const NON_ARRAYS = [
  ["a string", "nope"],
  ["a number", 7],
  ["null", null],
  ["an object", { label: "1 cup", grams: 240 }],
];

/** Mixed portion rows, and the ones that must survive. */
const goodPortions = [
  { label: "1 cup", grams: 240, isDefault: true },
  { label: "", grams: 0.5 },
];
const mixedPortions = [
  goodPortions[0],
  null,
  "1 cup",
  ["1 cup", 240],
  { grams: 240 },
  { label: 7, grams: 240 },
  { label: "1 cup" },
  { label: "1 cup", grams: 0 },
  { label: "1 cup", grams: -5 },
  { label: "1 cup", grams: "240" },
  { label: "1 cup", grams: Infinity },
  { label: "1 cup", grams: NaN },
  goodPortions[1],
];

const emptyData = () => ({
  entries: [],
  targets: [],
  customFoods: [],
  savedMeals: [],
  recent: [],
  completedDays: [],
});

describe("normalizeEntry", () => {
  it("drops entries with bad date, unknown slot, non-positive grams or non-numeric per100 and keeps valid ones", () => {
    const valid = entry();
    expect(normalizeEntry(valid)).toEqual(valid);
    expect(normalizeEntry(entry({ date: "03/01/2026" }))).toBeNull();
    expect(normalizeEntry(entry({ date: 20260301 }))).toBeNull();
    expect(normalizeEntry(entry({ date: ["2026-03-01"] }))).toBeNull();
    expect(normalizeEntry(entry({ slot: "brunch" }))).toBeNull();
    expect(normalizeEntry(entry({ grams: 0 }))).toBeNull();
    expect(normalizeEntry(entry({ grams: -5 }))).toBeNull();
    expect(normalizeEntry(entry({ grams: "50" }))).toBeNull();
    expect(normalizeEntry(entry({ grams: Infinity }))).toBeNull();
    expect(normalizeEntry(entry({ per100: undefined }))).toBeNull();
    expect(normalizeEntry(entry({ per100: null }))).toBeNull();
    expect(
      normalizeEntry(entry({ per100: { ...per100, kcal: "100" } })),
    ).toBeNull();
    expect(
      normalizeEntry(entry({ per100: { ...per100, fat: Infinity } })),
    ).toBeNull();
  });

  it.each(["10", null, undefined])(
    "drops a per100 protein of %j",
    (protein) => {
      expect(
        normalizeEntry(entry({ per100: { ...per100, protein } })),
      ).toBeNull();
    },
  );

  it("drops a real date that is not zero-padded YYYY-MM-DD", () => {
    expect(normalizeEntry(entry({ date: "2026-3-1" }))).toBeNull();
  });

  it("drops an impossible calendar date", () => {
    expect(normalizeEntry(entry({ date: "2026-02-31" }))).toBeNull();
    expect(normalizeEntry(entry({ date: "2026-13-01" }))).toBeNull();
  });

  it("drops a row with a missing, non-string or empty id instead of giving it a new id", () => {
    expect(normalizeEntry(entry({ id: undefined }))).toBeNull();
    expect(normalizeEntry(entry({ id: 7 }))).toBeNull();
    expect(normalizeEntry(entry({ id: "" }))).toBeNull();
  });

  it("coerces name to a string and createdAt to a number or now", () => {
    vi.spyOn(Date, "now").mockReturnValue(5555);
    try {
      expect(normalizeEntry(entry({ name: 42 })).name).toBe("42");
      expect(normalizeEntry(entry({ name: undefined })).name).toBe("");
      expect(normalizeEntry(entry({ name: unprintable() })).name).toBe("");
      expect(normalizeEntry(entry({ name: { a: 1 } })).name).toBe("");
      expect(normalizeEntry(entry({ name: true })).name).toBe("true");
      expect(normalizeEntry(entry({ name: false })).name).toBe("false");
      expect(normalizeEntry(entry({ createdAt: "1234" })).createdAt).toBe(1234);
      expect(normalizeEntry(entry({ createdAt: "soon" })).createdAt).toBe(5555);
      expect(normalizeEntry(entry({ createdAt: null })).createdAt).toBe(5555);
      expect(normalizeEntry(entry({ createdAt: "" })).createdAt).toBe(5555);
      expect(normalizeEntry(entry({ createdAt: "   " })).createdAt).toBe(5555);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("keeps a string portionLabel and every valid kind of FoodRef", () => {
    expect(
      normalizeEntry(entry({ portionLabel: "1 large egg" })).portionLabel,
    ).toBe("1 large egg");
    const scanned = { kind: "custom", id: "c1", barcode: "123" };
    expect(normalizeEntry(entry({ food: scanned })).food).toEqual(scanned);
  });

  it.each(BAD_FOOD_REFS)("returns null for a food %s", (_label, food) => {
    expect(normalizeEntry(entry({ food }))).toBeNull();
  });

  it.each(NON_STRINGS)(
    "removes a portionLabel that is %s and keeps the row",
    (_label, portionLabel) => {
      const input = entry({ portionLabel });
      const result = normalizeEntry(input);
      expect(result).not.toHaveProperty("portionLabel");
      expect(result).toEqual(entry());
      expect(input.portionLabel).toEqual(portionLabel);
    },
  );

  it("does not add a portionLabel key when the row has none", () => {
    expect(normalizeEntry(entry())).not.toHaveProperty("portionLabel");
  });

  it.each(NON_OBJECTS)("returns null for %s", (_label, bad) => {
    expect(normalizeEntry(bad)).toBeNull();
  });

  it.each(NON_STRINGS)(
    "removes a food barcode that is %s and keeps the row",
    (_label, barcode) => {
      const food = { kind: "db", id: "egg", barcode };
      const result = normalizeEntry(entry({ food }));
      expect(result).toEqual(entry());
      expect(result.food).not.toHaveProperty("barcode");
      expect(food.barcode).toEqual(barcode);
    },
  );
});

describe("normalizeTarget", () => {
  it("keeps a row that passes validateTarget and drops one that fails it", () => {
    expect(normalizeTarget(target())).toEqual(target());
    expect(normalizeTarget(target({ kcal: 0 }))).toBeNull();
    expect(normalizeTarget(target({ protein: -1 }))).toBeNull();
    expect(normalizeTarget(target({ from: "2026-02-31" }))).toBeNull();
    expect(normalizeTarget(null)).toBeNull();
  });

  it("keeps extra fields", () => {
    expect(normalizeTarget(target({ note: "cut" }))).toEqual(
      target({ note: "cut" }),
    );
  });

  it("does not check a barcode on a target", () => {
    expect(normalizeTarget(target({ barcode: 42 })).barcode).toBe(42);
  });
});

describe("normalizeCustomFood", () => {
  it("requires a string id, a non-empty string name and numeric per100", () => {
    expect(normalizeCustomFood(custom())).toEqual(custom());
    expect(normalizeCustomFood(custom({ id: 7 }))).toBeNull();
    expect(normalizeCustomFood(custom({ id: "" }))).toBeNull();
    expect(normalizeCustomFood(custom({ name: "" }))).toBeNull();
    expect(normalizeCustomFood(custom({ name: 42 }))).toBeNull();
    expect(
      normalizeCustomFood(custom({ per100: { ...per100, carb: "1" } })),
    ).toBeNull();
    expect(normalizeCustomFood(null)).toBeNull();
  });

  it("keeps optional fields and coerces createdAt", () => {
    vi.spyOn(Date, "now").mockReturnValue(5555);
    try {
      const portions = [{ label: "1 serving", grams: 45 }];
      const result = normalizeCustomFood(
        custom({ barcode: "123", portions, createdAt: undefined }),
      );
      expect(result.barcode).toBe("123");
      expect(result.portions).toEqual(portions);
      expect(result.createdAt).toBe(5555);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it.each(NON_STRINGS)(
    "removes a barcode that is %s and keeps the row",
    (_label, barcode) => {
      const input = custom({ barcode });
      const result = normalizeCustomFood(input);
      expect(result).not.toHaveProperty("barcode");
      expect(result).toEqual(custom());
      expect(input.barcode).toEqual(barcode);
    },
  );

  it.each(NON_ARRAYS)(
    "removes portions that are %s and keeps the row",
    (_label, portions) => {
      const input = custom({ portions });
      const result = normalizeCustomFood(input);
      expect(result).not.toHaveProperty("portions");
      expect(result).toEqual(custom());
      expect(input.portions).toEqual(portions);
    },
  );

  it("keeps only valid portion rows and does not change the input list", () => {
    const portions = [...mixedPortions];
    const result = normalizeCustomFood(custom({ portions }));
    expect(result.portions).toEqual(goodPortions);
    expect(portions).toEqual(mixedPortions);
  });

  it("keeps an empty portions list and adds no key for absent optional fields", () => {
    expect(normalizeCustomFood(custom({ portions: [] })).portions).toEqual([]);
    const result = normalizeCustomFood(custom());
    expect(result).not.toHaveProperty("barcode");
    expect(result).not.toHaveProperty("portions");
  });
});

describe("normalizeSavedMeal", () => {
  it("drops invalid items and keeps the valid ones with their fields", () => {
    const good = item({ portionLabel: "1 large egg" });
    const result = normalizeSavedMeal(
      meal({
        items: [
          good,
          item({ grams: 0 }),
          item({ per100: { ...per100, kcal: "1" } }),
          null,
        ],
      }),
    );
    expect(result.items).toEqual([good]);
  });

  it.each(BAD_FOOD_REFS)("drops an item with a food %s", (_label, food) => {
    const result = normalizeSavedMeal(
      meal({ items: [item({ food }), item()] }),
    );
    expect(result.items).toEqual([item()]);
  });

  it.each(BAD_FOOD_REFS)(
    "returns null when the only item has a food %s",
    (_label, food) => {
      expect(normalizeSavedMeal(meal({ items: [item({ food })] }))).toBeNull();
    },
  );

  it.each(NON_STRINGS)(
    "removes an item portionLabel that is %s and keeps the item",
    (_label, portionLabel) => {
      const input = item({ portionLabel });
      const result = normalizeSavedMeal(meal({ items: [input] }));
      expect(result.items[0]).not.toHaveProperty("portionLabel");
      expect(result.items).toEqual([item()]);
      expect(input.portionLabel).toEqual(portionLabel);
    },
  );

  it("does not add a portionLabel key to an item that has none", () => {
    const result = normalizeSavedMeal(meal());
    expect(result.items[0]).not.toHaveProperty("portionLabel");
  });

  it("does not check a barcode on the meal itself", () => {
    expect(normalizeSavedMeal(meal({ barcode: 42 })).barcode).toBe(42);
  });

  it.each(NON_STRINGS)(
    "removes an item food barcode that is %s and keeps the item",
    (_label, barcode) => {
      const food = { kind: "db", id: "egg", barcode };
      const result = normalizeSavedMeal(meal({ items: [item({ food })] }));
      expect(result.items).toEqual([item()]);
      expect(result.items[0].food).not.toHaveProperty("barcode");
      expect(food.barcode).toEqual(barcode);
    },
  );

  it("returns null when no item survives or items is not a list", () => {
    expect(
      normalizeSavedMeal(meal({ items: [item({ grams: 0 })] })),
    ).toBeNull();
    expect(normalizeSavedMeal(meal({ items: [] }))).toBeNull();
    expect(normalizeSavedMeal(meal({ items: "nope" }))).toBeNull();
    expect(normalizeSavedMeal(null)).toBeNull();
  });

  it("requires a string id, coerces name and coerces createdAt", () => {
    vi.spyOn(Date, "now").mockReturnValue(5555);
    try {
      expect(normalizeSavedMeal(meal({ id: undefined }))).toBeNull();
      expect(normalizeSavedMeal(meal({ id: 7 }))).toBeNull();
      expect(normalizeSavedMeal(meal({ id: "" }))).toBeNull();
      const result = normalizeSavedMeal(
        meal({ name: 42, createdAt: undefined }),
      );
      expect(result.name).toBe("42");
      expect(result.createdAt).toBe(5555);
      expect(normalizeSavedMeal(meal({ name: unprintable() })).name).toBe("");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("coerces an item name to a string and keeps the item", () => {
    const names = [42, undefined, { a: 1 }, unprintable()].map(
      (name) =>
        normalizeSavedMeal(meal({ items: [item({ name })] })).items[0].name,
    );
    expect(names).toEqual(["42", "", "", ""]);
  });
});

describe("normalizeRecent", () => {
  it("keeps a valid row with its optional fields", () => {
    const row = recent("a", {
      lastPortionLabel: "1 cup",
      food: { kind: "custom", id: "a", barcode: "123" },
    });
    expect(normalizeRecent(row)).toEqual(row);
  });

  it.each(BAD_FOOD_REFS)("returns null for a food %s", (_label, food) => {
    expect(normalizeRecent(recent("a", { food }))).toBeNull();
  });

  it.each(NON_STRINGS)(
    "removes a food barcode that is %s and keeps the row",
    (_label, barcode) => {
      const food = { kind: "db", id: "a", barcode };
      const result = normalizeRecent(recent("a", { food }));
      expect(result).toEqual(recent("a"));
      expect(result.food).not.toHaveProperty("barcode");
      expect(food.barcode).toEqual(barcode);
    },
  );

  it("returns null for a bad lastAt or per100", () => {
    expect(normalizeRecent(recent("a", { lastAt: "1000" }))).toBeNull();
    expect(normalizeRecent(recent("a", { lastAt: NaN }))).toBeNull();
    expect(
      normalizeRecent(recent("a", { per100: { ...per100, fat: null } })),
    ).toBeNull();
    expect(normalizeRecent(null)).toBeNull();
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["zero", 0],
    ["negative", -5],
    ["a numeric string", "100"],
    ["NaN", NaN],
    ["Infinity", Infinity],
  ])("returns null for a lastGrams that is %s", (_label, lastGrams) => {
    expect(normalizeRecent(recent("a", { lastGrams }))).toBeNull();
  });

  it.each(NON_STRINGS)(
    "removes a lastPortionLabel that is %s and keeps the row",
    (_label, lastPortionLabel) => {
      const input = recent("a", { lastPortionLabel });
      const result = normalizeRecent(input);
      expect(result).not.toHaveProperty("lastPortionLabel");
      expect(result).toEqual(recent("a"));
      expect(input.lastPortionLabel).toEqual(lastPortionLabel);
    },
  );

  it.each(NON_ARRAYS)(
    "removes portions that are %s and keeps the row",
    (_label, portions) => {
      const input = recent("a", { portions });
      const result = normalizeRecent(input);
      expect(result).not.toHaveProperty("portions");
      expect(result.food).toEqual(input.food);
      expect(input.portions).toEqual(portions);
    },
  );

  it("keeps only valid portion rows and does not change the input list", () => {
    const portions = [...mixedPortions];
    const result = normalizeRecent(recent("a", { portions }));
    expect(result.portions).toEqual(goodPortions);
    expect(portions).toEqual(mixedPortions);
  });

  it("adds no key for absent optional fields", () => {
    const row = recent("a");
    delete row.portions;
    const result = normalizeRecent(row);
    expect(result).not.toHaveProperty("portions");
    expect(result).not.toHaveProperty("lastPortionLabel");
  });

  it("coerces name to a string and keeps the row", () => {
    const names = [42, undefined, { a: 1 }, unprintable()].map(
      (name) => normalizeRecent(recent("a", { name })).name,
    );
    expect(names).toEqual(["42", "", "", ""]);
  });
});

describe("normalizeFoodData", () => {
  it.each(NON_OBJECTS)("gives six empty lists for %s", (_label, bad) => {
    expect(normalizeFoodData(bad)).toEqual(emptyData());
  });

  it("gives [] for missing and non-array lists", () => {
    expect(
      normalizeFoodData({ entries: "x", targets: 7, customFoods: {} }),
    ).toEqual(emptyData());
  });

  it("does not throw on null rows inside a list and drops them", () => {
    const result = normalizeFoodData({
      entries: [null, entry(), undefined, "x"],
      targets: [null, target()],
      customFoods: [null, custom()],
      savedMeals: [null, meal()],
      recent: [null, recent("a")],
    });
    expect(result).toEqual({
      entries: [entry()],
      targets: [target()],
      customFoods: [custom()],
      savedMeals: [meal()],
      recent: [recent("a")],
      completedDays: [],
    });
  });

  it("does not throw on a name that String() cannot convert", () => {
    const name = unprintable();
    const result = normalizeFoodData({
      entries: [entry({ name })],
      savedMeals: [meal({ name, items: [item({ name })] })],
      recent: [recent("a", { name })],
    });
    expect(result.entries.map((r) => r.name)).toEqual([""]);
    expect(result.savedMeals.map((r) => r.name)).toEqual([""]);
    expect(result.savedMeals[0].items.map((r) => r.name)).toEqual([""]);
    expect(result.recent.map((r) => r.name)).toEqual([""]);
  });

  it("keeps the first row of a duplicate in entries, customFoods, savedMeals and targets", () => {
    const result = normalizeFoodData({
      entries: [entry({ grams: 1 }), entry({ grams: 2 })],
      customFoods: [custom({ name: "First" }), custom({ name: "Second" })],
      savedMeals: [meal({ name: "First" }), meal({ name: "Second" })],
      targets: [target({ kcal: 1000 }), target({ kcal: 2000 })],
    });
    expect(result.entries.map((r) => r.grams)).toEqual([1]);
    expect(result.customFoods.map((r) => r.name)).toEqual(["First"]);
    expect(result.savedMeals.map((r) => r.name)).toEqual(["First"]);
    expect(result.targets.map((r) => r.kcal)).toEqual([1000]);
  });

  it("does not let an invalid first row shadow a valid duplicate", () => {
    const result = normalizeFoodData({
      entries: [entry({ grams: 0 }), entry({ grams: 2 })],
    });
    expect(result.entries.map((r) => r.grams)).toEqual([2]);
  });

  it("sorts targets ascending by from", () => {
    const result = normalizeFoodData({
      targets: [
        target({ from: "2026-05-01" }),
        target({ from: "2026-01-01" }),
        target({ from: "2026-03-01" }),
      ],
    });
    expect(result.targets.map((r) => r.from)).toEqual([
      "2026-01-01",
      "2026-03-01",
      "2026-05-01",
    ]);
  });

  it("keeps the newer lastAt for a duplicate recent row, sorts newest first and caps", () => {
    const dupes = normalizeFoodData({
      recent: [
        recent("a", { lastAt: 100, name: "old" }),
        recent("b", { lastAt: 200 }),
        recent("a", { lastAt: 300, name: "new" }),
      ],
    });
    expect(dupes.recent.map((r) => r.name)).toEqual(["new", "Food b"]);

    const many = Array.from({ length: RECENT_MAX + 5 }, (_, i) =>
      recent(`f${i}`, { lastAt: i }),
    );
    const capped = normalizeFoodData({ recent: many }).recent;
    expect(capped).toHaveLength(RECENT_MAX);
    expect(capped[0].lastAt).toBe(RECENT_MAX + 4);
    expect(capped[RECENT_MAX - 1].lastAt).toBe(5);
  });
});

describe("normalizeCompletedDays", () => {
  it("keeps valid dates only, drops duplicates and sorts oldest first", () => {
    expect(
      normalizeCompletedDays([
        "2026-11-05",
        "2026-11-03",
        "2026-11-05",
        "2026-02-30",
        "5 Nov",
        7,
        null,
      ]),
    ).toEqual(["2026-11-03", "2026-11-05"]);
  });

  it.each([
    ["an object", { a: 1 }],
    ["undefined", undefined],
  ])("gives [] for %s", (_label, value) => {
    expect(normalizeCompletedDays(value)).toEqual([]);
  });

  it("is used by normalizeFoodData", () => {
    expect(
      normalizeFoodData({ completedDays: ["2026-11-02", "x", "2026-11-01"] })
        .completedDays,
    ).toEqual(["2026-11-01", "2026-11-02"]);
  });
});

describe("mergeFoodData", () => {
  it("unions completedDays without duplicates, sorted", () => {
    const merged = mergeFoodData(
      { ...emptyData(), completedDays: ["2026-11-01"] },
      { ...emptyData(), completedDays: ["2026-11-02", "2026-11-01"] },
    );
    expect(merged.completedDays).toEqual(["2026-11-01", "2026-11-02"]);
  });

  it("merge keeps existing rows on id collision and unions by from for targets", () => {
    const current = {
      ...emptyData(),
      entries: [entry({ id: "same", grams: 1 })],
      customFoods: [custom({ id: "same", name: "Existing" })],
      savedMeals: [meal({ id: "same", name: "Existing" })],
      targets: [target({ from: "2026-03-01", kcal: 1111, protein: 11 })],
    };
    const incoming = {
      ...emptyData(),
      entries: [entry({ id: "same", grams: 2 }), entry({ id: "new" })],
      customFoods: [
        custom({ id: "same", name: "Incoming" }),
        custom({ id: "new" }),
      ],
      savedMeals: [meal({ id: "same", name: "Incoming" }), meal({ id: "new" })],
      targets: [
        target({ from: "2026-03-01", kcal: 2222, protein: 22 }),
        target({ from: "2026-01-01" }),
        target({ from: "2026-05-01" }),
      ],
    };

    const merged = mergeFoodData(current, incoming);

    expect(merged.entries.map((r) => [r.id, r.grams])).toEqual([
      ["same", 1],
      ["new", 50],
    ]);
    expect(merged.customFoods.map((r) => [r.id, r.name])).toEqual([
      ["same", "Existing"],
      ["new", "Bar"],
    ]);
    expect(merged.savedMeals.map((r) => [r.id, r.name])).toEqual([
      ["same", "Existing"],
      ["new", "Breakfast"],
    ]);
    expect(merged.targets.map((r) => r.from)).toEqual([
      "2026-01-01",
      "2026-03-01",
      "2026-05-01",
    ]);
    expect(merged.targets[1]).toMatchObject({ kcal: 1111, protein: 11 });
  });

  it("keeps the newer lastAt for recent in both directions", () => {
    const merged = mergeFoodData(
      {
        ...emptyData(),
        recent: [
          recent("a", { lastAt: 500, name: "existing newer" }),
          recent("b", { lastAt: 100, name: "existing older" }),
        ],
      },
      {
        ...emptyData(),
        recent: [
          recent("a", { lastAt: 200, name: "incoming older" }),
          recent("b", { lastAt: 900, name: "incoming newer" }),
        ],
      },
    );
    expect(merged.recent.map((r) => r.name)).toEqual([
      "incoming newer",
      "existing newer",
    ]);
  });

  it("lets the existing recent row win on equal lastAt", () => {
    const merged = mergeFoodData(
      { ...emptyData(), recent: [recent("a", { name: "existing" })] },
      { ...emptyData(), recent: [recent("a", { name: "incoming" })] },
    );
    expect(merged.recent.map((r) => r.name)).toEqual(["existing"]);
  });

  it("treats the same id under a different kind as a different recent food", () => {
    const merged = mergeFoodData(
      { ...emptyData(), recent: [recent("a")] },
      {
        ...emptyData(),
        recent: [recent("a", { food: { kind: "custom", id: "a" } })],
      },
    );
    expect(merged.recent).toHaveLength(2);
  });

  it("sorts merged recent newest first and caps it at RECENT_MAX", () => {
    const rows = (prefix, offset) =>
      Array.from({ length: RECENT_MAX }, (_, i) =>
        recent(`${prefix}${i}`, { lastAt: i * 2 + offset }),
      );
    const merged = mergeFoodData(
      { ...emptyData(), recent: rows("cur", 0) },
      { ...emptyData(), recent: rows("inc", 1) },
    ).recent;
    expect(merged).toHaveLength(RECENT_MAX);
    expect(merged[0].lastAt).toBe(RECENT_MAX * 2 - 1);
    expect(merged[RECENT_MAX - 1].lastAt).toBe(RECENT_MAX);
  });

  it.each([
    ["entries", (id) => entry({ id })],
    ["customFoods", (id) => custom({ id })],
    ["savedMeals", (id) => meal({ id })],
  ])(
    "keeps every current row of %s in order, then adds unmatched incoming rows",
    (list, row) => {
      const noKeyRows = [null, "text", 7, ["x"], { name: "no id" }, { id: 7 }];
      const current = [
        row("b"),
        ...noKeyRows,
        { ...row("a"), grams: 0, food: undefined },
        row("b"),
      ];
      const merged = mergeFoodData(
        { ...emptyData(), [list]: current },
        {
          ...emptyData(),
          [list]: [row("a"), row("c"), row("b"), row("d")],
        },
      );
      expect(merged[list]).toEqual([...current, row("c"), row("d")]);
    },
  );

  it("keeps every current target, sorts by from and puts rows with no string from last", () => {
    const noFrom = [null, "text", { kcal: 1 }, { from: 7 }];
    const merged = mergeFoodData(
      {
        ...emptyData(),
        targets: [
          noFrom[0],
          target({ from: "2026-05-01", kcal: 1 }),
          noFrom[1],
          target({ from: "2026-03-01", kcal: 2 }),
          noFrom[2],
          target({ from: "2026-05-01", kcal: 3 }),
          noFrom[3],
          { from: "2026-04-01", kcal: 0 },
        ],
      },
      {
        ...emptyData(),
        targets: [
          target({ from: "2026-03-01", kcal: 9 }),
          target({ from: "2026-01-01", kcal: 4 }),
        ],
      },
    );
    expect(merged.targets).toEqual([
      target({ from: "2026-01-01", kcal: 4 }),
      target({ from: "2026-03-01", kcal: 2 }),
      { from: "2026-04-01", kcal: 0 },
      target({ from: "2026-05-01", kcal: 1 }),
      target({ from: "2026-05-01", kcal: 3 }),
      ...noFrom,
    ]);
  });

  it("does not throw on a recent row with no food and puts it after the keyed rows", () => {
    const noKey = [null, { junk: true }, "text", { food: null }];
    const merged = mergeFoodData(
      {
        ...emptyData(),
        recent: [
          noKey[0],
          recent("a", { lastAt: 100 }),
          noKey[1],
          noKey[2],
          noKey[3],
        ],
      },
      { ...emptyData(), recent: [recent("b", { lastAt: 50 })] },
    );
    expect(merged.recent).toEqual([
      recent("a", { lastAt: 100 }),
      recent("b", { lastAt: 50 }),
      ...noKey,
    ]);
  });

  it("counts a recent row with no key toward the cap", () => {
    const keyed = Array.from({ length: RECENT_MAX - 1 }, (_, i) =>
      recent(`f${i}`, { lastAt: i + 1 }),
    );
    const merged = mergeFoodData(
      {
        ...emptyData(),
        recent: [{ junk: 1 }, { junk: 2 }, ...keyed],
      },
      emptyData(),
    ).recent;
    expect(merged).toHaveLength(RECENT_MAX);
    expect(merged[RECENT_MAX - 2].lastAt).toBe(1);
    expect(merged[RECENT_MAX - 1]).toEqual({ junk: 1 });
  });

  it("does not throw on a keyed recent row whose lastAt is not a number and sorts it after numeric ones", () => {
    const bad = recent("bad", { lastAt: unprintable() });
    const merged = mergeFoodData(
      { ...emptyData(), recent: [bad, recent("a", { lastAt: 100 })] },
      { ...emptyData(), recent: [recent("b", { lastAt: 200 })] },
    );
    expect(merged.recent.map((r) => r.food.id)).toEqual(["b", "a", "bad"]);
  });

  it("does not change the lists it is given", () => {
    const current = {
      ...emptyData(),
      targets: [target({ from: "2026-05-01" }), target({ from: "2026-01-01" })],
      recent: [recent("a", { lastAt: 1 }), recent("b", { lastAt: 2 })],
    };
    const before = structuredClone(current);
    mergeFoodData(current, emptyData());
    expect(current).toEqual(before);
  });
});
