import React, { useMemo, useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Button } from "./ui/Button";

/** Utils **/
function toDate(d) {
  if (!d) return null;
  if (typeof d === "number") return new Date(d);
  return new Date(d);
}

// Week helpers (Mon–Sun, local time)
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
function weekKey(date) {
  const s = startOfWeekMonday(date);
  const year = s.getFullYear();
  // ISO-like week calc aligned with Monday
  const jan4 = new Date(year, 0, 4);
  const jan4Start = startOfWeekMonday(jan4);
  const diffDays = Math.floor((s - jan4Start) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return `${year}-${String(week).padStart(2, "0")}`;
}
function weekLabel(date) {
  const s = startOfWeekMonday(date);
  const e = endOfWeekSunday(date);
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return `${fmt(s)} to ${fmt(e)}`;
}
function prevWeekKeyFrom(periodFrom) {
  const d = new Date(periodFrom);
  d.setDate(d.getDate() - 7);
  return weekKey(d);
}

// Month helpers
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
function monthKey(date) {
  const d = startOfMonth(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(date) {
  const d = startOfMonth(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function prevMonthKeyFrom(periodFrom) {
  const d = new Date(periodFrom);
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
}

function inRange(date, from, to) {
  const t = date.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

// ==== CHANGED: "volume" now means REPS ONLY ====
function setReps(set) {
  const r = Number(set?.reps ?? 0);
  return Number.isFinite(r) ? r : 0;
}

function resolveMainMuscle(exerciseName, exercisesDb) {
  const ex = exercisesDb.find((e) => e.name === exerciseName);
  return ex?.mainMuscle?.trim() || "Unknown";
}

function buildWeeks(workouts) {
  const buckets = new Map();
  for (const w of workouts) {
    const d = toDate(w.date);
    if (!d) continue;
    const key = weekKey(d);
    if (!buckets.has(key)) {
      const from = startOfWeekMonday(d);
      const to = endOfWeekSunday(d);
      buckets.set(key, { key, label: weekLabel(d), from, to, items: [] });
    }
    buckets.get(key).items.push(w);
  }
  return [...buckets.values()].sort((a, b) => b.from - a.from);
}
function buildMonths(workouts) {
  const buckets = new Map();
  for (const w of workouts) {
    const d = toDate(w.date);
    if (!d) continue;
    const key = monthKey(d);
    if (!buckets.has(key)) {
      const from = startOfMonth(d);
      const to = endOfMonth(d);
      buckets.set(key, { key, label: monthLabel(d), from, to, items: [] });
    }
    buckets.get(key).items.push(w);
  }
  return [...buckets.values()].sort((a, b) => b.from - a.from);
}

/** Compute metrics for a period using REPS-ONLY */
function computePeriodMetrics(period, workouts, exercisesDb) {
  const { from } = period;

  // Frequency
  const frequency = period.items.length;

  // Total reps + reps by muscle
  const repsByMuscle = {};
  let totalReps = 0;
  for (const w of period.items) {
    for (const ex of w.exercises || []) {
      const main = resolveMainMuscle(ex.exerciseName, exercisesDb);
      for (const s of ex.sets || []) {
        const reps = setReps(s);
        totalReps += reps;
        repsByMuscle[main] = (repsByMuscle[main] || 0) + reps;
      }
    }
  }

  // PRs still based on max WEIGHT (requirement didn’t change PR definition)
  const bestBefore = new Map(); // name -> max weight before "from"
  for (const w of workouts) {
    const d = toDate(w.date);
    if (!d || d >= from) continue;
    for (const ex of w.exercises || []) {
      let maxSet = 0;
      for (const s of ex.sets || []) {
        const wt = Number(s.weight || 0);
        if (wt > maxSet) maxSet = wt;
      }
      const prev = bestBefore.get(ex.exerciseName) || 0;
      if (maxSet > prev) bestBefore.set(ex.exerciseName, maxSet);
    }
  }

  const bestInWindow = new Map(); // name -> { best, date }
  for (const w of period.items) {
    const d = toDate(w.date);
    for (const ex of w.exercises || []) {
      let maxSet = 0;
      for (const s of ex.sets || []) {
        const wt = Number(s.weight || 0);
        if (wt > maxSet) maxSet = wt;
      }
      const prev = bestInWindow.get(ex.exerciseName);
      if (!prev || maxSet > prev.best) {
        bestInWindow.set(ex.exerciseName, { best: maxSet, date: d });
      }
    }
  }

  const prs = [];
  for (const [name, { best, date }] of bestInWindow.entries()) {
    const oldBest = bestBefore.get(name) || 0;
    if (best > oldBest) {
      prs.push({ exercise: name, newBest: best, prevBest: oldBest, date });
    }
  }

  return {
    frequency,
    totalReps,
    repsByMuscle,
    prs: prs.sort((a, b) => b.newBest - a.newBest),
  };
}

/** Local storage helpers */
function getLs(key, fallback = null) {
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

/** Delta badge for KPI vs last period */
function Delta({ curr, prev }) {
  if (prev === null || prev === undefined) {
    return <span className="text-xs text-neutral-500 ml-1">—</span>;
  }
  const diff = curr - prev;
  if (diff === 0) return <span className="text-xs text-neutral-500 ml-1">±0</span>;
  const sign = diff > 0 ? "+" : "";
  const color = diff > 0 ? "text-green-600" : "text-red-600";
  return <span className={`text-xs ml-1 ${color}`}>{sign}{diff}</span>;
}

/** Grouped bar chart: current vs last week/month (REPS) */
function GroupedRepsBar({ current, previous }) {
  const muscles = Array.from(
    new Set([...(current ? Object.keys(current) : []), ...(previous ? Object.keys(previous) : [])])
  );

  if (!muscles.length) {
    return <div className="text-sm text-neutral-500">No reps logged this period.</div>;
  }

  const max = Math.max(
    1,
    ...muscles.map((m) => Math.max(current?.[m] || 0, previous?.[m] || 0))
  );

  return (
    <div className="space-y-3">
      {muscles
        .sort((a, b) => (current?.[b] || 0) - (current?.[a] || 0))
        .map((muscle) => {
          const c = current?.[muscle] || 0;
          const p = previous?.[muscle] || 0;
          const cw = Math.round((c / max) * 100);
          const pw = Math.round((p / max) * 100);
          return (
            <div key={muscle} className="w-full">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium">{muscle}</span>
                <span className="tabular-nums">
                  {p ? `LW ${p} · ` : ""}Now {c}
                </span>
              </div>
              {/* Track */}
              <div className="h-4 bg-neutral-200 rounded relative overflow-hidden">
                {/* Previous period bar (back layer) */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-neutral-400"
                  style={{ width: `${pw}%` }}
                  title={`Last: ${p}`}
                />
                {/* Current period bar (front layer) */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-blue-600 mix-blend-multiply"
                  style={{ width: `${cw}%` }}
                  title={`Current: ${c}`}
                />
              </div>
            </div>
          );
        })}
      <div className="flex items-center gap-4 text-xs text-neutral-600">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 bg-blue-600" /> Now
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 bg-neutral-400" /> Last
        </div>
      </div>
    </div>
  );
}

/** Weekly notes with Edit / AI (stub) */
function WeeklyNotes({ periodKey }) {
  const storageKey = `weekly-note:${periodKey}`;
  const [saved, setSaved] = useState(() => getLs(storageKey, ""));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved || "");

  useEffect(() => {
    setSaved(getLs(storageKey, ""));
  }, [storageKey]);

  const onSave = () => {
    setLs(storageKey, draft || "");
    setSaved(draft || "");
    setEditing(false);
  };

  const onCancel = () => {
    setDraft(saved || "");
    setEditing(false);
  };

  const onAi = () => {
    alert("AI summary coming soon: will compare this week against last week.");
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = document.getElementById(`weekly-note-ta-${periodKey}`);
    if (!ta) return;
    const resize = () => {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    };
    resize();
  }, [draft, periodKey]);

  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">This Week’s Notes</h4>
        <div className="flex gap-2">
          {!editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onAi}>
            AI
          </Button>
        </div>
      </div>

      {!editing ? (
        <div className="text-sm whitespace-pre-wrap text-neutral-800">
          {saved ? saved : <span className="text-neutral-500">No notes yet.</span>}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            id={`weekly-note-ta-${periodKey}`}
            className="w-full min-h-[96px] resize-none rounded-lg border border-neutral-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="How did you feel this week? Sleep, stress, pumps, soreness…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={onSave}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Card */
function PeriodCard({
  period,
  metrics,
  prevMetrics, // may be null if not found
  defaultOpen = true,
  isWeek = false,
}) {
  const [open, setOpen] = useState(() => {
    const k = `summary-open:${period.key}`;
    const v = getLs(k, null);
    if (v === null) return defaultOpen;
    return !!v;
  });

  useEffect(() => {
    setLs(`summary-open:${period.key}`, open);
  }, [open, period.key]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm mb-3 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="w-full text-left px-3 py-2 bg-neutral-50 flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="font-semibold">{period.label}</div>
        <div className="text-xs text-neutral-500">
          {open ? "Collapse ▲" : "Expand ▼"}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-4">
          {/* CHART — grouped bars: Now vs Last */}
          <div>
            <div className="mb-2 text-sm font-medium">Reps by Muscle (Now vs Last)</div>
            <GroupedRepsBar
              current={metrics.repsByMuscle}
              previous={prevMetrics?.repsByMuscle || null}
            />
          </div>

          {/* KPIs with vs Last */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-2">
              <div className="text-xs text-neutral-500">Workouts</div>
              <div className="text-lg font-semibold">
                {metrics.frequency}
                <Delta curr={metrics.frequency} prev={prevMetrics?.frequency} />
              </div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-xs text-neutral-500">Total Reps</div>
              <div className="text-lg font-semibold tabular-nums">
                {metrics.totalReps}
                <Delta curr={metrics.totalReps} prev={prevMetrics?.totalReps} />
              </div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-xs text-neutral-500">New PRs</div>
              <div className="text-lg font-semibold">
                {metrics.prs.length}
                <Delta curr={metrics.prs.length} prev={prevMetrics?.prs?.length} />
              </div>
            </div>
          </div>

          {/* PR list */}
          {metrics.prs.length > 0 ? (
            <div className="space-y-1">
              <div className="text-sm font-medium">New PRs this period</div>
              <div className="text-sm border rounded-lg divide-y">
                {metrics.prs.map((p) => (
                  <div key={p.exercise} className="flex items-center justify-between px-2 py-1">
                    <div className="font-medium">{p.exercise}</div>
                    <div className="text-xs text-neutral-600">
                      {p.prevBest} → <span className="font-semibold">{p.newBest}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-neutral-500">No new PRs this period.</div>
          )}

          {/* Weekly notes only for weekly cards */}
          {isWeek && <WeeklyNotes periodKey={period.key} />}
        </div>
      )}
    </div>
  );
}

/** Page */
export default function DashboardSummary() {
  const { workouts, exercises } = useApp();
  const [mode, setMode] = useState("week"); // "week" | "month"

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

  // Compute metrics for all periods
  const weekData = useMemo(() => {
    return weeks.map((w) => {
      const metrics = computePeriodMetrics(w, workouts || [], exercises || []);
      const prevKey = prevWeekKeyFrom(w.from);
      const prevPeriod = weekMap.get(prevKey) || null;
      const prevMetrics = prevPeriod
        ? computePeriodMetrics(prevPeriod, workouts || [], exercises || [])
        : null;
      return { period: w, metrics, prevMetrics };
    });
  }, [weeks, workouts, exercises, weekMap]);

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
      {/* Toggle */}
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

      {/* Cards (newest first) */}
      {mode === "week" ? (
        weekData.length ? (
          weekData.map(({ period, metrics, prevMetrics }) => (
            <PeriodCard
              key={period.key}
              period={period}
              metrics={metrics}
              prevMetrics={prevMetrics}
              defaultOpen={true}
              isWeek={true}
            />
          ))
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
