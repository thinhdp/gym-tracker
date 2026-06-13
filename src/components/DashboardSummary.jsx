// src/components/DashboardSummary.jsx
// Main summary page that assembles period data and renders PeriodCards.

import React, { useCallback, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { Button } from "./ui/Button";
import { buildWeeks, buildMonths, computePeriodMetrics } from "../lib/metrics";
import { prevWeekKeyFrom, prevMonthKeyFrom } from "../lib/dateUtils";
import { loadLS, K_WEIGHT_LOGS } from "../lib/storage";
import { averageWeightInRange } from "../lib/weightUtils";
import PeriodCard from "./PeriodCard";

export default function DashboardSummary() {
  const { workouts, exercises } = useApp();
  const [mode, setMode] = useState("week");

  const weeks = useMemo(() => buildWeeks(workouts || []), [workouts]);
  const months = useMemo(() => buildMonths(workouts || []), [workouts]);

  // Maps for previous period lookup
  const weekMap = useMemo(() => {
    const m = new Map();
    for (const w of weeks) m.set(w.key, w);
    return m;
  }, [weeks]);
  const monthMap = useMemo(() => {
    const m = new Map();
    for (const mm of months) m.set(mm.key, mm);
    return m;
  }, [months]);

  // Weight logs for weekly average weight KPI
  const weightLogs = useMemo(() => loadLS(K_WEIGHT_LOGS, {}), []);

  const averageWeightInRangeMemo = useCallback(
    (from, to) => averageWeightInRange(weightLogs, from, to),
    [weightLogs],
  );

  // Build weekly data array
  const weekData = useMemo(() => {
    return weeks.map((w) => {
      const metrics = computePeriodMetrics(w, workouts || [], exercises || []);
      const prevKey = prevWeekKeyFrom(w.from);
      const prevPeriod = weekMap.get(prevKey) || null;
      const prevMetrics = prevPeriod
        ? computePeriodMetrics(prevPeriod, workouts || [], exercises || [])
        : null;

      const weekWeightAvg = averageWeightInRangeMemo(w.from, w.to);
      const prevWeekWeightAvg = prevPeriod
        ? averageWeightInRangeMemo(prevPeriod.from, prevPeriod.to)
        : null;

      return {
        period: w,
        metrics,
        prevMetrics,
        weekWeightAvg,
        prevWeekWeightAvg,
      };
    });
  }, [weeks, workouts, exercises, weekMap, averageWeightInRangeMemo]);

  // Build monthly data array
  const monthData = useMemo(() => {
    return months.map((m) => {
      const metrics = computePeriodMetrics(m, workouts || [], exercises || []);
      const prevKey = prevMonthKeyFrom(m.from);
      const prevPeriod = monthMap.get(prevKey) || null;
      const prevMetrics = prevPeriod
        ? computePeriodMetrics(prevPeriod, workouts || [], exercises || [])
        : null;

      return { period: m, metrics, prevMetrics };
    });
  }, [months, workouts, exercises, monthMap]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          variant={mode === "week" ? "primary" : "secondary"}
          onClick={() => setMode("week")}
        >
          Weekly
        </Button>
        <Button
          variant={mode === "month" ? "primary" : "secondary"}
          onClick={() => setMode("month")}
        >
          Monthly
        </Button>
      </div>

      {mode === "week" ? (
        weekData.length ? (
          weekData.map(
            ({
              period,
              metrics,
              prevMetrics,
              weekWeightAvg,
              prevWeekWeightAvg,
            }) => (
              <PeriodCard
                key={period.key}
                period={period}
                metrics={metrics}
                prevMetrics={prevMetrics}
                weekWeightAvg={weekWeightAvg}
                prevWeekWeightAvg={prevWeekWeightAvg}
                defaultOpen={true}
                isWeek={true}
              />
            ),
          )
        ) : (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            No weekly data yet.
          </div>
        )
      ) : monthData.length ? (
        monthData.map(({ period, metrics, prevMetrics }) => (
          <PeriodCard
            key={period.key}
            period={period}
            metrics={metrics}
            prevMetrics={prevMetrics}
            defaultOpen={true}
            isWeek={false}
          />
        ))
      ) : (
        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          No monthly data yet.
        </div>
      )}
    </div>
  );
}
