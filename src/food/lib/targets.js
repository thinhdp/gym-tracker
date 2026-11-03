const FROM_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when a YYYY-MM-DD string is a real calendar date (local, not UTC). */
const isRealDate = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(2000, 0, 1);
  date.setFullYear(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
};

/** The row with the greatest `from <= ymd`, or null. Input may be unsorted. */
export const targetForDate = (targets, ymd) => {
  let match = null;
  for (const row of targets) {
    if (row.from <= ymd && (match === null || row.from > match.from)) {
      match = row;
    }
  }
  return match;
};

export const upsertTarget = (targets, row) =>
  [...targets.filter((r) => r.from !== row.from), row].sort((a, b) =>
    a.from < b.from ? -1 : a.from > b.from ? 1 : 0,
  );

export const deleteTarget = (targets, from) =>
  targets.filter((r) => r.from !== from);

/** Returns the validation messages for a row; empty when valid. Never throws. */
export const validateTarget = (row) => {
  const { kcal, protein, carb, fat, from } = row ?? {};
  const messages = [];
  if (!Number.isFinite(kcal) || kcal <= 0) {
    messages.push("kcal must be above 0");
  }
  if (!Number.isFinite(protein) || protein < 0) {
    messages.push("protein must be 0 or more");
  }
  if (!Number.isFinite(carb) || carb < 0) {
    messages.push("carb must be 0 or more");
  }
  if (!Number.isFinite(fat) || fat < 0) {
    messages.push("fat must be 0 or more");
  }
  if (typeof from !== "string" || !FROM_RE.test(from) || !isRealDate(from)) {
    messages.push("from must be YYYY-MM-DD");
  }
  return messages;
};
