import { normalizeSet } from "./sets";

describe("normalizeSet", () => {
  it("numbers the set from its index and coerces weight and reps", () => {
    expect(normalizeSet({ weight: "60", reps: "8" }, 0)).toEqual({
      set: 1,
      weight: 60,
      reps: 8,
    });
  });

  it("defaults missing or unparseable fields to 0", () => {
    expect(normalizeSet({}, 2)).toEqual({ set: 3, weight: 0, reps: 0 });
    expect(normalizeSet({ weight: "abc", reps: null }, 0)).toEqual({
      set: 1,
      weight: 0,
      reps: 0,
    });
  });

  it("tolerates a null or undefined raw set", () => {
    expect(normalizeSet(null, 0)).toEqual({ set: 1, weight: 0, reps: 0 });
    expect(normalizeSet(undefined, 1)).toEqual({ set: 2, weight: 0, reps: 0 });
  });

  it("carries a positive targetReps through", () => {
    expect(normalizeSet({ weight: 60, reps: 0, targetReps: 10 }, 0)).toEqual({
      set: 1,
      weight: 60,
      reps: 0,
      targetReps: 10,
    });
  });

  it("omits targetReps when absent or non-positive", () => {
    expect(normalizeSet({ weight: 60, reps: 8 }, 0)).not.toHaveProperty(
      "targetReps",
    );
    expect(
      normalizeSet({ weight: 60, reps: 8, targetReps: 0 }, 0),
    ).not.toHaveProperty("targetReps");
  });
});
