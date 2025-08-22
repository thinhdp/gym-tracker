import React, { useEffect, useState } from "react";
import NumberInputAutoClear from "./NumberInputAutoClear";
import { Button } from "./ui/Button";
import { Plus, Trash2 } from "./ui/Icons";
import { fromDisplayWeight, toDisplayWeight } from "../lib/units";
import { useConfirm } from "./ConfirmDialog";

export default function WorkoutExerciseEditor({ item, onChange, onRemove, unit, recommendRep }) {
  const [sets, setSets] = useState(item.sets);
  const confirm = useConfirm();

  useEffect(() => onChange({ sets }), [sets, onChange]);

  const addSet = () =>
    setSets((prev) => (prev.length >= 5 ? prev : [...prev, { set: prev.length + 1, weight: 0, reps: 0 }]));

  const delSet = (i) => {
    confirm({
      title: "Delete this set?",
      message: "This can't be undone.",
      confirmText: "Delete",
      tone: "destructive",
    }).then((ok) => {
      if (!ok) return;
      setSets((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, set: idx + 1 })));
    });
  };

  return (
    <div className="rounded-2xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">
          {item.exerciseName}
          {recommendRep ? <span className="ml-2 text-xs text-neutral-500">({recommendRep})</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={addSet} disabled={sets.length >= 5}><Plus /> Set</Button>
          <Button variant="ghost" onClick={onRemove}><Trash2 /></Button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-1 text-xs text-neutral-500">
        <span className="w-16" />
        <div className="flex-1 grid grid-cols-2 gap-3"><div>Weight ({unit})</div><div>Reps</div></div>
        <span className="w-10" />
      </div>

      <div className="grid gap-2">
        {sets.map((s, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-xl border px-3 py-2">
            <span className="w-16 text-sm text-neutral-600">Set {idx + 1}</span>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                                    <NumberInputAutoClear
                      step="0.5"
                      min="0"
                      /* Compact width: replicate Input styling but limit to ~5 characters */
                      className="border rounded-xl px-3 py-1.5 text-sm w-20"
                      valueNumber={toDisplayWeight(s.weight, unit)}
                      onNumberChange={(v) =>
                        setSets((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? { ...p, weight: fromDisplayWeight(v, unit) }
                              : p
                          )
                        )
                      }
                    />
                <span className="text-xs text-neutral-500">{unit}</span>
              </div>
              <div className="flex items-center gap-2">
                <NumberInputAutoClear
                  step="1"
                  min="0"
                  className="w-24"
                  valueNumber={s.reps}
                  onNumberChange={(v) => setSets((prev) => prev.map((p, i) => (i === idx ? { ...p, reps: v } : p)))}
                />
                <span className="text-xs text-neutral-500">reps</span>
              </div>
            </div>
            <Button variant="ghost" onClick={() => delSet(idx)} disabled={sets.length <= 1}><Trash2 /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
