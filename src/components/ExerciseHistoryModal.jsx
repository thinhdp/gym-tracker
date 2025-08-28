import React from "react";
import { Button } from "./ui/Button";
import { toDisplayWeight } from "../lib/units";

/**
 * Reusable modal for viewing an exercise's history.
 * It lists all past workouts containing the exercise, grouped by date.
 *
 * Props:
 * - exerciseName (string)   Name of the exercise to display history for.
 * - workouts (array)        Full workouts array from state.
 * - unit (string)           Unit for displaying weights (e.g., 'kg' or 'lb').
 * - onClose (function)      Callback to close the modal.
 *
 * If exerciseName is falsy, nothing renders.
 */
export default function ExerciseHistoryModal({
  exerciseName,
  workouts,
  unit,
  onClose,
}) {
  if (!exerciseName) return null;

  const filtered = (workouts || []).filter((w) =>
    (w.exercises || []).some((e) => e.exerciseName === exerciseName)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-4 max-w-md w-full space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium">{exerciseName}</div>
            <div className="text-sm text-neutral-500">
              Past workouts containing this exercise
            </div>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        {filtered.length === 0 ? (
          <div className="text-sm text-neutral-500">
            No past workouts.
          </div>
        ) : (
          filtered.map((w) => {
            const item = (w.exercises || []).find(
              (e) => e.exerciseName === exerciseName
            );
            if (!item) return null;
            return (
              <div key={w.id} className="border rounded-md p-2 space-y-1">
                <div className="font-semibold">{w.date}</div>
                <div className="text-xs text-neutral-500">
                  {w.name || w.date}
                </div>
                {item.sets.map((s) => (
                  <div key={s.set} className="text-sm">
                    Set {s.set}:{" "}
                    {toDisplayWeight(s.weight, unit)} {unit} × {s.reps}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
