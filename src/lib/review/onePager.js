// src/lib/review/onePager.js
// Builds a self-contained, printable HTML one-pager from a ReviewResult. All CSS
// is inlined, no scripts, no external assets — safe to download, open offline,
// and print to PDF. Ports the skill's html-template.md.

const BADGE_CLASS = {
  PROGRESS: "progress",
  HOLD: "hold",
  DELOAD: "deload",
  BASELINE: "baseline",
  REP_BUMP: "rep",
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(str) {
  const [, m, d] = str.split("-").map(Number);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${mon}`;
}

export function onePagerFilename(result) {
  const n = String(result.cycle?.number ?? 0).padStart(2, "0");
  return `cycle_${n}_plan.html`;
}

function planTables(groups) {
  return groups
    .map(
      (g) => `
  <div class="day-section">
    <h2>${esc(g.group)}</h2>
    <table class="plan">
      <tr><th>Exercise</th><th>kg</th><th>Action</th></tr>
      ${g.lines
        .map(
          (l) => `<tr>
        <td>${esc(l.exercise)}<br><span class="reason">${esc(l.reason)}</span></td>
        <td class="weight">${esc(l.weightLabel)}</td>
        <td><span class="badge ${BADGE_CLASS[l.action] || "hold"}">${esc(l.badgeLabel)}</span></td>
      </tr>`,
        )
        .join("\n      ")}
    </table>
  </div>`,
    )
    .join("\n");
}

function trendRows(trend) {
  return (trend || [])
    .slice(-4)
    .map((w) => {
      const delta = w.deltaPct == null ? (w.isInProgram ? "—" : "(pre)") : `${w.deltaPct >= 0 ? "+" : ""}${w.deltaPct.toFixed(1)}%`;
      return `<tr><td>${esc(w.label)}</td><td class="num">${Math.round(w.tonnage)}</td><td class="num">${w.totalReps}</td><td class="num">${esc(delta)}</td></tr>`;
    })
    .join("\n      ");
}

export function buildOnePager(result, grouping = "bySession") {
  const c = result.cycle;
  const groups = result.plan[grouping] || result.plan.bySession || [];
  const concerns = (result.narrative.concerns || [])
    .slice(0, 2)
    .map((x) => `<li><strong>${esc(x.title)}.</strong> ${esc(x.action)}</li>`)
    .join("\n      ");
  const bw = result.bodyweight || {};
  // Not escaped here — the whole bwNote is escaped once at the interpolation site.
  const bwNote = bw.thisAvg != null ? `${bw.thisAvg.toFixed(1)}kg (${bw.thisN} weigh-ins). ${bw.evaluation || ""}` : "no weigh-ins";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cycle ${c.number} Plan — ${esc(result.program.name)}</title>
<style>
:root{--bg:#fff;--fg:#1f2937;--fg-muted:#6b7280;--rule:#e5e7eb;--surface:#f9fafb;--progress:#16a34a;--hold:#d97706;--deload:#dc2626;--baseline:#6b7280;--accent:#0f172a;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-size:15px;line-height:1.45;}
.container{max-width:480px;margin:0 auto;padding:16px 16px 40px;}
header{border-bottom:2px solid var(--accent);padding-bottom:12px;margin-bottom:20px;}
header h1{margin:0 0 4px;font-size:22px;font-weight:700;color:var(--accent);}
header .meta{font-size:13px;color:var(--fg-muted);}
.headline{background:var(--surface);border-left:3px solid var(--accent);padding:10px 12px;margin:16px 0;font-size:14px;font-weight:500;}
.section-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-muted);margin:24px 0 8px;}
.volume-table{width:100%;border-collapse:collapse;font-size:13px;}
.volume-table th,.volume-table td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--rule);}
.volume-table td.num{text-align:right;font-variant-numeric:tabular-nums;}
.volume-verdict{font-size:13px;font-style:italic;color:var(--fg-muted);margin-top:6px;}
.concerns{list-style:none;padding:0;margin:0;}
.concerns li{padding:6px 0;border-bottom:1px dashed var(--rule);font-size:13px;}
.day-section{margin-top:20px;}
.day-section h2{font-size:14px;font-weight:700;margin:0 0 6px;color:var(--accent);}
table.plan{width:100%;border-collapse:collapse;font-size:13px;}
table.plan th,table.plan td{padding:8px 6px;text-align:left;border-bottom:1px solid var(--rule);vertical-align:top;}
table.plan td.weight{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap;}
.reason{font-size:12px;color:var(--fg-muted);}
.badge{display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#fff;white-space:nowrap;}
.badge.progress{background:var(--progress);}.badge.hold{background:var(--hold);}.badge.deload{background:var(--deload);}.badge.baseline{background:var(--baseline);}.badge.rep{background:var(--progress);}
footer{margin-top:32px;padding-top:12px;border-top:1px solid var(--rule);font-size:12px;color:var(--fg-muted);}
@media print{body{font-size:12px;}.container{max-width:100%;padding:0;}*{print-color-adjust:exact;-webkit-print-color-adjust:exact;}}
</style>
</head>
<body>
<div class="container">
<header>
  <h1>Cycle ${c.number} Plan</h1>
  <div class="meta">${fmtDate(c.start)} – ${fmtDate(c.end)} • ${esc(c.phase)} • ${esc(result.program.name)}</div>
</header>
<div class="headline">${esc(result.narrative.headline)}</div>
<div class="section-title">Volume trend</div>
<table class="volume-table">
  <tr><th>Cycle</th><th class="num">Tonnage</th><th class="num">Reps</th><th class="num">Δ</th></tr>
      ${trendRows(result.tonnageTrend)}
</table>
<div class="volume-verdict">${esc(result.narrative.volumeVerdict)}</div>
${concerns ? `<div class="section-title">Concerns</div>\n<ul class="concerns">\n      ${concerns}\n</ul>` : ""}
${planTables(groups)}
<footer>
  Bodyweight: ${esc(bwNote)}<br>
  Generated ${esc(new Date().toISOString().slice(0, 10))} • ${esc(result.program.name)} cycle review
</footer>
</div>
</body>
</html>`;
}
