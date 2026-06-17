import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { useConfirm } from "./ConfirmDialog";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";
import RoutineEditor from "./RoutineEditor";
import WorkoutPlanner from "./WorkoutPlanner";

function muscleChips(exercises, exerciseDb) {
  const muscles = new Set();
  for (const we of exercises) {
    const ex = exerciseDb.find((e) => e.name === we.exerciseName);
    if (ex?.mainMuscle) muscles.add(ex.mainMuscle);
  }
  return [...muscles].slice(0, 3);
}

function ExerciseChips({ exercises }) {
  const names = exercises.map((we) => we.exerciseName);
  const visible = names.slice(0, 3);
  const rest = names.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {visible.map((n) => (
        <Badge key={n}>{n}</Badge>
      ))}
      {rest > 0 && <Badge>+{rest}</Badge>}
    </div>
  );
}

export default function RoutineList() {
  const {
    routines,
    exercises,
    saveRoutine,
    updateRoutine,
    deleteRoutine,
    startRoutine,
  } = useApp();
  const confirm = useConfirm();

  // null = list view; "new" = new editor; routine.id = editing that routine
  const [editing, setEditing] = useState(null);
  // routine being planned (shown in a WorkoutPlanner-like date picker)
  const [planning, setPlanning] = useState(null);
  // which card has its ⋯ menu open
  const [openMenu, setOpenMenu] = useState(null);

  if (planning) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setPlanning(null)}>
            ← Back
          </Button>
          <h2 className="text-base font-semibold">Plan: {planning.name}</h2>
        </div>
        <WorkoutPlanner
          prefillRoutine={planning}
          onCreated={() => setPlanning(null)}
        />
      </div>
    );
  }

  if (editing !== null) {
    const existing =
      editing === "new" ? null : routines.find((r) => r.id === editing);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setEditing(null)}>
            ← Back
          </Button>
          <h2 className="text-base font-semibold">
            {editing === "new"
              ? "New routine"
              : `Edit: ${existing?.name ?? ""}`}
          </h2>
        </div>
        <Card>
          <CardContent>
            <RoutineEditor
              routine={existing}
              onSave={(saved) => {
                if (editing === "new") saveRoutine(saved);
                else updateRoutine(saved.id, saved);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {routines.length === 0 && (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No routines yet. Save a workout as a routine from history, or
              create one from scratch.
            </p>
          </CardContent>
        </Card>
      )}

      {routines.map((r) => {
        const chips = muscleChips(r.exercises, exercises);
        return (
          <Card key={r.id}>
            <CardContent>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {r.name}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {r.exercises.length} exercise
                    {r.exercises.length !== 1 ? "s" : ""}
                    {chips.length > 0 && ` · ${chips.join(", ")}`}
                  </div>
                </div>
                <div className="relative">
                  <Button
                    variant="ghost"
                    onClick={() => setOpenMenu(openMenu === r.id ? null : r.id)}
                    aria-label="More options"
                  >
                    ⋯
                  </Button>
                  {openMenu === r.id && (
                    <div
                      className="absolute right-0 z-10 mt-1 w-40 rounded-xl border bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
                      onBlur={() => setOpenMenu(null)}
                    >
                      <button
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-t-xl"
                        onClick={() => {
                          setEditing(r.id);
                          setOpenMenu(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        onClick={() => {
                          saveRoutine({
                            ...r,
                            id: undefined,
                            name: `${r.name} (copy)`,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                          });
                          setOpenMenu(null);
                        }}
                      >
                        Duplicate
                      </button>
                      <button
                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-b-xl"
                        onClick={() => {
                          setOpenMenu(null);
                          confirm({
                            title: `Delete "${r.name}"?`,
                            message:
                              "This removes the routine. Past workouts are not affected.",
                            confirmText: "Delete",
                            tone: "destructive",
                          }).then((ok) => {
                            if (ok) deleteRoutine(r.id);
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <ExerciseChips exercises={r.exercises} />

              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => startRoutine(r.id)}
                  className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  ▶ Start
                </button>
                <button
                  type="button"
                  onClick={() => setPlanning(r)}
                  className="flex-1 rounded-xl border py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  Plan
                </button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <button
        type="button"
        onClick={() => setEditing("new")}
        className="w-full rounded-xl border border-dashed py-3 text-sm text-neutral-500 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
      >
        + New routine
      </button>
    </div>
  );
}
