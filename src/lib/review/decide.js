// src/lib/review/decide.js
// The progression decision matrix and its modifiers. Pure: given a per-exercise
// Analysis (analyzeExercise.js) plus a small context, returns one Decision.
//
// Precedence (each may override the previous): base matrix -> phase modifier ->
// front-delt caution -> RPE modifier -> feedback rule -> stall counter.
// BASELINE / INCOMPLETE / ABS short-circuit before the matrix. Where signals
// conflict, the more conservative action wins (per the spec).

import { matchesAny } from "./match";

const roundHalf = (x) => Math.round(x * 2) / 2;

function statusNumber(status) {
  if (!status || status === "HIT") return 0;
  const m = String(status).match(/-?\d+/);
  return m ? Number(m[0]) : 0;
}

function badgeFor(action, increment) {
  switch (action) {
    case "PROGRESS":
      return `+${increment}kg`;
    case "DELOAD":
      return "DELOAD";
    case "BASELINE":
      return "BASELINE";
    case "REP_BUMP":
      return "+1 REP";
    default:
      return "HOLD";
  }
}

function finalize(action, weight, increment, deloadPct, reason, flags) {
  let newWeight = weight;
  if (action === "PROGRESS") newWeight = roundHalf(weight + increment);
  else if (action === "DELOAD") newWeight = roundHalf(weight * (1 + deloadPct));
  return {
    action,
    newWeight,
    increment: action === "PROGRESS" ? increment : 0,
    reason,
    badgeLabel: badgeFor(action, increment),
    flags: flags || [],
  };
}

function cautionTier(config, name) {
  const c = config.cautionExercises || {};
  for (const tier of ["strict", "moderate", "light"]) {
    if (matchesAny(name, c[tier]?.names)) return { tier, ...c[tier] };
  }
  return null;
}

function feedbackHit(config, feedback) {
  const fb = String(feedback || "").toLowerCase();
  if (!fb) return null;
  for (const [kind, rule] of Object.entries(config.feedbackRules || {})) {
    if (
      (rule.keywords || []).some((k) => fb.includes(String(k).toLowerCase()))
    ) {
      return { kind, action: rule.action };
    }
  }
  return null;
}

// Base rep-status x pattern matrix -> { action, increment, deloadPct, reason }.
function matrixAction(a) {
  const inc = a.increment;
  const num = statusNumber(a.status);
  const p = a.pattern;
  const isOver = String(a.status).startsWith("OVER");
  const isHit = a.status === "HIT";
  const isUnder = String(a.status).startsWith("UNDER");
  const severeUnder = isUnder && num <= -8;

  if (isOver) {
    if (p === "linear" || p === "flat")
      return {
        action: "PROGRESS",
        increment: inc,
        reason: `overshot ${a.target} by ${num}, ${p} drop`,
      };
    if (p === "steep")
      return {
        action: "HOLD",
        increment: inc,
        reason: "overshot but steep — investigate pacing",
      };
    return {
      action: "HOLD",
      increment: inc,
      reason: "overshot but irregular — check setup",
    };
  }
  if (isHit) {
    if (p === "linear")
      return a.weakFinal
        ? {
            action: "HOLD",
            increment: inc,
            reason: "hit target, weak final set — push +1 rep",
          }
        : {
            action: "PROGRESS",
            increment: inc,
            reason: `hit ${a.target}, strong final set`,
          };
    if (p === "flat")
      return {
        action: "PROGRESS",
        increment: inc * 2,
        reason: `hit ${a.target} easily, flat — bigger step`,
      };
    if (p === "steep")
      return {
        action: "HOLD",
        increment: inc,
        reason: "at ceiling for this bucket",
      };
    return {
      action: "HOLD",
      increment: inc,
      reason: "irregular pattern — flag",
    };
  }
  if (isUnder) {
    if (severeUnder)
      return {
        action: "DELOAD",
        increment: inc,
        deloadPct: -0.1,
        reason: `undershot ${a.target} by ${num} — rebuild`,
      };
    if (p === "linear")
      return {
        action: "HOLD",
        increment: inc,
        reason: `undershot ${a.target} by ${num} — one more try`,
      };
    return {
      action: "DELOAD",
      increment: inc,
      deloadPct: -0.075,
      reason: `undershot with ${p} pattern`,
    };
  }
  return { action: "HOLD", increment: inc, reason: "hold" };
}

function decideAbs(config, a) {
  const allTop =
    a.reps.length >= a.expectedNSets && a.reps.every((r) => r >= a.repRangeMax);
  const anyBelow = a.reps.some((r) => r < a.repRangeMin);
  if (allTop)
    return finalize(
      "PROGRESS",
      a.weight,
      a.increment,
      0,
      `all sets at ${a.repRangeMax} — +${a.increment}kg`,
      ["abs"],
    );
  if (anyBelow)
    return finalize(
      "DELOAD",
      a.weight,
      a.increment,
      -0.1,
      `below ${a.repRangeMin}-rep range — drop load`,
      ["abs"],
    );
  return finalize(
    "HOLD",
    a.weight,
    a.increment,
    0,
    `in ${a.repRangeMin}-${a.repRangeMax} range — push reps`,
    ["abs"],
  );
}

