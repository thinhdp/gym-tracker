import React, { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { loadLS, K_WEIGHT_LOGS } from "../lib/storage";
import { ymdFromDate } from "../lib/date";
import {
  weekStats,
  weekVolumeByDay,
  currentStreak,
  workoutVolume,
  latestBodyweight,
} from "../lib/homeStats";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function greeting(h = new Date().getHours()) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const tonnes = (kg) => `${(kg / 1000).toFixed(1)}t`;

function StatTile({ value, label }) {
  return (
    <div className="rounded-xl border bg-white p-3 text-center">
      <div className="text-lg font-semibold text-neutral-900">{value}</div>
      <div className="text-[11px] text-neutral-500">{label}</div>
    </div>
  );
}

export default function Home() {
  const { workouts, setTab, unit } = useApp();
  // Captured once at mount: a stable "now" keeps the memos below from
  // recomputing every render (the wall-clock day doesn't change mid-session).
  const now = useMemo(() => new Date(), []);
  const todayYmd = ymdFromDate(now);

  const stats = useMemo(() => weekStats(workouts, now), [workouts, now]);
  const byDay = useMemo(() => weekVolumeByDay(workouts, now), [workouts, now]);
  const streak = useMemo(() => currentStreak(workouts, now), [workouts, now]);
  const bodyweight = useMemo(
    () => latestBodyweight(loadLS(K_WEIGHT_LOGS, {})),
    [],
  );

  const todays = (workouts || []).filter((w) => w.date === todayYmd);
  const recent = useMemo(
    () =>
      [...(workouts || [])]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3),
    [workouts],
  );

  const maxDay = Math.max(1, ...byDay);
  const todayIdx = (now.getDay() + 6) % 7;

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Greeting + streak */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-neutral-500">{dateLabel}</div>
          <h1 className="text-xl font-semibold text-neutral-900">
            {greeting()}
          </h1>
        </div>
        {streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-sm">
            <span aria-hidden>🔥</span>
            <span className="font-semibold">{streak}</span>
            <span className="sr-only">day streak</span>
          </span>
        )}
      </div>

      {/* Today's plan */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500">
          Today
        </div>
        {todays.length ? (
          <>
            <div className="mt-0.5 font-semibold text-neutral-900">
              {todays[0].name?.trim() || "Workout"}
            </div>
            <div className="text-xs text-neutral-500">
              {todays[0].exercises?.length || 0} exercises ·{" "}
              {Math.round(workoutVolume(todays[0])).toLocaleString()} kg
            </div>
            <button
              type="button"
              onClick={() => setTab("workouts")}
              className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              View workout
            </button>
          </>
        ) : (
          <>
            <div className="mt-0.5 font-semibold text-neutral-900">
              No workout logged yet
            </div>
            <div className="text-xs text-neutral-500">
              Plan today&apos;s session to get started.
            </div>
            <button
              type="button"
              onClick={() => setTab("workouts")}
              className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Plan a workout
            </button>
          </>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile value={stats.count} label="workouts" />
        <StatTile value={tonnes(stats.volume)} label="volume" />
        <StatTile
          value={bodyweight ? bodyweight.value : "—"}
          label={bodyweight ? unit : "weight"}
        />
      </div>

      {/* This week volume bars */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3 text-[11px] uppercase tracking-wide text-neutral-500">
          This week
        </div>
        <div className="flex h-24 items-stretch gap-2">
          {byDay.map((v, i) => (
            <div
              key={i}
              className="flex h-full flex-1 flex-col items-center gap-1"
            >
              <div className="flex w-full flex-1 items-end">
                <div
                  className={[
                    "w-full rounded-md",
                    i === todayIdx ? "bg-blue-600" : "bg-blue-200",
                  ].join(" ")}
                  style={{ height: `${Math.max(4, (v / maxDay) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-neutral-400">
                {DAY_LABELS[i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      {recent.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            Recent
          </div>
          {recent.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setTab("workouts")}
              className="flex w-full items-center justify-between rounded-xl border bg-white p-3 text-left transition hover:bg-neutral-50"
            >
              <div>
                <div className="text-sm font-medium text-neutral-900">
                  {w.name?.trim() || "Workout"}
                </div>
                <div className="text-[11px] text-neutral-500">{w.date}</div>
              </div>
              <div className="text-xs text-neutral-500">
                {w.exercises?.length || 0} ex ·{" "}
                {Math.round(workoutVolume(w)).toLocaleString()} kg
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
