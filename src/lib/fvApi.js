// src/lib/fvApi.js
// Thin client for the FitnessVolt Strength Standards API
// (https://fitnessvolt.com/strength-standards/developers/). Free, no auth,
// CORS-enabled. This is the app's only network dependency, so every call is
// cached in localStorage and failures degrade gracefully — the rest of the app
// stays offline-first.
//
// Attribution ("Powered by FitnessVolt Strength Standards") is required by the
// free tier and rendered in the Symmetry view.

import { loadLS, saveLS, K_FV_CACHE } from "./storage";

export const FV_BASE = "https://fitnessvolt.com/wp-json/fvss/v1";
export const FV_ATTRIBUTION_URL = "https://fitnessvolt.com/strength-standards/";

// Round to 0.5 kg so trivially different maxes/bodyweights share a cache entry
// and we don't hammer the rate-limited API (60 req/min per IP per endpoint).
const round = (n) => Math.round((Number(n) || 0) * 2) / 2;

/** Stable cache key for one percentile lookup. */
export function buildCacheKey({ lift, weight, bodyweight, sex, age, unit }) {
  return [
    lift,
    sex,
    age || "all",
    unit || "kg",
    round(weight),
    round(bodyweight),
  ].join("|");
}

function readCache() {
  const c = loadLS(K_FV_CACHE, {});
  return c && typeof c === "object" ? c : {};
}

/**
 * Look up the dual (verified + gym) percentile for one lift. Results are cached;
 * pass `{ cache: false }` to force a fresh request (still writes the cache).
 *
 * @returns {Promise<{ verified: object|null, gym: object|null }>}
 */
export async function fetchPercentile(
  { lift, weight, bodyweight, sex, age, unit = "kg" },
  { fetchImpl = fetch, cache = true } = {},
) {
  const key = buildCacheKey({ lift, weight, bodyweight, sex, age, unit });
  if (cache) {
    const hit = readCache()[key];
    if (hit) return hit;
  }

  const body = { lift, weight, bodyweight, sex, reps: 1, unit };
  if (age) body.age = age;

  const res = await fetchImpl(`${FV_BASE}/percentile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`FitnessVolt API ${res.status}`);
  }
  const json = await res.json();
  const result = { verified: json.verified || null, gym: json.gym || null };

  const all = readCache();
  all[key] = result;
  saveLS(K_FV_CACHE, all);
  return result;
}

/**
 * Resolve several percentile lookups sequentially (gentle on the rate limit).
 * Individual failures are isolated: a rejected lookup yields `{ error }` for
 * that request rather than failing the whole batch.
 *
 * @param {Array} requests - each `{ key, ...fetchPercentile args }`. `key`
 *   identifies the result in the returned map (defaults to `lift`).
 * @returns {Promise<Object>} map of request key -> result or `{ error: string }`.
 */
export async function fetchPercentiles(requests, opts = {}) {
  const out = {};
  for (const req of requests || []) {
    const { key, ...args } = req;
    const id = key ?? args.lift;
    try {
      out[id] = await fetchPercentile(args, opts);
    } catch (e) {
      out[id] = { error: e?.message || "request failed" };
    }
  }
  return out;
}
