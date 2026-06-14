import React, { useMemo } from "react";
import { loadLS, K_WEIGHT_LOGS } from "../lib/storage";
import { buildWeightSeries } from "../lib/weightSeries";
import MultiLineChart from "./MultiLineChart";

/**
 * Line chart for body-weight logs over a selected period.
 *
 * Every day in [from, to] is plotted; days without a logged weight carry the
 * most recent prior weight forward (see buildWeightSeries), so adjacent points
 * always represent consecutive days. Weekly view averages the filled days per
 * ISO week.
 *
 * Rendering (interactive tooltip, brush-to-zoom, value labels) is delegated to
 * MultiLineChart — this component only shapes the weight series into a single
 * line.
 *
 * Props:
 *   logs (optional) – map of ISO date strings to weights (falls back to LS).
 *   view – "daily" or "weekly".
 *   from / to – Date range to plot.
 */
export default function WeightChart({ logs, view = "daily", from, to }) {
  const rawLogs = logs || loadLS(K_WEIGHT_LOGS, {});

  const series = useMemo(
    () => buildWeightSeries(rawLogs, from, to, view),
    [rawLogs, from, to, view],
  );

  const labels = useMemo(
    () => series.map((row) => row.date.slice(5)),
    [series],
  ); // MM-DD
  const lineSeries = useMemo(
    () => [{ name: "Weight", points: series.map((row) => row.weight) }],
    [series],
  );

  return <MultiLineChart series={lineSeries} labels={labels} showValues />;
}
