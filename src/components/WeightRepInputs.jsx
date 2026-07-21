import React from "react";
import NumberInputAutoClear from "./NumberInputAutoClear";

/**
 * Compact weight & reps input component.
 * Encapsulates the styling and numeric handling used by both the
 * workout planner and history screens.
 *
 * Props:
 *   - weight: current weight value (already converted to display units)
 *   - reps: current reps value
 *   - onWeightChange: callback when weight changes
 *   - onRepsChange: callback when reps change
 *   - showWeight: when false, renders reps only (routine editor)
 */
export default function WeightRepInputs({
  weight,
  reps,
  onWeightChange,
  onRepsChange,
  showWeight = true,
}) {
  return (
    <div
      className={`flex-1 grid gap-3 ${showWeight ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {showWeight && (
        <div className="flex items-center gap-2">
          <NumberInputAutoClear
            step="0.5"
            min="0"
            className="border rounded-xl px-3 py-1.5 text-sm w-16 bg-white dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            valueNumber={weight}
            onNumberChange={onWeightChange}
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <NumberInputAutoClear
          step="1"
          min="0"
          className="border rounded-xl px-3 py-1.5 text-sm w-16 bg-white dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          valueNumber={reps}
          onNumberChange={onRepsChange}
        />
      </div>
    </div>
  );
}
