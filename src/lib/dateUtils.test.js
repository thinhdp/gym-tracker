import {
  startOfWeekMonday,
  endOfWeekSunday,
  weekKey,
  weekLabel,
  prevWeekKeyFrom,
  startOfMonth,
  endOfMonth,
  monthKey,
  prevMonthKeyFrom,
} from "./dateUtils";

describe("startOfWeekMonday / endOfWeekSunday", () => {
  it("maps a Monday to itself at 00:00:00.000", () => {
    const mon = new Date(2026, 5, 8, 15, 30); // Mon Jun 8 2026
    const s = startOfWeekMonday(mon);
    expect(s.getFullYear()).toBe(2026);
    expect(s.getMonth()).toBe(5);
    expect(s.getDate()).toBe(8);
    expect([
      s.getHours(),
      s.getMinutes(),
      s.getSeconds(),
      s.getMilliseconds(),
    ]).toEqual([0, 0, 0, 0]);
  });

  it("maps a Sunday back 6 days to the preceding Monday", () => {
    const sun = new Date(2026, 5, 14); // Sun Jun 14 2026
    const s = startOfWeekMonday(sun);
    expect(s.getDate()).toBe(8);
    expect(s.getMonth()).toBe(5);
  });

  it("ends the week on Sunday 23:59:59.999, 6 days after the start", () => {
    const e = endOfWeekSunday(new Date(2026, 5, 10)); // Wed Jun 10 2026
    expect(e.getDate()).toBe(14);
    expect(e.getMonth()).toBe(5);
    expect([
      e.getHours(),
      e.getMinutes(),
      e.getSeconds(),
      e.getMilliseconds(),
    ]).toEqual([23, 59, 59, 999]);
  });
});

describe("weekKey", () => {
  it("gives every day Mon–Sun of one week the same key", () => {
    const keys = [];
    for (let day = 8; day <= 14; day++) {
      keys.push(weekKey(new Date(2026, 5, day))); // Jun 8–14 2026
    }
    expect(new Set(keys).size).toBe(1);
  });

  it("keeps a year-crossing week in a single bucket", () => {
    // Mon Dec 28 2026 – Sun Jan 3 2027 is one week.
    const keyDec = weekKey(new Date(2026, 11, 28));
    const keyJan = weekKey(new Date(2027, 0, 1));
    expect(keyJan).toBe(keyDec);
    expect(keyDec.startsWith("2026-")).toBe(true);
  });
});

describe("weekLabel", () => {
  it("formats the Monday-to-Sunday range", () => {
    expect(weekLabel(new Date(2026, 5, 10))).toBe("2026-06-08 to 2026-06-14");
  });
});

describe("prevWeekKeyFrom", () => {
  it("returns the previous week's key", () => {
    const thisMon = new Date(2026, 5, 8);
    expect(prevWeekKeyFrom(thisMon)).toBe(weekKey(new Date(2026, 5, 1)));
  });

  it("crosses the year boundary", () => {
    const jan4 = new Date(2027, 0, 4); // Mon Jan 4 2027
    expect(prevWeekKeyFrom(jan4)).toBe(weekKey(new Date(2026, 11, 28)));
  });
});

describe("startOfMonth / endOfMonth", () => {
  it("starts on the 1st at 00:00:00.000", () => {
    const s = startOfMonth(new Date(2026, 5, 15, 12));
    expect([s.getDate(), s.getHours(), s.getMinutes()]).toEqual([1, 0, 0]);
  });

  it("handles leap-year February", () => {
    expect(endOfMonth(new Date(2024, 1, 15)).getDate()).toBe(29);
    expect(endOfMonth(new Date(2025, 1, 15)).getDate()).toBe(28);
  });

  it("ends on the last day at 23:59:59.999", () => {
    const e = endOfMonth(new Date(2026, 5, 1)); // June has 30 days
    expect(e.getDate()).toBe(30);
    expect([
      e.getHours(),
      e.getMinutes(),
      e.getSeconds(),
      e.getMilliseconds(),
    ]).toEqual([23, 59, 59, 999]);
  });
});

describe("monthKey / prevMonthKeyFrom", () => {
  it("zero-pads the month", () => {
    expect(monthKey(new Date(2026, 5, 15))).toBe("2026-06");
  });

  it("crosses the year boundary going back from January", () => {
    expect(prevMonthKeyFrom(new Date(2027, 0, 1))).toBe("2026-12");
  });
});
