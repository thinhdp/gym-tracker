import React, { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Segmented from "../../components/ui/Segmented";
import { K_UNIT, K_WEIGHT_LOGS, loadLS } from "../../lib/storage";
import { useFood } from "../context/FoodContext";
import { localDateFromYmd } from "../lib/localDate";
import { weeklyIntake } from "../lib/trends";

const RANGES = [
  ["4w", "4w"],
  ["12w", "12w"],
  ["all", "All"],
];
const WEEKS = { "4w": 4, "12w": 12, all: null };

const METRICS = [
  ["kcal", "Calories"],
  ["protein", "Protein"],
  ["carb", "Carbs"],
  ["fat", "Fat"],
];

const DASH = "—";
const BAR_COLOR = "#3b82f6";
const LINE_COLOR = "#f59e0b";

const axisTick = { fontSize: 11, fill: "currentColor", opacity: 0.6 };

const shortDay = (ymd) =>
  localDateFromYmd(ymd).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

const fmt = (v) => (v === null || v === undefined ? DASH : String(v));
const fmtDelta = (v) =>
  v === null || v === undefined ? DASH : v > 0 ? `+${v}` : String(v);

function ChartTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      <div className="mb-0.5 font-medium text-neutral-500 dark:text-neutral-400">
        {row.label}
      </div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={p.dataKey} className="tabular-nums">
            {p.name}: <span className="font-semibold">{p.value}</span>
          </div>
        ))}
    </div>
  );
}

export default function TrendsView() {
  const { entries } = useFood();
  const [range, setRange] = useState("4w");
  const [metric, setMetric] = useState("kcal");
  const weightLogs = useMemo(() => loadLS(K_WEIGHT_LOGS, {}), []);
  const unit = useMemo(() => loadLS(K_UNIT, "kg"), []);

  const rows = useMemo(
    () => weeklyIntake(entries, weightLogs, { weeks: WEEKS[range] }),
    [entries, weightLogs, range],
  );

  const metricLabel = METRICS.find(([k]) => k === metric)[1];
  const data = rows.map((r) => ({
    from: r.from,
    label: r.label,
    value: r.avg ? r.avg[metric] : null,
    bodyweight: r.bodyweight,
  }));
  const tickByFrom = new Map(
    rows.map((r) => [r.from, `${shortDay(r.from)} (${r.loggedDays}/7)`]),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Segmented options={RANGES} value={range} onChange={setRange} />
        <Segmented options={METRICS} value={metric} onChange={setMetric} />
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 4, bottom: 4, left: -8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.12}
            vertical={false}
          />
          <XAxis
            dataKey="from"
            tickFormatter={(from) => tickByFrom.get(from) ?? from}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: "currentColor", opacity: 0.2 }}
            interval={0}
          />
          <YAxis
            yAxisId="intake"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <YAxis
            yAxisId="weight"
            orientation="right"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "currentColor", opacity: 0.2 }}
          />
          <Bar
            yAxisId="intake"
            dataKey="value"
            name={metricLabel}
            fill={BAR_COLOR}
            isAnimationActive={false}
          />
          <Line
            yAxisId="weight"
            type="monotone"
            dataKey="bodyweight"
            name={`Bodyweight (${unit})`}
            stroke={LINE_COLOR}
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 2.5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-xs text-neutral-500 dark:text-neutral-400">
            <tr>
              <th className="py-1 pr-3 font-medium">Week</th>
              <th className="py-1 pr-3 font-medium">kcal</th>
              <th className="py-1 pr-3 font-medium">P</th>
              <th className="py-1 pr-3 font-medium">C</th>
              <th className="py-1 pr-3 font-medium">F</th>
              <th className="py-1 pr-3 font-medium">Days</th>
              <th className="py-1 pr-3 font-medium">Weight ({unit})</th>
              <th className="py-1 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.from} className="border-t dark:border-neutral-800">
                <td className="whitespace-nowrap py-1 pr-3">{r.label}</td>
                <td className="py-1 pr-3">{fmt(r.avg?.kcal)}</td>
                <td className="py-1 pr-3">{fmt(r.avg?.protein)}</td>
                <td className="py-1 pr-3">{fmt(r.avg?.carb)}</td>
                <td className="py-1 pr-3">{fmt(r.avg?.fat)}</td>
                <td className="py-1 pr-3">{r.loggedDays}/7</td>
                <td className="py-1 pr-3">{fmt(r.bodyweight)}</td>
                <td className="py-1">{fmtDelta(r.bodyweightDelta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
