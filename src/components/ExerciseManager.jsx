import React, { useMemo, useState } from "react";
import { Card, CardContent } from "./ui/Card";
import { Input, Textarea } from "./ui/Input";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Check, Pencil, Trash2, X, CalendarIcon } from "./ui/Icons";
import { toDisplayWeight } from "../lib/units";

function NewExerciseInline({ existing, onCreate }) {
  const [name, setName] = useState("");
  const [rep, setRep] = useState("");
  const isUnique = useMemo(
    () => name.trim() && !existing.some((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase()),
    [existing, name],
  );
  const canSave = !!isUnique;
  const handleSave = () => {
    if (!canSave) return;
    onCreate({ name: name.trim(), recommendRep: rep.trim(), lastWorkout: null });
    setName("");
    setRep("");
  };
  return (
    <div className="mt-3 grid gap-2 rounded-xl border p-3">
      <div className="grid sm:grid-cols-2 gap-2">
        <Input placeholder="Name * (unique)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Recommend rep (e.g., 3x8-12)" value={rep} onChange={(e) => setRep(e.target.value)} />
      </div>
      {!isUnique && name && <p className="text-xs text-red-600">An exercise with this name already exists.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => { setName(""); setRep(""); }}>Reset</Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>Save</Button>
      </div>
    </div>
  );
}

function ExerciseRow({ ex, onDelete, onUpdate, workouts, unit }) {
  const [editing, setEditing] = useState(false);
  const [rep, setRep] = useState(ex.recommendRep || "");
  const usedCount = useMemo(
    () => workouts.filter((w) => (w.exercises || []).some((e) => e.exerciseName === ex.name)).length,
    [workouts, ex.name],
  );

  return (
    <div className="rounded-2xl border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{ex.name}</h3>
            {ex.recommendRep ? <span className="text-xs text-neutral-500">({ex.recommendRep})</span> : null}
            {usedCount > 0 && <Badge>{usedCount} workouts</Badge>}
          </div>
          {!editing ? (
            <p className="text-sm text-neutral-600">
              {ex.recommendRep || <span className="italic text-neutral-400">No recommendation</span>}
            </p>
          ) : (
            <Textarea value={rep} onChange={(e) => setRep(e.target.value)} />
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button variant="secondary" onClick={() => setEditing(true)}><Pencil /></Button>
          ) : (
            <>
              <Button variant="primary" onClick={() => { onUpdate(ex.name, { recommendRep: rep }); setEditing(false); }}>
                <Check />
              </Button>
              <Button variant="ghost" onClick={() => { setRep(ex.recommendRep || ""); setEditing(false); }}>
                <X />
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={() => onDelete(ex.name)}><Trash2 /></Button>
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
        ) : (
          <p className="text-sm text-neutral-400">—</p>
        )}
      </div>
    </div>
  );
}

export default function ExerciseManager({ exercises, setExercises, workouts, unit }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => exercises.filter((e) => e.name.toLowerCase().includes(query.toLowerCase())),
    [exercises, query],
  );

  const onCreate = (ex) => setExercises((prev) => [...prev, ex]);
  const onDelete = (name) => setExercises((prev) => prev.filter((e) => e.name !== name));
  const onUpdate = (name, patch) =>
    setExercises((prev) => prev.map((e) => (e.name === name ? { ...e, ...patch, name: e.name } : e)));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input placeholder="Search exercises..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <NewExerciseInline existing={exercises} onCreate={onCreate} />
          <div className="grid gap-3 mt-3">
            {filtered.length === 0 && <p className="text-sm text-neutral-500">No exercises yet. Add one to get started.</p>}
            {filtered.map((e) => (
              <ExerciseRow key={e.name} ex={e} onDelete={onDelete} onUpdate={onUpdate} workouts={workouts} unit={unit} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
