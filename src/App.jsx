import React, { useEffect, useState } from "react";
import "./index.css";
import seedExercises from "./data/exercises_seed.json";
import { loadLS, saveLS, K_EX, K_WO, K_UNIT, K_TAB } from "./lib/storage";
import { Button } from "./components/ui/Button";
import DataManagementMenu from "./components/DataManagementMenu";
import WorkoutPlanner from "./components/WorkoutPlanner";
import WorkoutHistory from "./components/WorkoutHistory";
import ExerciseManager from "./components/ExerciseManager";
import CalendarView from "./components/CalendarView";
import Notepad from "./components/Notepad";
import { ConfirmProvider } from "./components/ConfirmDialog";

/**
 * Main application component. Handles top‑level state for exercises and workouts,
 * persists them to localStorage, and renders the various feature tabs.
 */
export default function App() {
  // Initialise tab and unit from localStorage (with sensible fallbacks)
  const [tab, setTab] = useState(() => loadLS(K_TAB, "workouts"));
  const [unit, setUnit] = useState(() => loadLS(K_UNIT, "kg"));

  // Load exercises and workouts from localStorage
  const [exercises, setExercises] = useState(() =>
    loadLS(K_EX, seedExercises)
  );
  const [workouts, setWorkouts] = useState(() => loadLS(K_WO, []));

  // Persist exercises and workouts when they change
  useEffect(() => saveLS(K_EX, exercises), [exercises]);
  useEffect(() => saveLS(K_WO, workouts), [workouts]);

  // Persist tab and unit preferences
  useEffect(() => saveLS(K_TAB, tab), [tab]);
  useEffect(() => saveLS(K_UNIT, unit), [unit]);

  // Derive lastWorkout info for exercises whenever workouts update
  useEffect(() => {
    const latestByName = {};
    for (const w of workouts) {
      for (const ex of w.exercises || []) {
        if (
          !latestByName[ex.exerciseName] ||
          latestByName[ex.exerciseName].date < w.date
        ) {
          latestByName[ex.exerciseName] = {
            date: w.date,
            sets: ex.sets,
          };
        }
      }
    }
    setExercises((prev) =>
      prev.map((e) => ({
        ...e,
        lastWorkout: latestByName[e.name]
          ? {
              date: latestByName[e.name].date,
              sets: latestByName[e.name].sets,
            }
          : null,
      }))
    );
  }, [workouts, setExercises]);

  return (
    <ConfirmProvider>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Gym&nbsp;Tracker</h1>
          <div className="flex items-center gap-4">
            <DataManagementMenu
              exercises={exercises}
              workouts={workouts}
              setExercises={setExercises}
              setWorkouts={setWorkouts}
            />
            <Button
              variant="secondary"
              onClick={() =>
                setUnit((u) => (u === "kg" ? "lb" : "kg"))
              }
            >
              Unit: {unit.toUpperCase()}
            </Button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2 border-b pb-2">
          <Button
            variant={tab === "workouts" ? "primary" : "ghost"}
            onClick={() => setTab("workouts")}
          >
            Workouts
          </Button>
          <Button
            variant={tab === "calendar" ? "primary" : "ghost"}
            onClick={() => setTab("calendar")}
          >
            Calendar
          </Button>
          <Button
            variant={tab === "exercises" ? "primary" : "ghost"}
            onClick={() => setTab("exercises")}
          >
            Exercises
          </Button>
          <Button
            variant={tab === "notepad" ? "primary" : "ghost"}
            onClick={() => setTab("notepad")}
          >
            Notepad
          </Button>
        </div>

        {/* Main content */}
        {tab === "workouts" && (
          <>
            <WorkoutPlanner
              exercises={exercises}
              setExercises={setExercises}
              workouts={workouts}
              setWorkouts={setWorkouts}
              unit={unit}
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
          <ExerciseManager
            exercises={exercises}
            setExercises={setExercises}
            workouts={workouts}
            unit={unit}
          />
        )}
        {tab === "notepad" && <Notepad />}

        {/* Footer */}
        <p className="text-center text-xs text-neutral-500">
          Data stored in your browser
        </p>
      </div>
    </ConfirmProvider>
  );
}
