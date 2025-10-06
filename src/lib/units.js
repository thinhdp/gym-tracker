// src/lib/units.js
export const KG_PER_LB = 0.45359237;

// Convert internal kilograms to display units (kg or lb), rounding to 1 decimal place when converting to pounds.
export const toDisplayWeight = (kg, unit) =>
  unit === "lb"
    ? Math.round((Number(kg || 0) / KG_PER_LB) * 10) / 10  // kg → lb rounded to 1 decimal
    : Number(kg || 0);

// Convert a displayed weight back to internal kilograms.
// When converting from pounds, avoid rounding so that entering a value like “1”
// remains exactly 1 lb on the next render.  Rounding should only happen when
// converting kg → lb for display.
export const fromDisplayWeight = (val, unit) =>
  unit === "lb"
    ? Number(val || 0) * KG_PER_LB   // lb → kg without premature rounding
    : Number(val || 0);