export function decide(config, a, context = {}) {
  const flags = [];

  // --- Short-circuits ---
  if (a.isBaseline) {
    const need = config.baselineExercises.sessionsRequired;
    return finalize(
      "BASELINE",
      a.weight,
      a.increment,
      0,
      `establish baseline (session ${a.sessionsToDate} of ${need})`,
      ["BASELINE"],
    );
  }
  if (a.pattern === "incomplete") {
    return finalize(
      "HOLD",
      a.weight,
      a.increment,
      0,
      "incomplete — fewer sets than expected",
      ["incomplete"],
    );
  }
  if (a.bucketKind === "abs") {
    return decideAbs(config, a);
  }

  // --- Base matrix ---
  const base = matrixAction(a);
  let action = base.action;
  let increment = base.increment;
  let deloadPct = base.deloadPct ?? -0.075;
  let reason = base.reason;
  let conservativeHold = false;

  // --- Phase modifier ---
  const phase = config.phases.find((ph) => ph.id === context.phase);
  if (context.isFirstBulkSession) {
    if (action !== "DELOAD") {
      action = "HOLD";
      reason = "first bulk session — hold to recalibrate";
      conservativeHold = true;
    }
  } else if (
    phase?.bias === "conservative" &&
    action === "PROGRESS" &&
    a.status === "HIT"
  ) {
    action = "HOLD";
    reason = "cut — hold borderline progress";
    conservativeHold = true;
  }

  // --- Front-delt caution ---
  const caution = cautionTier(config, a.name);
  if (caution) {
    const num = statusNumber(a.status);
    if (caution.tier === "strict") {
      const eligible =
        a.status.startsWith("OVER") &&
        num >= caution.overshootMin &&
        a.pattern === "linear" &&
        !a.weakFinal;
      if (action === "PROGRESS" && !eligible) {
        action = "HOLD";
        reason = `caution: needs OVER+${caution.overshootMin} clean linear`;
        conservativeHold = true;
      }
      if (a.pattern === "steep" || a.pattern === "irregular") {
        if (action !== "DELOAD") {
          action = "HOLD";
          reason = "caution: non-linear on shoulder lift";
          conservativeHold = true;
        }
      }
    } else if (caution.tier === "moderate" && a.pattern === "irregular") {
      if (action !== "DELOAD") {
        action = "HOLD";
        reason = "caution: irregular on incline";
        conservativeHold = true;
      }
    }
    if (action === "PROGRESS" && caution.maxIncrement != null) {
      increment = Math.min(increment, caution.maxIncrement);
    }
  }

  // --- RPE modifier (last-set proxy) ---
  const rpe = a.rpe;
  if (rpe != null) {
    if (rpe >= 10 && action === "PROGRESS") {
      action = "HOLD";
      reason = "RPE 10 last set — at ceiling";
    } else if (rpe <= 7 && action === "HOLD" && !conservativeHold) {
      // Only upgrade when the pattern is load-ambiguous (linear/flat).
      if (a.pattern === "linear" || a.pattern === "flat") {
        action = "PROGRESS";
        increment = caution
          ? Math.min(a.increment, caution.maxIncrement ?? a.increment)
          : a.increment;
        reason = `RPE ${rpe} — room to add load`;
      }
    }
  }

  // --- Feedback keyword rules ---
  const fb = feedbackHit(config, a.feedback);
  if (fb) {
    if (fb.kind === "fatigue" && action === "PROGRESS") {
      action = "HOLD";
      reason = "feedback: felt heavy/tired — hold";
    } else if (fb.action === "caution" && caution) {
      const d = caution.discomfort; // "deload" | "hold" | "downgrade"
      if (d === "deload") {
        action = "DELOAD";
        deloadPct = -0.1;
        reason = "feedback: discomfort — deload";
      } else if (d === "hold") {
        if (action !== "DELOAD") {
          action = "HOLD";
          reason = "feedback: discomfort — hold";
        }
      } else if (d === "downgrade" && action === "PROGRESS") {
        action = "HOLD";
        reason = "feedback: discomfort — hold";
      }
    }
  }

  // --- Stall counter (3-strike) ---
  if (action === "HOLD" && (context.stallCount || 0) >= 2) {
    action = "DELOAD";
    deloadPct = -0.1;
    reason = "3rd consecutive hold — deload to rebuild";
    flags.push("3-strike");
  }

  return finalize(action, a.weight, increment, deloadPct, reason, flags);
}
