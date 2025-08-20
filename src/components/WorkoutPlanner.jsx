import React, { useState } from "react";
import { Card, CardContent } from "./ui/Card";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import AddExerciseInput from "./AddExerciseInput";
import WorkoutExerciseEditor from "./WorkoutExerciseEditor";
import { todayStr, uuid } from "../lib/storage";

export default function WorkoutPlanner({ exercises, setExercises, workouts, setWorkouts, unit, onCreated }) {
  const [date, setDate] = useState(todayStr());
  const [name, setName] = useState("");
  const [items, setItems] = useState([]);

  const addExerciseByName = (rawName) => {
    const n = (rawName || "").trim();
    if (!n) return;
    const exists = exercises.find((e) => e.name.toLowerCase() === n.toLowerCase());

    if (!exists) {
      const created = { name: n, recommendRep: "", lastWorkout: null };
      setExercises((prev) => [...prev, created]);
    }

    if (!items.some((i) => i.exerciseName.toLowerCase() === n.toLowerCase())) {
      let initSets = [{ set: 1, weight: 0, reps: 0 }];
      if (exists?.lastWorkout?.sets?.length) {
        const lastSet = exists.lastWorkout.sets[exists.lastWorkout.sets.length - 1];
        initSets = [{ set: 1, weight: lastSet.weight || 0, reps: lastSet.reps || 0 }];
      }
      setItems((prev) => [...prev, { exerciseName: n, sets: initSets }]);
    }
  };

  const saveWorkout = () => {
    if (items.length === 0) return;
    const w = {
      id: uuid(),
      date,
      name: (name && name.trim()) || date,
      exercises: items.map((i) => ({
        exerciseName: i.exerciseName.trim(),
        sets: i.sets.slice(0, 5).map((s, idx) => ({ set: idx + 1, weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
      })),
    };
    setWorkouts((prev) => [w, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1)));
    setDate(todayStr());
    setName("");
    setItems([]);
    onCreated && onCreated();
  };

  return (
    <Card className="mb-4">
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Plan / Log Workout</h2>
          <Badge>Up to 5 sets / exercise</Badge>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-neutral-600">Workout date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-neutral-600">Workout name (optional)</label>
              <Input placeholder="If blank, uses date" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <AddExerciseInput allExercises={exercises} onAdd={addExerciseByName} />

          <div className="space-y-2">
            {items.length === 0 && <p className="text-sm text-neutral-500">No exercises added yet.</p>}
            {items.map((it) => {
              const rec = exercises.find((e) => e.name === it.exerciseName)?.recommendRep || "";
              return (
                <WorkoutExerciseEditor
                  key={it.exerciseName}
                  item={it}
                  unit={unit}
                  recommendRep={rec}
                  onChange={(patch) => setItems((prev) => prev.map((x) => (x.exerciseName === it.exerciseName ? { ...x, ...patch } : x)))}
                  onRemove={() => setItems((prev) => prev.filter((x) => x.exerciseName !== it.exerciseName))}
                />
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setItems([]); setName(""); setDate(todayStr()); }}>Reset</Button>
            <Button variant="primary" onClick={saveWorkout} disabled={items.length === 0}>Save Workout</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
