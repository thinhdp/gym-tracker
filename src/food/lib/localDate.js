import { ymdFromDate } from "../../lib/date";

/** Builds the local Date for a `YYYY-MM-DD` string, offset by `n` days. */
const localDateFromYmd = (ymd, n = 0) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d + n);
};

export const todayLocal = (now = new Date()) => ymdFromDate(now);

export const addDays = (ymd, n) => ymdFromDate(localDateFromYmd(ymd, n));

export const isToday = (ymd, now = new Date()) => ymd === todayLocal(now);

export const formatDayHeader = (ymd) =>
  localDateFromYmd(ymd).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
