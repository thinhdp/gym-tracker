export const K_EX = "mgym.exercises.v1";
export const K_WO = "mgym.workouts.v1";
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (d) => d;

/**
 * Generate a unique identifier.
 * Uses the Web Crypto API's randomUUID if available for better uniqueness,
 * falling back to a Math.random/Date-based ID for environments where crypto.randomUUID is unavailable.
 */
export const uuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

export function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLS(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
