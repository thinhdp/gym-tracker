// RPE (rate of perceived exertion) helpers.
//
// RPE is logged per workout-exercise as an optional number from 6 to 10 in
// 0.5 steps; feedback is an optional free-text note. Both default to "unset"
// (rpe = null, feedback = ""). These helpers are the validation boundary for
// imported data — anything out of range or non-numeric collapses to null so a
// bad backup can never poison the dropdown.

export const RPE_MIN = 6;
export const RPE_MAX = 10;
export const RPE_STEP = 0.5;
export const MAX_FEEDBACK_LEN = 2000;

// The values offered in the dropdown: 6, 6.5, 7, … 10.
export const RPE_OPTIONS = Array.from(
  { length: Math.round((RPE_MAX - RPE_MIN) / RPE_STEP) + 1 },
  (_, i) => RPE_MIN + i * RPE_STEP,
);

// Coerce an arbitrary value to a valid RPE: a number snapped to the nearest
// 0.5 within [6, 10]. Anything non-numeric or out of range returns null.
export function normalizeRpe(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const snapped = Math.round(n / RPE_STEP) * RPE_STEP;
  if (snapped < RPE_MIN || snapped > RPE_MAX) return null;
  // Avoid float artifacts (e.g. 7.5000000001) from the multiply/divide above.
  return Math.round(snapped * 10) / 10;
}

// Coerce an arbitrary value to feedback text: a string capped at the max
// length. Non-strings become "".
export function normalizeFeedback(value) {
  if (typeof value !== "string") return "";
  return value.slice(0, MAX_FEEDBACK_LEN);
}

// True when an exercise carries any RPE/feedback worth showing.
export function hasRpeFeedback(rpe, feedback) {
  return (
    rpe != null || (typeof feedback === "string" && feedback.trim() !== "")
  );
}
