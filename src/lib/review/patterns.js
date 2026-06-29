// src/lib/review/patterns.js
// Pure rep-pattern analysis: clean partials, classify drop-off and rep-total
// status, and select the rep-total bucket for an exercise. Ports the logic from
// the weekly-workout-review skill's parser, parameterized by the program config.

import { matchesAny } from "./match";

export function cleanReps(reps) {
  const list = reps || [];
  const cleaned = list.map((r) => Math.floor(Number(r) || 0));
  const nPartials = list.filter((r) => {
    const n = Number(r) || 0;
    return n !== Math.floor(n);
  }).length;
  return { cleaned, nPartials };
}

export function classifyPattern(reps, expectedNSets = 5) {
  if (reps.length < expectedNSets) return "incomplete";
  for (let i = 0; i < reps.length - 1; i++) {
    if (reps[i] < reps[i + 1]) return "irregular";
  }
  const drops = [];
  for (let i = 0; i < reps.length - 1; i++) drops.push(reps[i] - reps[i + 1]);
  const avgDrop = drops.reduce((a, b) => a + b, 0) / drops.length;
  const maxDrop = Math.max(...drops);
  const firstDrop = drops[0];
  const rangeDrop = reps[0] - reps[reps.length - 1];
  if (rangeDrop <= 1) return "flat";
  if (expectedNSets === 3) {
    if (maxDrop >= 3 || (rangeDrop > 5 && avgDrop > 2)) return "steep";
  } else if (
    maxDrop >= 4 ||
    // firstDrop >= 3 catches a big early drop like [8,5,4,3,2] (maxDrop 3, rangeDrop 6)
    // that the maxDrop>=4 / rangeDrop>8 thresholds miss but the framework calls steep.
    firstDrop >= 3 ||
    (rangeDrop > 8 && avgDrop > 2.5)
  ) {
    return "steep";
  }
  return "linear";
}

export function classifyStatus(total, target, config) {
  const { overshoot, deloadUndershoot, tolerance } = config;
  if (total >= target + overshoot) return `OVER+${total - target}`;
  if (total <= target - deloadUndershoot - 1) return `UNDER${total - target}`;
  if (Math.abs(total - target) <= tolerance) return "HIT";
  if (total < target) return `UNDER${total - target}`;
  return `OVER+${total - target}`;
}

export function closestTarget(total, config) {
  const targets = config.buckets.map((b) => b.target);
  return targets.reduce((best, t) =>
    Math.abs(t - total) < Math.abs(best - total) ? t : best,
  );
}

export function isDeadlift(config, name) {
  return matchesAny(name, config.special?.deadlift?.names);
}

export function isAbs(config, name) {
  return matchesAny(name, config.special?.abs?.names);
}

export function bucketFor(config, name, total) {
  if (isDeadlift(config, name)) {
    const d = config.special.deadlift;
    return {
      kind: "deadlift",
      target: d.target,
      expectedNSets: d.nSets,
      setFloor: d.set3Floor,
      increment: d.increment,
    };
  }
  if (isAbs(config, name)) {
    const a = config.special.abs;
    return {
      kind: "abs",
      target: null,
      expectedNSets: a.nSets,
      setFloor: a.repRangeMin,
      increment: a.increment,
      repRangeMin: a.repRangeMin,
      repRangeMax: a.repRangeMax,
    };
  }
  const target = closestTarget(total, config);
  const b = config.buckets.find((x) => x.target === target);
  return {
    kind: `${target}-bucket`,
    target,
    expectedNSets: 5,
    setFloor: b.set5Floor,
    increment: b.increment,
  };
}
