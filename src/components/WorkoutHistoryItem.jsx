import React from "react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Plus, Trash2, ChevronDown } from "./ui/Icons";
import AddExerciseInput from "./AddExerciseInput";
import WeightRepInputs from "./WeightRepInputs";
import RpeFeedback from "./RpeFeedback";
import { fromDisplayWeight, toDisplayWeight } from "../lib/units";
import { useConfirm } from "./ConfirmDialog";
import { MAX_SETS } from "../lib/constants";

/**
 * One workout card in the history list: header row (name, date,
 * expand/delete controls) plus the expanded inline editor for dates,
 * names, exercises and sets.
 *
 * Props:
 * - workout (object)            The workout to render.
 * - expanded (bool)             Whether the editor section is open.
 * - onToggle (fn)               Toggle the expanded state.
 * - exercises (array)           Exercise database (for recommendRep lookups).
 * - unit (string)               Display unit for weights.
 * - updateWorkout (fn)          (id, patch) updates the workout in context.
 * - deleteWorkout (fn)          (id) removes the workout.
 * - onMoveExerciseUp (fn)       (idx) moves an exercise up.
 * - onMoveExerciseDown (fn)     (idx) moves an exercise down.
 * - addExerciseToWorkout (fn)   (workout, name) appends an exercise.
 * - onShowHistory (fn)          (exerciseName) opens the history modal.
 */
