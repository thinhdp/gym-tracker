import { afterEach, beforeEach, vi } from "vitest";
import {
  FOOD_API_TIMEOUT_MS,
  FoodApiError,
  combineSignals,
  isFixtureMode,
  lookupBarcode,
  normaliseQuery,
  searchFoods,
} from "./foodApi";
import { FIXTURE_FOODS } from "./foodApiFixture";
import { K_FOOD_SEARCH_CACHE } from "./keys";
import { loadLS, saveLS } from "../../lib/storage";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

const BASE = "https://api.example.test";
const food = {
  id: "f1",
  name: "chicken, breast, roasted",
  prepState: "roasted",
  source: "usda_fdc",
  isVerified: true,
  barcode: null,
  per100: { kcal: 165, protein: 31, carb: 0, fat: 3.6 },
  portions: [{ label: "1 breast", grams: 172, isDefault: true }],
};
const ok = (json) => ({ ok: true, status: 200, json: async () => json });
const status = (code, json = {}) => ({
  ok: false,
  status: code,
  json: async () => json,
});

// A fetch that never resolves on its own but rejects with the signal's reason
// when the signal aborts, like the real fetch.
const hangingFetch = () =>
  vi.fn(
    (url, init) =>
      new Promise((_, reject) => {
        const s = init.signal;
        if (s.aborted) return reject(s.reason);
        s.addEventListener("abort", () => reject(s.reason), { once: true });
      }),
  );

const kindOf = async (p) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(FoodApiError);
    expect(e.name).toBe("FoodApiError");
    return e.kind;
  }
  throw new Error("expected a rejection");
};

describe("normaliseQuery / isFixtureMode", () => {
  it("trims, lowercases and collapses whitespace", () => {
    expect(normaliseQuery("  Chicken   BREAST \t")).toBe("chicken breast");
    expect(normaliseQuery(undefined)).toBe("");
  });

  it("is fixture mode when base is empty or 'fixture'", () => {
    expect(isFixtureMode("")).toBe(true);
    expect(isFixtureMode("fixture")).toBe(true);
    expect(isFixtureMode(BASE)).toBe(false);
  });
});

