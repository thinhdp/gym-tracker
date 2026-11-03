import { weeklyIntake } from "./trends";

afterEach(() => vi.unstubAllEnvs());

const entry = (date, kcal, extra = {}) => ({
  id: `${date}-${kcal}`,
  date,
  grams: 100,
  per100: { kcal, protein: 10, carb: 20, fat: 5 },
  ...extra,
});

describe("weeklyIntake", () => {
  it("buckets Monday-start weeks across a month boundary and averages by logged days, not 7", () => {
    // 2026-11-02 is a Monday; 2026-10-30 is the Friday before.
    const entries = [entry("2026-10-30", 2000), entry("2026-11-01", 1000)];
    const rows = weeklyIntake(entries, {}, { weeks: 2, today: "2026-11-04" });
    expect(rows.map((r) => [r.from, r.to])).toEqual([
      ["2026-10-26", "2026-11-01"],
      ["2026-11-02", "2026-11-08"],
    ]);
    expect(rows[0].loggedDays).toBe(2);
    expect(rows[0].avg).toEqual({ kcal: 1500, protein: 10, carb: 20, fat: 5 });
    expect(rows[1].avg).toBeNull();
  });

  it("returns avg null for a week with no entries and joins weekly bodyweight averages with delta", () => {
    const logs = {
      "2026-10-26": 80,
      "2026-10-28": 81,
      "2026-11-02": 80.1,
      "2026-11-03": 80.3,
    };
    const rows = weeklyIntake([entry("2026-10-27", 1800)], logs, {
      weeks: 2,
      today: "2026-11-04",
    });
    expect(rows[0].bodyweight).toBe(80.5);
    expect(rows[0].bodyweightDelta).toBeNull();
    expect(rows[1].avg).toBeNull();
    expect(rows[1].bodyweight).toBe(80.2);
    expect(rows[1].bodyweightDelta).toBe(-0.3);
  });

  it("weeks: 4 yields exactly four buckets ending with today's week", () => {
    const rows = weeklyIntake([], {}, { weeks: 4, today: "2026-11-04" });
    expect(rows).toHaveLength(4);
    expect(rows[3].from).toBe("2026-11-02");
    expect(rows[0].from).toBe("2026-10-12");
    expect(rows.every((r) => r.avg === null)).toBe(true);
  });

  it("buckets entries right across a year boundary", () => {
    const entries = [entry("2026-12-31", 1000), entry("2027-01-01", 2000)];
    const rows = weeklyIntake(entries, {}, { weeks: 2, today: "2027-01-05" });
    expect(rows[0]).toMatchObject({ from: "2026-12-28", to: "2027-01-03" });
    expect(rows[0].loggedDays).toBe(2);
    expect(rows[0].avg.kcal).toBe(1500);
    expect(rows[1].from).toBe("2027-01-04");
    expect(rows[1].loggedDays).toBe(0);
  });

  it("keeps the weeks around the spring daylight-saving change separate", () => {
    vi.stubEnv("TZ", "America/New_York");
    // US change is Sunday 2026-03-08.
    const entries = [entry("2026-03-08", 1000), entry("2026-03-09", 3000)];
    const rows = weeklyIntake(entries, {}, { weeks: 3, today: "2026-03-18" });
    expect(rows.map((r) => r.from)).toEqual([
      "2026-03-02",
      "2026-03-09",
      "2026-03-16",
    ]);
    expect(rows[0].avg.kcal).toBe(1000);
    expect(rows[1].avg.kcal).toBe(3000);
    expect(rows[0].loggedDays).toBe(1);
    expect(rows[1].loggedDays).toBe(1);
  });

  it("averages by days with at least one entry and rounds kcal to whole and macros to one decimal", () => {
    // Day one has two entries, so the divisor is 3 days, not 4 entries.
    const entries = [
      entry("2026-11-02", 1000),
      entry("2026-11-02", 500),
      entry("2026-11-03", 1000),
      entry("2026-11-04", 1000),
    ];
    const [row] = weeklyIntake(entries, {}, { weeks: 1, today: "2026-11-04" });
    expect(row.loggedDays).toBe(3);
    expect(row.avg).toEqual({
      kcal: 1167,
      protein: 13.3,
      carb: 26.7,
      fat: 6.7,
    });
  });

  it("gives a null delta when the current week has no weigh-ins but the previous week does", () => {
    const rows = weeklyIntake(
      [],
      { "2026-10-27": 80 },
      {
        weeks: 1,
        today: "2026-11-04",
      },
    );
    expect(rows[0].bodyweight).toBeNull();
    expect(rows[0].bodyweightDelta).toBeNull();
  });

  it("builds weeks from local dates when today is a Monday in a zone behind UTC", () => {
    vi.stubEnv("TZ", "America/New_York");
    const logs = {
      "2026-10-26": 72,
      "2026-11-01": 70,
      "2026-11-02": 80,
      "2026-11-08": 82,
    };
    const rows = weeklyIntake([], logs, { weeks: 2, today: "2026-11-02" });
    expect(rows.map((r) => [r.from, r.to])).toEqual([
      ["2026-10-26", "2026-11-01"],
      ["2026-11-02", "2026-11-08"],
    ]);
    expect(rows[1].label).toBe("2026-11-02 to 2026-11-08");
    expect(rows[1].key).toBe("2026-45");
    expect(rows[0].bodyweight).toBe(71);
    expect(rows[1].bodyweight).toBe(81);
    expect(rows[1].bodyweightDelta).toBe(10);
  });

  it("handles empty and future-only cases", () => {
    expect(weeklyIntake([], {}, { weeks: null, today: "2026-11-04" })).toEqual(
      [],
    );
    const future = [entry("2026-12-01", 1000)];
    expect(
      weeklyIntake(future, {}, { weeks: null, today: "2026-11-04" }),
    ).toEqual([]);
    const rows = weeklyIntake(future, {}, { weeks: 4, today: "2026-11-04" });
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.avg === null)).toBe(true);
  });

  it("weeks: null starts at the earliest entry's week even when entries are unsorted", () => {
    const entries = [entry("2026-11-03", 1000), entry("2026-10-14", 2000)];
    const rows = weeklyIntake(
      entries,
      {},
      { weeks: null, today: "2026-11-04" },
    );
    expect(rows.map((r) => r.from)).toEqual([
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
      "2026-11-02",
    ]);
  });

  it("computes the first row's delta from the real previous week outside the range", () => {
    const logs = { "2026-10-20": 82, "2026-10-27": 81 };
    const rows = weeklyIntake([], logs, { weeks: 1, today: "2026-11-01" });
    expect(rows).toHaveLength(1);
    expect(rows[0].bodyweight).toBe(81);
    expect(rows[0].bodyweightDelta).toBe(-1);
  });

  it("treats non-object weightLogs as no logs", () => {
    for (const bad of [null, [], undefined]) {
      const rows = weeklyIntake([], bad, { weeks: 2, today: "2026-11-04" });
      expect(rows.every((r) => r.bodyweight === null)).toBe(true);
    }
  });
});
