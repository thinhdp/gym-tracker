// src/lib/review/review.js
// Orchestrates the engine into one ReviewResult for a chosen cycle. Pure: no
// storage, no React. Reads live workouts/weightLogs/exercises passed in.

import {
  cycleDates,
  phaseForCycle,
  dayPhases,
  mostRecentCompletedCycle,
} from "./cycles";
import { buildExerciseHistory, findPriorSession, analyzeExercise } from "./analyzeExercise";
import { decide } from "./decide";
import { tonnageByPattern, collectHistory } from "./tonnage";
import { cycleAverage, evaluate } from "./bodyweight";
import { normalizeName } from "./match";
import { buildNarrative } from "./narrative";

const HISTORY_WINDOWS = 6;

function consecutiveSameWeight(history, name, beforeDate, weight) {
  const arr = (history.get(normalizeName(name)) || []).filter((s) => s.date < beforeDate);
  let count = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    const w = arr[i].sets.length ? Number(arr[i].sets[0].weight) || 0 : 0;
    if (w === weight) count += 1;
    else break;
  }
  return count;
}

function firstBulkCycle(config) {
  // First cycle whose majority phase is lean-bulk.
  for (let n = 1; n <= 60; n++) {
    if (phaseForCycle(config, n) === "lean-bulk") return n;
  }
  return null;
}

function groupBySession(lines) {
  const map = new Map();
  for (const l of lines) {
    if (!map.has(l.session)) map.set(l.session, []);
    map.get(l.session).push(l);
  }
  return [...map.entries()].map(([group, ls]) => ({ group, lines: ls }));
}

function groupByBlock(config, lines) {
  const blockOf = (sessionName) => {
    const n = normalizeName(sessionName);
    const b = (config.blocks || []).find((bl) => bl.sessions.includes(n));
    return b ? b.label : "Other";
  };
  const map = new Map();
  for (const l of lines) {
    const g = blockOf(l.session);
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(l);
  }
  return [...map.entries()].map(([group, ls]) => ({ group, lines: ls }));
}