describe("searchFoods", () => {
  it("GETs /v1/foods with encoded q and limit=20 and no Authorization header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ results: [food] }));
    const r = await searchFoods("  Chicken & Rice ", { fetchImpl, base: BASE });
    expect(r).toEqual([food]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${BASE}/v1/foods?q=chicken%20%26%20rice&limit=20`);
    expect(init?.headers).toBeUndefined();
    expect(JSON.stringify(init ?? {})).not.toMatch(/authorization/i);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("serves a repeat query from the cache without fetching", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ results: [food] }));
    await searchFoods("chicken", { fetchImpl, base: BASE, now: 1000 });
    const again = await searchFoods(" CHICKEN ", {
      fetchImpl,
      base: BASE,
      now: 2000,
    });
    expect(again).toEqual([food]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(loadLS(K_FOOD_SEARCH_CACHE, {})["q:chicken"]).toEqual({
      at: 1000,
      results: [food],
    });
  });

  it("resolves [] for an empty query without fetching or caching", async () => {
    const fetchImpl = vi.fn();
    expect(await searchFoods("   ", { fetchImpl, base: BASE })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(loadLS(K_FOOD_SEARCH_CACHE, null)).toBeNull();
  });

  it("treats a non-object stored cache value as empty", async () => {
    saveLS(K_FOOD_SEARCH_CACHE, "garbage");
    const fetchImpl = vi.fn().mockResolvedValue(ok({ results: [food] }));
    expect(await searchFoods("chicken", { fetchImpl, base: BASE })).toEqual([
      food,
    ]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(Object.keys(loadLS(K_FOOD_SEARCH_CACHE, {}))).toEqual(["q:chicken"]);
  });

  it("maps 429, 404, 400, 500 and a network TypeError to FoodApiError kinds", async () => {
    const run = (impl) =>
      kindOf(searchFoods(`q${Math.random()}`, { fetchImpl: impl, base: BASE }));
    expect(await run(vi.fn().mockResolvedValue(status(429)))).toBe(
      "rate_limited",
    );
    expect(await run(vi.fn().mockResolvedValue(status(404)))).toBe("not_found");
    expect(await run(vi.fn().mockResolvedValue(status(400)))).toBe("invalid");
    expect(await run(vi.fn().mockResolvedValue(status(500)))).toBe(
      "unavailable",
    );
    expect(
      await run(vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))),
    ).toBe("offline");
    expect(await run(vi.fn().mockRejectedValue(new Error("boom")))).toBe(
      "unavailable",
    );
    expect(loadLS(K_FOOD_SEARCH_CACHE, null)).toBeNull();
  });

  it("rethrows the caller's abort reason unchanged and caches nothing", async () => {
    const fetchImpl = hangingFetch();
    const ctrl = new AbortController();
    const reason = new DOMException("user typed again", "AbortError");
    const p = searchFoods("chicken", {
      fetchImpl,
      base: BASE,
      signal: ctrl.signal,
    });
    ctrl.abort(reason);
    let caught;
    try {
      await p;
    } catch (e) {
      caught = e;
    }
    expect(caught).toBe(reason);
    expect(caught).not.toBeInstanceOf(FoodApiError);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(loadLS(K_FOOD_SEARCH_CACHE, null)).toBeNull();
  });

  it("maps a timeout to unavailable", async () => {
    const fetchImpl = hangingFetch();
    expect(
      await kindOf(
        searchFoods("chicken", { fetchImpl, base: BASE, timeoutMs: 20 }),
      ),
    ).toBe("unavailable");
  });

  it("defaults the timeout to 8 s", () => {
    expect(FOOD_API_TIMEOUT_MS).toBe(8000);
  });

  it("uses the fixture when base is empty or 'fixture'", async () => {
    const r = await searchFoods("chicken", { base: "fixture" });
    expect(r[0].name).toMatch(/chicken/);
    localStorage.clear();
    const r2 = await searchFoods("banana", { base: "" });
    expect(r2[0].name).toMatch(/banana/);
  });
});

describe("lookupBarcode", () => {
  it("lookupBarcode throws not_found on 404 and caches a hit under bc:<code>", async () => {
    const miss = vi
      .fn()
      .mockResolvedValue(status(404, { error: { code: "not_found" } }));
    expect(
      await kindOf(lookupBarcode("000", { fetchImpl: miss, base: BASE })),
    ).toBe("not_found");
    expect(miss.mock.calls[0][0]).toBe(`${BASE}/v1/foods/barcode/000`);
    expect(loadLS(K_FOOD_SEARCH_CACHE, null)).toBeNull();

    const product = { ...food, source: "open_food_facts", barcode: "123" };
    const hit = vi
      .fn()
      .mockResolvedValue(ok({ requestId: "req_1", food: product }));
    expect(
      await lookupBarcode("123", { fetchImpl: hit, base: BASE, now: 50 }),
    ).toEqual(product);
    expect(hit.mock.calls[0][1]?.headers).toBeUndefined();
    expect(loadLS(K_FOOD_SEARCH_CACHE, {})["bc:123"]).toEqual({
      at: 50,
      results: [product],
    });
    expect(
      await lookupBarcode("123", { fetchImpl: hit, base: BASE, now: 60 }),
    ).toEqual(product);
    expect(hit).toHaveBeenCalledOnce();
  });

  it("applies the timeout to barcode lookups", async () => {
    const fetchImpl = hangingFetch();
    expect(
      await kindOf(
        lookupBarcode("123", { fetchImpl, base: BASE, timeoutMs: 20 }),
      ),
    ).toBe("unavailable");
  });

  it("finds the fixture product by barcode", async () => {
    const product = FIXTURE_FOODS.find((f) => f.source === "open_food_facts");
    expect(await lookupBarcode(product.barcode, { base: "fixture" })).toEqual(
      product,
    );
  });
});

describe("combineSignals", () => {
  it("aborts with a TimeoutError on timeout (AbortSignal.any path)", async () => {
    expect(typeof AbortSignal.any).toBe("function");
    const { signal, cleanup } = combineSignals(undefined, 20);
    await new Promise((r) => signal.addEventListener("abort", r));
    expect(signal.reason.name).toBe("TimeoutError");
    cleanup();
  });

  it("manual fallback aborts with a TimeoutError reason on timeout", () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const { signal, cleanup } = combineSignals(caller.signal, 20, {
      useAny: false,
    });
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(20);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBeInstanceOf(DOMException);
    expect(signal.reason.name).toBe("TimeoutError");
    cleanup();
  });

  it("manual fallback forwards a caller abort, before or after the call", () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const { signal, cleanup } = combineSignals(caller.signal, 20, {
      useAny: false,
    });
    const reason = new Error("caller");
    caller.abort(reason);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(reason);
    cleanup();

    const pre = new AbortController();
    pre.abort("early");
    const already = combineSignals(pre.signal, 20, { useAny: false });
    expect(already.signal.aborted).toBe(true);
    expect(already.signal.reason).toBe("early");
    already.cleanup();
  });

  it("manual fallback cleanup() stops the pending timer and caller listener", () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const { signal, cleanup } = combineSignals(caller.signal, 20, {
      useAny: false,
    });
    cleanup();
    vi.advanceTimersByTime(100);
    expect(signal.aborted).toBe(false);
    caller.abort();
    expect(signal.aborted).toBe(false);
  });
});

describe("fix round 1", () => {
  it("maps a 200 whose body is not JSON to unavailable and caches nothing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
    });
    expect(
      await kindOf(searchFoods("chicken", { fetchImpl, base: BASE })),
    ).toBe("unavailable");
    expect(await kindOf(lookupBarcode("123", { fetchImpl, base: BASE }))).toBe(
      "unavailable",
    );
    expect(loadLS(K_FOOD_SEARCH_CACHE, null)).toBeNull();
  });

  it("maps a 200 without a results array to unavailable and caches nothing", async () => {
    for (const body of [{}, { results: null }, { results: "x" }]) {
      const fetchImpl = vi.fn().mockResolvedValue(ok(body));
      expect(
        await kindOf(searchFoods("chicken", { fetchImpl, base: BASE })),
      ).toBe("unavailable");
    }
    expect(loadLS(K_FOOD_SEARCH_CACHE, null)).toBeNull();
  });

  it("caches a legitimate empty results array", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ results: [] }));
    expect(await searchFoods("zzz", { fetchImpl, base: BASE })).toEqual([]);
    expect(loadLS(K_FOOD_SEARCH_CACHE, {})["q:zzz"].results).toEqual([]);
  });

  it("lookupBarcode throws not_found on a 200 with no food and caches nothing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ requestId: "req_1" }));
    expect(await kindOf(lookupBarcode("123", { fetchImpl, base: BASE }))).toBe(
      "not_found",
    );
    expect(loadLS(K_FOOD_SEARCH_CACHE, null)).toBeNull();
  });

  it("stamps the cache entry after the await when now is not injected", async () => {
    vi.useFakeTimers({ now: 1000 });
    const fetchImpl = vi.fn(async () => {
      vi.setSystemTime(5000);
      return ok({ results: [food] });
    });
    await searchFoods("chicken", { fetchImpl, base: BASE });
    expect(loadLS(K_FOOD_SEARCH_CACHE, {})["q:chicken"].at).toBe(5000);
    vi.setSystemTime(6000);
    const bc = vi.fn(async () => {
      vi.setSystemTime(9000);
      return ok({ food });
    });
    await lookupBarcode("123", { fetchImpl: bc, base: BASE });
    expect(loadLS(K_FOOD_SEARCH_CACHE, {})["bc:123"].at).toBe(9000);
  });

  it("leaves no pending timer after a request on the manual signal path", async () => {
    // A 429 so nothing is written: jsdom schedules a timer for the storage
    // event on every localStorage write, which would mask the count.
    vi.useFakeTimers();
    let during = -1;
    const fetchImpl = vi.fn(async () => {
      during = vi.getTimerCount();
      return status(429);
    });
    expect(
      await kindOf(
        searchFoods("chicken", { fetchImpl, base: BASE, useAny: false }),
      ),
    ).toBe("rate_limited");
    expect(during).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    during = -1;
    expect(
      await kindOf(
        lookupBarcode("123", { fetchImpl, base: BASE, useAny: false }),
      ),
    ).toBe("rate_limited");
    expect(during).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("trims the barcode before building the URL and cache key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ food }));
    await lookupBarcode(" 123 ", { fetchImpl, base: BASE, now: 1 });
    expect(fetchImpl.mock.calls[0][0]).toBe(`${BASE}/v1/foods/barcode/123`);
    expect(Object.keys(loadLS(K_FOOD_SEARCH_CACHE, {}))).toEqual(["bc:123"]);
  });

  it("strips trailing slashes from base", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ results: [food] }));
    await searchFoods("chicken", { fetchImpl, base: "https://x/" });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://x/v1/foods?q=chicken&limit=20",
    );
    const bc = vi.fn().mockResolvedValue(ok({ food }));
    await lookupBarcode("123", { fetchImpl: bc, base: "https://x//" });
    expect(bc.mock.calls[0][0]).toBe("https://x/v1/foods/barcode/123");
  });

  it("finds a multi-word query in fixture mode", async () => {
    const r = await searchFoods("Chicken  Breast", { base: "fixture" });
    expect(r.map((f) => f.name)).toEqual(["chicken, breast, roasted"]);
  });
});
