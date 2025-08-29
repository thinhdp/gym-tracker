import React, { useMemo, useState } from "react";
import { Card, CardContent } from "./ui/Card";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Check, Pencil, Trash2, X, CalendarIcon } from "./ui/Icons";
import { toDisplayWeight } from "../lib/units";
import ComboInput from "./ui/ComboInput";
import { useConfirm } from "./ConfirmDialog";
import { useApp } from "../context/AppContext";

/**
 * Inline component to create a new exercise. Collects various
 * attributes such as recommended reps, muscle groups, type, etc.
 */
function NewExerciseInline({ existing, onCreate }) {
  const [name, setName] = useState("");
  const [rep, setRep] = useState("");
  const [mainMuscle, setMainMuscle] = useState("");
  const [secondaryMuscles, setSecondaryMuscles] = useState("");
  const [type, setType] = useState("");
  const [equipment, setEquipment] = useState("");
  const [force, setForce] = useState("");

  const {
    mainOptions,
    secondaryOptions,
    typeOptions,
    equipmentOptions,
    forceOptions,
  } = useMemo(() => {
    const mm = new Set(),
      sm = new Set(),
      t = new Set(),
      eq = new Set(),
      f = new Set();
    for (const e of existing) {
      if (e.mainMuscle) mm.add(String(e.mainMuscle).trim());
      if (e.secondaryMuscles)
        String(e.secondaryMuscles)
          .split(",")
          .forEach((s) => {
            const v = s.trim();
            if (v) sm.add(v);
          });
      if (e.type) t.add(String(e.type).trim());
      if (e.equipment) eq.add(String(e.equipment).trim());
      if (e.force) f.add(String(e.force).trim());
    }
    return {
      mainOptions: [...mm],
      secondaryOptions: [...sm],
      typeOptions: [...t],
      equipmentOptions: [...eq],
      forceOptions: [...f],
    };
  }, [existing]);

  const isUnique = useMemo(
    () =>
      name.trim() &&
      !existing.some(
        (e) =>
          e.name.trim().toLowerCase() === name.trim().toLowerCase()
      ),
    [existing, name]
  );
  const handleSave = () => {
    if (!isUnique) return;
    onCreate({
      name: name.trim(),
      recommendRep: rep.trim(),
      mainMuscle: mainMuscle.trim(),
      secondaryMuscles: secondaryMuscles.trim(),
      type: type.trim(),
      equipment: equipment.trim(),
      force: force.trim(),
      lastWorkout: null,
    });
    setName("");
    setRep("");
    setMainMuscle("");
    setSecondaryMuscles("");
    setType("");
    setEquipment("");
    setForce("");
  };

  return (
    <div className="mt-3 space-y-2 p-3 rounded-xl border bg-neutral-50">
      <div className="grid sm:grid-cols-2 gap-2">
        <Input
          placeholder="Exercise name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Recommend rep (e.g., 3x8-12)"
          value={rep}
          onChange={(e) => setRep(e.target.value)}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <ComboInput
          placeholder="Main Muscle"
          value={mainMuscle}
          onChange={setMainMuscle}
          options={mainOptions}
        />
        <ComboInput
          placeholder="Secondary Muscles (comma-separated allowed)"
          value={secondaryMuscles}
          onChange={setSecondaryMuscles}
          options={secondaryOptions}
        />
        <ComboInput
          placeholder="Type"
          value={type}
          onChange={setType}
          options={typeOptions}
        />
        <ComboInput
          placeholder="Equipment"
          value={equipment}
          onChange={setEquipment}
          options={equipmentOptions}
        />
        <ComboInput
          placeholder="Force (text)"
          value={force}
          onChange={setForce}
          options={forceOptions}
        />
      </div>
      {!isUnique && name && (
        <p className="text-sm text-red-600">
          An exercise with this name already exists.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setName("");
            setRep("");
            setMainMuscle("");
            setSecondaryMuscles("");
            setType("");
            setEquipment("");
            setForce("");
          }}
        >
          Reset
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isUnique}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

/**
 * Individual exercise row in the exercise manager. Shows basic
 * information about the exercise and allows editing/deleting.
 * A "View history" button opens a modal listing all past workouts
 * where this exercise appeared.
 */
function ExerciseRow({
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
    ex.secondaryMuscles || ""
  );
  const [type, setType] = useState(ex.type || "");
  const [equipment, setEquipment] = useState(ex.equipment || "");
  const [force, setForce] = useState(ex.force || "");
  const confirm = useConfirm();

  const usedCount = useMemo(
    () =>
      workouts.filter((w) =>
        (w.exercises || []).some(
          (e) => e.exerciseName === ex.name
        )
      ).length,
    [workouts, ex.name]
  );

  return (
    <div className="rounded-2xl border p-3 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold">
            {ex.name}
            {ex.recommendRep ? (
              <span className="ml-2 text-xs text-neutral-500">
                ({ex.recommendRep})
              </span>
            ) : null}
            {usedCount > 0 && (
              <span className="ml-2 text-xs text-neutral-500">
                {usedCount} workout
                {usedCount > 1 ? "s" : ""}
              </span>
            )}
          </h4>
          <div className="mt-1 text-sm text-neutral-600 space-x-2">
            {ex.type && <span>{ex.type}</span>}
            {ex.equipment && <span>{ex.equipment}</span>}
            {ex.mainMuscle && (
              <span>Main: {ex.mainMuscle}</span>
            )}
            {ex.secondaryMuscles && (
              <span>Secondary: {ex.secondaryMuscles}</span>
            )}
            {ex.force && <span>Force: {ex.force}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button
              variant="secondary"
              onClick={() => setEditing(true)}
            >
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
        <p className="text-xs font-medium text-neutral-500">
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
                  Set {s.set}: {toDisplayWeight(s.weight, unit)}{" "}
                  {unit} × {s.reps}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">—</p>
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

/**
 * Top-level component for managing exercises. Provides search, creation
 * and editing capabilities. A modal popup is used to display a full
 * history of any exercise across all recorded workouts.
 */
export default function ExerciseManager() {
  const { exercises, setExercises, workouts, unit } = useApp();
  const [query, setQuery] = useState("");
  // Holds the name of the exercise whose history is being viewed.
  const [historyExercise, setHistoryExercise] = useState(null);

  const {
    mainOptions,
    secondaryOptions,
    typeOptions,
    equipmentOptions,
    forceOptions,
  } = useMemo(() => {
    const mm = new Set(),
      sm = new Set(),
      t = new Set(),
      eq = new Set(),
      f = new Set();
    for (const e of exercises) {
      if (e.mainMuscle) mm.add(String(e.mainMuscle).trim());
      if (e.secondaryMuscles)
        String(e.secondaryMuscles)
          .split(",")
          .forEach((s) => {
            const v = s.trim();
            if (v) sm.add(v);
          });
      if (e.type) t.add(String(e.type).trim());
      if (e.equipment) eq.add(String(e.equipment).trim());
      if (e.force) f.add(String(e.force).trim());
    }
    return {
      mainOptions: [...mm],
      secondaryOptions: [...sm],
      typeOptions: [...t],
      equipmentOptions: [...eq],
      forceOptions: [...f],
    };
  }, [exercises]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => {
      const hay = [
        e.name,
        e.mainMuscle,
        e.secondaryMuscles,
        e.type,
        e.equipment,
        e.force,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [exercises, query]);

  const onCreate = (ex) =>
    setExercises((prev) => [...prev, ex]);
  const onDelete = (name) =>
    setExercises((prev) =>
      prev.filter((e) => e.name !== name)
    );
  const onUpdate = (name, patch) =>
    setExercises((prev) =>
      prev.map((e) =>
        e.name === name ? { ...e, ...patch, name: e.name } : e
      )
    );

  // Callback to open the history modal for a specific exercise
  const onViewHistory = (exerciseName) => {
    setHistoryExercise(exerciseName);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Input
              placeholder="Search (name, type, muscles, equipment, force)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <NewExerciseInline
            existing={exercises}
            onCreate={onCreate}
          />
          <div className="grid gap-3 mt-4">
            {filtered.length === 0 && (
              <p className="text-sm text-neutral-500">
                No exercises yet. Add one to get started.
              </p>
            )}
            {filtered.map((e) => (
              <ExerciseRow
                key={e.name}
                ex={e}
                onDelete={onDelete}
                onUpdate={onUpdate}
                workouts={workouts}
                unit={unit}
                options={{
                  mainOptions,
                  secondaryOptions,
                  typeOptions,
                  equipmentOptions,
                  forceOptions,
                }}
                onViewHistory={onViewHistory}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal popup for viewing exercise history across past workouts */}
      {historyExercise && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-xl shadow-lg p-4 overflow-y-auto max-h-[80vh]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-medium">
                  {historyExercise}
                </div>
                <div className="text-sm text-neutral-500">
                  Past workouts containing this exercise
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => setHistoryExercise(null)}
              >
                Close
              </Button>
            </div>
            <div className="space-y-3">
              {workouts.filter((w) =>
                (w.exercises || []).some(
                  (e) => e.exerciseName === historyExercise
                )
              ).length === 0 && (
                <p className="text-sm text-neutral-500">
                  No past workouts.
                </p>
              )}
              {workouts
                .filter((w) =>
                  (w.exercises || []).some(
                    (e) => e.exerciseName === historyExercise
                  )
                )
                .map((w) => {
                  const item = (w.exercises || []).find(
                    (e) =>
                      e.exerciseName === historyExercise
                  );
                  if (!item) return null;
                  return (
                    <div
                      key={w.id}
                      className="border rounded-lg p-3 space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <Badge>
                          <CalendarIcon /> {w.date}
                        </Badge>
                        <span className="font-medium text-sm">
                          {w.name || w.date}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 ml-4">
                        {item.sets.map((s) => (
                          <Badge key={s.set}>
                            Set {s.set}:{" "}
                            {toDisplayWeight(s.weight, unit)}{" "}
                            {unit} × {s.reps}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