export default function WorkoutHistoryItem({
  workout: w,
  expanded,
  onToggle,
  exercises,
  unit,
  updateWorkout,
  deleteWorkout,
  onMoveExerciseUp,
  onMoveExerciseDown,
  addExerciseToWorkout,
  onShowHistory,
}) {
  const confirm = useConfirm();

  return (
    <div className="rounded-2xl border dark:border-neutral-800">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="text-base font-medium">{w.name}</div>
          <div className="text-xs text-neutral-600 dark:text-neutral-300">
            {w.date}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onToggle}>
            Details <ChevronDown open={expanded} />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              confirm({
                title: "Delete this workout?",
                message: "This can't be undone.",
                confirmText: "Delete",
                tone: "destructive",
              }).then((ok) => {
                if (ok) deleteWorkout(w.id);
              });
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 p-4 border-t">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-neutral-600 dark:text-neutral-300">
                Date
              </label>
              <Input
                type="date"
                value={w.date}
                onChange={(e) => updateWorkout(w.id, { date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-neutral-600 dark:text-neutral-300">
                Workout name
              </label>
              <Input
                value={w.name}
                onChange={(e) =>
                  updateWorkout(w.id, {
                    name: e.target.value || w.date,
                  })
                }
              />
            </div>
          </div>

          {/* Exercises list */}
          <div className="space-y-2">
            {w.exercises.map((we, idx) => (
              <div
                key={idx}
                className="relative rounded-xl border dark:border-neutral-800 p-3 overflow-hidden"
              >
                {/* cyan accent bar for each exercise */}
                <div className="absolute inset-y-0 left-0 w-1 bg-cyan-300"></div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium">
                    <span
                      className="cursor-pointer underline"
                      onClick={() => onShowHistory(we.exerciseName)}
                    >
                      {we.exerciseName}
                    </span>
                    {(() => {
                      const rec =
                        exercises.find((e) => e.name === we.exerciseName)
                          ?.recommendRep || "";
                      return rec ? (
                        <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                          ({rec})
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMoveExerciseUp(idx)}
                      disabled={idx === 0}
                    >
                      ▲
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMoveExerciseDown(idx)}
                      disabled={idx === w.exercises.length - 1}
                    >
                      ▼
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const newName = (
                          prompt("Rename exercise to:", we.exerciseName) || ""
                        ).trim();
                        if (!newName) return;
                        updateWorkout(w.id, {
                          exercises: w.exercises.map((e2, i2) =>
                            i2 === idx ? { ...e2, exerciseName: newName } : e2,
                          ),
                        });
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        confirm({
                          title: `Remove "${we.exerciseName}"?`,
                          message:
                            "This removes the exercise from this workout.",
                          confirmText: "Remove",
                          tone: "destructive",
                        }).then((ok) => {
                          if (ok) {
                            updateWorkout(w.id, {
                              exercises: w.exercises.filter(
                                (_, i2) => i2 !== idx,
                              ),
                            });
                          }
                        });
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center gap-3 px-3 py-1 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="w-16" />
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>Weight ({unit})</div>
                      <div>Reps</div>
                    </div>
                    <span className="w-10" />
                  </div>

                  {we.sets.map((s, sidx) => (
                    <div
                      key={sidx}
                      className="relative flex items-center gap-3 rounded-xl border dark:border-neutral-800 px-3 py-2 shadow-sm overflow-hidden"
                    >
                      {/* cyan accent bar for each set */}
                      <div className="absolute inset-y-0 left-0 w-1 bg-cyan-200"></div>
                      <span className="w-16 text-sm text-neutral-600 dark:text-neutral-300">
                        Set {sidx + 1}
                      </span>
                      <WeightRepInputs
                        weight={toDisplayWeight(s.weight, unit)}
                        reps={s.reps}
                        onWeightChange={(v) => {
                          updateWorkout(w.id, {
                            exercises: w.exercises.map((e2, i2) => {
                              if (i2 !== idx) return e2;
                              return {
                                ...e2,
                                sets: e2.sets.map((ss, j) => {
                                  if (j !== sidx) return ss;
                                  return {
                                    ...ss,
                                    weight: fromDisplayWeight(v, unit),
                                  };
                                }),
                              };
                            }),
                          });
                        }}
                        onRepsChange={(v) => {
                          updateWorkout(w.id, {
                            exercises: w.exercises.map((e2, i2) => {
                              if (i2 !== idx) return e2;
                              return {
                                ...e2,
                                sets: e2.sets.map((ss, j) => {
                                  if (j !== sidx) return ss;
                                  return {
                                    ...ss,
                                    reps: v,
                                  };
                                }),
                              };
                            }),
                          });
                        }}
                      />
                      <Button
                        variant="ghost"
                        disabled={we.sets.length <= 1}
                        onClick={() => {
                          if (we.sets.length <= 1) return;
                          confirm({
                            title: "Delete this set?",
                            message: "This can't be undone.",
                            confirmText: "Delete",
                            tone: "destructive",
                          }).then((ok) => {
                            if (!ok) return;
                            updateWorkout(w.id, {
                              exercises: w.exercises.map((e2, i2) => {
                                if (i2 !== idx) return e2;
                                return {
                                  ...e2,
                                  sets: e2.sets
                                    .filter((_, j) => j !== sidx)
                                    .map((ss, j) => ({
                                      ...ss,
                                      set: j + 1,
                                    })),
                                };
                              }),
                            });
                          });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}

                  {we.sets.length < MAX_SETS && (
                    <Button
                      variant="secondary"
                      className="w-fit"
                      onClick={() =>
                        updateWorkout(w.id, {
                          exercises: w.exercises.map((e2, i2) => {
                            if (i2 !== idx) return e2;
                            return {
                              ...e2,
                              sets: [
                                ...e2.sets,
                                {
                                  set: e2.sets.length + 1,
                                  weight: 0,
                                  reps: 0,
                                },
                              ],
                            };
                          }),
                        })
                      }
                    >
                      <Plus /> Add set
                    </Button>
                  )}
                </div>

                {/* Optional RPE + feedback for this exercise */}
                <div className="mt-2">
                  <RpeFeedback
                    rpe={we.rpe ?? null}
                    feedback={we.feedback ?? ""}
                    onChange={(patch) =>
                      updateWorkout(w.id, {
                        exercises: w.exercises.map((e2, i2) =>
                          i2 === idx ? { ...e2, ...patch } : e2,
                        ),
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add exercise input moved below the list */}
          <div className="rounded-xl border dark:border-neutral-800 p-3">
            <div className="mb-2 font-medium text-sm">
              Add exercise to this workout
            </div>
            <AddExerciseInput
              allExercises={exercises}
              onAdd={(name) => addExerciseToWorkout(w, name)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
