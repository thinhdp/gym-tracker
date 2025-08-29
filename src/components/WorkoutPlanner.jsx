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
import { createExerciseEntry } from "../lib/exerciseUtils";
import { useApp } from "../context/AppContext";

/**
 * Planner component for creating a new workout.  Uses AppContext
 * for exercises, workouts and unit; onCreated callback remains optional.
 */
export default function WorkoutPlanner({ onCreated }) {
  const {
    exercises,
    setExercises,
    workouts,
    setWorkouts,
    unit,
  } = useApp();

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

  // Use helper to create or fetch exercise and prefill sets
  const addExerciseByName = (rawName) => {
    const entry = createExerciseEntry(
      rawName,
      exercises,
      setExercises
    );
    if (!entry) return;
    if (
      !items.some(
        (i) =>
          i.exerciseName.toLowerCase() ===
          entry.exerciseName.toLowerCase()
      )
    ) {
      setItems((prev) => [...prev, entry]);
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
        {/* ... rest of the component remains unchanged ... */}
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
