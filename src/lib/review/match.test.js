import { normalizeName, matchesAny } from "./match";

describe("normalizeName", () => {
  it("trims and lowercases", () => {
    expect(normalizeName("  Shoulder Press  ")).toBe("shoulder press");
  });
  it("handles null/undefined", () => {
    expect(normalizeName(null)).toBe("");
    expect(normalizeName(undefined)).toBe("");
  });
});

describe("matchesAny", () => {
  it("matches case-insensitively on exact normalized equality", () => {
    expect(matchesAny("Deadlift", ["deadlift", "sumo deadlift"])).toBe(true);
    expect(matchesAny("DEADLIFT", ["deadlift"])).toBe(true);
  });
  it("does not match on substring (RDL is not a deadlift)", () => {
    expect(matchesAny("Romanian Deadlift", ["deadlift"])).toBe(false);
  });
  it("is safe with empty/missing lists", () => {
    expect(matchesAny("x", undefined)).toBe(false);
    expect(matchesAny("x", [])).toBe(false);
  });
});