export function buildCycleReview(config, data, cycleNumber) {
  const workouts = data.workouts || [];
  const weightLogs = data.weightLogs || {};
  const warnings = [];

  const number = cycleNumber ?? mostRecentCompletedCycle(config, workouts);
  if (number == null) {
    return emptyResult(config, warnings.concat("No in-program workouts found."));
  }

  const { start, end } = cycleDates(config, number);
  const phase = phaseForCycle(config, number);
  const phases = dayPhases(config, number);
  const straddles = new Set(phases).size > 1;

  const cycleWorkouts = workouts
    .filter((w) => w.date >= start && w.date <= end)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (!cycleWorkouts.length) {
    warnings.push(`Cycle ${number} has no sessions logged.`);
  }
  if (phase === "maintenance") {
    warnings.push("Maintenance/travel cycle — sessions are environmentally confounded and excluded from progression analysis.");
  }
  if (phase === "post-program") {
    warnings.push("This cycle is past the program's end date — consider a continuation phase.");
  }
  if (cycleWorkouts.length && cycleWorkouts.length < config.cycle.expectedSessions) {
    warnings.push(`Partial cycle: ${cycleWorkouts.length} of ${config.cycle.expectedSessions} expected sessions.`);
  }

  const history = buildExerciseHistory(workouts);
  const fbCycle = firstBulkCycle(config);
  const firstSessionDate = cycleWorkouts.length ? cycleWorkouts[0].date : null;
  const firstBulkPhaseDate = (config.phases.find((p) => p.id === "lean-bulk") || {}).from;

  const sessions = cycleWorkouts.map((w) => {
    return {
      date: w.date,
      dayInCycle: dayIndex(config, number, w.date),
      name: w.name || w.date,
      nExercises: (w.exercises || []).length,
      nSets: (w.exercises || []).reduce((acc, e) => acc + (e.sets || []).length, 0),
    };
  });

  const exercises = [];
  const planLines = [];
  for (const w of cycleWorkouts) {
    for (const ex of w.exercises || []) {
      if (!ex.exerciseName) continue;
      const prior = findPriorSession(history, ex.exerciseName, w.date);
      const a = analyzeExercise(config, ex, prior, history, w.date);
      const stallCount = consecutiveSameWeight(history, ex.exerciseName, w.date, a.weight);
      const isFirstBulkSession =
        number === fbCycle &&
        w.date === firstSessionDate &&
        firstBulkPhaseDate != null &&
        w.date >= firstBulkPhaseDate;
      const decision =
        phase === "maintenance"
          ? { action: "HOLD", newWeight: a.weight, increment: 0, reason: "maintenance — hold", badgeLabel: "HOLD", flags: ["maintenance"] }
          : decide(config, a, { phase, stallCount, isFirstBulkSession });
      exercises.push({ ...a, date: w.date, session: w.name || w.date, decision });
      planLines.push({
        session: w.name || w.date,
        exercise: a.name,
        newWeight: decision.newWeight,
        weightLabel: a.weight === 0 ? "BW" : `${decision.newWeight}`,
        action: decision.action,
        badgeLabel: decision.badgeLabel,
        reason: decision.reason,
      });
    }
  }

  const tonnageTrend = collectHistory(config, workouts, number, HISTORY_WINDOWS).map((win) => ({
    ...win,
    phase: win.cycle != null ? phaseForCycle(config, win.cycle) : win.phase,
  }));

  const priorDates = number >= 2 ? cycleDates(config, number - 1) : null;
  const thisBW = cycleAverage(weightLogs, start, end);
  const priorBW = priorDates ? cycleAverage(weightLogs, priorDates.start, priorDates.end) : { avg: null, n: 0 };
  let bodyweight = { thisAvg: thisBW.avg, thisN: thisBW.n, priorAvg: priorBW.avg, priorN: priorBW.n, deltaKg: null, deltaPct: null, evaluation: "" };
  if (thisBW.avg != null && priorBW.avg != null && priorBW.avg > 0) {
    const deltaKg = thisBW.avg - priorBW.avg;
    const deltaPct = (deltaKg / priorBW.avg) * 100;
    bodyweight = { ...bodyweight, deltaKg, deltaPct, evaluation: evaluate(config, phase, deltaPct) };
  }

  const thisTn = tonnageByPattern(config, cycleWorkouts);
  const priorTn = priorDates ? tonnageByPattern(config, workouts.filter((w) => w.date >= priorDates.start && w.date <= priorDates.end)) : {};
  const byPattern = [...new Set([...Object.keys(thisTn), ...Object.keys(priorTn)])]
    .sort()
    .map((p) => ({ pattern: p, thisTonnage: thisTn[p] || 0, priorTonnage: priorTn[p] || 0, delta: (thisTn[p] || 0) - (priorTn[p] || 0) }));

  const plan = { bySession: groupBySession(planLines), byBlock: groupByBlock(config, planLines) };

  const result = {
    program: { id: config.id, name: config.name },
    cycle: { number, start, end, phase, dayPhases: phases, straddles, partial: cycleWorkouts.length > 0 && cycleWorkouts.length < config.cycle.expectedSessions },
    sessions,
    exercises,
    tonnageTrend,
    bodyweight,
    byPattern,
    plan,
    warnings,
  };
  result.narrative = buildNarrative(result);
  return result;
}

function dayIndex(config, n, dateStr) {
  const { start } = cycleDates(config, n);
  const a = new Date(start);
  const b = new Date(dateStr);
  return Math.round((b - a) / 86400000) + 1;
}

function emptyResult(config, warnings) {
  return {
    program: { id: config.id, name: config.name },
    cycle: null,
    sessions: [],
    exercises: [],
    tonnageTrend: [],
    bodyweight: { thisAvg: null, thisN: 0, priorAvg: null, priorN: 0, deltaKg: null, deltaPct: null, evaluation: "" },
    byPattern: [],
    plan: { bySession: [], byBlock: [] },
    warnings,
    narrative: { headline: "No data to review yet.", wins: [], concerns: [], volumeVerdict: "" },
  };
}
