// src/lib/review/pp21/nextSession.js
// Home's next-session card: what the PP21 engine prescribes next, as of today,
// and the workout that Start creates from it. Pure; weights stay in kg.

import { uuid } from "../../storage";
import { toDisplayWeight } from "../../units";
import { reviewProgram, nextSessionPlan } from "./engine";

/**
 * The upcoming PP21 session as seen from `today`.
 *
 * @param {{ workouts: object[], exercises: object[] }} data
 * @param {object} p        program config (programs/pp21.js)
 * @param {string} today    YYYY-MM-DD
 * @returns {{ plan, date: string, isToday: boolean, isRestDay: boolean,
 *             deload: boolean }}
 *   date: when the session is due (never before today: a missed day makes it
 *   due today). isRestDay: today is a scheduled rest day, the session is later.
 */
export function upcomingSession(data, p, today) {
  const review = reviewProgram(data, p);
  const plan = nextSessionPlan(review, p);
  const due = review.global.nextSessionDate;
  const date = due > today ? due : today;
  return {
    plan,
    date,
    isToday: date === today,
    isRestDay: date > today,
    deload: plan.deload,
  };
}

/**
 * Build the workout Start creates from a next-session plan. Exercises already
 * done earlier in the rotation are left out; reps start at 0 with the
 * prescription carried as `targetReps` (shown as a placeholder while logging).
 * The name is the session's routine name so the engine matches it back.
 */
export function workoutFromPlan(plan, date) {
  return {
    id: uuid(),
    date,
    name: plan.routineName,
    exercises: plan.exercises
      .filter((e) => !e.doneEarlier && e.sets.length)
      .map((e) => ({
        exerciseName: e.exerciseName,
        sets: e.sets.map((s, i) => ({
          set: i + 1,
          weight: Number(s.weight) || 0,
          reps: 0,
          targetReps: Number(s.targetReps) || 0,
        })),
        rpe: null,
        feedback: "",
        ...(e.optional ? { optional: true } : {}),
      })),
  };
}

// "47.5×5 · 42.5×7" for prescribed sets; 0 kg is bodyweight (pull-up
// back-off) and a null weight (no history yet) shows as "?".
export function setsLabel(sets, unit) {
  return sets
    .map((s) => {
      const w =
        s.weight == null
          ? "?"
          : s.weight === 0
            ? "BW"
            : toDisplayWeight(s.weight, unit);
      return `${w}×${s.targetReps}`;
    })
    .join(" · ");
}

// True when the plan leaves the weight to the lifter (no recent history).
export const needsWeight = (sets) => sets.some((s) => s.weight == null);

// Target reps of the prescribed sets: "2×10" when equal, else "5 / 7".
export function repsLabel(sets) {
  const reps = sets.map((s) => s.targetReps);
  return reps.length > 1 && reps.every((r) => r === reps[0])
    ? `${reps.length}×${reps[0]}`
    : reps.join(" / ");
}

// "8–9" from an exercise's RPE target ({ top: [lo, hi] } | { set1, set2 } |
// { note } during a deload).
export function rpeLabel(rpe) {
  if (!rpe) return "";
  if (rpe.note) return rpe.note.replace(/^RPE\s*/, "");
  const [a, b] = rpe.top ?? [rpe.set1, rpe.set2];
  return a === b ? String(a) : `${a}–${b}`;
}
