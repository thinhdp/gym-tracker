export const RECENT_MAX = 50;

export const recentKey = (food) => `${food.kind}:${food.id}`;

/** New list with `item` first, any row for the same food removed, capped. */
export const touchRecent = (list, item) =>
  [
    item,
    ...list.filter((r) => recentKey(r.food) !== recentKey(item.food)),
  ].slice(0, RECENT_MAX);

/** The food shape PortionSheet reads; its `source` and `id` rebuild the same FoodRef. */
export const recentToFood = (recent) => {
  const food = {
    id: recent.food.id,
    name: recent.name,
    per100: recent.per100,
    portions: recent.portions ?? [],
    source: recent.food.kind === "custom" ? "custom" : "db",
  };
  if (recent.food.barcode) food.barcode = recent.food.barcode;
  return food;
};
