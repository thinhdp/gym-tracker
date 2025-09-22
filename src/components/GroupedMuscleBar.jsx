// src/components/GroupedMuscleBar.jsx
// Renders sets and reps for each muscle on separate rows, comparing Now vs Last.

import React from "react";

export default function GroupedMuscleBar({ current, previous }) {
  const muscles = new Set([
    ...Object.keys(current?.reps || {}),
    ...Object.keys(current?.sets || {}),
    ...(previous?.reps ? Object.keys(previous.reps) : []),
    ...(previous?.sets ? Object.keys(previous.sets) : []),
  ]);

  if (!muscles.size) {
    return (
      <div className="text-sm text-neutral-500">No data logged this period.</div>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from(muscles).sort((a, b) => a.localeCompare(b)).map((muscle) => {
        const cReps = current?.reps?.[muscle] || 0;
        const pReps = previous?.reps?.[muscle] || 0;
        const maxReps = Math.max(1, cReps, pReps);
        const cRepsW = Math.round((cReps / maxReps) * 100);
        const pRepsW = Math.round((pReps / maxReps) * 100);

        const cSets = current?.sets?.[muscle] || 0;
        const pSets = previous?.sets?.[muscle] || 0;
        const maxSets = Math.max(1, cSets, pSets);
        const cSetsW = Math.round((cSets / maxSets) * 100);
        const pSetsW = Math.round((pSets / maxSets) * 100);

        return (
          <div key={muscle} className="space-y-2">
            <div className="text-xs font-medium mb-1">{muscle}</div>
            {/* Sets row */}
            <div className="w-full">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="pl-2">Sets</span>
                <span className="tabular-nums">
                  {pSets ? `LW ${pSets} · ` : ""}
                  Now {cSets}
                </span>
              </div>
              <div className="h-4 bg-neutral-200 rounded relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-neutral-400"
                  style={{ width: `${pSetsW}%` }}
                  title={`Last sets: ${pSets}`}
                />
                <div
                  className="absolute left-0 top-0 bottom-0 bg-green-500 mix-blend-multiply"
                  style={{ width: `${cSetsW}%` }}
                  title={`Current sets: ${cSets}`}
                />
              </div>
            </div>
            {/* Reps row */}
            <div className="w-full">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="pl-2">Reps</span>
                <span className="tabular-nums">
                  {pReps ? `LW ${pReps} · ` : ""}
                  Now {cReps}
                </span>
              </div>
              <div className="h-4 bg-neutral-200 rounded relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-neutral-400"
                  style={{ width: `${pRepsW}%` }}
                  title={`Last reps: ${pReps}`}
                />
                <div
                  className="absolute left-0 top-0 bottom-0 bg-blue-600 mix-blend-multiply"
                  style={{ width: `${cRepsW}%` }}
                  title={`Current reps: ${cReps}`}
                />
              </div>
            </div>
          </div>
        );
      })}
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-neutral-600">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 bg-green-500" /> Sets Now
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 bg-blue-600" /> Reps Now
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 bg-neutral-400" /> Last
        </div>
      </div>
    </div>
  );
}
