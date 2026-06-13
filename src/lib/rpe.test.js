import {
  RPE_OPTIONS,
  RPE_MIN,
  RPE_MAX,
  MAX_FEEDBACK_LEN,
  normalizeRpe,
  normalizeFeedback,
  hasRpeFeedback,
} from "./rpe";

describe("RPE_OPTIONS", () => {
  it("runs 6 to 10 in 0.5 steps", () => {
    expect(RPE_OPTIONS[0]).toBe(RPE_MIN);
    expect(RPE_OPTIONS.at(-1)).toBe(RPE_MAX);
    expect(RPE_OPTIONS).toEqual([6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]);
  });
});

describe("normalizeRpe", () => {
  it("returns null for unset / non-numeric input", () => {
    expect(normalizeRpe(null)).toBeNull();
    expect(normalizeRpe(undefined)).toBeNull();
    expect(normalizeRpe("")).toBeNull();
    expect(normalizeRpe("abc")).toBeNull();
    expect(normalizeRpe(NaN)).toBeNull();
  });

  it("returns null for values outside 6–10", () => {
    expect(normalizeRpe(5.5)).toBeNull();
    expect(normalizeRpe(0)).toBeNull();
    expect(normalizeRpe(11)).toBeNull();
    expect(normalizeRpe(-3)).toBeNull();
  });

  it("keeps valid in-range values", () => {
    expect(normalizeRpe(6)).toBe(6);
    expect(normalizeRpe(7.5)).toBe(7.5);
    expect(normalizeRpe(10)).toBe(10);
    expect(normalizeRpe("8")).toBe(8);
  });

  it("snaps to the nearest 0.5 step", () => {
    expect(normalizeRpe(7.3)).toBe(7.5);
    expect(normalizeRpe(7.2)).toBe(7);
    expect(normalizeRpe(8.74)).toBe(8.5);
  });

  it("does not leak float artifacts", () => {
    // 9.5 / 0.5 * 0.5 can drift; result must be exactly 9.5.
    expect(normalizeRpe(9.5)).toBe(9.5);
    expect(Number.isInteger(normalizeRpe(6.25) * 10)).toBe(true);
  });
});

describe("normalizeFeedback", () => {
  it("returns '' for non-strings", () => {
    expect(normalizeFeedback(null)).toBe("");
    expect(normalizeFeedback(undefined)).toBe("");
    expect(normalizeFeedback(42)).toBe("");
  });

  it("preserves free text verbatim, including quotes and newlines", () => {
    const text = 'Felt "heavy".\nGrip slipped — drop 5kg.';
    expect(normalizeFeedback(text)).toBe(text);
  });

  it("caps length at MAX_FEEDBACK_LEN", () => {
    const long = "x".repeat(MAX_FEEDBACK_LEN + 500);
    expect(normalizeFeedback(long)).toHaveLength(MAX_FEEDBACK_LEN);
  });
});

describe("hasRpeFeedback", () => {
  it("is false when both are empty", () => {
    expect(hasRpeFeedback(null, "")).toBe(false);
    expect(hasRpeFeedback(null, "   ")).toBe(false);
  });

  it("is true when either is present", () => {
    expect(hasRpeFeedback(8, "")).toBe(true);
    expect(hasRpeFeedback(null, "tough")).toBe(true);
  });
});
