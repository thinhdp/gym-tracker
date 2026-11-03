import {
  ZERO_MACROS,
  barTone,
  entryMacros,
  kcalFromMacros,
  pct,
  round1,
  scaleMacros,
  sumMacros,
} from "./macros";

describe("ZERO_MACROS", () => {
  it("is zero for every field", () => {
    expect(ZERO_MACROS).toEqual({ kcal: 0, protein: 0, carb: 0, fat: 0 });
  });
});

describe("round1", () => {
  it("rounds to one decimal place", () => {
    expect(round1(1.25)).toBe(1.3);
    expect(round1(1.24)).toBe(1.2);
    expect(round1(0.1 + 0.2)).toBe(0.3);
    expect(round1(7)).toBe(7);
  });
});

describe("scaleMacros", () => {
  it("scales per-100 values by grams, kcal to an integer and macros to 1 dp", () => {
    expect(
      scaleMacros({ kcal: 165, protein: 31, carb: 0, fat: 3.6 }, 150),
    ).toEqual({ kcal: 248, protein: 46.5, carb: 0, fat: 5.4 });
  });

  it("rounds protein, carb and fat to 1 dp when the scaled value has more", () => {
    expect(
      scaleMacros({ kcal: 0, protein: 1.1, carb: 2.2, fat: 3.3 }, 33.3),
    ).toEqual({ kcal: 0, protein: 0.4, carb: 0.7, fat: 1.1 });
  });
});

describe("entryMacros", () => {
  it("matches scaleMacros on the entry's per100 and grams", () => {
    const per100 = { kcal: 165, protein: 31, carb: 0, fat: 3.6 };
    expect(entryMacros({ per100, grams: 150 })).toEqual(
      scaleMacros(per100, 150),
    );
  });
});

describe("sumMacros", () => {
  const entry = (per100, grams) => ({ per100, grams });

  it("gives zero for no entries, as a new object", () => {
    expect(sumMacros([])).toEqual(ZERO_MACROS);
    expect(sumMacros([])).not.toBe(ZERO_MACROS);
  });

  it("adds two entries", () => {
    expect(
      sumMacros([
        entry({ kcal: 165, protein: 31, carb: 0, fat: 3.6 }, 150),
        entry({ kcal: 100, protein: 10, carb: 20, fat: 5 }, 100),
      ]),
    ).toEqual({ kcal: 348, protein: 56.5, carb: 20, fat: 10.4 });
  });

  it("adds the rounded entry values, so visible rows add up to the total", () => {
    const halfKcal = entry({ kcal: 50, protein: 0, carb: 0, fat: 0 }, 1);
    expect(sumMacros([halfKcal, halfKcal]).kcal).toBe(2);
  });

  it("adds the rounded protein, carb and fat of each entry", () => {
    const quarter = entry(
      { kcal: 0, protein: 0.25, carb: 0.25, fat: 0.25 },
      100,
    );
    expect(sumMacros([quarter, quarter])).toEqual({
      kcal: 0,
      protein: 0.6,
      carb: 0.6,
      fat: 0.6,
    });
  });

  it("removes float noise from the macro totals", () => {
    expect(
      sumMacros([
        entry({ kcal: 0, protein: 0.1, carb: 0.1, fat: 0.1 }, 100),
        entry({ kcal: 0, protein: 0.2, carb: 0.2, fat: 0.2 }, 100),
      ]),
    ).toEqual({ kcal: 0, protein: 0.3, carb: 0.3, fat: 0.3 });
  });
});

describe("kcalFromMacros", () => {
  it("uses 4P + 4C + 9F", () => {
    expect(kcalFromMacros({ protein: 10, carb: 10, fat: 10 })).toBe(170);
  });

  it("rounds to an integer", () => {
    expect(kcalFromMacros({ protein: 1.1, carb: 0, fat: 0 })).toBe(4);
  });
});

describe("pct", () => {
  it("returns value / target", () => {
    expect(pct(50, 200)).toBe(0.25);
  });

  it("returns null without a target", () => {
    expect(pct(50, 0)).toBeNull();
    expect(pct(50, null)).toBeNull();
  });
});

describe("barTone", () => {
  it("is ok below 90 %, warn up to 100 %, over past 100 %", () => {
    expect(barTone(0.89)).toBe("ok");
    expect(barTone(0.9)).toBe("warn");
    expect(barTone(1)).toBe("warn");
    expect(barTone(1.01)).toBe("over");
  });
});
