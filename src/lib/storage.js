// localStorage layer + shared id/date helpers. All persisted app data is
// namespaced under the "mgym" prefix. See docs/DATA-MODEL.md for the full key
// inventory (these constants cover the core AppContext state + preferences;
// other keys like `weightLogs` and `weekly-note:*` are defined in their owners).

/** localStorage key for the exercise database (Exercise[]). */
export const K_EX = "mgym.exercises.v1";
/** localStorage key for all workouts (Workout[]). */
export const K_WO = "mgym.workouts.v1";
/** localStorage key for the display-unit preference ("kg" | "lb"). */
export const K_UNIT = "mgym.unit";
/** localStorage key for the last active tab. */
export const K_TAB = "mgym.tab";
/** localStorage key for the theme preference ("system" | "light" | "dark"). */
export const K_THEME = "mgym.theme";
/** localStorage key for the in-progress live workout session (or null). */
export const K_SESSION = "mgym.session.v1";
/** localStorage key for body-weight logs ({ "YYYY-MM-DD": number }). Predates the "mgym" prefix. */
export const K_WEIGHT_LOGS = "weightLogs";
/** localStorage key for the lifter profile ({ sex, birthYear }) used by strength standards. */
export const K_PROFILE = "mgym.profile.v1";
/** localStorage key for the FitnessVolt strength-standards response cache. */
export const K_FV_CACHE = "mgym.fvCache.v1";

/** Today's date as a `YYYY-MM-DD` string (UTC-sliced). */
export const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Generate a unique identifier.
 * Uses the Web Crypto API's randomUUID if available for better uniqueness,
 * falling back to a Math.random/Date-based ID for environments where crypto.randomUUID is unavailable.
 */
export const uuid = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

/**
 * Read and JSON-parse a value from localStorage.
 * @param {string} key - localStorage key.
 * @param {*} fallback - returned when the key is missing or parsing throws.
 * @returns {*} the parsed value, or `fallback`.
 */
export function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * JSON-stringify a value and write it to localStorage.
 * @param {string} key - localStorage key.
 * @param {*} val - any JSON-serializable value.
 * @returns {void}
 */
export function saveLS(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
