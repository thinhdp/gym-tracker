import { RECENT_MAX, recentKey } from "./recent";
import { SLOT_IDS } from "./slots";
import { isRealDate, validateTarget } from "./targets";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FOOD_KINDS = ["db", "custom"];

/** True for a non-null, non-array object. */
export const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasId = (id) => typeof id === "string" && id !== "";

const validGrams = (grams) => Number.isFinite(grams) && grams > 0;

const validPer100 = (per100) =>
  isObject(per100) &&
  Number.isFinite(per100.kcal) &&
  Number.isFinite(per100.protein) &&
  Number.isFinite(per100.carb) &&
  Number.isFinite(per100.fat);

/** A FoodRef needs a known `kind` and a non-empty string `id`. */
const validFoodRef = (food) =>
  isObject(food) && FOOD_KINDS.includes(food.kind) && hasId(food.id);

const validPortion = (portion) =>
  isObject(portion) &&
  typeof portion.label === "string" &&
  validGrams(portion.grams);

/** Copy of `row` without `key` when it holds a non-string. An absent key stays absent. */
const withoutNonString = (row, key) => {
  const copy = { ...row };
  if (typeof copy[key] !== "string") delete copy[key];
  return copy;
};

/**
 * Copy of `row` with only the valid portion rows, or without `portions` when it
 * holds a non-array. An absent key stays absent.
 */
const withValidPortions = (row) => {
  const copy = { ...row };
  if (Array.isArray(copy.portions)) {
    copy.portions = copy.portions.filter(validPortion);
  } else {
    delete copy.portions;
  }
  return copy;
};

/** A string as is, a number or boolean as text; anything else, objects included, is "". */
const toName = (name) => {
  if (typeof name === "string") return name;
  return typeof name === "number" || typeof name === "boolean"
    ? String(name)
    : "";
};

const toCreatedAt = (createdAt) => {
  if (Number.isFinite(createdAt)) return createdAt;
  if (typeof createdAt === "string" && createdAt.trim() !== "") {
    const parsed = Number(createdAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
};

/** Copy of a valid FoodRef without a non-string `barcode`. */
const cleanFoodRef = (food) => withoutNonString(food, "barcode");

export const normalizeEntry = (e) => {
  if (!isObject(e) || !hasId(e.id)) return null;
  if (
    typeof e.date !== "string" ||
    !DATE_RE.test(e.date) ||
    !isRealDate(e.date)
  ) {
    return null;
  }
  if (!SLOT_IDS.includes(e.slot)) return null;
  if (!validGrams(e.grams) || !validPer100(e.per100)) return null;
  if (!validFoodRef(e.food)) return null;
  return {
    ...withoutNonString(e, "portionLabel"),
    food: cleanFoodRef(e.food),
    name: toName(e.name),
    createdAt: toCreatedAt(e.createdAt),
  };
};

export const normalizeTarget = (t) =>
  isObject(t) && validateTarget(t).length === 0 ? t : null;

export const normalizeCustomFood = (c) => {
  if (!isObject(c) || !hasId(c.id)) return null;
  if (typeof c.name !== "string" || c.name === "") return null;
  if (!validPer100(c.per100)) return null;
  return {
    ...withValidPortions(withoutNonString(c, "barcode")),
    createdAt: toCreatedAt(c.createdAt),
  };
};

const validMealItem = (item) =>
  isObject(item) &&
  validGrams(item.grams) &&
  validPer100(item.per100) &&
  validFoodRef(item.food);

export const normalizeSavedMeal = (m) => {
  if (!isObject(m) || !hasId(m.id) || !Array.isArray(m.items)) return null;
  const items = m.items.filter(validMealItem).map((item) => ({
    ...withoutNonString(item, "portionLabel"),
    food: cleanFoodRef(item.food),
    name: toName(item.name),
  }));
  if (items.length === 0) return null;
  return {
    ...m,
    name: toName(m.name),
    items,
    createdAt: toCreatedAt(m.createdAt),
  };
};

export const normalizeRecent = (r) => {
  if (!isObject(r) || !validFoodRef(r.food)) return null;
  if (!Number.isFinite(r.lastAt) || !validPer100(r.per100)) return null;
  if (!validGrams(r.lastGrams)) return null;
  return {
    ...withValidPortions(withoutNonString(r, "lastPortionLabel")),
    food: cleanFoodRef(r.food),
    name: toName(r.name),
  };
};

/** First row for each key wins; order of first appearance is kept. */
const firstByKey = (rows, keyOf) => {
  const byKey = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return [...byKey.values()];
};

/** The string in `row[field]`, or undefined for a row that cannot be keyed. */
const stringField = (row, field) =>
  isObject(row) && typeof row[field] === "string" ? row[field] : undefined;

const byId = (row) => stringField(row, "id");
const byFrom = (row) => stringField(row, "from");
const byFood = (row) =>
  isObject(row) && validFoodRef(row.food) ? recentKey(row.food) : undefined;

/** New list ascending by `from`; rows with no string `from` go last in their order. */
const sortTargets = (rows) => [
  ...rows
    .filter((row) => byFrom(row) !== undefined)
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0)),
  ...rows.filter((row) => byFrom(row) === undefined),
];

