import React, { useState } from "react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Plus, Trash2, ChevronDown } from "./ui/Icons";
import AddExerciseInput from "./AddExerciseInput";
import NumberInputAutoClear from "./NumberInputAutoClear";
import WeightRepInputs from "./WeightRepInputs";
import { fromDisplayWeight, toDisplayWeight } from "../lib/units";
import { useConfirm } from "./ConfirmDialog";

/**
 * History component for editing existing workouts. Provides controls
 * to rename, reorder, remove exercises and log sets. Users can tap
 * an exercise name to view past performance across all workouts.
 */
export default function WorkoutHistory({
  workouts,
  setWorkouts,
  exercises,
  setExercises,
  unit,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const confirm = useConfirm();

  const updateWorkout = (id, patch) => {
    setWorkouts((prev) =>
      prev
        .map((w) => (w.id === id ? { ...w, ...patch } : w))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    );
  };

  const deleteWorkout = (id) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  };

  const addExerciseToWorkout = (workout, exerciseName) => {
    const exists = exercises.find(
      (e) => e.name.toLowerCase() === exerciseName.toLowerCase()
    );
    if (!exists) {
      const created = {
        name: exerciseName,
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
    const last = exists?.lastWorkout?.sets?.length
      ? exists.lastWorkout.sets.at(-1)
      : null;
    const newExercise = {
      exerciseName,
      sets: [{ set: 1, weight: last?.weight || 0, reps: last?.reps || 0 }],
    };
    updateWorkout(workout.id, { exercises: [...workout.exercises, newExercise] });
  };

  const moveItem = (arr, from, to) => {
    if (to < 0 || to >= arr.length) return arr;
    const next = arr.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    return next;
  };

  const moveExerciseUp = (workoutId, idx) => {
    setWorkouts((prev) =>
      prev
        .map((w) =>
          w.id === workoutId
            ? { ...w, exercises: moveItem(w.exercises, idx, idx - 1) }
            : w
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    );
  };

  const moveExerciseDown = (workoutId, idx) => {
    setWorkouts((prev) =>
      prev
        .map((w) =>
          w.id === workoutId
            ? { ...w, exercises: moveItem(w.exercises, idx, idx + 1) }
            : w
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    );
  };

  /**
   * Display past performance for a given exercise across all workouts.
   * When an exercise name is tapped, gather previous set records and show
   * them via the confirm dialog. If none are found, a default message appears.
   *
   * @param {string} exerciseName Exercise to display past workouts for.
   */
  const showExerciseHistory = (exerciseName) => {
    const lines = [];
    workouts.forEach((wk) => {
      wk.exercises.forEach((ex) => {
        if (ex.exerciseName === exerciseName) {
          ex.sets.forEach((s) => {
            lines.push(`${wk.date}: ${s.weight}×${s.reps}`);
          });
        }
      });
    });
    confirm({
      title: `Past workouts for ${exerciseName}`,
      message:
        lines.length > 0 ? lines.join("\n") : "No previous records",
      confirmText: "Close",
      tone: "default",
    });
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
        <div key={w.id} className="rounded-2xl border">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-base font-medium">{w.name}</div>
              <div className="text-xs text-neutral-600">{w.date}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  setExpandedId((prev) => (prev === w.id ? null : w.id))
                }
              >
                Details <ChevronDown open={expandedId === w.id} />
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

          {expandedId === w.id && (
            <div className="space-y-3 p-4 border-t">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600">Date</label>
                  <Input
                    type="date"
                    value={w.date}
                    onChange={(e) =>
                      updateWorkout(w.id, { date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600">Workout name</label>
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

              <div className="rounded-xl border p-3">
                <div className="mb-2 font-medium text-sm">
                  Add exercise to this workout
                </div>
                <AddExerciseInput
                  allExercises={exercises}
                  onAdd={(name) => addExerciseToWorkout(w, name)}
                />
              </div>

              <div className="space-y-2">
                {w.exercises.map((we, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-xl border p-3 overflow-hidden"
                  >
                    {/* cyan accent bar for each exercise */}
                    <div className="absolute inset-y-0 left-0 w-1 bg-cyan-300"></div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-medium">
                        <span
                          className="cursor-pointer underline"
                          onClick={() => showExerciseHistory(we.exerciseName)}
                        >
                          {we.exerciseName}
                        </span>
                        {(() => {
                          const rec =
                            exercises.find(
                              (e) => e.name === we.exerciseName
                            )?.recommendRep || "";
                          return rec ? (
                            <span className="ml-2 text-xs text-neutral-500">
                              ({rec})
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveExerciseUp(w.id, idx)}
                          disabled={idx === 0}
                        >
                          ▲
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveExerciseDown(w.id, idx)}
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
                                i2 === idx
                                  ? { ...e2, exerciseName: newName }
                                  : e2
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
                                    (_, i2) => i2 !== idx
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
                      <div className="flex items-center gap-3 px-3 py-1 text-xs text-neutral-500">
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
                          className="relative flex items-center gap-3 rounded-xl border px-3 py-2 shadow-sm overflow-hidden"
                        >
                          {/* cyan accent bar for each set */}
                          <div className="absolute inset-y-0 left-0 w-1 bg-cyan-200"></div>
                          <span className="w-16 text-sm text-neutral-600">
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

                      {we.sets.length < 5 && (
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
