import React, { useMemo } from 'react';
import { loadLS } from '../lib/storage';

/**
 * A simple SVG line chart component. Accepts an array of points
 * with x/y coordinates and draws a polyline with markers and labels.
 * The width of the chart is configurable to support horizontal scrolling.
 */
function SimpleLineChart({ points, height = 160, width, padding = 24 }) {
  if (!points || points.length < 2) {
    return <div className="text-sm text-neutral-500">Not enough data to plot.</div>;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scaleX = (x) =>
    padding + ((x - minX) / (maxX - minX || 1)) * (width - padding * 2);
  const scaleY = (y) =>
    height -
    padding -
    ((y - minY) / (maxY - minY || 1)) * (height - padding * 2);
  const linePoints = points
    .map((p) => `${scaleX(p.x)},${scaleY(p.y)}`)
    .join(' ');
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
    >
      {/* line */}
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={linePoints} />
      {/* point markers + labels */}
      {points.map((p, i) => {
        const cx = scaleX(p.x);
        const cy = scaleY(p.y);
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="3" fill="currentColor" />
            <text
              x={cx}
              y={cy - 8}
              fontSize="10"
              textAnchor="middle"
              fill="currentColor"
            >
              {p.label}: {p.y}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Scrollable line chart for displaying body‑weight logs. This component
 * renders a maximum of two weeks (14 days) at a time in daily mode or
 * twelve weeks in weekly mode. The most recent entries are shown,
 * and the chart scrolls horizontally when there are more slots than
 * displayed data. No external charting library is required.
 *
 * Props:
 *   logs (optional) – an object mapping ISO date strings to weights.
 *   view – "daily" or "weekly" to determine aggregation.
 */
export default function WeightChart({ logs, view = 'daily' }) {
  // Read weight logs from props or localStorage
  const rawLogs = logs || loadLS('weightLogs', {});
  // Helper to compute the start of the week (Monday)
  const startOfWeekMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMon = (day + 6) % 7;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - diffToMon);
    return d;
  };
  // Normalize data according to view
  const weightData = useMemo(() => {
    const entries = Object.keys(rawLogs).sort();
    if (view === 'weekly') {
      const byWeek = {};
      entries.forEach((date) => {
        const d = new Date(date + 'T00:00:00');
        const weekStart = startOfWeekMonday(d);
        const wkKey = weekStart.toISOString().slice(0, 10);
        if (!byWeek[wkKey]) byWeek[wkKey] = [];
        byWeek[wkKey].push(rawLogs[date]);
      });
      return Object.keys(byWeek)
        .sort()
        .map((wk) => {
          const weights = byWeek[wk];
          const avg =
            weights.reduce((sum, w) => sum + w, 0) /
            (weights.length || 1);
          return { date: wk, weight: parseFloat(avg.toFixed(2)) };
        });
    }
    return entries.map((date) => ({ date, weight: rawLogs[date] }));
  }, [rawLogs, view]);
  // Determine page size: 12 weeks or 14 days. This defines the width of the
  // visible window (number of slots displayed at once).
  const PAGE_SIZE = view === 'weekly' ? 12 : 14;
  // Convert all entries to points with sequential x values. We assign each
  // record a zero-based index so that the x-axis spacing is uniform.
  const points = useMemo(() => {
    return weightData.map((row, idx) => {
      const label = row.date.slice(5); // show MM-DD portion
      return { x: idx, y: row.weight, label };
    });
  }, [weightData]);
  // Full chart width based on the total number of points
  const chartWidth = points.length * 60;
  // Visible window width: fixed number of slots (PAGE_SIZE)
  const visibleWidth = PAGE_SIZE * 60;
  return (
    <div>
      {/* Wrapper with fixed width so only PAGE_SIZE points are visible at once */}
      <div style={{ overflowX: 'auto', width: `${visibleWidth}px` }}>
        <div style={{ width: `${chartWidth}px` }}>
          <SimpleLineChart points={points} width={chartWidth} />
        </div>
      </div>
    </div>
  );
}
