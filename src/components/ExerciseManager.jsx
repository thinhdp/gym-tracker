import React, { useMemo, useState } from "react";
import { Card, CardContent } from "./ui/Card";
import { Input, Textarea } from "./ui/Input";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Check, Pencil, Trash2, X, CalendarIcon } from "./ui/Icons";
import { toDisplayWeight } from "../lib/units";
import ComboInput from "./ui/ComboInput";
import { useConfirm } from "./ConfirmDialog";

/* ... NewExerciseInline unchanged ... */

function ExerciseRow({ ex, onDelete, onUpdate, workouts, unit, options }) {
  const [editing, setEditing] = useState(false);
  const [rep, setRep] = useState(ex.recommendRep || "");
  const [mainMuscle, setMainMuscle] = useState(ex.mainMuscle || "");
  const [secondaryMuscles, setSecondaryMuscles] = useState(ex.secondaryMuscles || "");
  const [type, setType] = useState(ex.type || "");
  const [equipment, setEquipment] = useState(ex.equipment || "");
  const [force, setForce] = useState(ex.force || "");
  const confirm = useConfirm();

  const usedCount = useMemo(
    () => workouts.filter((w) => (w.exercises || []).some((e) => e.exerciseName === ex.name)).length,
    [workouts, ex.name]
  );

  return (
    <div className="rounded-2xl border p-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold">{ex.name}</h3>
            {ex.recommendRep ? <span className="text-xs text-neutral-500">({ex.recommendRep})</span> : null}
            {usedCount > 0 && <Badge>{usedCount} workouts</Badge>}
          </div>
          <div className="mt-1 text-xs text-neutral-600 flex flex-wrap gap-2">
            {ex.type && <Badge className="border-neutral-300">{ex.type}</Badge>}
            {ex.equipment && <Badge className="border-neutral-300">{ex.equipment}</Badge>}
            {ex.mainMuscle && <Badge className="border-neutral-300">Main: {ex.mainMuscle}</Badge>}
            {ex.secondaryMuscles && <Badge className="border-neutral-300">Secondary: {ex.secondaryMuscles}</Badge>}
            {ex.force && <Badge className="border-neutral-300">Force: {ex.force}</Badge>}
          </div>

          {!editing ? (
            <p className="mt-2 text-sm text-neutral-600">
              {ex.recommendRep || <span className="italic text-neutral-400">No recommendation</span>}
            </p>
          ) : (
            <div className="mt-2 grid gap-2">
              <Textarea value={rep} onChange={(e) => setRep(e.target.value)} placeholder="Recommend rep (e.g., 3x8-12)" />
              <div className="grid sm:grid-cols-2 gap-2">
                <ComboInput placeholder="Main Muscle" value={mainMuscle} onChange={setMainMuscle} options={options?.mainOptions || []} />
                <ComboInput placeholder="Secondary Muscles (comma-separated allowed)" value={secondaryMuscles} onChange={setSecondaryMuscles} options={options?.secondaryOptions || []} />
                <ComboInput placeholder="Type" value={type} onChange={setType} options={options?.typeOptions || []} />
                <ComboInput placeholder="Equipment" value={equipment} onChange={setEquipment} options={options?.equipmentOptions || []} />
                <ComboInput placeholder="Force (text)" value={force} onChange={setForce} options={options?.forceOptions || []} />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button variant="secondary" onClick={() => setEditing(true)}><Pencil /></Button>
          ) : (
            <>
              <Button variant="primary" onClick={() => { onUpdate(ex.name, { recommendRep: rep, mainMuscle, secondaryMuscles, type, equipment, force }); setEditing(false); }}><Check /></Button>
              <Button variant="ghost" onClick={() => { setRep(ex.recommendRep || ""); setMainMuscle(ex.mainMuscle || ""); setSecondaryMuscles(ex.secondaryMuscles || ""); setType(ex.type || ""); setEquipment(ex.equipment || ""); setForce(ex.force || ""); setEditing(false); }}><X /></Button>
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              confirm({
                title: `Delete exercise "${ex.name}"?`,
                message: "This removes it from your exercise database (workout history stays).",
                confirmText: "Delete",
                tone: "destructive",
              }).then((ok) => { if (ok) onDelete(ex.name); });
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="mt-2">
        <p className="text-xs font-medium text-neutral-500">Last workout</p>
        {ex.lastWorkout ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Badge><CalendarIcon /> {ex.lastWorkout.date}</Badge>
            <div className="flex flex-wrap gap-1">
              {ex.lastWorkout.sets.map((s) => (
                <Badge key={s.set}>Set {s.set}: {toDisplayWeight(s.weight, unit)} {unit} x {s.reps}</Badge>
              ))}
            </div>
          </div>
        ) : <p className="text-sm text-neutral-400">—</p>}
      </div>
    </div>
  );
}

/* The rest of ExerciseManager (list/search/NewExerciseInline) stays the same */
