import React, { useEffect, useState } from "react";
import NumberInputAutoClear from "./NumberInputAutoClear";
import WeightRepInputs from "./WeightRepInputs";
import { Button } from "./ui/Button";
import { Plus, Trash2 } from "./ui/Icons";
import { fromDisplayWeight, toDisplayWeight } from "../lib/units";
import { useConfirm } from "./ConfirmDialog";

export default function WorkoutExerciseEditor({
  item,
  onChange,
  onRemove,
  unit,
  recommendRep,
}) {
  const [sets, setSets] = useState(item.sets);
  const confirm = useConfirm();

  useEffect(() => onChange({ sets }), [sets, onChange]);

  const addSet = () =>
    setSets((prev) =>
      prev.length >= 5 ? prev : [...prev, { set: prev.length + 1, weight: 0, reps: 0 }]
    );

  const delSet = (i) => {
    confirm({
      title: "Delete this set?",
      message: "This can't be undone.",
      confirmText: "Delete",
      tone: "destructive",
    }).then((ok) => {
      if (!ok) return;
      setSets((prev) =>
        prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, set: idx + 1 }))
      );
    });
  };

  return (
    // Outer card with cyan accent bar and gradient background
    <div className="relative rounded-2xl border border-cyan-300 bg-gradient-to-b from-white to-cyan-50 shadow-sm p-3">
      <div className="absolute inset-y-0 left-0 w-1 bg-cyan-300 rounded-l-2xl"></div>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">
          {item.exerciseName}
          {recommendRep ? (
            <span className="ml-2 text-xs text-neutral-500">({recommendRep})</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={addSet} disabled={sets.length >= 5}>
            <Plus /> Set
          </Button>
          <Button variant="ghost" onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-1 text-xs text-neutral-500">
        <span className="w-16" />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>Weight ({unit})</div>
          <div>Reps</div>
        </div>
        <span className="w-10" />
      </div>

      <div className="grid gap-2">
        {sets.map((s, idx) => (
          <div
            key={idx}
            className="relative flex items-center gap-3 rounded-xl border border-cyan-200 bg-gradient-to-b from-white to-cyan-50 px-3 py-2 shadow-sm"
          >
            {/* Left accent bar for each set */}
            <div className="absolute inset-y-0 left-0 w-1 bg-cyan-200 rounded-l-xl"></div>
            <span className="w-16 text-sm text-neutral-600">Set {idx + 1}</span>
            <WeightRepInputs
              weight={toDisplayWeight(s.weight, unit)}
              reps={s.reps}
              onWeightChange={(v) =>
                setSets((prev) =>
                  prev.map((p, i) =>
                    i === idx ? { ...p, weight: fromDisplayWeight(v, unit) } : p
                  )
                )
              }
              onRepsChange={(v) =>
                setSets((prev) =>
                  prev.map((p, i) => (i === idx ? { ...p, reps: v } : p))
                )
              }
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
    </div>
  );
}
