import { addDays, formatDayHeader, isToday, todayLocal } from "./localDate";

afterEach(() => vi.unstubAllEnvs());

describe("todayLocal", () => {
  it("uses the local date", () => {
    expect(todayLocal(new Date(2026, 10, 2, 23, 30))).toBe("2026-11-02"); // local, regardless of TZ
  });

  it("stays on the local date early in the morning east of UTC", () => {
    vi.stubEnv("TZ", "Asia/Ho_Chi_Minh");
    expect(todayLocal(new Date(2026, 10, 2, 6, 30))).toBe("2026-11-02");
  });

  it("stays on the local date late in the evening west of UTC", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(todayLocal(new Date(2026, 10, 2, 23, 30))).toBe("2026-11-02");
  });
});

describe("addDays", () => {
  it("crosses month ends in both directions", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("reads the string as a local date west of UTC", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("crosses a daylight-saving change", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  });

  it("crosses a year end", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("returns the same date for n = 0", () => {
    expect(addDays("2026-11-02", 0)).toBe("2026-11-02");
  });
});

describe("isToday", () => {
  afterEach(() => vi.useRealTimers());

  it("compares with an explicit now", () => {
    const now = new Date(2026, 10, 2, 12, 0);
    expect(isToday("2026-11-02", now)).toBe(true);
    expect(isToday("2026-11-01", now)).toBe(false);
  });

  it("uses the current time when now is omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 12, 0));
    expect(isToday("2026-11-02")).toBe(true);
    expect(isToday("2026-11-03")).toBe(false);
  });
});

describe("formatDayHeader", () => {
  const expected = () =>
    new Date(2026, 10, 2).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  it("formats the local date with the default locale", () => {
    expect(formatDayHeader("2026-11-02")).toBe(expected());
  });

  it("reads the string as a local date west of UTC", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(formatDayHeader("2026-11-02")).toBe(expected());
  });
});
