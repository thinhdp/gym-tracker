import React, { useMemo, useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { useApp } from "../context/AppContext";
// Import the new scrollable weight chart component. This component handles
// rendering both daily and monthly weight data in a horizontally scrollable
// graph. It reads from the provided logs or falls back to localStorage
// internally if no logs are supplied.
import WeightChart from "./WeightChart";

/** Storage helpers */
function getLs(key, fallback = {}) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function setLs(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar helpers (Mon–Sun) */
function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}
function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMon);
  return d;
}
function endOfWeekSunday(date) {
  const start = startOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
function weekRangeOf(date) {
  const from = startOfWeekMonday(date);
  const to = endOfWeekSunday(date);
  return { from, to };
}

/** Weekly stats */
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

function computeWeeklyAvgAndDelta(weightLogs, refDate) {
  const { from: thisFrom, to: thisTo } = weekRangeOf(refDate);
  const lastWeekRef = new Date(thisFrom);
  lastWeekRef.setDate(lastWeekRef.getDate() - 1);
  const { from: prevFrom, to: prevTo } = weekRangeOf(lastWeekRef);
  const curr = averageWeightInRange(weightLogs, thisFrom, thisTo);
  const prev = averageWeightInRange(weightLogs, prevFrom, prevTo);
  const delta = curr != null && prev != null ? Math.round((curr - prev) * 10) / 10 : null;
  return { curr, prev, delta };
}

/** SVG Line chart with points + labels */
function LineChart({ points, height = 160, padding = 24 }) {
  if (!points || points.length < 2) {
    return <div className="text-sm text-neutral-500">Not enough data to plot.</div>;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = 640;

  const scaleX = (x) => padding + ((x - minX) / (maxX - minX || 1)) * (width - padding * 2);
  const scaleY = (y) => height - padding - ((y - minY) / (maxY - minY || 1)) * (height - padding * 2);

  const linePoints = points.map((p) => `${scaleX(p.x)},${scaleY(p.y)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* line */}
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={linePoints} />
      {/* point markers + labels */}
      {points.map((p, i) => {
        const cx = scaleX(p.x);
        const cy = scaleY(p.y);
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="3" fill="currentColor" />
            <text x={cx} y={cy - 8} fontSize="10" textAnchor="middle" fill="currentColor">
              {p.label}: {p.y}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function WeightTracker() {
  const { unit } = useApp();
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const [editingKey, setEditingKey] = useState(null); // YYYY-MM-DD being edited
  const [draft, setDraft] = useState("");

  const weightLogs = useMemo(() => getLs("weightLogs", {}), []);
  const [logs, setLogs] = useState(weightLogs);

  useEffect(() => {
    setLs("weightLogs", logs);
  }, [logs]);

  const days = useMemo(() => {
    const firstOfMonth = startOfMonth(monthCursor);
    const lastOfMonth = endOfMonth(monthCursor);
    const start = startOfWeekMonday(firstOfMonth);
    const end = endOfWeekSunday(lastOfMonth);
    const arr = [];
    const cur = new Date(start);
    while (cur <= end) {
      arr.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }, [monthCursor]);

  const todayYmd = ymd(new Date());

  // Weekly stats for current week (based on "today")
  const { curr: weekAvg, delta: weekDelta } = useMemo(() => computeWeeklyAvgAndDelta(logs, new Date()), [logs]);

  // Graph data toggle: "daily" | "weekly"
  const [mode, setMode] = useState("daily");

  const dailyPoints = useMemo(() => {
    const allKeys = Object.keys(logs).sort();
    if (!allKeys.length) return [];
    const base = new Date(allKeys[0] + "T00:00:00");
    return allKeys
      .filter((k) => typeof logs[k] === "number" && isFinite(logs[k]))
      .map((k) => {
        const d = new Date(k + "T00:00:00");
        const label = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return { x: (d - base) / 86400000, y: logs[k], label };
      });
  }, [logs]);

  // We no longer compute aggregated points for the chart here. The WeightChart
  // component handles aggregation for weekly view internally. If you need
  // weeklyPoints elsewhere (e.g. for alternate visualizations), you can
  // compute them similarly to the original implementation.

  const onCellClick = (date) => {
    const key = ymd(date);
    setEditingKey(key);
    setDraft(logs[key] != null ? String(logs[key]) : "");
  };
  const commitEdit = () => {
    const val = draft.trim();
    if (val === "") {
      setLogs((prev) => {
        const next = { ...prev };
        delete next[editingKey];
        return next;
      });
    } else {
      const num = Number(val);
      if (!Number.isFinite(num)) return; // ignore invalid
      setLogs((prev) => ({ ...prev, [editingKey]: num }));
    }
    setEditingKey(null);
  };

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => {
            const d = new Date(monthCursor);
            d.setMonth(d.getMonth() - 1);
            setMonthCursor(startOfMonth(d));
          }}
        >
          ←
        </Button>
        <div className="font-semibold">
          {monthCursor.getFullYear()}-{String(monthCursor.getMonth() + 1).padStart(2, "0")}
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            const d = new Date(monthCursor);
            d.setMonth(d.getMonth() + 1);
            setMonthCursor(startOfMonth(d));
          }}
        >
          →
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center text-neutral-500 py-1">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === monthCursor.getMonth();
          const isToday = key === todayYmd;
          const val = logs[key];

          return (
            <div
              key={key}
              className={[
                "relative h-16 border rounded-md p-1 cursor-pointer",
                inMonth ? "bg-white" : "bg-neutral-50",
                isToday ? "ring-2 ring-blue-500" : "",
              ].join(" ")}
              onClick={() => onCellClick(d)}
            >
              <div className="absolute top-1 left-1 text-[10px] text-neutral-500">
                {d.getDate()}
              </div>
              {editingKey === key ? (
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  <input
                    autoFocus
                    type="number"
                    step="0.1"
                    className="w-full text-center border rounded px-2 py-1 text-sm"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingKey(null);
                    }}
                  />
                </div>
              ) : val != null ? (
                <div className="h-full flex items-center justify-center">
                  {/* Smaller weight text so it doesn't cover the date */}
                  <div className="text-[10px] md:text-xs font-semibold">
                    {val}
                    <span className="text-[9px] text-neutral-500"> {unit}</span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Weekly average + delta */}
      <div className="rounded-lg border p-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-neutral-500">This Week Avg</div>
          <div className="text-lg font-semibold">
            {weekAvg != null ? `${weekAvg} ${unit}` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">Δ vs Last Week</div>
          <div
            className={[
              "text-lg font-semibold",
              weekDelta == null
                ? "text-neutral-400"
                : weekDelta > 0
                ? "text-green-600"
                : "text-red-600",
            ].join(" ")}
          >
            {weekDelta == null ? "—" : (weekDelta > 0 ? "+" : "") + weekDelta}
          </div>
        </div>
      </div>

      {/* Trend graph with markers + labels (day/value) */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            variant={mode === "daily" ? "primary" : "secondary"}
            onClick={() => setMode("daily")}
          >
            Daily
          </Button>
          <Button
            variant={mode === "weekly" ? "primary" : "secondary"}
            onClick={() => setMode("weekly")}
          >
            Weekly
          </Button>
        </div>
        {/*
          Use the WeightChart component to render the line chart. It
          automatically aggregates data based on the view (daily or
          weekly) and renders a horizontally scrollable graph. The
          window displays at most 14 days or 12 weeks at once, but
          you can scroll left/right to view the rest of your weight
          history. Passing the logs ensures it uses the same data
          that WeightTracker manages.
        */}
        <div className="rounded-lg border p-3 overflow-x-auto">
          <WeightChart view={mode} logs={logs} />
        </div>
      </div>
    </div>
  );
}
