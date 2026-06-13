import React, { useState } from "react";
import Segmented from "./ui/Segmented";
import WorkoutPlanner from "./WorkoutPlanner";
import WorkoutHistory from "./WorkoutHistory";
import CalendarView from "./CalendarView";

/**
 * Workouts destination. Holds the planner + history list ("List"), with the
 * old Calendar tab folded in as a toggle ("Calendar").
 */
export default function WorkoutsTab() {
  const [view, setView] = useState("list");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Workouts</h1>
        <Segmented
          options={[
            ["list", "List"],
            ["calendar", "Calendar"],
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {view === "list" ? (
        <>
          <WorkoutPlanner />
          <WorkoutHistory />
        </>
      ) : (
        <CalendarView />
      )}
    </div>
  );
}
