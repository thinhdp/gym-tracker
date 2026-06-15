import React, { useState } from "react";
import Segmented from "./ui/Segmented";
import WeightTracker from "./WeightTracker";
import StrengthAnalysis from "./StrengthAnalysis";
import StrengthStandards from "./StrengthStandards";

/**
 * Progress destination. Merges the former Weight and Summary tabs:
 * "Bodyweight" shows the bodyweight calendar + trend, "Strength" shows the
 * strength-analysis dashboard (progression, PRs, volume-by-muscle), and
 * "Symmetry" scores lifts against external strength standards (radar).
 */
export default function Progress() {
  const [view, setView] = useState("bodyweight");

  const body = {
    bodyweight: <WeightTracker />,
    strength: <StrengthAnalysis />,
    symmetry: <StrengthStandards />,
  };

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
            ["symmetry", "Symmetry"],
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {body[view]}
    </div>
  );
}
