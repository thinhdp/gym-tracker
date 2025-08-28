import React, { useEffect, useState } from "react";
import NumberInputAutoClear from "./NumberInputAutoClear";
import WeightRepInputs from "./WeightRepInputs";
import { Button } from "./ui/Button";
import { Plus, Trash2 } from "./ui/Icons";
import { fromDisplayWeight, toDisplayWeight } from "../lib/units";
import { useConfirm } from "./ConfirmDialog";

/**
 * Editor for a single exercise within a workout.  Displays the exercise name,
 * recommended rep range (if provided), and allows reordering, removal and
 * editing of individual sets.  The add‑set control is positioned at the
 * bottom of the card per updated design.
 */
export default function WorkoutExerciseEditor({
  item,
  onChange,
  onRemove,
  unit,
  recommendRep,
  // Optional props to support reordering from parent
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}) {
  const [sets, setSets] = useState(item.sets);
  const confirm = useConfirm();

  // Keep parent informed whenever sets change
  useEffect(() => onChange({ sets }), [sets, onChange]);

  // Append a new set (up to a maximum of 5)
  const addSet = () =>
    setSets((prev) =>
      prev.length >= 5 ? prev : [...prev, { set: prev.length + 1, weight: 0, reps: 0 }]
    );

  // Delete an existing set after confirming with the user
  const delSet = (index) => {
    confirm({
      title: "Delete this set?",
      message: "This can't be undone.",
      confirmText: "Delete",
      tone: "destructive",
    }).then((ok) => {
      if (!ok) return;
      setSets((prev) =>
        prev
          .filter((_, idx) => idx !== index)
          .map((s, idx) => ({ ...s, set: idx + 1 }))
      );
    });
  };

  return (
    <div className="relative rounded-2xl border p-3 overflow-hidden">
      {/* cyan accent bar for the whole exercise */}
      <div className="absolute inset-y-0 left-0 w-1 bg-cyan-300"></div>
      <div className="mb-2 flex items-center justify-between">
        {/* Exercise title and reorder controls */}
        <div className="flex items-center gap-2 font-medium">
          <span>{item.exerciseName}</span>
          {recommendRep ? (
            <span className="ml-2 text-xs text-neutral-500">({recommendRep})</span>
          ) : null}
          {onMoveUp && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveUp}
              disabled={!canMoveUp}
            >
              ▲
            </Button>
          )}
          {onMoveDown && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveDown}
              disabled={!canMoveDown}
            >
              ▼
            </Button>
          )}
        </div>
        {/* Remove exercise */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* Header row for sets */}
      <div className="flex items-center gap-3 px-3 py-1 text-xs text-neutral-500">
        <span className="w-16" />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>Weight ({unit})</div>
          <div>Reps</div>
        </div>
        <span className="w-10" />
      </div>

      {/* List of sets */}
      <div className="grid gap-2">
        {sets.map((s, idx) => (
          <div
            key={idx}
            className="relative flex items-center gap-3 rounded-xl border px-3 py-2 shadow-sm overflow-hidden"
          >
            {/* cyan accent bar for each set */}
            <div className="absolute inset-y-0 left-0 w-1 bg-cyan-200"></div>
            <span className="w-16 text-sm text-neutral-600">Set {idx + 1}</span>
            <WeightRepInputs
              weight={toDisplayWeight(s.weight, unit)}
              reps={s.reps}
              onWeightChange={(v) => {
                setSets((prev) =>
                  prev.map((p, i) => {
                    if (i !== idx) return p;
                    return { ...p, weight: fromDisplayWeight(v, unit) };
                  })
                );
              }}
              onRepsChange={(v) => {
                setSets((prev) =>
                  prev.map((p, i) => {
                    if (i !== idx) return p;
                    return { ...p, reps: v };
                  })
                );
              }}
            />
            <Button
              variant="ghost"
              onClick={() => delSet(idx)}
              disabled={sets.length <= 1}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>

      {/* Add set control moved to bottom */}
      <div className="mt-2 flex justify-end">
        <Button variant="secondary" onClick={addSet} disabled={sets.length >= 5}>
          <Plus /> Set
        </Button>
      </div>
    </div>
  );
}
