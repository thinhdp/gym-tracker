import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import AddExerciseInput from "./AddExerciseInput";
import WorkoutExerciseEditor from "./WorkoutExerciseEditor";
import { useApp } from "../context/AppContext";
import { useConfirm } from "./ConfirmDialog";
import { createExerciseEntry } from "../lib/exerciseUtils";
import { moveItem } from "../lib/arrayUtils";
import { normalizeRpe, normalizeFeedback } from "../lib/rpe";
import { MAX_SETS } from "../lib/constants";
import { uuid } from "../lib/storage";

/**
 * Create or edit a Routine. No date field — routines are dateless templates.
 * Props:
 *   routine   – existing routine to edit (null for new)
 *   onSave    – called with the saved routine object
 *   onCancel  – called when user cancels
 */
export default function RoutineEditor({ routine = null, onSave, onCancel }) {
  const { exercises, setExercises, unit } = useApp();
  const confirm = useConfirm();

  const [name, setName] = useState(routine?.name ?? "");
  const [items, setItems] = useState(
    routine?.exercises
      ? routine.exercises.map((we) => ({
          ...we,
          sets: we.sets.map((s) => ({ ...s })),
        }))
      : [],
  );

  const addExerciseByName = (rawName) => {
    const entry = createExerciseEntry(rawName, exercises, setExercises);
    if (!entry) return;
    if (
      !items.some(
        (i) =>
          i.exerciseName.toLowerCase() === entry.exerciseName.toLowerCase(),
      )
    ) {
      setItems((prev) => [...prev, entry]);
    }
  };

  const moveUp = (idx) => setItems((prev) => moveItem(prev, idx, idx - 1));
  const moveDown = (idx) => setItems((prev) => moveItem(prev, idx, idx + 1));

  const handleSave = () => {
    if (!name.trim() || items.length === 0) return;
    const now = Date.now();
    const saved = {
      id: routine?.id ?? uuid(),
      name: name.trim(),
      exercises: items.map((i) => ({
        exerciseName: i.exerciseName.trim(),
        sets: i.sets.slice(0, MAX_SETS).map((s, idx) => ({
          set: idx + 1,
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
        })),
        rpe: normalizeRpe(i.rpe),
        feedback: normalizeFeedback(i.feedback),
      })),
      createdAt: routine?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(saved);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs text-neutral-600 dark:text-neutral-300">
          Routine name
        </label>
        <Input
          placeholder="e.g. Push Day A"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No exercises added yet.
          </p>
        )}
        {items.map((it, idx) => {
          const rec =
            exercises.find((e) => e.name === it.exerciseName)?.recommendRep ||
            "";
          return (
            <WorkoutExerciseEditor
              key={it.exerciseName}
              item={it}
              unit={unit}
              recommendRep={rec}
              onChange={(patch) =>
                setItems((prev) =>
                  prev.map((x) =>
                    x.exerciseName === it.exerciseName ? { ...x, ...patch } : x,
                  ),
                )
              }
              onRemove={() => {
                confirm({
                  title: `Remove "${it.exerciseName}"?`,
                  message: "This removes it from the routine.",
                  confirmText: "Remove",
                  tone: "destructive",
                }).then((ok) => {
                  if (ok)
                    setItems((prev) =>
                      prev.filter((x) => x.exerciseName !== it.exerciseName),
                    );
                });
              }}
              onMoveUp={() => moveUp(idx)}
              onMoveDown={() => moveDown(idx)}
              canMoveUp={idx > 0}
              canMoveDown={idx < items.length - 1}
              onShowHistory={() => {}}
            />
          );
        })}
      </div>

      <AddExerciseInput allExercises={exercises} onAdd={addExerciseByName} />

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!name.trim() || items.length === 0}
        >
          {routine ? "Save changes" : "Save routine"}
        </Button>
      </div>
    </div>
  );
}
