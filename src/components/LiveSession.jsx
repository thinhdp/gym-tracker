import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { toDisplayWeight, fromDisplayWeight } from "../lib/units";
import { createExerciseEntry } from "../lib/exerciseUtils";
import { MAX_SETS } from "../lib/constants";
import {
  isLogged,
  completedSets,
  totalSets,
  formatClock,
  remapIndexAfterMove,
} from "../lib/liveSession";
import { moveItem } from "../lib/arrayUtils";
import WeightRepInputs from "./WeightRepInputs";
import AddExerciseInput from "./AddExerciseInput";
import RpeFeedback from "./RpeFeedback";
import ExerciseHistoryModal from "./ExerciseHistoryModal";
import { Trash2 } from "./ui/Icons";
import { useConfirm } from "./ConfirmDialog";

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

  // Drag-to-reorder the exercise chips. Pointer-based so it works on touch and
  // mouse alike (HTML5 drag-and-drop doesn't fire on touch).
  const [dragIdx, setDragIdx] = useState(null);
  const suppressClickRef = useRef(false);
  // Inline "replace exercise" picker for the current exercise.
  const [swapping, setSwapping] = useState(false);
  // Exercise whose past-workout history is shown in the modal (null = closed).
  const [historyExercise, setHistoryExercise] = useState(null);
  const confirm = useConfirm();

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

  // A new set carries the previous set's weight as a convenience, but starts
  // with no reps — entering reps is what marks it logged.
  const addSet = (exIdx) =>
    mapExercise(exIdx, (ex) => {
      if (ex.sets.length >= MAX_SETS) return ex;
      const last = ex.sets.at(-1) || { weight: 0 };
      return {
        ...ex,
        sets: [
          ...ex.sets,
          { set: ex.sets.length + 1, weight: last.weight, reps: 0 },
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

  // Build a fresh entry for `name`: prefilled weight from its own history, but
  // reps cleared so it reads as "to do".
  const freshEntry = (name) => {
    const entry = createExerciseEntry(name, exercises, setExercises);
    if (!entry) return null;
    return { ...entry, sets: entry.sets.map((s) => ({ ...s, reps: 0 })) };
  };

  const addExercise = (name) => {
    const fresh = freshEntry(name);
    if (!fresh) return;
    const newIdx = exs.length;
    patchWorkout((w) => ({ ...w, exercises: [...w.exercises, fresh] }));
    setSession((s) => ({ ...s, currentIdx: newIdx }));
  };

  // Swap the current exercise for another in place (machine taken, etc.).
  const replaceExercise = (exIdx, name) => {
    const fresh = freshEntry(name);
    if (!fresh) return;
    mapExercise(exIdx, () => fresh);
    setSwapping(false);
  };

  // Drop an exercise from the session (confirmed — it discards its logged sets).
  const removeExercise = (exIdx) => {
    confirm({
      title: "Remove this exercise?",
      message: "It will be taken out of this workout, along with its sets.",
      confirmText: "Remove",
      tone: "destructive",
    }).then((ok) => {
      if (!ok) return;
      patchWorkout((w) => ({
        ...w,
        exercises: w.exercises.filter((_, i) => i !== exIdx),
      }));
      const newLen = exs.length - 1;
      setSession((s) => ({
        ...s,
        currentIdx: Math.max(0, Math.min(s.currentIdx || 0, newLen - 1)),
      }));
    });
  };

  // Reorder exercises mid-session (e.g. a machine is taken). Completion lives on
  // each set's reps, so it moves with the exercise automatically; only the
  // on-screen pointer needs remapping to stay on the same exercise.
  const moveExercise = (from, to) => {
    if (to < 0 || to >= exs.length) return;
    patchWorkout((w) => ({ ...w, exercises: moveItem(w.exercises, from, to) }));
    setSession((s) => ({
      ...s,
      currentIdx: remapIndexAfterMove(s.currentIdx || 0, from, to),
    }));
  };

  // Begin a chip drag. Window listeners live only for the duration of the drag
  // and close over the current `moveExercise`, reordering live as the pointer
  // passes over other chips.
  const startChipDrag = (e, fromIdx) => {
    const start = { x: e.clientX, y: e.clientY };
    let idx = fromIdx;
    let active = false;
    const onMove = (ev) => {
      if (!active) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
        active = true;
        setDragIdx(idx);
      }
      const chip = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest("[data-chip-idx]");
      if (!chip) return;
      const over = Number(chip.getAttribute("data-chip-idx"));
      if (Number.isInteger(over) && over !== idx) {
        moveExercise(idx, over);
        idx = over;
        setDragIdx(over);
      }
    };
    const onUp = () => {
      if (active) suppressClickRef.current = true; // swallow the trailing click
      setDragIdx(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const goTo = (idx) => {
    setSwapping(false);
    setSession((s) => ({ ...s, currentIdx: idx }));
  };
  const setName = (name) => patchWorkout((w) => ({ ...w, name }));

  const finish = () => {
    // Drop an abandoned empty workout so it doesn't litter history.
    if (exs.length === 0) {
      setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
    }
    endSession();
  };

  const completed = completedSets(workout);
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
          {/* Exercise nav chips — tap to jump, drag to reorder */}
          {exs.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {exs.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  data-chip-idx={i}
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => startChipDrag(e, i)}
                  onClick={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    goTo(i);
                  }}
                  className={[
                    "cursor-grab select-none whitespace-nowrap rounded-full px-3 py-1 text-xs transition active:cursor-grabbing",
                    dragIdx === i ? "opacity-60 " : "",
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
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryExercise(current.exerciseName)}
                  title="View past logs"
                  className="min-w-0 flex-1 truncate text-left text-lg font-semibold text-neutral-900 underline decoration-dotted underline-offset-4 transition hover:text-blue-600 dark:text-neutral-100 dark:hover:text-blue-400"
                >
                  {current.exerciseName}
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {exs.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => moveExercise(currentIdx, currentIdx - 1)}
                        disabled={currentIdx === 0}
                        aria-label="Move exercise earlier"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveExercise(currentIdx, currentIdx + 1)}
                        disabled={currentIdx === exs.length - 1}
                        aria-label="Move exercise later"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        ↓
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setSwapping((v) => !v)}
                    aria-label="Replace exercise"
                    aria-pressed={swapping}
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-lg border text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800",
                      swapping ? "bg-neutral-100 dark:bg-neutral-800" : "",
                    ].join(" ")}
                  >
                    ⇄
                  </button>
                  <button
                    type="button"
                    onClick={() => removeExercise(currentIdx)}
                    aria-label="Remove exercise"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border text-red-600 transition hover:bg-red-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>

              {/* Inline replace picker */}
              {swapping && (
                <div className="mb-3 rounded-xl border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Replace with
                  </div>
                  <AddExerciseInput
                    allExercises={exercises}
                    onAdd={(name) => replaceExercise(currentIdx, name)}
                  />
                </div>
              )}

              {/* Column headers */}
              <div className="mb-1 grid grid-cols-[28px,1fr,28px] items-center gap-2 px-1 text-[10px] uppercase text-neutral-400 dark:text-neutral-500">
                <span>Set</span>
                <span className="grid grid-cols-2 gap-3">
                  <span className="text-center">{unit}</span>
                  <span className="text-center">reps</span>
                </span>
                <span className="text-center">✓</span>
              </div>

              {/* Set rows — a set reads as logged once it has reps */}
              <div className="space-y-2">
                {current.sets.map((s, j) => (
                  <div
                    key={j}
                    className="grid grid-cols-[28px,1fr,28px] items-center gap-2"
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
                    <span
                      aria-hidden="true"
                      className={[
                        "mx-auto text-base",
                        isLogged(s)
                          ? "text-green-600 dark:text-green-500"
                          : "text-transparent",
                      ].join(" ")}
                    >
                      ✓
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addSet(currentIdx)}
                disabled={current.sets.length >= MAX_SETS}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-300 py-2 text-sm text-blue-600 transition hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-blue-400 dark:hover:bg-neutral-800"
              >
                + Add set
              </button>

              {/* RPE + feedback for this exercise */}
              <div className="mt-3 border-t pt-3 dark:border-neutral-800">
                <RpeFeedback
                  rpe={current.rpe ?? null}
                  feedback={current.feedback ?? ""}
                  onChange={(patch) =>
                    mapExercise(currentIdx, (ex) => ({ ...ex, ...patch }))
                  }
                />
              </div>
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

      {/* Past-logs modal — excludes the in-progress workout itself */}
      <ExerciseHistoryModal
        exerciseName={historyExercise}
        workouts={workouts.filter((w) => w.id !== workout.id)}
        unit={unit}
        onClose={() => setHistoryExercise(null)}
      />
    </div>
  );
}
