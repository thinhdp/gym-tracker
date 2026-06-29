// src/components/CycleReview.jsx
// More -> Cycle Review: an offline Max 7/5/3 cycle review + next-cycle plan.
// Reads live workouts (AppContext) and bodyweight logs (localStorage), runs the
// pure review engine, and renders the structured result with a downloadable
// HTML one-pager. No data is mutated here.

import React, { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { loadLS, K_WEIGHT_LOGS } from "../lib/storage";
import Segmented from "./ui/Segmented";
import max753 from "../lib/review/programs/max753";
import { buildCycleReview } from "../lib/review/review";
import { loggedCycles } from "../lib/review/cycles";
import { buildOnePager, onePagerFilename } from "../lib/review/onePager";

const program = max753;

const BADGE = {
  PROGRESS: "bg-green-600",
  HOLD: "bg-amber-600",
  DELOAD: "bg-red-600",
  BASELINE: "bg-neutral-500",
  REP_BUMP: "bg-green-600",
};

function Badge({ action, label }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${BADGE[action] || "bg-amber-600"}`}>
      {label}
    </span>
  );
}

export default function CycleReview() {
  const { workouts, exercises } = useApp();
  const weightLogs = useMemo(() => loadLS(K_WEIGHT_LOGS, {}), []);
  const cycles = useMemo(() => loggedCycles(program, workouts), [workouts]);
  const [selected, setSelected] = useState(() => cycles[0]);
  const [grouping, setGrouping] = useState("bySession");

  const cycleNum = selected ?? cycles[0];
  const review = useMemo(
    () => buildCycleReview(program, { workouts, weightLogs, exercises }, cycleNum),
    [workouts, weightLogs, exercises, cycleNum],
  );

  if (!review.cycle) {
    return (
      <div className="rounded-xl border bg-white p-6 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        No completed cycle to review yet. Log some workouts and check back.
      </div>
    );
  }

  const groups = review.plan[grouping] || [];

  const onDownload = () => {
    const html = buildOnePager(review, grouping);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = onePagerFilename(review);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Cycle Review
        </h1>
        <button
          type="button"
          onClick={onDownload}
          className="rounded-lg border px-3 py-1.5 text-sm text-blue-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-blue-400 dark:hover:bg-neutral-800"
        >
          Download
        </button>
      </div>

      {cycles.length > 1 && (
        <select
          value={cycleNum}
          onChange={(e) => setSelected(Number(e.target.value))}
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {cycles.map((n) => (
            <option key={n} value={n}>
              Cycle {n}
            </option>
          ))}
        </select>
      )}

      <div className="rounded-xl border-l-4 border-neutral-800 bg-neutral-50 p-3 text-sm font-medium dark:border-neutral-300 dark:bg-neutral-800/40">
        {review.narrative.headline}
      </div>

      {review.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
          {review.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}

      {review.narrative.wins.length > 0 && (
        <Section title="Wins">
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
            {review.narrative.wins.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Section>
      )}

      {review.narrative.concerns.length > 0 && (
        <Section title="Concerns">
          <ul className="space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
            {review.narrative.concerns.map((c, i) => (
              <li key={i}>
                <strong>{c.title}.</strong> {c.action}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Volume trend">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400">
              <th className="py-1">Cycle</th>
              <th className="py-1 text-right">Tonnage</th>
              <th className="py-1 text-right">Reps</th>
              <th className="py-1 text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {review.tonnageTrend.slice(-4).map((w, i) => (
              <tr key={i} className="border-t dark:border-neutral-800">
                <td className="py-1">{w.label}</td>
                <td className="py-1 text-right tabular-nums">{Math.round(w.tonnage)}</td>
                <td className="py-1 text-right tabular-nums">{w.totalReps}</td>
                <td className="py-1 text-right tabular-nums">
                  {w.deltaPct == null ? (w.isInProgram ? "—" : "(pre)") : `${w.deltaPct >= 0 ? "+" : ""}${w.deltaPct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs italic text-neutral-500">{review.narrative.volumeVerdict}</p>
      </Section>

      {review.bodyweight.thisAvg != null && (
        <Section title="Bodyweight">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {review.bodyweight.thisAvg.toFixed(1)}kg ({review.bodyweight.thisN} weigh-ins)
            {review.bodyweight.deltaPct != null && (
              <>
                {" "}· {review.bodyweight.deltaPct >= 0 ? "+" : ""}
                {review.bodyweight.deltaPct.toFixed(1)}% — {review.bodyweight.evaluation}
              </>
            )}
          </p>
        </Section>
      )}

      <Section title="Next cycle plan">
        <Segmented
          options={[
            ["bySession", "By session"],
            ["byBlock", "By block"],
          ]}
          value={grouping}
          onChange={setGrouping}
        />
        <div className="mt-3 space-y-4">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {g.group}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {g.lines.map((l, i) => (
                    <tr key={i} className="border-t align-top dark:border-neutral-800">
                      <td className="py-1.5">
                        <div className="text-neutral-900 dark:text-neutral-100">{l.exercise}</div>
                        <div className="text-xs text-neutral-500">{l.reason}</div>
                      </td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{l.weightLabel}</td>
                      <td className="py-1.5 pl-2 text-right">
                        <Badge action={l.action} label={l.badgeLabel} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="mb-1.5 px-1 text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {title}
      </div>
      {children}
    </div>
  );
}
