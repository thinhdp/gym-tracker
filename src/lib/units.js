// src/lib/units.js
export const KG_PER_LB = 0.45359237;

// Convert internal kilograms to display units (kg or lb).
// When converting to pounds, round to 1 decimal place for a clean display.
export const toDisplayWeight = (kg, unit) =>
  unit === "lb"
    ? Math.round((Number(kg || 0) / KG_PER_LB) * 10) / 10   // kg → lb rounded to 1 decimal
    : Math.round(Number(kg || 0) * 100) / 100;              // kg → kg rounded to 2 decimals

// Convert a displayed weight back to internal kilograms.
// When converting from pounds, round to 2 decimals in kg to ensure that
// the round‑trip back to lb (with a 1‑decimal round) yields the original value.
export const fromDisplayWeight = (val, unit) =>
  unit === "lb"
    ? Math.round((Number(val || 0) * KG_PER_LB) * 100) / 100  // lb → kg rounded to 2 decimals
    : Math.round(Number(val || 0) * 100) / 100;
