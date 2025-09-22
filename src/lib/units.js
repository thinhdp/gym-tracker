export const KG_PER_LB = 0.45359237;

// Convert internal kilograms to display units (kg or lb), rounding to 1 decimal place when converting to pounds.
export const toDisplayWeight = (kg, unit) =>
  unit === "lb"
    ? Math.round((Number(kg || 0) / KG_PER_LB) * 10) / 10  // kg -> lb rounded to 1 decimal
    : Number(kg || 0);

// Convert a displayed weight back to internal kilograms, rounding to 1 decimal place when converting from pounds.
export const fromDisplayWeight = (val, unit) =>
  unit === "lb"
    ? Math.round((Number(val || 0) * KG_PER_LB) * 10) / 10  // lb -> kg rounded to 1 decimal
    : Number(val || 0);
