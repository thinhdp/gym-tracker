import React, { useMemo, useState } from "react";
import { Input } from "./ui/Input";
import { useApp } from "../context/AppContext";
import { extractExerciseOptions } from "../lib/exerciseUtils";
import NewExerciseInline from "./NewExerciseInline";
import ExerciseRow from "./ExerciseRow";
import ExerciseHistoryModal from "./ExerciseHistoryModal";

/** Distinct, sorted mainMuscle values present in the library (non-empty). */
function muscleGroups(exercises) {
  const set = new Set();
  for (const e of exercises) {
    const m = e.mainMuscle?.trim();
    if (m) set.add(m);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Top-level component for managing exercises. Provides search, muscle-group
 * filtering, creation and editing. A modal popup displays a full history of any
 * exercise across all recorded workouts.
 */
export default function ExerciseManager() {
  const { exercises, setExercises, workouts, unit } = useApp();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [historyExercise, setHistoryExercise] = useState(null);

  const options = useMemo(() => extractExerciseOptions(exercises), [exercises]);
  const groups = useMemo(() => muscleGroups(exercises), [exercises]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (muscle !== "all" && e.mainMuscle?.trim() !== muscle) return false;
      if (!q) return true;
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
  }, [exercises, query, muscle]);

  const onCreate = (ex) => {
    setExercises((prev) => [...prev, ex]);
    setShowCreate(false);
  };
  const onDelete = (name) =>
    setExercises((prev) => prev.filter((e) => e.name !== name));
  const onUpdate = (name, patch) =>
    setExercises((prev) =>
      prev.map((e) => (e.name === name ? { ...e, ...patch, name: e.name } : e)),
    );

  const chip = (key, label) => {
    const active = muscle === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setMuscle(key)}
        aria-pressed={active}
        className={[
          "whitespace-nowrap rounded-full px-3 py-1 text-xs transition",
          active
            ? "bg-blue-600 text-white"
            : "border bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Exercises
          <span className="ml-2 text-sm font-normal text-neutral-400 dark:text-neutral-500">
            {exercises.length}
          </span>
        </h1>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          aria-expanded={showCreate}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-lg text-white transition hover:bg-blue-700"
          aria-label="New exercise"
        >
          {showCreate ? "×" : "+"}
        </button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search (name, type, muscles, equipment, force)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Muscle-group filter chips */}
      {groups.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chip("all", "All")}
          {groups.map((m) => chip(m, m))}
        </div>
      )}

      {/* Collapsible create form */}
      {showCreate && (
        <div className="rounded-2xl border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <NewExerciseInline
            existing={exercises}
            options={options}
            onCreate={onCreate}
          />
        </div>
      )}

      {/* Exercise list */}
      <div className="grid gap-3">
        {filtered.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No exercises match. Try a different search or filter.
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
            onViewHistory={setHistoryExercise}
          />
        ))}
      </div>

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
