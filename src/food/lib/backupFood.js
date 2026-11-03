import { loadLS, saveLS } from "../../lib/storage";
import {
  K_FOOD_CUSTOM,
  K_FOOD_ENTRIES,
  K_FOOD_MEALS,
  K_FOOD_RECENT,
  K_FOOD_TARGETS,
} from "./keys";
import { isObject, mergeFoodData, normalizeFoodData } from "./normalize";

const loadList = (key) => {
  const value = loadLS(key, []);
  return Array.isArray(value) ? value : [];
};

/** The five food lists for the backup envelope. */
export const exportFoodData = () => ({
  entries: loadList(K_FOOD_ENTRIES),
  targets: loadList(K_FOOD_TARGETS),
  customFoods: loadList(K_FOOD_CUSTOM),
  savedMeals: loadList(K_FOOD_MEALS),
  recent: loadList(K_FOOD_RECENT),
});

/**
 * Applies `raw.food` to the stored food lists. Returns false and writes nothing
 * when `raw.food` is not a plain object. `mode` "replace" overwrites each list;
 * any other mode merges into the stored rows, which are not normalised.
 */
export const importFoodData = (raw, mode) => {
  if (!isObject(raw?.food)) return false;
  const incoming = normalizeFoodData(raw.food);
  const next =
    mode === "replace" ? incoming : mergeFoodData(exportFoodData(), incoming);
  saveLS(K_FOOD_ENTRIES, next.entries);
  saveLS(K_FOOD_TARGETS, next.targets);
  saveLS(K_FOOD_CUSTOM, next.customFoods);
  saveLS(K_FOOD_MEALS, next.savedMeals);
  saveLS(K_FOOD_RECENT, next.recent);
  return true;
};
