import { createContext, useContext, useEffect, useState } from "react";
import { loadLS, saveLS, uuid } from "../../lib/storage";
import {
  K_FOOD_ENTRIES,
  K_FOOD_TARGETS,
  K_FOOD_CUSTOM,
  K_FOOD_MEALS,
  K_FOOD_RECENT,
} from "../lib/keys";
import {
  upsertTarget as upsertTargetRow,
  deleteTarget as deleteTargetRow,
} from "../lib/targets";

const FoodContext = createContext(null);

// loadLS returns any parsed JSON value, so a stored non-array needs this guard.
const loadList = (key) => {
  const stored = loadLS(key, []);
  return Array.isArray(stored) ? stored : [];
};

/**
 * Owns the food app's stored lists. Each list is loaded lazily and written back
 * on change, the same pattern as AppProvider. Rows, ids and timestamps are built
 * outside the setter updaters, because StrictMode runs updaters twice.
 */
export function FoodProvider({ children }) {
  const [entries, setEntries] = useState(() => loadList(K_FOOD_ENTRIES));
  const [targets, setTargets] = useState(() => loadList(K_FOOD_TARGETS));
  const [customFoods, setCustomFoods] = useState(() => loadList(K_FOOD_CUSTOM));
  const [savedMeals, setSavedMeals] = useState(() => loadList(K_FOOD_MEALS));
  const [recent, setRecent] = useState(() => loadList(K_FOOD_RECENT));

  useEffect(() => saveLS(K_FOOD_ENTRIES, entries), [entries]);
  useEffect(() => saveLS(K_FOOD_TARGETS, targets), [targets]);
  useEffect(() => saveLS(K_FOOD_CUSTOM, customFoods), [customFoods]);
  useEffect(() => saveLS(K_FOOD_MEALS, savedMeals), [savedMeals]);
  useEffect(() => saveLS(K_FOOD_RECENT, recent), [recent]);

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
    setEntries((prev) => [...prev, row]);
    return row;
  };

  const updateEntry = (id, patch) =>
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );

  const deleteEntry = (id) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  // Reads the last rendered entries, because it must return synchronously.
  const saveMealFromSlot = (name, date, slot) => {
    const items = entries
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
    setSavedMeals((prev) => [...prev, meal]);
    return meal;
  };

  // Reads the last rendered savedMeals, because it must return synchronously.
  const logSavedMeal = (mealId, date, slot) => {
    const meal = savedMeals.find((m) => m.id === mealId);
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
    setEntries((prev) => [...prev, ...newEntries]);
    return newEntries;
  };

  const upsertCustomFood = (food) => {
    const row = {
      ...food,
      id: food.id ?? uuid(),
      createdAt: food.createdAt ?? Date.now(),
    };
    setCustomFoods((prev) =>
      prev.some((f) => f.id === row.id)
        ? prev.map((f) => (f.id === row.id ? row : f))
        : [...prev, row],
    );
    return row;
  };

  const deleteCustomFood = (id) =>
    setCustomFoods((prev) => prev.filter((f) => f.id !== id));

  const upsertTarget = (row) =>
    setTargets((prev) => upsertTargetRow(prev, row));

  const deleteTarget = (from) =>
    setTargets((prev) => deleteTargetRow(prev, from));

  // Task 11b replaces this with the real implementation.
  const touchRecent = (_item) => setRecent((prev) => prev);

  const value = {
    entries,
    targets,
    customFoods,
    savedMeals,
    recent,
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
