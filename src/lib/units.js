export const KG_PER_LB = 0.45359237;
export const toDisplayWeight = (kg, unit) => unit === "lb"
  ? Math.round((Number(kg || 0) / KG_PER_LB) * 100) / 100
  : Number(kg || 0);
export const fromDisplayWeight = (val, unit) => unit === "lb"
  ? Number(val || 0) * KG_PER_LB
  : Number(val || 0);
