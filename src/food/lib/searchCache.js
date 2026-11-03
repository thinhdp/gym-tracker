// Network cache for food search and barcode lookups (spec §5.7). The map is
// `{ [key]: { at: epochMs, results } }` with keys `q:<normalised query>` and
// `bc:<code>`. Entries older than the TTL are ignored on read and pruned on
// write; past SEARCH_CACHE_MAX keys the oldest `at` is dropped. See
// docs/DATA-MODEL.md (`mgym.food.searchCache.v1`).

import { loadLS, saveLS } from "../../lib/storage";
import { K_FOOD_SEARCH_CACHE } from "./keys";

export const SEARCH_CACHE_TTL_MS = 7 * 86400000;
export const SEARCH_CACHE_MAX = 200;

const isEntry = (e) => !!e && typeof e === "object" && typeof e.at === "number";

const isFresh = (e, now) => isEntry(e) && now - e.at <= SEARCH_CACHE_TTL_MS;

/** Results stored under `key`, or `null` when missing, malformed or expired. */
export function getCached(map, key, now) {
  const e = map && typeof map === "object" ? map[key] : undefined;
  return isFresh(e, now) ? e.results : null;
}

/**
 * New map with `key` set to `{ at: now, results }`, pruned of expired entries,
 * then of the oldest `at` until it holds at most SEARCH_CACHE_MAX keys.
 */
export function putCached(map, key, results, now) {
  const next = {};
  for (const [k, e] of Object.entries(map || {})) {
    if (isFresh(e, now)) next[k] = e;
  }
  next[key] = { at: now, results };
  const keys = Object.keys(next);
  if (keys.length > SEARCH_CACHE_MAX) {
    keys.sort((a, b) => next[a].at - next[b].at);
    for (const k of keys.slice(0, keys.length - SEARCH_CACHE_MAX)) {
      delete next[k];
    }
  }
  return next;
}

function loadMap() {
  const c = loadLS(K_FOOD_SEARCH_CACHE, {});
  return c && typeof c === "object" && !Array.isArray(c) ? c : {};
}

/** Cached results for `key` from localStorage, or `null`. */
export function readSearchCache(key, now = Date.now()) {
  return getCached(loadMap(), key, now);
}

/** Store `results` under `key` in localStorage, pruning on write. */
export function writeSearchCache(key, results, now = Date.now()) {
  saveLS(K_FOOD_SEARCH_CACHE, putCached(loadMap(), key, results, now));
}
