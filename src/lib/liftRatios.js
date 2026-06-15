// src/lib/liftRatios.js
// Pure helpers for the Progress -> Symmetry "Lift Balance" panel, a take on
// FitnessVolt's Strength Symmetry Analyzer: it compares the *ratios* between
// your main barbell lifts to the ratios of the median lifter.
//
// The key idea: instead of inventing "ideal" ratio constants, the benchmark
// ratios are derived from the API's own p50 (median) standards at your
// bodyweight/sex. So "average" means a real median lifter, not a guess.
//
// All weights are kg. Network access lives in fvApi.js (fetchStandards).

// Squat is the reference lift; every ratio is <lift> : squat.
export const RATIO_BASE = "squat";
export const RATIO_BASE_LABEL = "Squat";

// The big barbell lifts we compare. `slug` is the FitnessVolt standards slug,
// which also matches the gym slug keys produced by bestE1RMBySlug.
export const RATIO_LIFTS = [
  { key: "squat", label: "Squat", slug: "back_squat" },
  { key: "bench", label: "Bench Press", slug: "bench_press" },
  { key: "deadlift", label: "Deadlift", slug: "deadlift" },
  { key: "ohp", label: "Overhead Press", slug: "overhead_press" },
  { key: "row", label: "Barbell Row", slug: "pendlay_row" },
];

// Within this fraction of the median ratio counts as "balanced".
export const RATIO_TOLERANCE = 0.05;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Build one comparison row per non-base lift that has both a user value and a
 * median value (and a usable squat base in each). Each row carries the user's
 * lift:squat ratio, the median lift:squat ratio, the fractional difference, and
 * a balanced/weak/strong assessment.
 *
 * @param {Object<string,number>} userByKey - lift key -> user e1RM (kg).
 * @param {Object<string,number>} avgByKey  - lift key -> median (p50) lift (kg).
 * @returns {Array<{key,label,userRatio,avgRatio,diff,assessment}>}
 */
export function buildRatioRows(userByKey, avgByKey, tol = RATIO_TOLERANCE) {
  const uBase = num(userByKey?.[RATIO_BASE]);
  const aBase = num(avgByKey?.[RATIO_BASE]);
  if (!uBase || !aBase) return [];

  const rows = [];
  for (const lift of RATIO_LIFTS) {
    if (lift.key === RATIO_BASE) continue;
    const u = num(userByKey?.[lift.key]);
    const a = num(avgByKey?.[lift.key]);
    if (u == null || a == null || a <= 0) continue;

    const userRatio = u / uBase;
    const avgRatio = a / aBase;
    const diff = userRatio / avgRatio - 1; // fractional vs median
    let assessment = "balanced";
    if (diff > tol) assessment = "strong";
    else if (diff < -tol) assessment = "weak";

    rows.push({
      key: lift.key,
      label: lift.label,
      userRatio,
      avgRatio,
      diff,
      assessment,
    });
  }
  return rows;
}

/**
 * Overall symmetry score (0-100). Each lift earns full credit when its ratio
 * matches the median and zero credit once it deviates by half (50%); the score
 * is the average credit. Null when there are no rows to score.
 */
export function overallScore(rows) {
  if (!rows || rows.length === 0) return null;
  const credit = rows.reduce(
    (sum, r) => sum + Math.max(0, 1 - Math.abs(r.diff) / 0.5),
    0,
  );
  return Math.round((credit / rows.length) * 100);
}

/** Word label for an overall score. */
export function scoreRating(score) {
  if (score == null) return null;
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  return "Imbalanced";
}

/**
 * The most-lagging and most-leading lifts, for a "focus here" callout.
 * Returns nulls when nothing is meaningfully out of balance.
 */
export function focusAreas(rows, tol = RATIO_TOLERANCE) {
  const weak = rows
    .filter((r) => r.diff < -tol)
    .sort((a, b) => a.diff - b.diff)[0];
  const strong = rows
    .filter((r) => r.diff > tol)
    .sort((a, b) => b.diff - a.diff)[0];
  return { weakest: weak || null, strongest: strong || null };
}
