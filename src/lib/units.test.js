import { toDisplayWeight, fromDisplayWeight, KG_PER_LB } from "./units";

describe("toDisplayWeight", () => {
  it("returns kg rounded to 2 decimals when unit is kg", () => {
    expect(toDisplayWeight(100, "kg")).toBe(100);
    expect(toDisplayWeight(61.236, "kg")).toBe(61.24);
    expect(toDisplayWeight(61.234, "kg")).toBe(61.23);
  });

  it("converts kg to lb rounded to 1 decimal", () => {
    expect(toDisplayWeight(100, "lb")).toBe(220.5);
    expect(toDisplayWeight(KG_PER_LB, "lb")).toBe(1);
    expect(toDisplayWeight(45.36, "lb")).toBe(100);
  });

  it("coerces null/undefined/empty to 0", () => {
    expect(toDisplayWeight(null, "kg")).toBe(0);
    expect(toDisplayWeight(undefined, "lb")).toBe(0);
    expect(toDisplayWeight("", "kg")).toBe(0);
  });
});

describe("fromDisplayWeight", () => {
  it("returns kg rounded to 2 decimals when unit is kg", () => {
    expect(fromDisplayWeight(61.236, "kg")).toBe(61.24);
  });

  it("converts lb to kg rounded to 2 decimals", () => {
    expect(fromDisplayWeight(135, "lb")).toBe(61.23);
    expect(fromDisplayWeight(1, "lb")).toBe(0.45);
  });

  it("coerces null/undefined/empty to 0", () => {
    expect(fromDisplayWeight(null, "lb")).toBe(0);
    expect(fromDisplayWeight("", "kg")).toBe(0);
  });
});

describe("round-trip invariant", () => {
  // Documented contract: storing a displayed lb value and re-displaying it
  // must give back the same number the user typed.
  it("lb → kg → lb returns the original display value", () => {
    for (const lb of [1, 2.5, 45, 100, 135, 220.5, 315, 502.5]) {
      expect(toDisplayWeight(fromDisplayWeight(lb, "lb"), "lb")).toBe(lb);
    }
  });

  it("kg → kg is stable", () => {
    for (const kg of [0, 2.5, 60, 102.34]) {
      expect(toDisplayWeight(fromDisplayWeight(kg, "kg"), "kg")).toBe(kg);
    }
  });
});
