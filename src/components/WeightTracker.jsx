import React, { useMemo, useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { useApp } from "../context/AppContext";
// Import the new scrollable weight chart component. This component handles
// rendering both daily and monthly weight data in a horizontally scrollable
// graph. It reads from the provided logs or falls back to localStorage
// internally if no logs are supplied.
import WeightChart from "./WeightChart";
import { loadLS, saveLS, K_WEIGHT_LOGS } from "../lib/storage";
import { ymdFromDate } from "../lib/date";
import {
  startOfMonth,
  endOfMonth,
  startOfWeekMonday,
  endOfWeekSunday,
} from "../lib/dateUtils";
import { averageWeightInRange } from "../lib/weightUtils";
import { rangeForPeriod } from "../lib/weightSeries";

function weekRangeOf(date) {
  const from = startOfWeekMonday(date);
  const to = endOfWeekSunday(date);
  return { from, to };
}

/** Weekly stats */
function computeWeeklyAvgAndDelta(weightLogs, refDate) {
  const { from: thisFrom, to: thisTo } = weekRangeOf(refDate);
  const lastWeekRef = new Date(thisFrom);
  lastWeekRef.setDate(lastWeekRef.getDate() - 1);
  const { from: prevFrom, to: prevTo } = weekRangeOf(lastWeekRef);
  const curr = averageWeightInRange(weightLogs, thisFrom, thisTo);
  const prev = averageWeightInRange(weightLogs, prevFrom, prevTo);
  const delta =
    curr != null && prev != null ? Math.round((curr - prev) * 10) / 10 : null;
  return { curr, prev, delta };
}

export default function WeightTracker() {
  const { unit } = useApp();
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const [editingKey, setEditingKey] = useState(null); // YYYY-MM-DD being edited
  const [draft, setDraft] = useState("");

  const [logs, setLogs] = useState(() => loadLS(K_WEIGHT_LOGS, {}));

  useEffect(() => {
    saveLS(K_WEIGHT_LOGS, logs);
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

  const todayYmd = ymdFromDate(new Date());

  // Weekly stats for current week (based on "today")
  const { curr: weekAvg, delta: weekDelta } = useMemo(
    () => computeWeeklyAvgAndDelta(logs, new Date()),
    [logs],
  );

  // Graph data toggle: "daily" | "weekly"
  const [mode, setMode] = useState("daily");

  // Chart period: "1m" | "3m" | "6m" | "1y" | "custom"
  const [period, setPeriod] = useState("3m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from: chartFrom, to: chartTo } = useMemo(() => {
    if (period === "custom") {
      const f = customFrom ? new Date(customFrom + "T00:00:00") : null;
      const t = customTo ? new Date(customTo + "T00:00:00") : new Date();
      return { from: f, to: t };
    }
    return rangeForPeriod(period);
  }, [period, customFrom, customTo]);

  const onCellClick = (date) => {
    const key = ymdFromDate(date);
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
          {monthCursor.getFullYear()}-
          {String(monthCursor.getMonth() + 1).padStart(2, "0")}
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
          <div
            key={d}
            className="text-center text-neutral-500 dark:text-neutral-400 py-1"
          >
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = ymdFromDate(d);
          const inMonth = d.getMonth() === monthCursor.getMonth();
          const isToday = key === todayYmd;
          const val = logs[key];

          return (
            <div
              key={key}
              className={[
                "relative h-16 border dark:border-neutral-800 rounded-md p-1 cursor-pointer",
                inMonth
                  ? "bg-white dark:bg-neutral-900"
                  : "bg-neutral-50 dark:bg-neutral-800",
                isToday ? "ring-2 ring-blue-500" : "",
              ].join(" ")}
              onClick={() => onCellClick(d)}
            >
              <div className="absolute top-1 left-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                {d.getDate()}
              </div>
              {editingKey === key ? (
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  <input
                    autoFocus
                    type="number"
                    step="0.1"
                    className="w-full text-center border dark:border-neutral-800 rounded px-2 py-1 text-sm"
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
                    <span className="text-[9px] text-neutral-500 dark:text-neutral-400">
                      {" "}
                      {unit}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Weekly average + delta */}
      <div className="rounded-lg border dark:border-neutral-800 p-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            This Week Avg
          </div>
          <div className="text-lg font-semibold">
            {weekAvg != null ? `${weekAvg} ${unit}` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Δ vs Last Week
          </div>
          <div
            className={[
              "text-lg font-semibold",
              weekDelta == null
                ? "text-neutral-400 dark:text-neutral-500"
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
        {/* Daily / Weekly view toggle */}
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

        {/* Period selector */}
        <div className="flex flex-wrap gap-2">
          {[
            ["1m", "1M"],
            ["3m", "3M"],
            ["6m", "6M"],
            ["1y", "1Y"],
            ["custom", "Custom"],
          ].map(([key, label]) => (
            <Button
              key={key}
              variant={period === key ? "primary" : "secondary"}
              onClick={() => setPeriod(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Custom range inputs */}
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1">
              <span className="text-neutral-500 dark:text-neutral-400">
                From
              </span>
              <input
                type="date"
                className="border dark:border-neutral-800 rounded px-2 py-1"
                value={customFrom}
                max={customTo || todayYmd}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-neutral-500 dark:text-neutral-400">To</span>
              <input
                type="date"
                className="border dark:border-neutral-800 rounded px-2 py-1"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </label>
          </div>
        )}

        {/*
          WeightChart plots every day in the selected range. Days without a
          logged weight carry the last recorded weight forward, so adjacent
          points always represent consecutive days. Weekly view averages the
          filled days per ISO week. Passing the logs ensures it uses the same
          data that WeightTracker manages.
        */}
        <div className="rounded-lg border dark:border-neutral-800 p-3">
          {period === "custom" && !customFrom ? (
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              Pick a start date to plot a custom range.
            </div>
          ) : (
            <WeightChart
              view={mode}
              logs={logs}
              from={chartFrom}
              to={chartTo}
            />
          )}
        </div>
      </div>
    </div>
  );
}
