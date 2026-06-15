// src/lib/strengthStandards.js
// Pure helpers for the Progress -> Symmetry view, which scores your lifts against
// the FitnessVolt Strength Standards API (https://fitnessvolt.com/strength-standards).
//
// The API only publishes standards for a fixed set of barbell / bodyweight lifts,
// so the radar is movement-based: one axis per lift group the API supports. Each
// axis is fed by the best estimated 1RM (kg) among the exercises that map to it.
//
// All weights are kg (the storage invariant). The network layer lives in fvApi.js;
// this module is framework- and fetch-free so it stays trivially testable.

import { estimate1RM } from "./strength";
import { setReps } from "./metrics";

// Lowercased exercise name -> FitnessVolt "gym" (Symmetric Strength) lift slug.
// Only barbell / bodyweight lifts with a clean, unambiguous standard are mapped;
// dumbbell and machine variants are intentionally left out (different standards).
export const EXERCISE_SLUG_MAP = {
  "squat barbell": "back_squat",
  "back squat": "back_squat",
  "front squat": "front_squat",
  "bench press barbell": "bench_press",
  deadlift: "deadlift",
  "sumo deadlift": "sumo_deadlift",
  "shoulder press barbell": "overhead_press",
  "pull-up": "pullup",
  "pull-up (wide grip)": "pullup",
  "chin-ups": "chinup",
  "bent-over row barbell": "pendlay_row",
};

// Slugs scored relative to total system weight (bodyweight + any added load)
// rather than the bare bar weight.
export const BODYWEIGHT_SLUGS = new Set(["pullup", "chinup", "dip"]);

// Radar axes. Each axis aggregates one or more gym slugs (best percentile wins).
// `verified` is the OpenPowerlifting slug shown as a bonus stat where one exists
// (squat / bench-press / deadlift only); it is scored from the first axis slug.
export const RADAR_AXES = [
  {
    key: "squat",
    label: "Squat",
    slugs: ["back_squat", "front_squat"],
    verified: "squat",
  },
  {
    key: "bench",
    label: "Bench",
    slugs: ["bench_press"],
    verified: "bench-press",
  },
  {
    key: "deadlift",
    label: "Deadlift",
    slugs: ["deadlift", "sumo_deadlift"],
    verified: "deadlift",
  },
  { key: "ohp", label: "Overhead Press", slugs: ["overhead_press"] },
  { key: "pull", label: "Pull-up", slugs: ["pullup", "chinup"] },
  { key: "row", label: "Row", slugs: ["pendlay_row"] },
];

// Strength tiers, weakest to strongest, matching the API's `tier` values.
export const TIERS = [
  "beginner",
  "novice",
  "intermediate",
  "advanced",
  "elite",
];

/** Map an exercise name to its gym lift slug, or undefined when unsupported. */
export function slugForExercise(name) {
  return EXERCISE_SLUG_MAP[(name || "").toLowerCase().trim()];
}

/**
 * Best estimated 1RM (kg) per gym slug across workouts, optionally capped at a
 * date (inclusive) so a past milestone can be reconstructed.
 *
 * For bodyweight slugs the value is the best *added* load (which may be 0 — a set
 * of unweighted pull-ups still counts); callers add bodyweight via `liftWeight`.
 * For loaded slugs, zero-weight sets are ignored.
 *
 * @returns {Object<string, number>} slug -> best e1RM in kg.
 */
export function bestE1RMBySlug(workouts, asOf = null) {
  const out = {};
  for (const w of workouts || []) {
    const date = w?.date;
    if (!date) continue;
    if (asOf && date > asOf) continue;
    for (const ex of w.exercises || []) {
      const slug = slugForExercise(ex.exerciseName);
      if (!slug) continue;
      const bw = BODYWEIGHT_SLUGS.has(slug);
      for (const s of ex.sets || []) {
        const reps = setReps(s);
        if (reps <= 0) continue;
        const wt = Number(s.weight) || 0;
        if (!bw && wt <= 0) continue;
        const e = estimate1RM(wt, reps);
        if (!(slug in out) || e > out[slug]) out[slug] = e;
      }
    }
  }
  return out;
}

/**
 * The weight to score for a slug: total system weight for bodyweight lifts
 * (bodyweight + added e1RM), otherwise the bare e1RM.
 */
export function liftWeight(slug, e1rm, bodyweight) {
  const added = Number(e1rm) || 0;
  return BODYWEIGHT_SLUGS.has(slug) ? (Number(bodyweight) || 0) + added : added;
}

/** Current age in whole years from a birth year, or null when unknown. */
export function ageFromBirthYear(birthYear, now = new Date()) {
  const y = Number(birthYear);
  if (!Number.isFinite(y) || y < 1900) return null;
  const age = now.getFullYear() - y;
  return age >= 10 && age <= 90 ? age : null;
}

/** Map a percentile (0-100) to a strength tier; null passes through. */
export function percentileToTier(p) {
  if (p == null || !Number.isFinite(Number(p))) return null;
  const v = Number(p);
  if (v < 20) return "beginner";
  if (v < 40) return "novice";
  if (v < 60) return "intermediate";
  if (v < 80) return "advanced";
  return "elite";
}

/** Average percentile across axes mapped to an overall tier; null when empty. */
export function overallTier(percentiles) {
  const vals = (percentiles || []).filter(
    (p) => p != null && Number.isFinite(Number(p)),
  );
  if (vals.length === 0) return null;
  const avg = vals.reduce((a, b) => a + Number(b), 0) / vals.length;
  return percentileToTier(avg);
}

/** Star rating (0-5) from an average percentile, for a strengthlevel-style header. */
export function starsFromPercentile(p) {
  if (p == null || !Number.isFinite(Number(p))) return 0;
  return Math.max(0, Math.min(5, Math.round((Number(p) / 100) * 5)));
}

/**
 * Resolve, per axis, which slug to query and at what weight, for one snapshot
 * (a set of slug e1RMs + a bodyweight). Axes with no logged data are dropped.
 *
 * @returns {Array<{ axis, slug, e1rm, weight }>} one entry per axis with data,
 *   where `slug` is the best-available slug for that axis and `weight` is the
 *   value to send to the percentile endpoint.
 */
export function axisRequests(e1rmBySlug, bodyweight) {
  const reqs = [];
  for (const axis of RADAR_AXES) {
    let best = null;
    for (const slug of axis.slugs) {
      if (!(slug in (e1rmBySlug || {}))) continue;
      const e1rm = e1rmBySlug[slug];
      const weight = liftWeight(slug, e1rm, bodyweight);
      if (!best || weight > best.weight) best = { slug, e1rm, weight };
    }
    if (best) reqs.push({ axis: axis.key, ...best });
  }
  return reqs;
}
