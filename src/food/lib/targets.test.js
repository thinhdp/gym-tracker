import {
  deleteTarget,
  targetForDate,
  upsertTarget,
  validateTarget,
} from "./targets";

const t = [
  { from: "2026-01-01", kcal: 2000, protein: 150, carb: 200, fat: 70 },
  { from: "2026-11-01", kcal: 1800, protein: 160, carb: 150, fat: 60 },
];

describe("targetForDate", () => {
  it("returns the row with the greatest from on or before the date", () => {
    expect(targetForDate(t, "2026-10-31").kcal).toBe(2000);
    expect(targetForDate(t, "2026-11-01").kcal).toBe(1800);
    expect(targetForDate(t, "2025-12-31")).toBeNull();
  });

  it("does not assume sorted input", () => {
    const reversed = [...t].reverse();
    expect(targetForDate(reversed, "2026-11-15").kcal).toBe(1800);
    expect(targetForDate(reversed, "2026-10-31").kcal).toBe(2000);
  });

  it("returns null for an empty list", () => {
    expect(targetForDate([], "2026-11-01")).toBeNull();
  });
});

describe("upsertTarget", () => {
  const replacement = {
    from: "2026-11-01",
    kcal: 1900,
    protein: 160,
    carb: 150,
    fat: 60,
  };

  it("replaces the row with the same from", () => {
    const result = upsertTarget(t, replacement);
    expect(result).toHaveLength(2);
    expect(targetForDate(result, "2026-11-01").kcal).toBe(1900);
  });

  it("sorts a new from into place", () => {
    const row = {
      from: "2026-06-01",
      kcal: 1700,
      protein: 140,
      carb: 170,
      fat: 55,
    };
    expect(upsertTarget(t, row).map((r) => r.from)).toEqual([
      "2026-01-01",
      "2026-06-01",
      "2026-11-01",
    ]);
  });

  it("does not mutate the input", () => {
    const input = structuredClone(t);
    const result = upsertTarget(input, replacement);
    expect(input).toEqual(t);
    expect(result).not.toBe(input);
  });
});

describe("deleteTarget", () => {
  it("removes one row", () => {
    expect(deleteTarget(t, "2026-01-01")).toEqual([t[1]]);
  });

  it("deleting the only row leaves a list with no target", () => {
    const result = deleteTarget([t[0]], "2026-01-01");
    expect(result).toEqual([]);
    expect(targetForDate(result, "2026-11-01")).toBeNull();
  });
});

describe("validateTarget", () => {
  const valid = {
    from: "2026-11-01",
    kcal: 1800,
    protein: 160,
    carb: 150,
    fat: 60,
  };

  it("returns no messages for a valid row", () => {
    expect(validateTarget(valid)).toEqual([]);
  });

  it("accepts protein 0", () => {
    expect(validateTarget({ ...valid, protein: 0 })).toEqual([]);
  });

  it("rejects kcal 0", () => {
    expect(
      validateTarget({
        from: "2026-11-01",
        kcal: 0,
        protein: 1,
        carb: 1,
        fat: 1,
      }),
    ).toContain("kcal must be above 0");
  });

  it("rejects negative carb and negative fat", () => {
    expect(validateTarget({ ...valid, carb: -1 })).toEqual([
      "carb must be 0 or more",
    ]);
    expect(validateTarget({ ...valid, fat: -1 })).toEqual([
      "fat must be 0 or more",
    ]);
  });

  it("rejects negative kcal and negative protein", () => {
    expect(validateTarget({ ...valid, kcal: -5 })).toEqual([
      "kcal must be above 0",
    ]);
    expect(validateTarget({ ...valid, protein: -1 })).toEqual([
      "protein must be 0 or more",
    ]);
  });

  it.each([
    ["kcal", "kcal must be above 0"],
    ["protein", "protein must be 0 or more"],
    ["carb", "carb must be 0 or more"],
    ["fat", "fat must be 0 or more"],
  ])("rejects a non-finite or non-number %s", (field, message) => {
    for (const bad of [NaN, Infinity, -Infinity, "150", null, undefined]) {
      expect(validateTarget({ ...valid, [field]: bad })).toEqual([message]);
    }
  });

  it("rejects a from that is not a string, even if it stringifies to a date", () => {
    expect(validateTarget({ ...valid, from: ["2026-11-01"] })).toEqual([
      "from must be YYYY-MM-DD",
    ]);
  });

  it("rejects NaN, a string and a missing field", () => {
    expect(validateTarget({ ...valid, kcal: NaN })).toEqual([
      "kcal must be above 0",
    ]);
    expect(validateTarget({ ...valid, protein: "160" })).toEqual([
      "protein must be 0 or more",
    ]);
    const noFat = { ...valid };
    delete noFat.fat;
    expect(validateTarget(noFat)).toEqual(["fat must be 0 or more"]);
  });

  it("rejects a bad from", () => {
    expect(validateTarget({ ...valid, from: "2026-11-1" })).toEqual([
      "from must be YYYY-MM-DD",
    ]);
  });

  it.each(["2026-11-01 ", "2026-11-011", "2026-11-01\n"])(
    "rejects %j, a valid date with extra text after it",
    (from) => {
      expect(validateTarget({ ...valid, from })).toEqual([
        "from must be YYYY-MM-DD",
      ]);
    },
  );

  it.each([" 2026-11-01", "12026-11-01"])(
    "rejects %j, a valid date with extra text before it",
    (from) => {
      expect(validateTarget({ ...valid, from })).toEqual([
        "from must be YYYY-MM-DD",
      ]);
    },
  );

  it.each([
    "2026-13-01",
    "2026-00-10",
    "2026-11-45",
    "2026-11-00",
    "2026-02-31",
  ])("rejects %s, which is not a real calendar date", (from) => {
    expect(validateTarget({ ...valid, from })).toEqual([
      "from must be YYYY-MM-DD",
    ]);
  });

  it("accepts a real leap day and rejects a non-leap 29 February", () => {
    expect(validateTarget({ ...valid, from: "2024-02-29" })).toEqual([]);
    expect(validateTarget({ ...valid, from: "2026-02-29" })).toEqual([
      "from must be YYYY-MM-DD",
    ]);
  });

  it("accepts a day that a zone skipped, in that zone", () => {
    vi.stubEnv("TZ", "Pacific/Apia");
    try {
      expect(validateTarget({ ...valid, from: "2011-12-30" })).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("gives the same answer for consecutive dates in a zone with a midnight DST change", () => {
    vi.stubEnv("TZ", "Asia/Gaza");
    try {
      expect(validateTarget({ ...valid, from: "2040-10-20" })).toEqual([]);
      expect(validateTarget({ ...valid, from: "2040-10-21" })).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("accepts year 0099, rejects 1900-02-29 and accepts 2000-02-29", () => {
    expect(validateTarget({ ...valid, from: "0099-01-01" })).toEqual([]);
    expect(validateTarget({ ...valid, from: "1900-02-29" })).toEqual([
      "from must be YYYY-MM-DD",
    ]);
    expect(validateTarget({ ...valid, from: "2000-02-29" })).toEqual([]);
  });

  it("returns all five messages for null without throwing", () => {
    expect(validateTarget(null)).toEqual([
      "kcal must be above 0",
      "protein must be 0 or more",
      "carb must be 0 or more",
      "fat must be 0 or more",
      "from must be YYYY-MM-DD",
    ]);
  });
});
