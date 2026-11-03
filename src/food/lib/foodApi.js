// Client for the food API (spec §3.4, §4), modelled on src/lib/fvApi.js.
// Every call reads and writes the search cache (searchCache.js); a cache hit
// never throws. Failures throw FoodApiError with a `kind` the views map to a
// one-line note (spec §8). No Authorization header: the API protects these
// routes with per-IP rate limits and an Origin allowlist.

import { fixtureFetch } from "./foodApiFixture";
import { readSearchCache, writeSearchCache } from "./searchCache";

export const FOOD_API_BASE = import.meta.env.VITE_FOOD_API_BASE || "";
export const FOOD_API_TIMEOUT_MS = 8000;

/** True when the client should serve the offline fixture. */
export function isFixtureMode(base = FOOD_API_BASE) {
  return !base || base === "fixture";
}

/** kind: "offline" | "rate_limited" | "not_found" | "invalid" | "unavailable" */
export class FoodApiError extends Error {
  constructor(kind, message) {
    super(message || `Food API: ${kind}`);
    this.name = "FoodApiError";
    this.kind = kind;
  }
}

/** Trim, lowercase and collapse whitespace. */
export function normaliseQuery(q) {
  return String(q ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Combine the caller's `signal` (optional) with a timeout. Uses
 * `AbortSignal.any` where available; otherwise (older iOS Safari) an
 * AbortController aborted by a timer with a TimeoutError reason, or by the
 * caller's signal with the caller's reason. Always call `cleanup()` when the
 * request settles.
 *
 * @returns {{ signal: AbortSignal, cleanup: () => void }}
 */
export function combineSignals(
  signal,
  timeoutMs,
  { useAny = typeof AbortSignal.any === "function" } = {},
) {
  if (useAny) {
    const signals = [AbortSignal.timeout(timeoutMs)];
    if (signal) signals.push(signal);
    return { signal: AbortSignal.any(signals), cleanup: () => {} };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new DOMException("Request timed out", "TimeoutError")),
    timeoutMs,
  );
  const onAbort = () => ctrl.abort(signal.reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    },
  };
}

const defaultFetch = (...args) => fetch(...args);

// In fixture mode the request goes to fixtureFetch as a relative `/v1/...`
// URL, so "fixture" is never used as a URL prefix.
function resolve(base, fetchImpl) {
  const fixture = isFixtureMode(base);
  return {
    prefix: fixture ? "" : String(base).replace(/\/+$/, ""),
    impl: fetchImpl || (fixture ? fixtureFetch : defaultFetch),
  };
}

function statusError(status) {
  if (status === 429) return new FoodApiError("rate_limited");
  if (status === 404) return new FoodApiError("not_found");
  if (status === 400) return new FoodApiError("invalid");
  return new FoodApiError("unavailable", `Food API ${status}`);
}

async function getJson(url, { fetchImpl, signal, timeoutMs, useAny }) {
  const combined = combineSignals(
    signal,
    timeoutMs,
    useAny === undefined ? undefined : { useAny },
  );
  try {
    let res;
    try {
      res = await fetchImpl(url, { signal: combined.signal });
    } catch (e) {
      if (signal?.aborted) throw e;
      if (e instanceof TypeError) throw new FoodApiError("offline", e.message);
      throw new FoodApiError("unavailable", e?.message);
    }
    if (!res.ok) throw statusError(res.status);
    // A body that is not JSON (an HTML page from a wrong base URL) or a
    // timeout while reading it is "unavailable"; a caller abort is rethrown.
    try {
      return await res.json();
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new FoodApiError("unavailable", e?.message);
    }
  } finally {
    combined.cleanup();
  }
}

/** Search foods; resolves the API `results` array. Cached under `q:<query>`. */
export async function searchFoods(
  query,
  {
    fetchImpl,
    signal,
    now,
    base = FOOD_API_BASE,
    timeoutMs = FOOD_API_TIMEOUT_MS,
    useAny,
  } = {},
) {
  const q = normaliseQuery(query);
  if (!q) return [];
  const key = `q:${q}`;
  const hit = readSearchCache(key, now ?? Date.now());
  if (hit) return hit;

  const { prefix, impl } = resolve(base, fetchImpl);
  const json = await getJson(
    `${prefix}/v1/foods?q=${encodeURIComponent(q)}&limit=20`,
    { fetchImpl: impl, signal, timeoutMs, useAny },
  );
  if (!Array.isArray(json?.results)) {
    throw new FoodApiError("unavailable", "Food API: malformed results");
  }
  // Timestamp the write after the await, not at request start.
  writeSearchCache(key, json.results, now ?? Date.now());
  return json.results;
}

/** Look up one food by barcode; 404 throws FoodApiError("not_found"). */
export async function lookupBarcode(
  code,
  {
    fetchImpl,
    now,
    base = FOOD_API_BASE,
    timeoutMs = FOOD_API_TIMEOUT_MS,
    useAny,
  } = {},
) {
  const trimmed = String(code ?? "").trim();
  const key = `bc:${trimmed}`;
  const hit = readSearchCache(key, now ?? Date.now());
  if (hit && hit.length) return hit[0];

  const { prefix, impl } = resolve(base, fetchImpl);
  const json = await getJson(
    `${prefix}/v1/foods/barcode/${encodeURIComponent(trimmed)}`,
    { fetchImpl: impl, signal: undefined, timeoutMs, useAny },
  );
  if (!json?.food) throw new FoodApiError("not_found");
  writeSearchCache(key, [json.food], now ?? Date.now());
  return json.food;
}
