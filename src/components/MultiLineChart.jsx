import React from "react";

/**
 * A compact multi-series SVG line chart. Generalizes the single-line pattern
 * from WeightChart so it can plot one series (per-exercise progression) or
 * several (volume by muscle) on a shared axis.
 *
 * Props:
 *   series  – [{ name, color, points: number[] }]. All series share the same
 *             x indices; `points` align with `labels` by index. Non-finite
 *             values are skipped. `color` defaults to currentColor.
 *   labels  – x-axis labels (strings), one per index.
 *   showValues – when true and there is a single series, draws the rounded
 *             y-value above sampled points (like WeightChart).
 */
export default function MultiLineChart({
  series = [],
  labels = [],
  height = 200,
  width = 720,
  padding = 32,
  showValues = false,
}) {
  const ys = series.flatMap((s) => s.points).filter((v) => Number.isFinite(v));
  if (labels.length < 2 || ys.length === 0) {
    return (
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        Not enough data to plot.
      </div>
    );
  }

  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const lastIdx = labels.length - 1;
  const scaleX = (i) => padding + (i / (lastIdx || 1)) * (width - padding * 2);
  const scaleY = (y) =>
    height -
    padding -
    ((y - minY) / (maxY - minY || 1)) * (height - padding * 2);

  // Show at most ~8 x-labels, always including the last point.
  const labelStep = Math.max(1, Math.ceil(labels.length / 8));
  const showLabel = (i) => i === lastIdx || i % labelStep === 0;
  // Markers get noisy past ~40 points; hide them on long ranges.
  const showMarkers = labels.length <= 40;
  const single = series.length === 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      {series.map((s, si) => {
        const pts = s.points
          .map((y, i) =>
            Number.isFinite(y) ? `${scaleX(i)},${scaleY(y)}` : null,
          )
          .filter(Boolean)
          .join(" ");
        return (
          <polyline
            key={s.name || si}
            fill="none"
            stroke={s.color || "currentColor"}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            points={pts}
          />
        );
      })}

      {series.map((s, si) =>
        s.points.map((y, i) => {
          if (!Number.isFinite(y)) return null;
          const cx = scaleX(i);
          const cy = scaleY(y);
          return (
            <g key={`${si}-${i}`}>
              {showMarkers && (
                <circle
                  cx={cx}
                  cy={cy}
                  r="3"
                  fill={s.color || "currentColor"}
                />
              )}
              {showValues && single && showLabel(i) && (
                <text
                  x={cx}
                  y={cy - 8}
                  fontSize="10"
                  textAnchor="middle"
                  fill="currentColor"
                >
                  {Math.round(y)}
                </text>
              )}
            </g>
          );
        }),
      )}

      {labels.map((lab, i) =>
        showLabel(i) ? (
          <text
            key={`l-${i}`}
            x={scaleX(i)}
            y={height - padding + 14}
            fontSize="9"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
          >
            {lab}
          </text>
        ) : null,
      )}
    </svg>
  );
}
