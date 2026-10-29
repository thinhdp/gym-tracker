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

// "47.5×5 · 42.5×7" for prescribed sets; 0 kg is bodyweight (pull-up back-off).
export function setsLabel(sets, unit) {
  return sets
    .map(
      (s) =>
        `${s.weight === 0 ? "BW" : toDisplayWeight(s.weight, unit)}×${s.targetReps}`,
    )
    .join(" · ");
}
