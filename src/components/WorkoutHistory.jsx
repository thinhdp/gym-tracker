import React, { useState } from "react";
import ExerciseHistoryModal from "./ExerciseHistoryModal";
import WorkoutHistoryItem from "./WorkoutHistoryItem";
import { createExerciseEntry } from "../lib/exerciseUtils";
import { useApp } from "../context/AppContext";
import { moveItem } from "../lib/arrayUtils";

/**
 * History component for editing existing workouts.  Uses AppContext
 * to access workouts, exercises and unit; no props required.
 * Rendering of each workout card lives in WorkoutHistoryItem.
 */
export default function WorkoutHistory() {
  const {
    workouts,
    setWorkouts,
    exercises,
    setExercises,
    unit,
  } = useApp();
  const [expandedId, setExpandedId] = useState(null);
  const [historyExercise, setHistoryExercise] = useState(null);

  // Helper to update a workout by id and keep list sorted by date
  const updateWorkout = (id, patch) => {
    setWorkouts((prev) =>
      prev
        .map((w) => (w.id === id ? { ...w, ...patch } : w))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    );
  };

  // Delete a workout entirely
  const deleteWorkout = (id) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  };

  // Use helper to create or fetch exercise and prefill sets
  const addExerciseToWorkout = (workout, exerciseName) => {
    const entry = createExerciseEntry(exerciseName, exercises, setExercises);
    if (!entry) return;
    updateWorkout(workout.id, {
      exercises: [...workout.exercises, entry],
    });
  };

  const moveExercise = (workoutId, idx, delta) => {
    setWorkouts((prev) =>
      prev
        .map((w) =>
          w.id === workoutId
            ? { ...w, exercises: moveItem(w.exercises, idx, idx + delta) }
            : w
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    );
  };

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
        History
      </h3>
      {workouts.length === 0 && (
        <p className="text-sm text-neutral-500">No workouts logged yet.</p>
      )}
      {workouts.map((w) => (
        <WorkoutHistoryItem
          key={w.id}
          workout={w}
          expanded={expandedId === w.id}
          onToggle={() =>
            setExpandedId((prev) => (prev === w.id ? null : w.id))
          }
          exercises={exercises}
          unit={unit}
          updateWorkout={updateWorkout}
          deleteWorkout={deleteWorkout}
          onMoveExerciseUp={(idx) => moveExercise(w.id, idx, -1)}
          onMoveExerciseDown={(idx) => moveExercise(w.id, idx, +1)}
          addExerciseToWorkout={addExerciseToWorkout}
          onShowHistory={setHistoryExercise}
        />
      ))}
      {/* Shared history modal */}
      <ExerciseHistoryModal
        exerciseName={historyExercise}
        workouts={workouts}
        unit={unit}
        onClose={() => setHistoryExercise(null)}
      />
    </div>
  );
}
