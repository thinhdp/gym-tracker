import React, { useMemo } from "react";
import { loadLS, K_WEIGHT_LOGS } from "../lib/storage";
import { buildWeightSeries } from "../lib/weightSeries";

/**
 * A simple SVG line chart. Fits the width of its container (no horizontal
 * scrolling) and samples labels so long ranges stay readable. Markers are
 * only drawn when the series is short enough not to look noisy.
 */
function SimpleLineChart({ points, height = 200, width = 720, padding = 32 }) {
  if (!points || points.length < 2) {
    return (
      <div className="text-sm text-neutral-500">Not enough data to plot.</div>
    );
  }
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const lastIdx = points.length - 1;
  const scaleX = (x) => padding + (x / (lastIdx || 1)) * (width - padding * 2);
  const scaleY = (y) =>
    height -
    padding -
    ((y - minY) / (maxY - minY || 1)) * (height - padding * 2);
  const linePoints = points
    .map((p) => `${scaleX(p.x)},${scaleY(p.y)}`)
    .join(" ");

  // Show at most ~8 labels along the axis, always including the last point.
  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  const showLabel = (i) => i === lastIdx || i % labelStep === 0;
  // Markers get noisy past ~40 points; hide them on long ranges.
  const showMarkers = points.length <= 40;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      {/* line */}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        points={linePoints}
      />
      {points.map((p, i) => {
        const cx = scaleX(p.x);
        const cy = scaleY(p.y);
        const labelled = showLabel(i);
        return (
          <g key={i}>
            {showMarkers && (
              <circle cx={cx} cy={cy} r="3" fill="currentColor" />
            )}
            {labelled && (
              <>
                <text
                  x={cx}
                  y={cy - 8}
                  fontSize="10"
                  textAnchor="middle"
                  fill="currentColor"
                >
                  {p.y}
                </text>
                <text
                  x={cx}
                  y={height - padding + 14}
                  fontSize="9"
                  textAnchor="middle"
                  fill="currentColor"
                  opacity="0.6"
                >
                  {p.label}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Line chart for body-weight logs over a selected period.
 *
 * Every day in [from, to] is plotted; days without a logged weight carry the
 * most recent prior weight forward (see buildWeightSeries), so adjacent points
 * always represent consecutive days. Weekly view averages the filled days per
 * ISO week.
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

  const points = useMemo(
    () =>
      series.map((row, idx) => ({
        x: idx,
        y: row.weight,
        label: row.date.slice(5), // MM-DD
      })),
    [series],
  );

  return <SimpleLineChart points={points} />;
}
