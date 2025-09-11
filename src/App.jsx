import React from "react";
import "./index.css";
import { AppProvider, useApp } from "./context/AppContext";
import { Button } from "./components/ui/Button";
import DataManagementMenu from "./components/DataManagementMenu";
import WorkoutPlanner from "./components/WorkoutPlanner";
import WorkoutHistory from "./components/WorkoutHistory";
import ExerciseManager from "./components/ExerciseManager";
import CalendarView from "./components/CalendarView";
import Notepad from "./components/Notepad";
import { ConfirmProvider } from "./components/ConfirmDialog";
import DashboardSummary from "./components/DashboardSummary";

/**
 * Internal component that consumes AppContext and renders the app UI.
 * This separates context consumption from the outer provider.
 */
function AppContent() {
  const {
    tab,
    setTab,
    unit,
    setUnit,
    exercises,
    setExercises,
    workouts,
    setWorkouts,
  } = useApp();

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
              onClick={() => setUnit((u) => (u === "kg" ? "lb" : "kg"))}
            >
              Unit: {unit.toUpperCase()}
            </Button>
          </div>
        </div>

        {/* Tab navigation (scrollable) */}
        <div className="overflow-x-auto whitespace-nowrap border-b pb-2">
          <div className="inline-flex gap-2">
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
            <Button
              variant={tab === "summary" ? "primary" : "ghost"}
              onClick={() => setTab("summary")}
            >
              Summary
            </Button>
          </div>
        </div>

        {/* Main content */}
        {tab === "workouts" && (
          <>
            <WorkoutPlanner />
            <WorkoutHistory />
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

        {tab === "summary" && <DashboardSummary />}

        {/* Footer */}
        <p className="text-center text-xs text-neutral-500">
          Data stored in your browser
        </p>
      </div>
    </ConfirmProvider>
  );
}

/**
 * Top-level component wraps the application in AppProvider
 * so all children can access the shared state.
 */
export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
