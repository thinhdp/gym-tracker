// src/components/LiftRatioBalance.jsx
// Progress → Symmetry "Lift Balance" panel — a take on FitnessVolt's Strength
// Symmetry Analyzer. It compares the ratios between your main barbell lifts
// (each vs your squat) to the ratios of the median lifter at your bodyweight,
// derived from the API's p50 standards rather than hard-coded "ideal" numbers.

import React, { useEffect, useMemo, useState } from "react";
import {
  RATIO_LIFTS,
  RATIO_BASE,
  RATIO_BASE_LABEL,
  buildRatioRows,
  overallScore,
  scoreRating,
  focusAreas,
} from "../lib/liftRatios";
import { fetchStandards } from "../lib/fvApi";

const pct = (r) => `${Math.round(r * 100)}%`;
const signed = (n) => `${n >= 0 ? "+" : ""}${n}%`;

function Notice({ children }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
      {children}
    </div>
  );
}

const BADGE = {
  balanced:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  weak: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  strong: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
};
const BADGE_LABEL = {
  balanced: "Balanced",
  weak: "Lagging",
  strong: "Leading",
};

function AssessBadge({ assessment }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[assessment]}`}
    >
      {BADGE_LABEL[assessment]}
    </span>
  );
}

export default function LiftRatioBalance({
  e1rmBySlug,
  bodyweight,
  sex,
  age,
  refreshNonce = 0,
}) {
  // User e1RM (kg) keyed by ratio-lift key, for lifts actually logged.
  const userByKey = useMemo(() => {
    const out = {};
    for (const lift of RATIO_LIFTS) {
      const v = Number(e1rmBySlug?.[lift.slug]);
      if (Number.isFinite(v) && v > 0) out[lift.key] = v;
    }
    return out;
  }, [e1rmBySlug]);

  const presentLifts = RATIO_LIFTS.filter((l) => l.key in userByKey);
  const hasBase = RATIO_BASE in userByKey;
  const canQuery = hasBase && presentLifts.length >= 2;

  const reqKey = JSON.stringify({
    sex,
    age,
    bw: Math.round(Number(bodyweight) || 0),
    keys: Object.keys(userByKey).sort(),
  });

  const [state, setState] = useState({
    loading: false,
    error: null,
    avg: null,
  });

  useEffect(() => {
    if (!canQuery) return;
    let cancelled = false;
    // Flagging the in-flight fetch (external-system sync) — documented exception.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: null }));

    const reqs = presentLifts.map((l) => ({
      key: l.key,
      lift: l.slug,
      bodyweight,
      sex,
      age,
      source: "gym",
    }));

    fetchStandards(reqs, { cache: refreshNonce === 0 })
      .then((res) => {
        if (cancelled) return;
        const avg = {};
        for (const l of presentLifts) {
          const r = res[l.key];
          if (r && !r.error && r.p50 != null) avg[l.key] = r.p50;
        }
        const anyError = Object.values(res).some((r) => r?.error);
        setState({
          loading: false,
          error: anyError ? "Some standards couldn't be loaded." : null,
          avg,
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            loading: false,
            error: e?.message || "Lookup failed.",
            avg: null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey, refreshNonce, canQuery]);

  // --- Gating --------------------------------------------------------------
  if (!hasBase) {
    return (
      <Notice>
        Log a <span className="font-medium">Back Squat</span> to see lift
        balance — every ratio is measured against your squat.
      </Notice>
    );
  }
  if (presentLifts.length < 2) {
    return (
      <Notice>
        Log at least one more big lift (Bench, Deadlift, Overhead Press or
        Barbell Row) alongside your squat to compare lift balance.
      </Notice>
    );
  }

  const { loading, error, avg } = state;
  const rows = buildRatioRows(userByKey, avg || {});
  const score = overallScore(rows);
  const rating = scoreRating(score);
  const { weakest, strongest } = focusAreas(rows);

  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wide text-neutral-400">
        Lift balance
      </div>

      {/* Overall symmetry score */}
      <div className="rounded-xl border p-4 dark:border-neutral-800">
        {loading && !avg ? (
          <div className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Loading strength standards…
          </div>
        ) : score == null ? (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            Couldn’t compute a balance score yet.
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-400">
                  Symmetry score
                </div>
                <div className="mt-0.5 text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {score}
                  <span className="text-lg text-neutral-400"> / 100</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                  {rating}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  vs the median lifter
                </div>
              </div>
            </div>

            {(weakest || strongest) && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {weakest && (
                  <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                    <span className="font-medium">{weakest.label}</span> lags
                    your squat — a good place to push.
                  </div>
                )}
                {strongest && (
                  <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
                    <span className="font-medium">{strongest.label}</span> leads
                    relative to your squat.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          {error}
        </div>
      )}

      {/* Ratio breakdown */}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border text-sm dark:border-neutral-800">
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 bg-neutral-50 px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-400 dark:bg-neutral-800/60">
            <span>Lift</span>
            <span className="text-right">Yours</span>
            <span className="text-right">Median</span>
            <span className="text-right">Balance</span>
          </div>
          <div className="divide-y dark:divide-neutral-800">
            {rows.map((r) => {
              const diffPts = Math.round(r.diff * 100);
              return (
                <div
                  key={r.key}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                      {r.label}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      vs {RATIO_BASE_LABEL}
                    </div>
                  </div>
                  <div className="text-right font-semibold tabular-nums">
                    {pct(r.userRatio)}
                  </div>
                  <div className="text-right tabular-nums text-neutral-500 dark:text-neutral-400">
                    {pct(r.avgRatio)}
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <AssessBadge assessment={r.assessment} />
                    {r.assessment !== "balanced" && (
                      <span className="text-[11px] tabular-nums text-neutral-400">
                        {signed(diffPts)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="px-1 text-[11px] leading-snug text-neutral-400 dark:text-neutral-500">
        Each lift is shown as a percentage of your {RATIO_BASE_LABEL}. “Median”
        is the typical lifter at your bodyweight and sex (FitnessVolt gym data);
        within 5% counts as balanced.
      </p>
    </div>
  );
}