/** Unique by `from`, first row wins, ascending by `from`. */
const uniqueTargets = (rows) => sortTargets(firstByKey(rows, byFrom));

/** A stored `lastAt` may be anything; one that is not a finite number counts as oldest. */
const lastAtOf = (row) =>
  Number.isFinite(row.lastAt) ? row.lastAt : -Infinity;

/**
 * Unique by food, newer `lastAt` wins and the earlier row wins a tie; newest
 * first, capped at RECENT_MAX. Every row must have a key.
 */
const uniqueRecent = (rows) => {
  const byKey = new Map();
  for (const row of rows) {
    const key = byFood(row);
    const seen = byKey.get(key);
    if (!seen || lastAtOf(row) > lastAtOf(seen)) byKey.set(key, row);
  }
  return [...byKey.values()]
    .sort((a, b) =>
      lastAtOf(a) === lastAtOf(b) ? 0 : lastAtOf(b) - lastAtOf(a),
    )
    .slice(0, RECENT_MAX);
};

const normalizeList = (list, normalizeRow) =>
  Array.isArray(list) ? list.map(normalizeRow).filter(Boolean) : [];

/** Valid local dates only, each once, sorted oldest first; a non-array gives []. */
export const normalizeCompletedDays = (value) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (d) => typeof d === "string" && DATE_RE.test(d) && isRealDate(d),
          ),
        ),
      ].sort()
    : [];

/** The six food lists from untrusted input, each valid and free of duplicates. Never throws. */
export const normalizeFoodData = (raw) => {
  const data = isObject(raw) ? raw : {};
  return {
    entries: firstByKey(normalizeList(data.entries, normalizeEntry), byId),
    targets: uniqueTargets(normalizeList(data.targets, normalizeTarget)),
    customFoods: firstByKey(
      normalizeList(data.customFoods, normalizeCustomFood),
      byId,
    ),
    savedMeals: firstByKey(
      normalizeList(data.savedMeals, normalizeSavedMeal),
      byId,
    ),
    recent: uniqueRecent(normalizeList(data.recent, normalizeRecent)),
    completedDays: normalizeCompletedDays(data.completedDays),
  };
};

/** Every current row as is, then the incoming rows whose key matches no current row. */
const unionKeepingCurrent = (current, incoming, keyOf) => {
  const taken = new Set(current.map(keyOf));
  return [
    ...current,
    ...incoming.filter((row) => {
      const key = keyOf(row);
      return key === undefined || !taken.has(key);
    }),
  ];
};

/** Keyed rows through uniqueRecent, then rows with no key in their order; capped. */
const mergeRecent = (current, incoming) => {
  const rows = [...current, ...incoming];
  return [
    ...uniqueRecent(rows.filter((row) => byFood(row) !== undefined)),
    ...rows.filter((row) => byFood(row) === undefined),
  ].slice(0, RECENT_MAX);
};

/**
 * Union of the stored lists and a normalised data set. `current` is not
 * normalised: every stored row stays unchanged, and a malformed one has no key.
 * Recent keeps the newer `lastAt` for a food and is capped. completedDays is
 * the exception: the union is normalised, so an invalid stored date drops.
 */
export const mergeFoodData = (current, incoming) => ({
  entries: unionKeepingCurrent(current.entries, incoming.entries, byId),
  targets: sortTargets(
    unionKeepingCurrent(current.targets, incoming.targets, byFrom),
  ),
  customFoods: unionKeepingCurrent(
    current.customFoods,
    incoming.customFoods,
    byId,
  ),
  savedMeals: unionKeepingCurrent(
    current.savedMeals,
    incoming.savedMeals,
    byId,
  ),
  recent: mergeRecent(current.recent, incoming.recent),
  completedDays: normalizeCompletedDays([
    ...current.completedDays,
    ...incoming.completedDays,
  ]),
});
