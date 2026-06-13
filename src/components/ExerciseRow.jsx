import React, { useMemo, useState } from "react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Check, Pencil, Trash2, X, CalendarIcon } from "./ui/Icons";
import { toDisplayWeight } from "../lib/units";
import ComboInput from "./ui/ComboInput";
import { useConfirm } from "./ConfirmDialog";
import { workoutsWithExercise } from "../lib/exerciseUtils";

/**
 * Individual exercise row in the exercise manager. Shows basic
 * information about the exercise and allows editing/deleting.
 * A "View history" button opens a modal listing all past workouts
 * where this exercise appeared.
 *
 * Props:
 * - ex (object)          The exercise record.
 * - onDelete (fn)        Called with the exercise name to delete it.
 * - onUpdate (fn)        Called with (name, patch) to update fields.
 * - workouts (array)     All workouts, for the used-in count.
 * - unit (string)        Display unit for weights.
 * - options (object)     Combo suggestions from extractExerciseOptions().
 * - onViewHistory (fn)   Called with the exercise name to open history.
 */
export default function ExerciseRow({
  ex,
  onDelete,
  onUpdate,
  workouts,
  unit,
  options,
  onViewHistory,
}) {
  const [editing, setEditing] = useState(false);
  const [rep, setRep] = useState(ex.recommendRep || "");
  const [mainMuscle, setMainMuscle] = useState(ex.mainMuscle || "");
  const [secondaryMuscles, setSecondaryMuscles] = useState(
    ex.secondaryMuscles || "",
  );
  const [type, setType] = useState(ex.type || "");
  const [equipment, setEquipment] = useState(ex.equipment || "");
  const [force, setForce] = useState(ex.force || "");
  const confirm = useConfirm();

  const usedCount = useMemo(
    () => workoutsWithExercise(workouts, ex.name).length,
    [workouts, ex.name],
  );

  return (
    <div className="rounded-2xl border dark:border-neutral-800 p-3 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold">
            {ex.name}
            {ex.recommendRep ? (
              <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                ({ex.recommendRep})
              </span>
            ) : null}
            {usedCount > 0 && (
              <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                {usedCount} workout
                {usedCount > 1 ? "s" : ""}
              </span>
            )}
          </h4>
          <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300 space-x-2">
            {ex.type && <span>{ex.type}</span>}
            {ex.equipment && <span>{ex.equipment}</span>}
            {ex.mainMuscle && <span>Main: {ex.mainMuscle}</span>}
            {ex.secondaryMuscles && (
              <span>Secondary: {ex.secondaryMuscles}</span>
            )}
            {ex.force && <span>Force: {ex.force}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                onClick={() => {
                  onUpdate(ex.name, {
                    recommendRep: rep,
                    mainMuscle,
                    secondaryMuscles,
                    type,
                    equipment,
                    force,
                  });
                  setEditing(false);
                }}
              >
                <Check />
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRep(ex.recommendRep || "");
                  setMainMuscle(ex.mainMuscle || "");
                  setSecondaryMuscles(ex.secondaryMuscles || "");
                  setType(ex.type || "");
                  setEquipment(ex.equipment || "");
                  setForce(ex.force || "");
                  setEditing(false);
                }}
              >
                <X />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              confirm({
                title: `Delete exercise "${ex.name}"?`,
                message:
                  "This removes it from your exercise database (workout history stays).",
                confirmText: "Delete",
                tone: "destructive",
              }).then((ok) => {
                if (ok) onDelete(ex.name);
              });
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* Editing fields when in edit mode */}
      {editing && (
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          <Input
            value={rep}
            onChange={(e) => setRep(e.target.value)}
            placeholder="Recommend rep (e.g., 3x8-12)"
          />
          <ComboInput
            placeholder="Main Muscle"
            value={mainMuscle}
            onChange={setMainMuscle}
            options={options?.mainOptions || []}
          />
          <ComboInput
            placeholder="Secondary Muscles (comma-separated allowed)"
            value={secondaryMuscles}
            onChange={setSecondaryMuscles}
            options={options?.secondaryOptions || []}
          />
          <ComboInput
            placeholder="Type"
            value={type}
            onChange={setType}
            options={options?.typeOptions || []}
          />
          <ComboInput
            placeholder="Equipment"
            value={equipment}
            onChange={setEquipment}
            options={options?.equipmentOptions || []}
          />
          <ComboInput
            placeholder="Force (text)"
            value={force}
            onChange={setForce}
            options={options?.forceOptions || []}
          />
        </div>
      )}

      {/* Last workout summary */}
      <div className="mt-2">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Last workout
        </p>
        {ex.lastWorkout ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Badge>
              <CalendarIcon /> {ex.lastWorkout.date}
            </Badge>
            <div className="flex flex-wrap gap-1">
              {ex.lastWorkout.sets.map((s) => (
                <Badge key={s.set}>
                  Set {s.set}: {toDisplayWeight(s.weight, unit)} {unit} ×{" "}
                  {s.reps}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">—</p>
        )}
      </div>

      {/* View history button */}
      <div className="mt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onViewHistory(ex.name)}
        >
          View history
        </Button>
      </div>
    </div>
  );
}
