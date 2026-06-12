import { loadLS, saveLS, uuid, todayStr } from "./storage";

describe("loadLS", () => {
  it("returns the fallback for a missing key", () => {
    expect(loadLS("missing", "fallback")).toBe("fallback");
  });

  it("returns the fallback for corrupt JSON", () => {
    localStorage.setItem("corrupt", "{not json");
    expect(loadLS("corrupt", [])).toEqual([]);
  });

  it("round-trips a value through saveLS", () => {
    const val = { a: 1, list: ["x", "y"] };
    saveLS("key", val);
    expect(loadLS("key", null)).toEqual(val);
  });
});

describe("uuid", () => {
  it("returns unique non-empty strings", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuid()));
    expect(ids.size).toBe(100);
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});

describe("todayStr", () => {
  // todayStr slices an ISO (UTC) string by design, so near local midnight it
  // can differ from the local date — assert the format only.
  it("matches YYYY-MM-DD", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
