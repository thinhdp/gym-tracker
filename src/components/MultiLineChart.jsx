import React, { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  LabelList,
} from "recharts";

/**
 * An interactive multi-series line chart built on Recharts. Generalizes the
 * single-line pattern from WeightChart so it can plot one series (per-exercise
 * progression, body weight) or several (volume by muscle) on a shared axis.
 *
 * Interactions:
 *   - hover / tap a point for a tooltip with every series' value at that x
 *   - drag the brush handles under the chart to zoom into a sub-range
 *   - click a legend entry to hide / show that series (multi-series only)
 *
 * Props:
 *   series  – [{ name, color, points: number[] }]. All series share the same
 *             x indices; `points` align with `labels` by index. Non-finite
 *             values are plotted as gaps but the line connects across them.
 *             `color` defaults to currentColor (inherits the parent text color).
 *   labels  – x-axis labels (strings), one per index.
 *   showValues – when true and there is a single (short) series, draws the
 *             rounded y-value above each point (like the old WeightChart).
 *   height  – chart height in px (default 240).
 */

// Tailwind-styled tooltip so values read clearly in both light and dark mode,
// instead of Recharts' default inline-styled white box.
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => p.value != null);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-md border bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      <div className="mb-0.5 font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      {rows.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 tabular-nums">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ background: p.color }}
          />
          {rows.length > 1 && (
            <span className="text-neutral-600 dark:text-neutral-300">
              {p.name}
            </span>
          )}
          <span className="font-semibold">{Math.round(p.value * 10) / 10}</span>
        </div>
      ))}
    </div>
  );
}

export default function MultiLineChart({
  series = [],
  labels = [],
  height = 240,
  showValues = false,
}) {
  // Track which series are toggled off via the legend, keyed by line dataKey.
  const [hidden, setHidden] = useState(() => new Set());
  const toggle = (key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const ys = series.flatMap((s) => s.points).filter((v) => Number.isFinite(v));
  if (labels.length < 2 || ys.length === 0) {
    return (
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        Not enough data to plot.
      </div>
    );
  }

  // Recharts wants row-major data: one object per x index, each series under a
  // stable key (v0, v1…) so names with odd characters can't collide with axes.
  const data = labels.map((label, i) => {
    const row = { label };
    series.forEach((s, si) => {
      const y = s.points[i];
      row[`v${si}`] = Number.isFinite(y) ? y : null;
    });
    return row;
  });

  const multi = series.length > 1;
  // Markers and always-on value labels get noisy on long ranges; the tooltip
  // covers detail past those thresholds.
  const showDots = data.length <= 40;
  const withValueLabels = showValues && !multi && data.length <= 12;
  // Only offer the zoom brush once there's enough data to be worth zooming.
  const showBrush = data.length > 8;

  const axisTick = { fontSize: 11, fill: "currentColor", opacity: 0.6 };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 12, right: 12, bottom: 4, left: -8 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          opacity={0.12}
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: "currentColor", opacity: 0.2 }}
          minTickGap={24}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={36}
          domain={["auto", "auto"]}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ stroke: "currentColor", opacity: 0.2 }}
        />
        {multi && (
          <Legend
            onClick={(o) => toggle(o.dataKey)}
            wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
            formatter={(value, entry) => (
              <span
                className="text-neutral-600 dark:text-neutral-300"
                style={{ opacity: hidden.has(entry.dataKey) ? 0.4 : 1 }}
              >
                {value}
              </span>
            )}
          />
        )}
        {series.map((s, si) => {
          const key = `v${si}`;
          return (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={s.name}
              stroke={s.color || "currentColor"}
              strokeWidth={2}
              connectNulls
              hide={hidden.has(key)}
              dot={showDots ? { r: 2.5 } : false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            >
              {withValueLabels && (
                <LabelList
                  dataKey={key}
                  position="top"
                  fontSize={10}
                  fill="currentColor"
                  formatter={(v) => (v == null ? "" : Math.round(v))}
                />
              )}
            </Line>
          );
        })}
        {showBrush && (
          <Brush
            dataKey="label"
            height={22}
            travellerWidth={8}
            stroke="currentColor"
            tickFormatter={() => ""}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
