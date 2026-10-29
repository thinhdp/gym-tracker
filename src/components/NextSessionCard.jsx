// src/components/NextSessionCard.jsx
// Home -> next-session card for the Push·Pull 2-1 (PP21) program: the session
// the review engine prescribes next, its date, a rest-day or deload banner, and
// each exercise's decision chip, prescribed sets and first reason. Start adds
// a workout prefilled with those weights (reps start blank, targets shown as
// placeholders) and opens the live session. An exercise with no recent history
// has no weight yet: it asks the lifter to pick one for the target reps/RPE.
// Props: today (YYYY-MM-DD). Reads workouts/exercises/unit from useApp().

import React, { useMemo } from "react";
import { useApp } from "../context/AppContext";
import pp21 from "../lib/review/programs/pp21";
import {
  upcomingSession,
  workoutFromPlan,
  setsLabel,
  needsWeight,
  rpeLabel,
  repsLabel,
} from "../lib/review/pp21/nextSession";
import DecisionChip from "./DecisionChip";

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const DAYS = "Sun Mon Tue Wed Thu Fri Sat".split(" ");
const dayLabel = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${DAYS[new Date(y, m - 1, d).getDay()]} ${d} ${MONTHS[m - 1]}`;
};

export default function NextSessionCard({ today }) {
  const { workouts, exercises, unit, startWorkout, startEmptyWorkout } =
    useApp();
  const upcoming = useMemo(
    () => upcomingSession({ workouts, exercises }, pp21, today),
    [workouts, exercises, today],
  );
  const { plan, date, isRestDay, deload } = upcoming;
  const unitLabel = unit === "lb" ? "lb" : "kg";

  return (
    <div className="rounded-2xl border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Next session
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
          {plan.name}
        </div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          {isRestDay ? dayLabel(date) : "Today"}
        </div>
      </div>

      {isRestDay && (
        <div className="mt-2 rounded-lg bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          Rest day today. {plan.name} is planned for {dayLabel(date)}.
        </div>
      )}
      {deload && (
        <div className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          Deload: 1 set per exercise at the same weight, RPE 7.
        </div>
      )}

      <ul className="mt-2">
        {plan.exercises.map((e) => (
          <li
            key={e.exId}
            className="flex items-start justify-between gap-2 border-t py-1.5 dark:border-neutral-800"
          >
            <div className="min-w-0">
              <div
                className={
                  e.doneEarlier
                    ? "text-sm text-neutral-400 line-through"
                    : "text-sm text-neutral-900 dark:text-neutral-100"
                }
              >
                {e.exerciseName}
                {e.optional && (
                  <span className="text-xs text-neutral-400"> (optional)</span>
                )}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {e.doneEarlier
                  ? "Already done this rotation."
                  : needsWeight(e.sets)
                    ? `Pick a weight: ${repsLabel(e.sets)} reps @ RPE ${rpeLabel(e.rpe)}`
                    : `${setsLabel(e.sets, unit)} ${unitLabel}`}
                {e.carriedFrom && ` · moved from ${e.carriedFrom}`}
              </div>
              {/* the "Pick a weight" line already says why there's no weight */}
              {!e.doneEarlier && !needsWeight(e.sets) && e.reasons?.[0] && (
                <div className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  {e.reasons[0]}
                </div>
              )}
            </div>
            {!e.doneEarlier && (
              <div className="shrink-0 pt-0.5">
                <DecisionChip decision={e.decision} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => startWorkout(workoutFromPlan(plan, today))}
          className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {isRestDay ? `Start ${plan.name} anyway` : `Start ${plan.name}`}
        </button>
        <button
          type="button"
          onClick={startEmptyWorkout}
          className="rounded-xl border px-3 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          Empty workout
        </button>
      </div>
    </div>
  );
}
