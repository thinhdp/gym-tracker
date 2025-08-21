export const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
