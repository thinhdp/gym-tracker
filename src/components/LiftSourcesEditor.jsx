// src/components/LiftSourcesEditor.jsx
// More → Profile → "Lift sources": maps each of the standard Symmetry lifts to
// the exercise it should pull data from, and lets you add the bar weight for
// lifts you log plates-only. Both are optional per lift — leave a row untouched
// and the Symmetry view keeps auto-detecting from the exercise name.

import React, { useMemo } from "react";
import { STANDARD_LIFTS, DEFAULT_BAR_KG } from "../lib/strengthStandards";
import Combobox from "./ui/Combobox";
import { Input } from "./ui/Input";

/**
 * Controlled editor for `profile.liftConfig`.
 *
 * @param {Object} value - the current liftConfig ({ [liftKey]: { exercise, addBar, barKg } }).
 * @param {(next: Object) => void} onChange - called with the next liftConfig.
 * @param {string[]} exerciseNames - names to offer in each exercise picker.
 */
export default function LiftSourcesEditor({
  value,
  onChange,
  exerciseNames = [],
}) {
  const config = value || {};
  const options = useMemo(
    () => [...exerciseNames].sort((a, b) => a.localeCompare(b)),
    [exerciseNames],
  );

  const setLift = (key, patch) => {
    const next = { ...config };
    const entry = { ...(next[key] || {}), ...patch };
    // Drop a row that carries no real config so the stored object stays small.
    if (!entry.exercise && !entry.addBar) delete next[key];
    else next[key] = entry;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="px-1 text-[12px] leading-snug text-neutral-500 dark:text-neutral-400">
        Pick which exercise feeds each lift, and tick{" "}
        <span className="font-medium">Add bar</span> for lifts you log without
        the bar (the bar weight is added to every set before scoring). Untouched
        lifts are detected automatically from the exercise name.
      </p>

      <div className="space-y-2">
        {STANDARD_LIFTS.map((lift) => {
          const c = config[lift.key] || {};
          const addBar = Boolean(c.addBar);
          return (
            <div
              key={lift.key}
              className="rounded-xl border p-3 dark:border-neutral-800"
            >
              <div className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {lift.label}
              </div>

              <Combobox
                value={c.exercise || ""}
                onChange={(exercise) =>
                  setLift(lift.key, { exercise: exercise || undefined })
                }
                options={options}
                placeholder="Auto (detect from name)"
              />

              <label className="mt-2 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                  checked={addBar}
                  onChange={(e) =>
                    setLift(lift.key, { addBar: e.target.checked })
                  }
                />
                <span>Add bar weight</span>
                {addBar && (
                  <span className="ml-auto flex items-center gap-1">
                    <span className="w-16">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.5"
                        value={c.barKg ?? DEFAULT_BAR_KG}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setLift(lift.key, {
                            barKg: v === "" ? DEFAULT_BAR_KG : Number(v),
                          });
                        }}
                      />
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      kg
                    </span>
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
