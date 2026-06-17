import React, { useState } from "react";
import Segmented from "./ui/Segmented";
import { useApp } from "../context/AppContext";
import WorkoutPlanner from "./WorkoutPlanner";
import WorkoutHistory from "./WorkoutHistory";
import CalendarView from "./CalendarView";
import RoutineList from "./RoutineList";

/**
 * Workouts destination. Holds the planner + history list ("List"), with the
 * old Calendar tab folded in as a toggle ("Calendar").
 */
export default function WorkoutsTab() {
  const [view, setView] = useState("list");
  const { startEmptyWorkout } = useApp();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Workouts
        </h1>
        <Segmented
          options={[
            ["list", "List"],
            ["routines", "Routines"],
            ["calendar", "Calendar"],
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {view === "list" && (
        <>
          <button
            type="button"
            onClick={startEmptyWorkout}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            ▶ Start empty workout
          </button>
          <WorkoutPlanner />
          <WorkoutHistory />
        </>
      )}
      {view === "routines" && <RoutineList />}
      {view === "calendar" && <CalendarView />}
    </div>
  );
}
