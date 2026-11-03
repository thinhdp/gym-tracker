import { beforeEach } from "vitest";
import {
  SEARCH_CACHE_TTL_MS,
  SEARCH_CACHE_MAX,
  getCached,
  putCached,
  readSearchCache,
  writeSearchCache,
} from "./searchCache";
import { K_FOOD_SEARCH_CACHE } from "./keys";
import { loadLS, saveLS } from "../../lib/storage";

beforeEach(() => {
  localStorage.clear();
});

const results = [{ id: "a", name: "apple" }];

describe("getCached", () => {
  it("returns null for a missing or expired key and the results for a fresh one", () => {
    const now = 1_000_000;
    const map = putCached({}, "q:apple", results, now);
    expect(getCached(map, "q:missing", now)).toBeNull();
    expect(getCached(map, "q:apple", now)).toEqual(results);
    expect(getCached(map, "q:apple", now + SEARCH_CACHE_TTL_MS)).toEqual(
      results,
    );
    expect(getCached(map, "q:apple", now + SEARCH_CACHE_TTL_MS + 1)).toBeNull();
  });

  it("returns null for a malformed entry", () => {
    expect(getCached({ "q:x": "junk" }, "q:x", 0)).toBeNull();
    expect(getCached(null, "q:x", 0)).toBeNull();
  });
});

describe("putCached", () => {
  it("returns a new map and does not mutate the input", () => {
    const map = {};
    const next = putCached(map, "q:a", results, 5);
    expect(map).toEqual({});
    expect(next).toEqual({ "q:a": { at: 5, results } });
  });

  it("prunes expired entries on write", () => {
    let map = putCached({}, "q:old", results, 0);
    map = putCached(map, "q:new", results, SEARCH_CACHE_TTL_MS + 1);
    expect(Object.keys(map)).toEqual(["q:new"]);
  });

  it("drops the oldest entry past 200", () => {
    let map = {};
    for (let i = 0; i < SEARCH_CACHE_MAX; i++) {
      map = putCached(map, `q:${i}`, results, 1000 + i);
    }
    expect(Object.keys(map)).toHaveLength(SEARCH_CACHE_MAX);
    map = putCached(map, "q:extra", results, 1000 + SEARCH_CACHE_MAX);
    expect(Object.keys(map)).toHaveLength(SEARCH_CACHE_MAX);
    expect(map["q:0"]).toBeUndefined();
    expect(map["q:1"]).toBeDefined();
    expect(map["q:extra"]).toBeDefined();
  });
});

describe("readSearchCache / writeSearchCache", () => {
  it("round-trips through localStorage under K_FOOD_SEARCH_CACHE", () => {
    writeSearchCache("q:apple", results, 10);
    expect(loadLS(K_FOOD_SEARCH_CACHE, null)).toEqual({
      "q:apple": { at: 10, results },
    });
    expect(readSearchCache("q:apple", 10)).toEqual(results);
    expect(readSearchCache("q:apple", 10 + SEARCH_CACHE_TTL_MS + 1)).toBeNull();
  });

  it("treats a non-object stored value as an empty map", () => {
    saveLS(K_FOOD_SEARCH_CACHE, "garbage");
    expect(readSearchCache("q:apple", 0)).toBeNull();
    writeSearchCache("q:apple", results, 0);
    expect(loadLS(K_FOOD_SEARCH_CACHE, null)).toEqual({
      "q:apple": { at: 0, results },
    });
    saveLS(K_FOOD_SEARCH_CACHE, [1, 2]);
    expect(readSearchCache("0", 0)).toBeNull();
  });
});
