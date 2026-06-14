import React, { useState } from "react";
import Segmented from "./ui/Segmented";
import WeightTracker from "./WeightTracker";
import StrengthAnalysis from "./StrengthAnalysis";

/**
 * Progress destination. Merges the former Weight and Summary tabs:
 * "Bodyweight" shows the bodyweight calendar + trend, "Strength" shows the
 * strength-analysis dashboard (progression, PRs, volume-by-muscle).
 */
export default function Progress() {
  const [view, setView] = useState("bodyweight");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Progress
        </h1>
        <Segmented
          options={[
            ["bodyweight", "Bodyweight"],
            ["strength", "Strength"],
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {view === "bodyweight" ? <WeightTracker /> : <StrengthAnalysis />}
    </div>
  );
}
