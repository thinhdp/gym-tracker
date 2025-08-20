import React, { useEffect, useMemo, useState } from "react";
import "./index.css";

import { loadLS, saveLS, K_EX, K_WO, todayStr, fmtDate } from "./lib/storage";
import { toDisplayWeight } from "./lib/units";

import { Card, CardContent } from "./components/ui/Card";
import { Badge } from "./components/ui/Badge";
import { Button } from "./components/ui/Button";

import ImportExportControls from "./components/ImportExportControls";
import WorkoutPlanner from "./components/WorkoutPlanner";
import WorkoutHistory from "./components/WorkoutHistory";
import CalendarView from "./components/CalendarView";
import ExerciseManager from "./components/ExerciseManager";

export default function App() {
  const [tab, setTab] = useState("workouts"); // "workouts" | "calendar" | "exercises"
  const [exercises, setExercises] = useState(() => loadLS(K_EX, []));
  const [workouts, setWorkouts] = useState(() => loadLS(K_WO, []));
  const [unit, setUnit] = useState("kg"); // kg | lb

  useEffect(() => saveLS(K_EX, exercises), [exercises]);
  useEffect(() => saveLS(K_WO, workouts), [workouts]);

  // Derive last workout per exercise from logged workouts
  useEffect(() => {
    const latestByName = {};
    for (const w of workouts) {
      for (const ex of w.exercises || []) {
        if (!latestByName[ex.exerciseName] || latestByName[ex.exerciseName].date < w.date) {
          latestByName[ex.exerciseName] = { date: w.date, sets: ex.sets };
        }
      }
    }
    setExercises((prev) =>
      prev.map((e) => ({
        ...e,
        lastWorkout: latestByName[e.name] ? { date: latestByName[e.name].date, sets: latestByName[e.name].sets } : null,
      })),
    );
  }, [workouts, setExercises]);

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md p-4 pb-24">
        <header className="sticky top-0 z-10 bg-neutral-50">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-2xl font-bold tracking-tight">Gym Tracker</h1>
            <div className="flex items-center gap-2">
              <Badge>Local • Offline</Badge>
              <Button variant="secondary" onClick={() => setUnit((u) => (u === "kg" ? "lb" : "kg"))}>
                Unit: {unit.toUpperCase()}
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mb-2">
            <Button variant={tab === "workouts" ? "primary" : "secondary"} onClick={() => setTab("workouts")}>
              Workouts
            </Button>
            <Button variant={tab === "calendar" ? "primary" : "secondary"} onClick={() => setTab("calendar")}>
              Calendar
            </Button>
            <Button variant={tab === "exercises" ? "primary" : "secondary"} onClick={() => setTab("exercises")}>
              Exercises
            </Button>
          </div>

          <div className="flex justify-end mb-2">
            <ImportExportControls
              exercises={exercises}
              workouts={workouts}
              setExercises={setExercises}
              setWorkouts={setWorkouts}
            />
          </div>
        </header>

        <main className="mt-2">
          {tab === "workouts" && (
            <>
              <WorkoutPlanner
                exercises={exercises}
                setExercises={setExercises}
                workouts={workouts}
                setWorkouts={setWorkouts}
                unit={unit}
                onCreated={() => setTab("workouts")}
              />
              <WorkoutHistory
                workouts={workouts}
                setWorkouts={setWorkouts}
                exercises={exercises}
                setExercises={setExercises}
                unit={unit}
              />
            </>
          )}

          {tab === "calendar" && (
            <CalendarView
              workouts={workouts}
              setWorkouts={setWorkouts}
              exercises={exercises}
              setExercises={setExercises}
              unit={unit}
            />
          )}

          {tab === "exercises" && (
            <ExerciseManager exercises={exercises} setExercises={setExercises} workouts={workouts} unit={unit} />
          )}
        </main>
      </div>

      <footer className="fixed inset-x-0 bottom-0 border-t bg-white/80">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 p-3 text-xs text-neutral-500">
          <span>Data stored in your browser</span>
          <span>v1.5</span>
        </div>
      </footer>
    </div>
  );
}
