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
  return { ...e, name: toName(e.name), createdAt: toCreatedAt(e.createdAt) };
};

export const normalizeTarget = (t) =>
  isObject(t) && validateTarget(t).length === 0 ? { ...t } : null;

export const normalizeCustomFood = (c) => {
  if (!isObject(c) || !hasId(c.id)) return null;
  if (typeof c.name !== "string" || c.name === "") return null;
  if (!validPer100(c.per100)) return null;
  return { ...c, createdAt: toCreatedAt(c.createdAt) };
};

const validMealItem = (item) =>
  isObject(item) && validGrams(item.grams) && validPer100(item.per100);

export const normalizeSavedMeal = (m) => {
  if (!isObject(m) || !hasId(m.id) || !Array.isArray(m.items)) return null;
  const items = m.items
    .filter(validMealItem)
    .map((item) => ({ ...item, name: toName(item.name) }));
  if (items.length === 0) return null;
  return {
    ...m,
    name: toName(m.name),
    items,
    createdAt: toCreatedAt(m.createdAt),
  };
};

export const normalizeRecent = (r) => {
  if (!isObject(r) || !isObject(r.food)) return null;
  if (!FOOD_KINDS.includes(r.food.kind) || !hasId(r.food.id)) return null;
  if (!Number.isFinite(r.lastAt) || !validPer100(r.per100)) return null;
  if (!validGrams(r.lastGrams)) return null;
  return { ...r, name: toName(r.name) };
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

const byId = (row) => row.id;
const byFrom = (row) => row.from;

/** Unique by `from`, first row wins, ascending by `from`. */
const uniqueTargets = (rows) =>
  firstByKey(rows, byFrom).sort((a, b) =>
    a.from < b.from ? -1 : a.from > b.from ? 1 : 0,
  );

/**
 * Unique by food, newer `lastAt` wins and the earlier row wins a tie; newest
 * first, capped at RECENT_MAX.
 */
const uniqueRecent = (rows) => {
  const byKey = new Map();
  for (const row of rows) {
    const key = recentKey(row.food);
    const seen = byKey.get(key);
    if (!seen || row.lastAt > seen.lastAt) byKey.set(key, row);
  }
  return [...byKey.values()]
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, RECENT_MAX);
};

const normalizeList = (list, normalizeRow) =>
  Array.isArray(list) ? list.map(normalizeRow).filter(Boolean) : [];

/** The five food lists from untrusted input, each valid and free of duplicates. Never throws. */
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
  };
};

/** Union of two normalised data sets. Existing rows win; recent keeps the newer `lastAt`. */
export const mergeFoodData = (current, incoming) => ({
  entries: firstByKey([...current.entries, ...incoming.entries], byId),
  targets: uniqueTargets([...current.targets, ...incoming.targets]),
  customFoods: firstByKey(
    [...current.customFoods, ...incoming.customFoods],
    byId,
  ),
  savedMeals: firstByKey([...current.savedMeals, ...incoming.savedMeals], byId),
  recent: uniqueRecent([...current.recent, ...incoming.recent]),
});
