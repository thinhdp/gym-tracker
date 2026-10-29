// src/components/PushPullReview.jsx
// More -> Push·Pull Review: the PP21 (Push·Pull 2-1) review, rotation by
// rotation. A rotation is one Push A -> Pull A -> Push B -> Pull B pass. Each
// rotation is reviewed as it stood at its last session: what was decided for
// every exercise, session checks, program calls, and the next session plan.
// Reads live workouts (AppContext); no data is mutated here.

import React, { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { toDisplayWeight } from "../lib/units";
import pp21 from "../lib/review/programs/pp21";
import { loggedRotations, reviewRotation } from "../lib/review/pp21/engine";

const program = pp21;

const DECISION_BG = {
  ADD: "bg-green-600",
  HOLD: "bg-neutral-500",
  REDUCE: "bg-amber-600",
  RESET: "bg-amber-600",
  SWAP: "bg-red-600",
  START: "bg-blue-600",
  DELOAD_DONE: "bg-blue-600",
};

const SEVERITY_TEXT = {
  alert: "text-red-600 dark:text-red-400",
  warn: "text-amber-700 dark:text-amber-400",
  info: "text-neutral-500 dark:text-neutral-400",
};

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const short = (ymd) => {
  if (!ymd) return "";
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

const sessionName = (id) => program.sessions[id]?.name ?? "Unplanned";

function Chip({ decision }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${DECISION_BG[decision] || "bg-neutral-500"}`}
    >
      {decision === "DELOAD_DONE" ? "DELOAD" : decision}
    </span>
  );
}

// "47.5×5 · 42.5×7" for routine sets; 0 kg on a back-off is bodyweight.
function setsLabel(sets, unit) {
  return sets
    .map(
      (s) =>
        `${s.weight === 0 ? "BW" : toDisplayWeight(s.weight, unit)}×${s.targetReps}`,
    )
    .join(" · ");
}

function StallDots({ count }) {
  const max = program.thresholds.stallExposures;
  if (!count) return null;
  return (
    <span
      className="ml-1 text-[10px] tracking-tight text-amber-600"
      title={`${count} of ${max} sessions without progress`}
    >
      {"●".repeat(Math.min(count, max))}
      {"○".repeat(Math.max(0, max - count))}
    </span>
  );
}

export default function PushPullReview() {
  const { workouts, exercises, unit } = useApp();
  // the exercise catalog supplies each logged exercise's mainMuscle, which the
  // engine uses to fill a slot when the logged name differs from the plan
  const data = useMemo(() => ({ workouts, exercises }), [workouts, exercises]);
  const rotations = useMemo(() => loggedRotations(data, program), [data]);
  const [selected, setSelected] = useState(null);

  const rotationNum = selected ?? rotations[0]?.rotation;
  const rr = useMemo(
    () =>
      rotationNum == null ? null : reviewRotation(data, program, rotationNum),
    [data, rotationNum],
  );

  if (!rr) {
    return (
      <div className="rounded-xl border bg-white p-6 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        No Push·Pull sessions to review yet. Log a workout with{" "}
        <strong>Push A</strong> in its name on or after{" "}
        {short(program.startDate)} and check back.
      </div>
    );
  }

  const { rotation, global, next } = rr;
  const stepFlags = rr.exercises.flatMap((x) =>
    (x.step?.flags || []).map((f) => ({ ...f, exercise: x.name })),
  );
  const alerts = stepFlags.filter((f) => f.severity === "alert");
  const unitLabel = unit === "lb" ? "lb" : "kg";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Push·Pull Review
      </h1>

      {rotations.length > 1 && (
        <select
          aria-label="Rotation"
          value={rotationNum}
          onChange={(e) => setSelected(Number(e.target.value))}
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {rotations.map((r) => (
            <option key={r.rotation} value={r.rotation}>
              Rotation {r.rotation} · {short(r.start)}–{short(r.end)}
            </option>
          ))}
        </select>
      )}

      <div className="rounded-xl border-l-4 border-neutral-800 bg-neutral-50 p-3 text-sm dark:border-neutral-300 dark:bg-neutral-800/40">
        <div className="font-medium">
          Rotation {rotation.rotation} · {short(rotation.start)}–
          {short(rotation.end)} · {rotation.sessions.length}/
          {program.sessionOrder.length} sessions
          {rotation.deload
            ? " · deload"
            : rotation.complete
              ? ""
              : " · in progress"}
        </div>
        {rotation.missingSessions.length > 0 && rotation.complete && (
          <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Missed: {rotation.missingSessions.map(sessionName).join(", ")}
          </div>
        )}
      </div>

      {(alerts.length > 0 || global.flags.length > 0) && (
        <Section title="Alerts & calls">
          <ul className="space-y-1 text-sm">
            {alerts.map((f, i) => (
              <li key={`a${i}`} className={SEVERITY_TEXT.alert}>
                ⚠ <strong>{f.exercise}:</strong> {f.message}
              </li>
            ))}
            {global.flags.map((f, i) => (
              <li key={`g${i}`} className={SEVERITY_TEXT[f.severity]}>
                {f.severity === "info" ? "•" : "⚠"} {f.message}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title={rr.isLatest ? "Next session" : "Next session (as planned then)"}
      >
        <div className="rounded-xl border bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {next.name}
            </span>
            <span className="text-neutral-500">
              {short(global.nextSessionDate)}
            </span>
            {global.restDayFirst && (
              <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                Rest day first
              </span>
            )}
          </div>
          {next.deload && (
            <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
              Deload: 1 set per exercise at the same weight, RPE 7.
            </div>
          )}
          <table className="mt-2 w-full text-sm">
            <tbody>
              {next.exercises.map((e) => (
                <tr
                  key={e.exId}
                  className="border-t align-top dark:border-neutral-800"
                >
                  <td className="py-1.5">
                    <div
                      className={
                        e.doneEarlier
                          ? "text-neutral-400 line-through"
                          : "text-neutral-900 dark:text-neutral-100"
                      }
                    >
                      {e.exerciseName}
                      {e.optional && (
                        <span className="text-xs text-neutral-400">
                          {" "}
                          (optional)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {e.doneEarlier
                        ? "Already done this rotation."
                        : `${setsLabel(e.sets, unit)} ${unitLabel}`}
                      {e.carriedFrom && ` · moved from ${e.carriedFrom}`}
                    </div>
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    {!e.doneEarlier && <Chip decision={e.decision} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Sessions">
        <ul className="space-y-2 text-sm">
          {rr.sessions.map((s) => (
            <li
              key={s.workoutId}
              className="rounded-xl border bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {short(s.date)} · {sessionName(s.sessionId)}
                  {s.deload && " (deload)"}
                </span>
                <span className="text-xs tabular-nums text-neutral-500">
                  {s.workingSets}
                  {s.workingSetsOptional
                    ? `+${s.workingSetsOptional}`
                    : ""}{" "}
                  sets · RPE {s.rpeLogged}/{s.rpeExpected}
                </span>
              </div>
              {s.flags.map((f, i) => (
                <div key={i} className={`text-xs ${SEVERITY_TEXT[f.severity]}`}>
                  {f.message}
                </div>
              ))}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Exercises">
        <div className="space-y-4">
          {program.sessionOrder.map((sid) => (
            <div key={sid}>
              <div className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {sessionName(sid)}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {rr.exercises
                    .filter((x) => x.session === sid)
                    .map((x) => (
                      <ExerciseRow key={x.exId} x={x} unit={unit} />
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Rotation checks">
        <ul className="space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
          <li>
            Regressed compounds:{" "}
            {rotation.regressedCompounds.length
              ? rotation.regressedCompounds.join(", ")
              : "none"}
          </li>
          <li>Fatigue / RPE-overshoot signals: {rotation.fatigueSignals}</li>
          <li>
            Rotations since last deload: {global.deload.rotationsSinceDeload}
          </li>
          <li>
            Chest days per 7: {global.chest.minPer7Days ?? "—"} min (target{" "}
            {program.thresholds.chestMinPer7Days}+)
          </li>
          <li className="text-xs text-neutral-500">
            Direct sets:{" "}
            {Object.entries(rotation.directSetsByMuscle)
              .map(([m, n]) => `${m.replace(/_/g, " ")} ${n}`)
              .join(" · ")}
          </li>
        </ul>
      </Section>
    </div>
  );
}

function ExerciseRow({ x, unit }) {
  const step = x.step;
  const flags = (step?.flags || []).filter((f) => f.severity !== "info");
  return (
    <tr className="border-t align-top dark:border-neutral-800">
      <td className="py-1.5">
        <div className="text-neutral-900 dark:text-neutral-100">
          {x.loggedAs ?? x.name}
          <StallDots count={x.stallCount} />
        </div>
        {x.loggedAs && (
          <div className="text-[11px] text-neutral-400">
            in the {x.name} slot
          </div>
        )}
        <div className="text-xs text-neutral-500">
          {step ? step.reasons.join(" ") : "Not logged this rotation."}
        </div>
        {flags.map((f, i) => (
          <div key={i} className={`text-xs ${SEVERITY_TEXT[f.severity]}`}>
            {f.message}
          </div>
        ))}
        <div className="text-xs text-neutral-700 dark:text-neutral-300">
          Next: {x.next.swapTo ? `${x.next.swapTo} · ` : ""}
          {setsLabel(x.next.routineSets, unit)}
          {x.confidence === "low" && step && (
            <span className="text-neutral-400"> · no RPE logged</span>
          )}
        </div>
      </td>
      <td className="py-1.5 pl-2 text-right">
        {step ? <Chip decision={step.decision} /> : null}
      </td>
    </tr>
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
