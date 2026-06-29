// src/lib/review/analyzeExercise.js
// Builds per-exercise history and the per-session analysis object the decision
// matrix consumes. RPE is read from the structured ex.rpe field (the app stores
// one RPE per exercise) as the last-set proxy; ex.feedback is carried through
// for the feedback keyword rules in decide.js.

import { normalizeName, matchesAny } from "./match";
import {
  cleanReps,
  classifyPattern,
  classifyStatus,
  bucketFor,
} from "./patterns";

export function buildExerciseHistory(workouts) {
  const hist = new Map();
  for (const w of workouts || []) {
    for (const ex of w.exercises || []) {
      const key = normalizeName(ex.exerciseName);
      if (!key) continue;
      if (!hist.has(key)) hist.set(key, []);
      hist.get(key).push({
        date: w.date,
        sets: ex.sets || [],
        rpe: ex.rpe ?? null,
        feedback: ex.feedback || "",
      });
    }
  }
  for (const arr of hist.values()) {
    arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  return hist;
}

export function findPriorSession(history, name, beforeDate) {
  const arr = history.get(normalizeName(name)) || [];
  const prior = arr.filter((s) => s.date < beforeDate);
  return prior.length ? prior[prior.length - 1] : null;
}

export function analyzeExercise(config, ex, prior, history, dateStr) {
  const name = ex.exerciseName;
  const sets = ex.sets || [];
  const rawReps = sets.map((s) => Number(s.reps) || 0);
  const { cleaned: reps, nPartials } = cleanReps(rawReps);
  const weights = sets.map((s) => Number(s.weight) || 0);
  const weight = weights.length ? weights[0] : 0;
  const weightConsistent = weights.every((w) => w === weight);
  const totalReps = reps.reduce((a, b) => a + b, 0);

  const bucket = bucketFor(config, name, totalReps);
  const isAbsKind = bucket.kind === "abs";
  const status = isAbsKind
    ? null
    : classifyStatus(totalReps, bucket.target, config);
  const pattern = isAbsKind
    ? "n/a"
    : classifyPattern(reps, bucket.expectedNSets);
  const weakFinal =
    !isAbsKind &&
    reps.length >= bucket.expectedNSets &&
    reps[reps.length - 1] < bucket.setFloor;

  let priorComparison = null;
  if (prior) {
    const priorWeight = prior.sets.length
      ? Number(prior.sets[0].weight) || 0
      : 0;
    const priorTotal = prior.sets.reduce(
      (acc, s) => acc + (Number(s.reps) || 0),
      0,
    );
    const flags = [];
    if (prior.date < config.cycle.startDate) flags.push("PRE-PROGRAM");
    if (prior.sets.length !== sets.length) {
      flags.push(`different-set-count(${prior.sets.length}vs${sets.length})`);
    }
    priorComparison = {
      date: prior.date,
      weight: priorWeight,
      nSets: prior.sets.length,
      total: priorTotal,
      loadDelta: weight - priorWeight,
      repDelta: totalReps - priorTotal,
      flags,
    };
  }

  const sessionsToDate = (history.get(normalizeName(name)) || []).filter(
    (s) => s.date <= dateStr,
  ).length;
  const isBaseline =
    matchesAny(name, config.baselineExercises?.names) &&
    sessionsToDate < config.baselineExercises.sessionsRequired;

  return {
    name,
    weight,
    weightConsistent,
    reps,
    rawReps,
    nPartials,
    nSets: sets.length,
    expectedNSets: bucket.expectedNSets,
    bucketKind: bucket.kind,
    target: bucket.target,
    setFloor: bucket.setFloor,
    increment: bucket.increment,
    repRangeMin: bucket.repRangeMin,
    repRangeMax: bucket.repRangeMax,
    totalReps,
    status,
    pattern,
    weakFinal,
    priorComparison,
    sessionsToDate,
    isBaseline,
    movementPattern:
      config.movementPatterns[normalizeName(name)] || "uncategorized",
    rpe: ex.rpe ?? null,
    feedback: ex.feedback || "",
  };
}
