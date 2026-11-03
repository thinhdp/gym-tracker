export const ZERO_MACROS = { kcal: 0, protein: 0, carb: 0, fat: 0 };

export const round1 = (n) => Math.round(n * 10) / 10;

export const scaleMacros = (per100, grams) => ({
  kcal: Math.round((per100.kcal * grams) / 100),
  protein: round1((per100.protein * grams) / 100),
  carb: round1((per100.carb * grams) / 100),
  fat: round1((per100.fat * grams) / 100),
});

export const entryMacros = (entry) => scaleMacros(entry.per100, entry.grams);

/**
 * Adds the rounded per-entry values, so visible rows add up to the visible
 * total, then rounds again to remove float noise.
 */
export const sumMacros = (entries) => {
  const total = { ...ZERO_MACROS };
  for (const entry of entries) {
    const macros = entryMacros(entry);
    total.kcal += macros.kcal;
    total.protein += macros.protein;
    total.carb += macros.carb;
    total.fat += macros.fat;
  }
  return {
    kcal: Math.round(total.kcal),
    protein: round1(total.protein),
    carb: round1(total.carb),
    fat: round1(total.fat),
  };
};

export const kcalFromMacros = ({ protein, carb, fat }) =>
  Math.round(4 * protein + 4 * carb + 9 * fat);

export const pct = (value, target) => (!target ? null : value / target);

export const barTone = (ratio) => {
  if (ratio > 1) return "over";
  if (ratio >= 0.9) return "warn";
  return "ok";
};
