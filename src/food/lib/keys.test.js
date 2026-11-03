import {
  K_FOOD_ENTRIES,
  K_FOOD_TARGETS,
  K_FOOD_CUSTOM,
  K_FOOD_MEALS,
  K_FOOD_RECENT,
  K_FOOD_SEARCH_CACHE,
  K_FOOD_TAB,
} from "./keys";

// A renamed key would orphan stored user data, so the strings are pinned.
describe("food localStorage keys", () => {
  it("keep their exact stored names", () => {
    expect(K_FOOD_ENTRIES).toBe("mgym.food.entries.v1");
    expect(K_FOOD_TARGETS).toBe("mgym.food.targets.v1");
    expect(K_FOOD_CUSTOM).toBe("mgym.food.customFoods.v1");
    expect(K_FOOD_MEALS).toBe("mgym.food.savedMeals.v1");
    expect(K_FOOD_RECENT).toBe("mgym.food.recent.v1");
    expect(K_FOOD_SEARCH_CACHE).toBe("mgym.food.searchCache.v1");
    expect(K_FOOD_TAB).toBe("mgym.food.tab");
  });
});
