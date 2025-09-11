import React, { useMemo, useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Button } from "./ui/Button";

/**
 * Utility: parse an app date (string or number) into a JS Date in local time.
 */
function toDate(d) {
  if (!d) return null;
  if (typeof d === "number") return new Date(d);
  // ISO or yyyy-mm-dd — rely on Date parsing
  return new Date(d);
}

/**
 * Start of week (Monday 00:00) in local time, and week key YYYY-WW.
 * We’ll align to Monday–Sunday for Singapore as requested.
 */
function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun,1=Mon,...6=Sat
  const diffToMon = (day + 6) % 7; // Mon->0, Tue->1, ..., Sun->6
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
  // compute week number (Mon-based)
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

/**
 * Month helpers
 */
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

/**
 * Check date falls within [from, to].
 */
function inRange(date, from, to) {
  const t = date.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

/**
 * Compute simple volume = weight * reps for a set (assumes consistent unit).
 */
function setVolume(set) {
  const w = Number(set?.weight ?? 0);
  const r = Number(set?.reps ?? 0);
  if (Number.isNaN(w) || Number.isNaN(r)) return 0;
  return w * r;
}

/**
 * Resolve main muscle for an exercise by name from the exercises DB if missing on log.
 */
function resolveMainMuscle(exerciseName, exercisesDb) {
  const ex = exercisesDb.find((e) => e.name === exerciseName);
  return ex?.mainMuscle?.trim() || "Unknown";
}

/**
 * Build periods (weeks or months) from workouts (sorted newest first).
 */
function buildWeeks(workouts) {
  const buckets = new Map(); // key -> { from, to, items: [] }
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
  // sort newest first (by from)
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

/**
 * Compute metrics for a period:
 * - frequency (# of workouts)
 * - total volume
 * - volumeByMuscle (main muscle only)
 * - PRs (new best working-set weight beating historical-best before this window)
 */
function computePeriodMetrics(period, workouts, exercisesDb) {
  const { from, to } = period;

  // Frequency
  const freq = period.items.length;

  // Total volume + volume by muscle
  const byMuscle = {};
  let total = 0;
  for (const w of period.items) {
    for (const ex of w.exercises || []) {
      const main = resolveMainMuscle(ex.exerciseName, exercisesDb);
      for (const s of ex.sets || []) {
        const v = setVolume(s);
        total += v;
        byMuscle[main] = (byMuscle[main] || 0) + v;
      }
    }
  }

  // PRs
  // 1) build best-before map for each exercise
  const bestBefore = new Map(); // name -> max weight before "from"
  for (const w of workouts) {
    const d = toDate(w.date);
    if (!d || !d.getTime || d >= from) continue; // strictly before
    for (const ex of w.exercises || []) {
      let maxSet = 0;
      for (const s of ex.sets || []) {
        if (Number(s.weight) > maxSet) maxSet = Number(s.weight);
      }
      const prev = bestBefore.get(ex.exerciseName) || 0;
      if (maxSet > prev) bestBefore.set(ex.exerciseName, maxSet);
    }
  }

  // 2) best-in-window + compare
  const prs = [];
  const bestInWindow = new Map(); // name -> { best, date }
  for (const w of period.items) {
    const d = toDate(w.date);
    for (const ex of w.exercises || []) {
      let maxSet = 0;
      for (const s of ex.sets || []) {
        if (Number(s.weight) > maxSet) maxSet = Number(s.weight);
      }
      const prev = bestInWindow.get(ex.exerciseName);
      if (!prev || maxSet > prev.best) {
        bestInWindow.set(ex.exerciseName, { best: maxSet, date: d });
      }
    }
  }
  for (const [name, { best, date }] of bestInWindow.entries()) {
    const oldBest = bestBefore.get(name) || 0;
    if (best > oldBest) {
      prs.push({
        exercise: name,
        newBest: best,
        prevBest: oldBest,
        date,
      });
    }
  }

  return {
    frequency: freq,
    totalVolume: total,
    volumeByMuscle: byMuscle,
    prs: prs.sort((a, b) => b.newBest - a.newBest),
  };
}

/**
 * Local storage helpers for collapsible state and weekly notes.
 */
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

/**
 * Small, dependency-free bar chart for volume-by-muscle.
 */
function VolumeByMuscleBar({ data }) {
  const entries = Object.entries(data || {});
  if (!entries.length) {
    return (
      <div className="text-sm text-neutral-500">No volume this period.</div>
    );
  }

  const max = Math.max(...entries.map(([, v]) => v)) || 1;
  return (
    <div className="space-y-2">
      {entries
        .sort((a, b) => b[1] - a[1])
        .map(([muscle, val]) => {
          const pct = Math.round((val / max) * 100);
          return (
            <div key={muscle} className="w-full">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium">{muscle}</span>
                <span className="tabular-nums">{val}</span>
              </div>
              <div className="h-2 bg-neutral-200 rounded">
                <div
                  className="h-2 rounded bg-blue-600"
                  style={{ width: `${pct}%` }}
                  title={`${muscle}: ${val}`}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}

/**
 * Weekly notes block with Edit / AI (stub) actions.
 * Persisted to localStorage per week key: weekly-note:<YYYY-WW>
 */
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
    // Placeholder for future AI: compare current week to previous week
    // For now, just a non-blocking hint.
    alert("AI summary coming soon: will compare this week vs last week.");
  };

  // Auto-resize helper
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

/**
 * A collapsible card for a week or month.
 * For week: includes WeeklyNotes.
 */
function PeriodCard({ period, metrics, defaultOpen = true, isWeek = false }) {
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
      {/* Card header */}
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
          {/* Volume chart always at TOP */}
          <div>
            <div className="mb-2 text-sm font-medium">Volume by Muscle</div>
            <VolumeByMuscleBar data={metrics.volumeByMuscle} />
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-2">
              <div className="text-xs text-neutral-500">Workouts</div>
              <div className="text-lg font-semibold">{metrics.frequency}</div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-xs text-neutral-500">Total Volume</div>
              <div className="text-lg font-semibold tabular-nums">
                {metrics.totalVolume}
              </div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-xs text-neutral-500">New PRs</div>
              <div className="text-lg font-semibold">{metrics.prs.length}</div>
            </div>
          </div>

          {/* PR list (if any) */}
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

export default function DashboardSummary() {
  const { workouts, exercises } = useApp();
  const [mode, setMode] = useState("week"); // "week" | "month"

  const weeks = useMemo(() => buildWeeks(workouts || []), [workouts]);
  const months = useMemo(() => buildMonths(workouts || []), [workouts]);

  // Pre-compute metrics
  const weekMetrics = useMemo(
    () =>
      weeks.map((w) => ({
        period: w,
        metrics: computePeriodMetrics(w, workouts || [], exercises || []),
      })),
    [weeks, workouts, exercises]
  );
  const monthMetrics = useMemo(
    () =>
      months.map((m) => ({
        period: m,
        metrics: computePeriodMetrics(m, workouts || [], exercises || []),
      })),
    [months, workouts, exercises]
  );

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

      {/* Cards list (newest first) */}
      {mode === "week" ? (
        weekMetrics.length ? (
          weekMetrics.map(({ period, metrics }) => (
            <PeriodCard
              key={period.key}
              period={period}
              metrics={metrics}
              defaultOpen={true}
              isWeek={true}
            />
          ))
        ) : (
          <div className="text-sm text-neutral-500">No weekly data yet.</div>
        )
      ) : monthMetrics.length ? (
        monthMetrics.map(({ period, metrics }) => (
          <PeriodCard
            key={period.key}
            period={period}
            metrics={metrics}
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
DashboardSummary.jsx
