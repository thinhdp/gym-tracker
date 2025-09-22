// src/components/PeriodCard.jsx
// Displays a single weekly or monthly summary card.

import React, { useState, useEffect } from "react";
import { loadLS, saveLS } from "../lib/storage";
import GroupedMuscleBar from "./GroupedMuscleBar";
import WeeklyNotes from "./WeeklyNotes";
import Delta from "./Delta";
import { Button } from "./ui/Button";

export default function PeriodCard({
  period,
  metrics,
  prevMetrics,
  weekWeightAvg,
  prevWeekWeightAvg,
  defaultOpen = true,
  isWeek = false,
}) {
  const [open, setOpen] = useState(() => {
    const k = `summary-open:${period.key}`;
    const v = loadLS(k, null);
    if (v === null) return defaultOpen;
    return !!v;
  });

  useEffect(() => {
    saveLS(`summary-open:${period.key}`, open);
  }, [open, period.key]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm mb-3 overflow-hidden">
      <button
        type="button"
        className="w-full text-left px-3 py-2 bg-neutral-50 flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="font-semibold">{period.label}</div>
        <div className="text-xs text-neutral-500">
          {open ? "Collapse ▲" : "Expand ▼"}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium">Reps &amp; Sets by Muscle (Now vs Last)</div>
            <GroupedMuscleBar
              current={{ reps: metrics.repsByMuscle, sets: metrics.setsByMuscle }}
              previous={
                prevMetrics
                  ? { reps: prevMetrics.repsByMuscle, sets: prevMetrics.setsByMuscle }
                  : null
              }
            />
          </div>

          <div className="grid grid-cols-5 gap-2">
            <div className="rounded-lg border p-2">
              <div className="text-xs text-neutral-500">Workouts</div>
              <div className="text-lg font-semibold flex flex-wrap items-baseline gap-x-1">
                {metrics.frequency}
                <Delta curr={metrics.frequency} prev={prevMetrics?.frequency} />
              </div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-xs text-neutral-500">Total Reps</div>
              <div className="text-lg font-semibold tabular-nums flex flex-wrap items-baseline gap-x-1">
                {metrics.totalReps}
                <Delta curr={metrics.totalReps} prev={prevMetrics?.totalReps} />
              </div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-xs text-neutral-500">Total Sets</div>
              <div className="text-lg font-semibold tabular-nums flex flex-wrap items-baseline gap-x-1">
                {metrics.totalSets}
                <Delta curr={metrics.totalSets} prev={prevMetrics?.totalSets} />
              </div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-xs text-neutral-500">New PRs</div>
              <div className="text-lg font-semibold flex flex-wrap items-baseline gap-x-1">
                {metrics.prs.length}
                <Delta curr={metrics.prs.length} prev={prevMetrics?.prs?.length} />
              </div>
            </div>
            {isWeek ? (
              <div className="rounded-lg border p-2">
                <div className="text-xs text-neutral-500">Avg Weight (This Week)</div>
                <div className="text-lg font-semibold tabular-nums flex flex-wrap items-baseline gap-x-1">
                  {weekWeightAvg ?? "—"}
                  <Delta curr={weekWeightAvg} prev={prevWeekWeightAvg} decimals={1} />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border p-2 opacity-50">
                <div className="text-xs text-neutral-400">Avg Weight</div>
                <div className="text-lg font-semibold text-neutral-400">—</div>
              </div>
            )}
          </div>

          {metrics.prs.length > 0 ? (
            <div className="space-y-1">
              <div className="text-sm font-medium">New PRs this period</div>
              <div className="text-sm border rounded-lg divide-y">
                {metrics.prs.map((p) => (
                  <div key={p.exercise} className="flex items-center justify-between px-2 py-1">
                    <div className="font-medium">{p.exercise}</div>
                    <div className="text-xs text-neutral-600">
                      {p.prevBest} → <span className="font-semibold">{p.newBest}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-neutral-500">No new PRs this period.</div>
          )}

          {isWeek && <WeeklyNotes periodKey={period.key} />}
        </div>
      )}
    </div>
  );
}
