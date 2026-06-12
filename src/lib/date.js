export const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
/** Format a Date as a local-time `YYYY-MM-DD` string. */
export const ymdFromDate = (d) => ymd(d.getFullYear(), d.getMonth(), d.getDate());
