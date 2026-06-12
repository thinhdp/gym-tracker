// src/components/DashboardSummary.jsx
// Main summary page that assembles period data and renders PeriodCards.

import React, { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { Button } from "./ui/Button";
import {
  buildWeeks,
  buildMonths,
  computePeriodMetrics,
} from "../lib/metrics";
import {
  prevWeekKeyFrom,
  prevMonthKeyFrom,
} from "../lib/dateUtils";
import { loadLS } from "../lib/storage";
import PeriodCard from "./PeriodCard";

// Helper for averaging weight logs (y-m-d keys).
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function averageWeightInRange(weightLogs, from, to) {
  const vals = [];
  const cur = new Date(from);
  while (cur <= to) {
    const key = ymd(cur);
    const v = weightLogs[key];
    if (typeof v === "number" && isFinite(v)) vals.push(v);
    cur.setDate(cur.getDate() + 1);
  }
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 10) / 10;
}

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
  const weightLogs = useMemo(() => loadLS("weightLogs", {}), []);

  const averageWeightInRangeMemo = (from, to) =>
    averageWeightInRange(weightLogs, from, to);

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

      return { period: w, metrics, prevMetrics, weekWeightAvg, prevWeekWeightAvg };
    });
  }, [weeks, workouts, exercises, weekMap, weightLogs]);

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
            ({ period, metrics, prevMetrics, weekWeightAvg, prevWeekWeightAvg }) => (
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
            )
          )
        ) : (
          <div className="text-sm text-neutral-500">No weekly data yet.</div>
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
        <div className="text-sm text-neutral-500">No monthly data yet.</div>
      )}
    </div>
  );
}
