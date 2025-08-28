import React from "react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { CalendarIcon } from "./ui/Icons";
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

  // Filter workouts that contain the exercise
  const filtered = (workouts || []).filter((w) =>
    (w.exercises || []).some((e) => e.exerciseName === exerciseName)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-xl shadow-lg p-4 overflow-y-auto max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-medium">{exerciseName}</div>
            <div className="text-sm text-neutral-500">
              Past workouts containing this exercise
            </div>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Body */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-sm text-neutral-500">No past workouts.</p>
          )}
          {filtered.map((w) => {
            const item = (w.exercises || []).find(
              (e) => e.exerciseName === exerciseName
            );
            if (!item) return null;
            return (
              <div
                key={w.id}
                className="border rounded-lg p-3 space-y-1"
              >
                {/* Date and workout name */}
                <div className="flex items-center gap-2">
                  <Badge>
                    <CalendarIcon /> {w.date}
                  </Badge>
                  <span className="font-medium text-sm">
                    {w.name || w.date}
                  </span>
                </div>
                {/* Sets */}
                <div className="flex flex-wrap gap-1 ml-4">
                  {item.sets.map((s) => (
                    <Badge key={s.set}>
                      Set {s.set}:{" "}
                      {toDisplayWeight(s.weight, unit)} {unit} × {s.reps}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
