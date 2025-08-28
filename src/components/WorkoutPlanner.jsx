import React, { useState } from "react";
import { Card, CardContent } from "./ui/Card";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import AddExerciseInput from "./AddExerciseInput";
import WorkoutExerciseEditor from "./WorkoutExerciseEditor";
import { todayStr, uuid } from "../lib/storage";
import { useConfirm } from "./ConfirmDialog";
import ExerciseHistoryModal from "./ExerciseHistoryModal";

/**
 * Planner component for creating a new workout.  Allows the user to specify
 * multiple dates, name the workout, add exercises and arrange them.  The
 * reorder buttons are passed through to the editor so they appear within
 * the card header and the add‑set button is rendered at the bottom of
 * each exercise card.  A history modal can be invoked by tapping on an
 * exercise name.
 */
export default function WorkoutPlanner({
  exercises,
  setExercises,
  workouts,
  setWorkouts,
  unit,
  onCreated,
}) {
  const [dates, setDates] = useState([todayStr()]);
  const [name, setName] = useState("");
  const [items, setItems] = useState([]);
  const confirm = useConfirm();
  const [historyExercise, setHistoryExercise] = useState(null);

  // Helper to move an element in an array
  const moveItem = (arr, from, to) => {
    if (to < 0 || to >= arr.length) return arr;
    const next = arr.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    return next;
  };

  const moveItemUp = (idx) =>
    setItems((prev) => moveItem(prev, idx, idx - 1));
  const moveItemDown = (idx) =>
    setItems((prev) => moveItem(prev, idx, idx + 1));

  const addDate = () =>
    setDates((prev) => [...prev, todayStr()]);
  const removeDate = (idx) =>
    setDates((prev) => prev.filter((_, i) => i !== idx));
  const setDateAt = (idx, val) =>
    setDates((prev) =>
      prev.map((d, i) => (i === idx ? val : d))
    );

  const addExerciseByName = (rawName) => {
    const n = (rawName || "").trim();
    if (!n) return;
    const exists = exercises.find(
      (e) => e.name.toLowerCase() === n.toLowerCase()
    );
    if (!exists) {
      const created = {
        name: n,
        recommendRep: "",
        lastWorkout: null,
        mainMuscle: "",
        secondaryMuscles: "",
        type: "",
        equipment: "",
        force: "",
      };
      setExercises((prev) => [...prev, created]);
    }
    if (
      !items.some(
        (i) => i.exerciseName.toLowerCase() === n.toLowerCase()
      )
    ) {
      let initSets = [{ set: 1, weight: 0, reps: 0 }];
      if (exists?.lastWorkout?.sets?.length) {
        const last = exists.lastWorkout.sets.at(-1);
        initSets = [
          {
            set: 1,
            weight: last.weight || 0,
            reps: last.reps || 0,
          },
        ];
      }
      setItems((prev) => [
        ...prev,
        { exerciseName: n, sets: initSets },
      ]);
    }
  };

  const saveWorkout = () => {
    if (items.length === 0 || dates.length === 0) return;
    const created = dates.map((date) => ({
      id: uuid(),
      date,
      name: (name && name.trim()) || date,
      exercises: items.map((i) => ({
        exerciseName: i.exerciseName.trim(),
        sets: i.sets
          .slice(0, 5)
          .map((s, idx) => ({
            set: idx + 1,
            weight: Number(s.weight) || 0,
            reps: Number(s.reps) || 0,
          })),
      })),
    }));
    setWorkouts((prev) =>
      [...created, ...prev].sort((a, b) =>
        a.date < b.date ? 1 : -1
      )
    );
    setDates([todayStr()]);
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
          {/* Date inputs */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-600">
              Workout date(s)
            </label>
            {dates.map((d, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="date"
                  value={d}
                  onChange={(e) => setDateAt(idx, e.target.value)}
                />
                <Button
                  variant="ghost"
                  onClick={() => {
                    confirm({
                      title: "Remove this date?",
                      message:
                        "This only removes the date from the plan.",
                      confirmText: "Remove",
                      tone: "destructive",
                    }).then((ok) => {
                      if (ok) removeDate(idx);
                    });
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="secondary" onClick={addDate}>
              Add another date
            </Button>
          </div>

          {/* Workout name */}
          <div className="space-y-1">
            <label className="text-xs text-neutral-600">
              Workout name (optional)
            </label>
            <Input
              placeholder="If blank, uses date"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Add exercise */}
          <AddExerciseInput
            allExercises={exercises}
            onAdd={addExerciseByName}
          />

          {/* Exercises list */}
          <div className="space-y-2">
            {items.length === 0 && (
              <p className="text-sm text-neutral-500">
                No exercises added yet.
              </p>
            )}
            {items.map((it, idx) => {
              const rec =
                exercises.find(
                  (e) => e.name === it.exerciseName
                )?.recommendRep || "";
              return (
                <WorkoutExerciseEditor
                  key={it.exerciseName}
                  item={it}
                  unit={unit}
                  recommendRep={rec}
                  onChange={(patch) =>
                    setItems((prev) =>
                      prev.map((x) =>
                        x.exerciseName === it.exerciseName
                          ? { ...x, ...patch }
                          : x
                      )
                    )
                  }
                  onRemove={() => {
                    confirm({
                      title: `Remove "${it.exerciseName}"?`,
                      message:
                        "This removes it from the current plan.",
                      confirmText: "Remove",
                      tone: "destructive",
                    }).then((ok) => {
                      if (ok)
                        setItems((prev) =>
                          prev.filter(
                            (x) =>
                              x.exerciseName !== it.exerciseName
                          )
                        );
                    });
                  }}
                  onMoveUp={() => moveItemUp(idx)}
                  onMoveDown={() => moveItemDown(idx)}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < items.length - 1}
                  onShowHistory={(name) =>
                    setHistoryExercise(name)
                  }
                />
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setItems([]);
                setName("");
                setDates([todayStr()]);
              }}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              onClick={saveWorkout}
              disabled={items.length === 0}
            >
              Save Workouts
            </Button>
          </div>
        </div>
      </CardContent>

      {/* History modal reused across components */}
      <ExerciseHistoryModal
        exerciseName={historyExercise}
        workouts={workouts}
        unit={unit}
        onClose={() => setHistoryExercise(null)}
      />
    </Card>
  );
}
