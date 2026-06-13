import React, { useMemo, useState } from "react";
import { Card, CardContent } from "./ui/Card";
import { Input } from "./ui/Input";
import { useApp } from "../context/AppContext";
import { extractExerciseOptions } from "../lib/exerciseUtils";
import NewExerciseInline from "./NewExerciseInline";
import ExerciseRow from "./ExerciseRow";
import ExerciseHistoryModal from "./ExerciseHistoryModal";

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

  const options = useMemo(() => extractExerciseOptions(exercises), [exercises]);

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

  const onCreate = (ex) => setExercises((prev) => [...prev, ex]);
  const onDelete = (name) =>
    setExercises((prev) => prev.filter((e) => e.name !== name));
  const onUpdate = (name, patch) =>
    setExercises((prev) =>
      prev.map((e) => (e.name === name ? { ...e, ...patch, name: e.name } : e)),
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
            options={options}
            onCreate={onCreate}
          />
          <div className="grid gap-3 mt-4">
            {filtered.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
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
                options={options}
                onViewHistory={onViewHistory}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal popup for viewing exercise history across past workouts */}
      <ExerciseHistoryModal
        exerciseName={historyExercise}
        workouts={workouts}
        unit={unit}
        onClose={() => setHistoryExercise(null)}
      />
    </div>
  );
}
