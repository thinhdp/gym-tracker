import React, { useMemo, useState } from "react";
import { Card, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import AddExerciseInput from "./AddExerciseInput";
import { uuid } from "../lib/storage";
import { ymd } from "../lib/date";
import { toDisplayWeight } from "../lib/units";
import { Plus, Trash2 } from "./ui/Icons";
import { useConfirm } from "./ConfirmDialog";
import { useApp } from "../context/AppContext";

export default function CalendarView() {
  const {
    workouts,
    setWorkouts,
    exercises,
    setExercises,
    unit,
  } = useApp();

  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const confirm = useConfirm();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startWeekday = first.getDay();
  const prevMonth = () =>
    setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setViewDate(new Date(year, month + 1, 1));

  const byDate = useMemo(() => {
    const map = {};
    for (const w of workouts) {
      if (!map[w.date]) map[w.date] = [];
      map[w.date].push(w);
    }
    return map;
  }, [workouts]);

  const days = [];
  for (let i = 0; i < startWeekday; i++) {
    days.push(null);
  }
  for (let d = 1; d <= lastDay; d++) {
    // ymd expects: year (full year), month (0–based), day (1–31)
    const dateStr = ymd(year, month, d);
    days.push(dateStr);
  }

  const selectedWorkouts = byDate[selected] || [];

  const addWorkout = () => {
    const newWorkout = {
      id: uuid(),
      date: selected,
      name: selected,
      exercises: [],
    };
    setWorkouts((prev) =>
      [newWorkout, ...prev].sort((a, b) =>
        a.date < b.date ? 1 : -1
      )
    );
  };

  const addExerciseToWorkout = (
    workout,
    exerciseName
  ) => {
    const exists = exercises.find(
      (e) =>
        e.name.toLowerCase() ===
        exerciseName.toLowerCase()
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
    const last =
      exists?.lastWorkout?.sets?.length
        ? exists.lastWorkout.sets.at(-1)
        : null;
    const newExercise = {
      exerciseName,
      sets: [
        {
          set: 1,
          weight: last?.weight || 0,
          reps: last?.reps || 0,
        },
      ],
    };
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workout.id
          ? {
              ...w,
              exercises: [...w.exercises, newExercise],
            }
          : w
      )
    );
  };

  const deleteWorkout = (id) =>
    setWorkouts((prev) =>
      prev.filter((w) => w.id !== id)
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={prevMonth}>
          ‹ Prev
        </Button>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
          {viewDate.toLocaleString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h3>
        <Button variant="ghost" onClick={nextMonth}>
          Next ›
        </Button>
      </div>

      <Card>
        <CardContent>
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-neutral-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (d) => (
                <div key={d}>{d}</div>
              )
            )}
          </div>

          <div className="grid grid-cols-7 gap-1 text-sm mt-1">
            {days.map((ds, idx) => {
              const isSelected = ds === selected;
              const count = ds ? (byDate[ds]?.length || 0) : 0;
               return (
                 <Button
                   key={idx}
                   variant={
                     isSelected ? "primary" : "ghost"
                   }
                   disabled={!ds}
                   onClick={() => ds && setSelected(ds)}
                 >
                   {ds ? Number(ds.slice(-2)) : ""}
                   {count > 0 && (
                     <span className="ml-1 text-xs text-neutral-500">
                       {count} workout{count > 1 ? "s" : ""}
                     </span>
                   )}
                 </Button>
               );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Plans for {selected}
          </h3>
          <Button
            variant="secondary"
            onClick={addWorkout}
          >
            <Plus /> New workout
          </Button>
        </div>

        {selectedWorkouts.length === 0 && (
          <p className="text-sm text-neutral-500">
            No workouts on this day.
          </p>
        )}

        {selectedWorkouts.map((w) => (
          <Card key={w.id}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {w.name}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {w.date}
                  </div>
                </div>
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

              <div className="rounded-xl border p-3">
                <div className="mb-2 font-medium text-sm">
                  Add exercise
                </div>
                <AddExerciseInput
                  allExercises={exercises}
                  onAdd={(name) =>
                    addExerciseToWorkout(w, name)
                  }
                />
              </div>

              {w.exercises.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No exercises yet.
                </p>
              ) : (
                w.exercises.map((we, i) => (
                  <div
                    key={i}
                    className="rounded-xl border p-3 space-y-1"
                  >
                    <div className="font-medium">
                      {we.exerciseName}
                      {(() => {
                        const rec =
                          exercises.find(
                            (e) =>
                              e.name === we.exerciseName
                          )?.recommendRep || "";
                        return rec ? (
                          <span className="ml-1 text-xs text-neutral-500">
                            ({rec})
                          </span>
                        ) : null;
                      })()}
                    </div>
                    {we.sets.map((s) => (
                      <div
                        key={s.set}
                        className="flex justify-between text-sm"
                      >
                        <span>
                          Set {s.set}:{" "}
                          {toDisplayWeight(
                            s.weight,
                            unit
                          )}{" "}
                          {unit}
                        </span>
                        <span>x {s.reps}</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
