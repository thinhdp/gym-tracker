// src/lib/homeStats.js
// Pure helpers backing the Home dashboard. All weights are kg (see units.js);
// these functions only sum/aggregate and never convert for display.

import { toDate, startOfWeekMonday, endOfWeekSunday } from "./dateUtils";
import { ymdFromDate } from "./date";

/** Volume (kg) of one set: weight × reps, NaN-guarded. */
export function setVolume(set) {
  const w = Number(set?.weight ?? 0);
  const r = Number(set?.reps ?? 0);
  if (!Number.isFinite(w) || !Number.isFinite(r)) return 0;
  return w * r;
}

/** Total volume (kg) of a workout across all exercises and sets. */
export function workoutVolume(workout) {
  let total = 0;
  for (const ex of workout?.exercises || []) {
    for (const s of ex.sets || []) total += setVolume(s);
  }
  return total;
}

/** Workouts whose date falls inside the Mon–Sun week containing refDate. */
function workoutsInWeek(workouts, refDate) {
  const from = startOfWeekMonday(refDate);
  const to = endOfWeekSunday(refDate);
  return (workouts || []).filter((w) => {
    const d = toDate(w.date);
    return d && d >= from && d <= to;
  });
}

/** { count, volume } for the week containing refDate. */
export function weekStats(workouts, refDate = new Date()) {
  const inWeek = workoutsInWeek(workouts, refDate);
  let volume = 0;
  for (const w of inWeek) volume += workoutVolume(w);
  return { count: inWeek.length, volume };
}

/** Seven volume totals (kg), Monday→Sunday, for the week containing refDate. */
export function weekVolumeByDay(workouts, refDate = new Date()) {
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const w of workoutsInWeek(workouts, refDate)) {
    const d = toDate(w.date);
    const idx = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
    days[idx] += workoutVolume(w);
  }
  return days;
}

/**
 * Consecutive calendar days, ending on refDate and counting backwards, on which
 * at least one workout exists. Stops at the first day with no workout.
 */
export function currentStreak(workouts, refDate = new Date()) {
  const dates = new Set((workouts || []).map((w) => w.date));
  let streak = 0;
  const cur = new Date(refDate);
  cur.setHours(0, 0, 0, 0);
  while (dates.has(ymdFromDate(cur))) {
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

/** Most recent bodyweight log as { date, value }, or null when empty. */
export function latestBodyweight(weightLogs) {
  const keys = Object.keys(weightLogs || {});
  if (keys.length === 0) return null;
  const date = keys.sort().at(-1); // ISO date strings sort chronologically
  return { date, value: weightLogs[date] };
}
