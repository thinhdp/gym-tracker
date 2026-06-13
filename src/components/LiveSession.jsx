import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { toDisplayWeight, fromDisplayWeight } from "../lib/units";
import { createExerciseEntry } from "../lib/exerciseUtils";
import { MAX_SETS } from "../lib/constants";
import {
  isSetDone,
  toggleDone,
  doneCount,
  totalSets,
  formatClock,
} from "../lib/liveSession";
import WeightRepInputs from "./WeightRepInputs";
import AddExerciseInput from "./AddExerciseInput";

// Rest-timer presets: [label, seconds].
const REST_PRESETS = [
  ["3 min", 180],
  ["2 min", 120],
  ["1.5 min", 90],
];

export default function LiveSession() {
  const {
    session,
    setSession,
    workouts,
    setWorkouts,
    exercises,
    setExercises,
    unit,
    endSession,
  } = useApp();

  const workout = workouts.find((w) => w.id === session?.workoutId) || null;

  // Tick the elapsed clock once a second.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Manual rest timer: null when idle, else seconds remaining. The countdown
  // ticks inside the timeout callback and clears itself at zero, so the effect
  // body never sets state synchronously.
  const [restLeft, setRestLeft] = useState(null);
  useEffect(() => {
    if (restLeft == null || restLeft <= 0) return undefined;
    const id = setTimeout(
      () => setRestLeft((s) => (s != null && s <= 1 ? null : s - 1)),
      1000,
    );
    return () => clearTimeout(id);
  }, [restLeft]);

  // If the workout vanished (e.g. deleted elsewhere), close the session.
  useEffect(() => {
    if (session && !workout) endSession();
  }, [session, workout, endSession]);
  if (!workout) return null;

  const exs = workout.exercises || [];
  const currentIdx = Math.min(
    session.currentIdx || 0,
    Math.max(0, exs.length - 1),
  );
  const current = exs[currentIdx] || null;
  const elapsed = Math.floor((nowTs - (session.startedAt || nowTs)) / 1000);

  // --- mutations (write through to the persisted workout) ---
  const patchWorkout = (updater) =>
    setWorkouts((prev) =>
      prev.map((w) => (w.id === workout.id ? updater(w) : w)),
    );

  const mapExercise = (exIdx, fn) =>
    patchWorkout((w) => ({
      ...w,
      exercises: w.exercises.map((ex, i) => (i === exIdx ? fn(ex) : ex)),
    }));

  const updateSet = (exIdx, setIdx, patch) =>
    mapExercise(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)),
    }));

  const addSet = (exIdx) =>
    mapExercise(exIdx, (ex) => {
      if (ex.sets.length >= MAX_SETS) return ex;
      const last = ex.sets.at(-1) || { weight: 0, reps: 0 };
      return {
        ...ex,
        sets: [
          ...ex.sets,
          { set: ex.sets.length + 1, weight: last.weight, reps: last.reps },
        ],
      };
    });

  const removeSet = (exIdx, setIdx) =>
    mapExercise(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets
        .filter((_, j) => j !== setIdx)
        .map((s, k) => ({ ...s, set: k + 1 })),
    }));

  const addExercise = (name) => {
    const entry = createExerciseEntry(name, exercises, setExercises);
    if (!entry) return;
    const newIdx = exs.length;
    patchWorkout((w) => ({ ...w, exercises: [...w.exercises, entry] }));
    setSession((s) => ({ ...s, currentIdx: newIdx }));
  };

  const toggleSetDone = (exIdx, setIdx) =>
    setSession((s) => ({ ...s, done: toggleDone(s.done, exIdx, setIdx) }));

  const goTo = (idx) => setSession((s) => ({ ...s, currentIdx: idx }));
  const setName = (name) => patchWorkout((w) => ({ ...w, name }));

  const finish = () => {
    // Drop an abandoned empty workout so it doesn't litter history.
    if (exs.length === 0) {
      setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
    }
    endSession();
  };

  const completed = doneCount(session.done);
  const total = totalSets(workout);

  const surface =
    "rounded-2xl border bg-white dark:border-neutral-800 dark:bg-neutral-900";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-950">
      {/* Top bar */}
      <div className="border-b bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <input
              value={workout.name || ""}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workout"
              className="w-full bg-transparent text-base font-semibold text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100"
            />
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {formatClock(elapsed)} elapsed · {completed}/{total} sets
            </div>
          </div>
          <button
            type="button"
            onClick={finish}
            className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-neutral-800"
          >
            Finish
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Exercise nav chips */}
          {exs.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {exs.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className={[
                    "whitespace-nowrap rounded-full px-3 py-1 text-xs transition",
                    i === currentIdx
                      ? "bg-blue-600 text-white"
                      : "border bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
                  ].join(" ")}
                >
                  {i + 1}. {ex.exerciseName}
                </button>
              ))}
            </div>
          )}

          {/* Current exercise */}
          {current ? (
            <div className={`${surface} p-4`}>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Exercise {currentIdx + 1} of {exs.length}
              </div>
              <div className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {current.exerciseName}
              </div>

              {/* Column headers */}
              <div className="mb-1 grid grid-cols-[28px,1fr,40px] items-center gap-2 px-1 text-[10px] uppercase text-neutral-400 dark:text-neutral-500">
                <span>Set</span>
                <span className="grid grid-cols-2 gap-3">
                  <span className="text-center">{unit}</span>
                  <span className="text-center">reps</span>
                </span>
                <span className="text-center">done</span>
              </div>

              {/* Set rows */}
              <div className="space-y-2">
                {current.sets.map((s, j) => {
                  const done = isSetDone(session.done, currentIdx, j);
                  return (
                    <div
                      key={j}
                      className="grid grid-cols-[28px,1fr,40px] items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => removeSet(currentIdx, j)}
                        aria-label={`Remove set ${j + 1}`}
                        className="text-sm text-neutral-500 hover:text-red-600 dark:text-neutral-400"
                        title="Remove set"
                      >
                        {j + 1}
                      </button>
                      <WeightRepInputs
                        weight={toDisplayWeight(s.weight, unit)}
                        reps={s.reps}
                        onWeightChange={(v) =>
                          updateSet(currentIdx, j, {
                            weight: fromDisplayWeight(v, unit),
                          })
                        }
                        onRepsChange={(v) =>
                          updateSet(currentIdx, j, { reps: v })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => toggleSetDone(currentIdx, j)}
                        aria-label={`Mark set ${j + 1} done`}
                        aria-pressed={done}
                        className={[
                          "mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-sm transition",
                          done
                            ? "border-green-600 bg-green-600 text-white"
                            : "border-neutral-300 text-neutral-400 hover:border-green-600 dark:border-neutral-600 dark:text-neutral-500",
                        ].join(" ")}
                      >
                        ✓
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => addSet(currentIdx)}
                disabled={current.sets.length >= MAX_SETS}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-300 py-2 text-sm text-blue-600 transition hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-blue-400 dark:hover:bg-neutral-800"
              >
                + Add set
              </button>
            </div>
          ) : (
            <div className={`${surface} p-4 text-center`}>
              <div className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">
                No exercises yet
              </div>
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                Add your first exercise to start logging.
              </div>
            </div>
          )}

          {/* Add exercise */}
          <div className={`${surface} p-4`}>
            <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Add exercise
            </div>
            <AddExerciseInput allExercises={exercises} onAdd={addExercise} />
          </div>
        </div>
      </div>

      {/* Bottom bar: rest timer + prev/next */}
      <div className="border-t bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-3xl space-y-3">
          {/* Rest timer (manual) */}
          {restLeft == null ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Rest
              </span>
              {REST_PRESETS.map(([label, secs]) => (
                <button
                  key={secs}
                  type="button"
                  onClick={() => setRestLeft(secs)}
                  className="flex-1 rounded-xl bg-neutral-100 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-blue-50 px-3 py-2 dark:bg-neutral-800">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Rest · {formatClock(restLeft)}
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRestLeft((s) => Math.max(0, s - 15))}
                  className="rounded-lg px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-neutral-700"
                >
                  −15s
                </button>
                <button
                  type="button"
                  onClick={() => setRestLeft((s) => s + 15)}
                  className="rounded-lg px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-neutral-700"
                >
                  +15s
                </button>
                <button
                  type="button"
                  onClick={() => setRestLeft(null)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-neutral-700"
                >
                  Skip
                </button>
              </span>
            </div>
          )}

          {/* Prev / Next */}
          {exs.length > 1 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goTo(Math.max(0, currentIdx - 1))}
                disabled={currentIdx === 0}
                className="flex-1 rounded-xl border py-2 text-sm transition hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => goTo(Math.min(exs.length - 1, currentIdx + 1))}
                disabled={currentIdx >= exs.length - 1}
                className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
