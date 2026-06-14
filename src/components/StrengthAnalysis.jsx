// src/components/StrengthAnalysis.jsx
// The Progress → Strength view: an analysis dashboard (volume / workouts / PR
// trends, a recent-PRs feed, and volume-by-muscle over time) plus a
// per-exercise drill-down with an estimated-1RM / top-set / volume curve.

import React, { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import Segmented from "./ui/Segmented";
import Combobox from "./ui/Combobox";
import Delta from "./Delta";
import MultiLineChart from "./MultiLineChart";
import { toDisplayWeight } from "../lib/units";
import { toDate } from "../lib/dateUtils";
import {
  exerciseSeries,
  exercisePRs,
  recentPRs,
  volumeByMuscleSeries,
  rangeWindows,
  totalVolume,
  loggedExerciseNames,
  mostRecentExercise,
} from "../lib/strength";

const RANGES = [
  ["3M", "3M"],
  ["6M", "6M"],
  ["1Y", "1Y"],
  ["all", "All"],
];
const METRICS = [
  ["e1rm", "Est. 1RM"],
  ["top", "Top set"],
  ["vol", "Volume"],
];
// Distinct, mid-ramp colors that read in both light and dark mode.
const MUSCLE_COLORS = ["#534AB7", "#1D9E75", "#D85A30", "#378ADD", "#D4537E"];
const LINE_COLOR = "#378ADD";

function KpiCard({ label, value, suffix, curr, prev, decimals = 0 }) {
  return (
    <div className="rounded-lg border dark:border-neutral-800 p-2">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums flex flex-wrap items-baseline gap-x-1">
        {value}
        {suffix && (
          <span className="text-xs font-normal text-neutral-400">{suffix}</span>
        )}
        <Delta curr={curr} prev={prev} decimals={decimals} />
      </div>
    </div>
  );
}

function PrCard({ label, value, suffix, sub }) {
  return (
    <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-2">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums">
        {value}
        {suffix && (
          <span className="text-xs font-normal text-neutral-400">
            {" "}
            {suffix}
          </span>
        )}
      </div>
      {sub && (
        <div className="text-xs text-neutral-400 dark:text-neutral-500">
          {sub}
        </div>
      )}
    </div>
  );
}

export default function StrengthAnalysis() {
  const { workouts, exercises, unit } = useApp();
  const wos = useMemo(() => workouts || [], [workouts]);

  const [range, setRange] = useState("6M");
  const [metric, setMetric] = useState("e1rm");
  // Seed the drill-down with a sensible default once, but keep the input fully
  // editable afterwards — binding the field to a fallback would repopulate it
  // the instant the user clears it, blocking both retyping and the dropdown.
  const [exercise, setExercise] = useState(
    () => mostRecentExercise(wos) || loggedExerciseNames(wos)[0] || "",
  );

  const names = useMemo(() => loggedExerciseNames(wos), [wos]);
  const selected = exercise;

  // Current vs previous equal-length window for trend deltas. Destructure the
  // memoized result so each derived useMemo depends on a stable value.
  const windows = useMemo(() => rangeWindows(wos, range), [wos, range]);
  const {
    current: curWindow,
    previous: prevWindow,
    from: winFrom,
    prevFrom: winPrevFrom,
  } = windows;
  const curVol = useMemo(() => totalVolume(curWindow), [curWindow]);
  const prevVol = prevWindow ? totalVolume(prevWindow) : null;

  // PR events across all history, then split by window for counts + the feed.
  const allPRs = useMemo(() => recentPRs(wos, 0), [wos]);
  const curPRs = winFrom
    ? allPRs.filter((p) => toDate(p.date) >= winFrom)
    : allPRs;
  const prevPRcount = prevWindow
    ? allPRs.filter((p) => {
        const d = toDate(p.date);
        return d >= winPrevFrom && d < winFrom;
      }).length
    : null;
  const feed = curPRs.slice(0, 8);

  // Volume by muscle: weekly buckets for short ranges, monthly for long ones.
  const period = range === "1Y" || range === "all" ? "month" : "week";
  const muscleData = useMemo(
    () => volumeByMuscleSeries(curWindow, exercises || [], period),
    [curWindow, exercises, period],
  );
  const muscleSeries = muscleData.muscles.map((m, i) => ({
    name: m.name,
    color: MUSCLE_COLORS[i % MUSCLE_COLORS.length],
    points: m.points.map((v) => toDisplayWeight(v, unit)),
  }));
  const muscleLabels = muscleData.buckets.map((b) =>
    period === "month"
      ? b.key.slice(2)
      : `${b.from.getMonth() + 1}/${b.from.getDate()}`,
  );

  // Per-exercise progression for the selected lift.
  const series = useMemo(
    () => exerciseSeries(curWindow, selected),
    [curWindow, selected],
  );
  const prs = useMemo(() => exercisePRs(wos, selected), [wos, selected]);
  const exLabels = series.map((s) => s.date.slice(5));
  const exPoints = series.map((s) => {
    const raw =
      metric === "e1rm"
        ? s.bestE1RM
        : metric === "top"
          ? s.topSetWeight
          : s.volume;
    return toDisplayWeight(raw, unit);
  });

  if (names.length === 0) {
    return (
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        No strength data yet. Log a workout to see your progress here.
      </div>
    );
  }

  const fmt = (kg) => toDisplayWeight(kg, unit);

  return (
    <div className="space-y-5">
      {/* Range selector */}
      <div className="flex justify-end">
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard
          label="Volume"
          value={fmt(curVol).toLocaleString()}
          suffix={unit}
          curr={fmt(curVol)}
          prev={prevVol == null ? null : fmt(prevVol)}
        />
        <KpiCard
          label="Workouts"
          value={curWindow.length}
          curr={curWindow.length}
          prev={prevWindow ? prevWindow.length : null}
        />
        <KpiCard
          label="New PRs"
          value={curPRs.length}
          curr={curPRs.length}
          prev={prevPRcount}
        />
      </div>

      {/* Recent PRs feed */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Recent PRs</div>
        {feed.length ? (
          <div className="text-sm border dark:border-neutral-800 rounded-lg divide-y dark:divide-neutral-800">
            {feed.map((p, i) => (
              <div
                key={`${p.date}-${p.exercise}-${p.type}-${i}`}
                className="flex items-center justify-between px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.exercise}</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500">
                    {p.date} · {p.type === "e1RM" ? "Est. 1RM" : "Top weight"}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums shrink-0">
                  {fmt(p.value)}
                  <span className="text-xs font-normal text-neutral-400">
                    {" "}
                    {unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            No new PRs in this range.
          </div>
        )}
      </div>

      {/* Volume by muscle trend */}
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {period === "month" ? "Monthly" : "Weekly"} volume by muscle
        </div>
        <div className="rounded-lg border dark:border-neutral-800 p-3 text-neutral-700 dark:text-neutral-300">
          <MultiLineChart series={muscleSeries} labels={muscleLabels} />
        </div>
        {muscleSeries.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            {muscleSeries.map((m) => (
              <span key={m.name} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: m.color }}
                />
                {m.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Per-exercise drill-down */}
      <div className="space-y-3 border-t dark:border-neutral-800 pt-4">
        <div>
          <label className="text-xs text-neutral-500 dark:text-neutral-400">
            Exercise
          </label>
          <Combobox
            value={selected}
            onChange={setExercise}
            options={names}
            placeholder="Pick an exercise"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <PrCard label="Best e1RM" value={fmt(prs.bestE1RM)} suffix={unit} />
          <PrCard
            label="Heaviest"
            value={prs.heaviest ? fmt(prs.heaviest.weight) : "—"}
            suffix={prs.heaviest ? unit : ""}
            sub={prs.heaviest ? `${prs.heaviest.reps} reps` : null}
          />
          <PrCard
            label="Best set vol"
            value={prs.bestSetVolume ? fmt(prs.bestSetVolume.value) : "—"}
            suffix={prs.bestSetVolume ? unit : ""}
            sub={
              prs.bestSetVolume
                ? `${fmt(prs.bestSetVolume.weight)}×${prs.bestSetVolume.reps}`
                : null
            }
          />
        </div>

        <Segmented options={METRICS} value={metric} onChange={setMetric} />

        <div className="rounded-lg border dark:border-neutral-800 p-3 text-neutral-800 dark:text-neutral-200">
          {series.length >= 2 ? (
            <MultiLineChart
              series={[{ name: selected, color: LINE_COLOR, points: exPoints }]}
              labels={exLabels}
              showValues
            />
          ) : (
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              Not enough sessions in this range to plot{" "}
              {selected || "this exercise"}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
