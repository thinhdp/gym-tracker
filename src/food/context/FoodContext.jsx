import { createContext, useContext, useEffect, useRef, useState } from "react";
import { loadLS, saveLS, uuid } from "../../lib/storage";
import {
  K_FOOD_ENTRIES,
  K_FOOD_TARGETS,
  K_FOOD_CUSTOM,
  K_FOOD_MEALS,
  K_FOOD_RECENT,
} from "../lib/keys";
import { normalizeFoodData } from "../lib/normalize";
import {
  upsertTarget as upsertTargetRow,
  deleteTarget as deleteTargetRow,
} from "../lib/targets";

const FoodContext = createContext(null);

const LIST_KEYS = {
  entries: K_FOOD_ENTRIES,
  targets: K_FOOD_TARGETS,
  customFoods: K_FOOD_CUSTOM,
  savedMeals: K_FOOD_MEALS,
  recent: K_FOOD_RECENT,
};

/**
 * The five stored lists through the shared shape rules, and how many rows those
 * rules removed. loadLS returns any parsed JSON value, so a stored non-array loads
 * as [] and counts as 0.
 */
const loadLists = () => {
  const raw = {};
  for (const [name, key] of Object.entries(LIST_KEYS)) {
    raw[name] = loadLS(key, []);
  }
  const lists = normalizeFoodData(raw);
  let droppedRows = 0;
  for (const name of Object.keys(LIST_KEYS)) {
    if (Array.isArray(raw[name])) {
      droppedRows += raw[name].length - lists[name].length;
    }
  }
  return { lists, droppedRows };
};

/**
 * One stored list: starts from `initial` and is written back on change, the same
 * pattern as AppProvider. `update` applies its change to `latest` at once, so an action can
 * read the current list and return synchronously, even in the same batch as an
 * earlier action or from a function held since an earlier render.
 */
function useStoredList(key, initial) {
  const [list, setList] = useState(initial);
  const latest = useRef(list);
  useEffect(() => saveLS(key, list), [key, list]);
  const update = (change) => {
    latest.current = change(latest.current);
    setList(latest.current);
  };
  return [list, update, latest];
}

/** Owns the food app's stored lists. */
export function FoodProvider({ children }) {
  // Lazy, so storage is read at mount only. droppedRows does not change after load.
  const [{ lists, droppedRows }] = useState(loadLists);
  const [entries, updateEntries, latestEntries] = useStoredList(
    K_FOOD_ENTRIES,
    lists.entries,
  );
  const [targets, updateTargets] = useStoredList(K_FOOD_TARGETS, lists.targets);
  const [customFoods, updateCustomFoods] = useStoredList(
    K_FOOD_CUSTOM,
    lists.customFoods,
  );
  const [savedMeals, updateSavedMeals, latestSavedMeals] = useStoredList(
    K_FOOD_MEALS,
    lists.savedMeals,
  );
  const [recent, updateRecent] = useStoredList(K_FOOD_RECENT, lists.recent);

  const addEntry = ({
    date,
    slot,
    name,
    grams,
    per100,
    food,
    portionLabel,
  }) => {
    const row = {
      id: uuid(),
      date,
      slot,
      name,
      grams,
      per100,
      food,
      portionLabel,
      createdAt: Date.now(),
    };
    updateEntries((prev) => [...prev, row]);
    return row;
  };

  const updateEntry = (id, patch) =>
    updateEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );

  const deleteEntry = (id) =>
    updateEntries((prev) => prev.filter((e) => e.id !== id));

  const saveMealFromSlot = (name, date, slot) => {
    const items = latestEntries.current
      .filter((e) => e.date === date && e.slot === slot)
      .map((e) => {
        const item = {
          name: e.name,
          grams: e.grams,
          per100: e.per100,
          food: e.food,
        };
        if (e.portionLabel !== undefined) item.portionLabel = e.portionLabel;
        return item;
      });
    if (items.length === 0) return null;
    const meal = { id: uuid(), name, items, createdAt: Date.now() };
    updateSavedMeals((prev) => [...prev, meal]);
    return meal;
  };

  const logSavedMeal = (mealId, date, slot) => {
    const meal = latestSavedMeals.current.find((m) => m.id === mealId);
    if (!meal) return [];
    const newEntries = meal.items.map((item) => ({
      id: uuid(),
      date,
      slot,
      name: item.name,
      grams: item.grams,
      per100: item.per100,
      food: item.food,
      portionLabel: item.portionLabel,
      createdAt: Date.now(),
    }));
    updateEntries((prev) => [...prev, ...newEntries]);
    return newEntries;
  };

  const upsertCustomFood = (food) => {
    const row = {
      ...food,
      id: food.id ?? uuid(),
      createdAt: food.createdAt ?? Date.now(),
    };
    updateCustomFoods((prev) =>
      prev.some((f) => f.id === row.id)
        ? prev.map((f) => (f.id === row.id ? row : f))
        : [...prev, row],
    );
    return row;
  };

  const deleteCustomFood = (id) =>
    updateCustomFoods((prev) => prev.filter((f) => f.id !== id));

  const upsertTarget = (row) =>
    updateTargets((prev) => upsertTargetRow(prev, row));

  const deleteTarget = (from) =>
    updateTargets((prev) => deleteTargetRow(prev, from));

  // Task 11b replaces this with the real implementation.
  const touchRecent = (_item) => updateRecent((prev) => prev);

  const value = {
    entries,
    targets,
    customFoods,
    savedMeals,
    recent,
    droppedRows,
    addEntry,
    updateEntry,
    deleteEntry,
    logSavedMeal,
    saveMealFromSlot,
    upsertCustomFood,
    deleteCustomFood,
    upsertTarget,
    deleteTarget,
    touchRecent,
  };

  return <FoodContext.Provider value={value}>{children}</FoodContext.Provider>;
}

export function useFood() {
  return useContext(FoodContext);
}
