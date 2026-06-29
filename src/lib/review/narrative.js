// src/lib/review/narrative.js
// Templated prose for the review (replaces the skill's LLM-authored sections).
// Everything is derived deterministically from the structured ReviewResult.

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function fmtDate(str) {
  const [, m, d] = str.split("-").map(Number);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${mon}`;
}

export function buildNarrative(result) {
  const ex = result.exercises || [];
  const progressions = ex.filter((e) => e.decision.action === "PROGRESS");
  const deloads = ex.filter((e) => e.decision.action === "DELOAD");
  const concerns = buildConcerns(ex);

  const c = result.cycle;
  const verdict =
    deloads.length >= 2
      ? "rough cycle"
      : progressions.length >= 3
        ? "strong cycle"
        : "steady cycle";
  const headline =
    `Week ${c.number} (${fmtDate(c.start)}–${fmtDate(c.end)}, ${c.phase}) — ${verdict}: ` +
    `${plural(result.sessions.length, "session")}, ${plural(progressions.length, "progression")}, ${plural(concerns.length, "concern")}.`;

  const wins = [];
  for (const e of progressions.slice(0, 4)) {
    wins.push(
      `${e.name} — ${e.decision.badgeLabel}${e.decision.reason ? ` (${e.decision.reason})` : ""}.`,
    );
  }
  if (result.bodyweight?.evaluation && /ON TARGET/.test(result.bodyweight.evaluation)) {
    wins.push(`Bodyweight ${result.bodyweight.deltaPct >= 0 ? "+" : ""}${result.bodyweight.deltaPct.toFixed(1)}% — ${result.bodyweight.evaluation}.`);
  }

  return { headline, wins, concerns, volumeVerdict: volumeVerdict(result.tonnageTrend) };
}

function buildConcerns(ex) {
  const ranked = [];
  // Tier 1: injury / 3-strike
  for (const e of ex) {
    const isInjury = /discomfort|pain/.test(e.decision.reason || "");
    const isStrike = (e.flags || []).includes("3-strike") || (e.decision.flags || []).includes("3-strike");
    if (isInjury || isStrike) {
      ranked.push({ tier: 1, title: e.name, action: e.decision.reason });
    }
  }
  // Tier 2: deloads
  for (const e of ex) {
    if (e.decision.action === "DELOAD" && !ranked.some((r) => r.title === e.name)) {
      ranked.push({ tier: 2, title: e.name, action: `DELOAD — ${e.decision.reason}` });
    }
  }
  // Tier 3: irregular / incomplete
  for (const e of ex) {
    if ((e.pattern === "irregular" || e.pattern === "incomplete") && !ranked.some((r) => r.title === e.name)) {
      ranked.push({ tier: 3, title: e.name, action: `${e.pattern} pattern — ${e.decision.reason}` });
    }
  }
  ranked.sort((a, b) => a.tier - b.tier);
  return ranked.slice(0, 3).map(({ title, action }) => ({ title, action }));
}

function volumeVerdict(trend) {
  const inProg = (trend || []).filter((w) => w.isInProgram);
  if (inProg.length < 2) return "Not enough cycles yet to judge volume trend.";
  const last = inProg[inProg.length - 1];
  const delta = last.deltaPct;
  const pq = last.patternQualityPct;
  if (delta == null) return "Volume trend baseline set this cycle.";
  if (delta >= 1 && delta <= 3 && pq != null && pq >= 70) {
    return "Effort calibration on point — continue progressing where indicated.";
  }
  if (Math.abs(delta) < 1) {
    return "Tonnage flat — room to push harder on flat-pattern lifts.";
  }
  if (delta > 3 && pq != null && pq < 70) {
    return "Tonnage rising but pattern quality slipping — convert borderline progress to hold.";
  }
  if (delta < 0) {
    return "Tonnage easing — expected during a cut, otherwise check recovery.";
  }
  return "Volume trend within normal range.";
}
