// src/lib/review/bodyweight.js
// Cycle bodyweight average and phase-target evaluation. Verdict bands come from
// the program phases' bodyweight {minPct,maxPct}. Bodyweight logs are raw kg
// numbers ({ "YYYY-MM-DD": number }); they are not unit-converted (see DATA-MODEL).

export function cycleAverage(weightLogs, startStr, endStr) {
  const vals = [];
  for (const [d, w] of Object.entries(weightLogs || {})) {
    if (d >= startStr && d <= endStr) {
      const n = Number(w);
      if (Number.isFinite(n)) vals.push(n);
    }
  }
  if (!vals.length) return { avg: null, n: 0 };
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length };
}

export function evaluate(config, phaseId, deltaPct) {
  if (deltaPct == null) return "";
  const ph = (config.phases || []).find((p) => p.id === phaseId);
  if (!ph || !ph.bodyweight) return "";
  const { minPct, maxPct } = ph.bodyweight;
  const d = deltaPct;

  if (phaseId === "cut") {
    if (d >= minPct && d <= maxPct) return "ON TARGET (cut band)";
    if (d < -1.0) return "TOO FAST (>1%/cycle — strength risk)";
    if (d > -0.2) return "TOO SLOW (deficit may not be real)";
    return "ACCEPTABLE (within reasonable cut range)";
  }
  if (phaseId === "lean-bulk") {
    if (d >= minPct && d <= maxPct) return "ON TARGET (lean bulk band)";
    if (d > 0.7) return "TOO FAST (excess fat-gain risk)";
    if (d < 0) return "BELOW TARGET (no gain)";
    return "ACCEPTABLE";
  }
  if (phaseId === "maintenance") {
    if (Math.abs(d) <= maxPct) return "ON TARGET (maintenance band)";
    return "OFF TARGET (travel-diet effect — no action)";
  }
  return "";
}
