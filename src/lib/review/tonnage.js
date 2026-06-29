// src/lib/review/tonnage.js
// Per-cycle tonnage aggregates, movement-pattern tonnage, and the multi-cycle
// trend used by the volume section. Tonnage floors partial reps (a half-rep is
// bad-form effort, not a clean rep). Pattern quality = % of complete exercises
// with a linear or flat drop-off.

import { cleanReps, classifyPattern, isDeadlift, isAbs } from "./patterns";
import { normalizeName } from "./match";
import { cycleDates, parseYMD, ymd } from "./cycles";

function expectedSets(config, name) {
  if (isDeadlift(config, name)) return config.special.deadlift.nSets;
  if (isAbs(config, name)) return config.special.abs.nSets;
  return 5;
}

export function weeklySummary(config, workouts) {
  let tonnage = 0;
  let totalReps = 0;
  let nPartialReps = 0;
  let nComplete = 0;
  const patternCounts = { linear: 0, flat: 0, steep: 0, irregular: 0, incomplete: 0, "n/a": 0 };

  for (const w of workouts || []) {
    for (const exr of w.exercises || []) {
      const raw = (exr.sets || []).map((s) => Number(s.reps) || 0);
      const { cleaned, nPartials } = cleanReps(raw);
      nPartialReps += nPartials;
      for (const s of exr.sets || []) {
        const reps = Math.floor(Number(s.reps) || 0);
        tonnage += (Number(s.weight) || 0) * reps;
        totalReps += reps;
      }
      const pattern = isAbs(config, exr.exerciseName)
        ? "n/a"
        : classifyPattern(cleaned, expectedSets(config, exr.exerciseName));
      patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
      if (pattern !== "incomplete" && pattern !== "n/a") nComplete += 1;
    }
  }

  const good = patternCounts.linear + patternCounts.flat;
  const patternQualityPct = nComplete > 0 ? (good / nComplete) * 100 : null;
  return {
    tonnage,
    totalReps,
    nSessions: (workouts || []).length,
    patternCounts,
    patternQualityPct,
    nPartialReps,
  };
}

export function tonnageByPattern(config, workouts) {
  const out = {};
  for (const w of workouts || []) {
    for (const exr of w.exercises || []) {
      const mp = config.movementPatterns[normalizeName(exr.exerciseName)] || "uncategorized";
      for (const s of exr.sets || []) {
        out[mp] = (out[mp] || 0) + (Number(s.weight) || 0) * Math.floor(Number(s.reps) || 0);
      }
    }
  }
  return out;
}

function workoutsInRange(workouts, start, end) {
  return (workouts || []).filter((w) => w.date >= start && w.date <= end);
}

export function collectHistory(config, workouts, cycleN, nWindows) {
  const start0 = parseYMD(config.cycle.startDate);
  const windows = [];
  for (let offset = nWindows - 1; offset >= 0; offset--) {
    const n = cycleN - offset;
    let summary;
    let win;
    if (n >= 1) {
      const { start, end } = cycleDates(config, n);
      summary = weeklySummary(config, workoutsInRange(workouts, start, end));
      win = {
        label: `W${n}`,
        cycle: n,
        start,
        end,
        windowDays: config.cycle.lengthDays,
        isInProgram: true,
        phase: undefined, // filled by review.js if needed; not required for trend
      };
    } else {
      // Pre-program: a labeled 7-day window before the program start (context only).
      const isoOffset = 1 - n;
      const s = new Date(start0);
      s.setDate(s.getDate() - 7 * isoOffset);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      summary = weeklySummary(config, workoutsInRange(workouts, ymd(s), ymd(e)));
      win = {
        label: `${ymd(s)} (pre)`,
        cycle: null,
        start: ymd(s),
        end: ymd(e),
        windowDays: 7,
        isInProgram: false,
        phase: "pre-program",
      };
    }
    windows.push({ ...win, ...summary, deltaPct: null });
  }
  // Δton only between consecutive in-program cycles.
  let prevTon = null;
  for (const w of windows) {
    if (w.isInProgram) {
      if (prevTon != null && prevTon > 0) {
        w.deltaPct = ((w.tonnage - prevTon) / prevTon) * 100;
      }
      prevTon = w.tonnage;
    }
  }
  return windows;
}
