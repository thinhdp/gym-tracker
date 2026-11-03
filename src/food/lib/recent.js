export const RECENT_MAX = 50;

export const recentKey = (food) => `${food.kind}:${food.id}`;

/** New list with `item` first, any row for the same food removed, capped. */
export const touchRecent = (list, item) =>
  [
    item,
    ...list.filter((r) => recentKey(r.food) !== recentKey(item.food)),
  ].slice(0, RECENT_MAX);
