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
 */
export default function WeightRepInputs({
  weight,
  reps,
  onWeightChange,
  onRepsChange,
}) {
  return (
    <div className="flex-1 grid grid-cols-2 gap-3">
      <div className="flex items-center gap-2">
        <NumberInputAutoClear
          step="0.5"
          min="0"
          className="border rounded-xl px-3 py-1.5 text-sm w-16"
          valueNumber={weight}
          onNumberChange={onWeightChange}
        />
      </div>
      <div className="flex items-center gap-2">
        <NumberInputAutoClear
          step="1"
          min="0"
          className="border rounded-xl px-3 py-1.5 text-sm w-16"
          valueNumber={reps}
          onNumberChange={onRepsChange}
        />
      </div>
    </div>
  );
}
