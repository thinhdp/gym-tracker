// src/components/StrengthStandards.jsx
// Progress → Symmetry: a strengthlevel-style radar that scores your best lifts
// against the FitnessVolt Strength Standards API, with a "now vs a past date"
// comparison. The radar (gym source) is movement-based; verified
// (OpenPowerlifting) percentiles are shown as a bonus for squat/bench/deadlift.

import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
} from "recharts";
import { useApp } from "../context/AppContext";
import { Input } from "./ui/Input";
import { loadLS, K_PROFILE, K_WEIGHT_LOGS } from "../lib/storage";
import { ymdFromDate } from "../lib/date";
import {
  RADAR_AXES,
  bestE1RMBySlug,
  axisRequests,
  liftWeight,
  ageFromBirthYear,
  percentileToTier,
  overallTier,
  starsFromPercentile,
} from "../lib/strengthStandards";
import { fetchPercentiles, FV_ATTRIBUTION_URL } from "../lib/fvApi";
import LiftRatioBalance from "./LiftRatioBalance";

const NOW_COLOR = "#378ADD";
const PAST_COLOR = "#D4537E";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Most recent logged bodyweight (kg) on or before a date, else the latest.
function bodyweightAsOf(logs, onOrBefore = null) {
  const keys = Object.keys(logs || {})
    .filter((k) => !onOrBefore || k <= onOrBefore)
    .sort();
  for (let i = keys.length - 1; i >= 0; i--) {
    const v = logs[keys[i]];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function Stars({ percentile }) {
  const n = starsFromPercentile(percentile);
  return (
    <span aria-label={`${n} of 5 stars`} className="text-lg tracking-tight">
      <span className="text-amber-400">{"★".repeat(n)}</span>
      <span className="text-neutral-300 dark:text-neutral-600">
        {"★".repeat(5 - n)}
      </span>
    </span>
  );
}

function TierBadge({ tier }) {
  if (!tier) return <span className="text-neutral-400">—</span>;
  return (
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
      {cap(tier)}
    </span>
  );
}

function Notice({ children }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
      {children}
    </div>
  );
}

export default function StrengthStandards() {
  const { workouts } = useApp();
  const wos = useMemo(() => workouts || [], [workouts]);

  const profile = useMemo(() => loadLS(K_PROFILE, {}), []);
  const weightLogs = useMemo(() => loadLS(K_WEIGHT_LOGS, {}), []);
  const sex = profile.sex;
  const age = ageFromBirthYear(profile.birthYear);
  const liftConfig = profile.liftConfig;

  // Default the comparison date to ~6 months ago.
  const defaultPast = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return ymdFromDate(d);
  }, []);
  const [pastDate, setPastDate] = useState(defaultPast);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const bwNow = bodyweightAsOf(weightLogs);
  const bwPast = bodyweightAsOf(weightLogs, pastDate) ?? bwNow;

  // Best current e1RM per slug — feeds both the radar and the lift-balance panel.
  // liftConfig pins exercise→lift mappings and adds bar weight where logged out.
  const e1rmNow = useMemo(
    () => bestE1RMBySlug(wos, null, liftConfig),
    [wos, liftConfig],
  );

  // Build the per-axis lookup requests for both snapshots.
  const { nowReqs, pastReqs, verifiedReqs } = useMemo(() => {
    const e1rmPast = bestE1RMBySlug(wos, pastDate, liftConfig);
    const now = axisRequests(e1rmNow, bwNow);
    const past = axisRequests(e1rmPast, bwPast);
    // Verified bonus: only squat/bench/deadlift, scored from each axis's
    // canonical (first) slug, "now" snapshot only.
    const verified = [];
    for (const axis of RADAR_AXES) {
      if (!axis.verified) continue;
      const slug = axis.slugs[0];
      if (!(slug in e1rmNow)) continue;
      verified.push({
        key: axis.key,
        lift: axis.verified,
        weight: liftWeight(slug, e1rmNow[slug], bwNow),
        bodyweight: bwNow,
      });
    }
    return { nowReqs: now, pastReqs: past, verifiedReqs: verified };
  }, [wos, e1rmNow, pastDate, bwNow, bwPast, liftConfig]);

  const [state, setState] = useState({
    loading: false,
    error: null,
    data: null,
  });

  const canQuery = Boolean(sex) && bwNow != null && nowReqs.length > 0;

  // Serialize the request shape so the effect only refetches on real changes.
  const reqKey = JSON.stringify({ sex, age, nowReqs, pastReqs, verifiedReqs });

  useEffect(() => {
    if (!canQuery) return;
    let cancelled = false;
    // Flagging the in-flight fetch is the documented exception to this rule
    // (synchronizing with an external system on mount/dep-change).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: null }));

    const opts = { cache: refreshNonce === 0 ? true : false };
    const req = (src, key, lift, weight, bodyweight) => ({
      key: `${src}:${key}`,
      lift,
      weight,
      bodyweight,
      sex,
      age,
    });

    const all = [
      ...nowReqs.map((r) => req("now", r.axis, r.slug, r.weight, bwNow)),
      ...pastReqs.map((r) => req("past", r.axis, r.slug, r.weight, bwPast)),
      ...verifiedReqs.map((r) =>
        req("ver", r.key, r.lift, r.weight, r.bodyweight),
      ),
    ];

    fetchPercentiles(all, opts)
      .then((res) => {
        if (cancelled) return;
        const data = { now: {}, past: {}, verified: {} };
        for (const axis of RADAR_AXES) {
          const n = res[`now:${axis.key}`];
          const p = res[`past:${axis.key}`];
          const v = res[`ver:${axis.key}`];
          if (n && !n.error) data.now[axis.key] = n.gym;
          if (p && !p.error) data.past[axis.key] = p.gym;
          if (v && !v.error) data.verified[axis.key] = v.verified;
        }
        const anyError = Object.values(res).some((r) => r?.error);
        setState({
          loading: false,
          error: anyError ? "Some standards couldn't be loaded." : null,
          data,
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            loading: false,
            error: e?.message || "Lookup failed.",
            data: null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // reqKey captures sex/age/requests; refreshNonce forces a cache-bypassing refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey, refreshNonce, canQuery]);

  // --- Gating states -------------------------------------------------------
  if (!sex) {
    return (
      <Notice>
        Set your <span className="font-medium">sex</span> in{" "}
        <span className="font-medium">More → Profile</span> to compare your
        lifts against strength standards.
      </Notice>
    );
  }
  if (bwNow == null) {
    return (
      <Notice>
        Log your <span className="font-medium">bodyweight</span> in{" "}
        <span className="font-medium">Progress → Bodyweight</span> first —
        strength standards are relative to bodyweight.
      </Notice>
    );
  }
  if (nowReqs.length === 0) {
    return (
      <Notice>
        No standard barbell lifts logged yet. Log lifts like{" "}
        <span className="font-medium">
          Squat, Bench Press, Deadlift, Shoulder Press, Pull-up or Bent-over Row
        </span>{" "}
        to see your strength symmetry.
      </Notice>
    );
  }

  const { loading, error, data } = state;

  // --- Derived view data ---------------------------------------------------
  const axesWithData = RADAR_AXES.filter((a) => data?.now?.[a.key]);
  const radarData = axesWithData.map((a) => ({
    axis: a.label,
    now: data.now[a.key]?.percentile ?? null,
    past: data.past?.[a.key]?.percentile ?? null,
  }));
  const hasPast = radarData.some((r) => r.past != null);

  const nowPercentiles = axesWithData.map((a) => data.now[a.key]?.percentile);
  const avgNow =
    nowPercentiles.filter((p) => p != null).reduce((a, b) => a + b, 0) /
    (nowPercentiles.filter((p) => p != null).length || 1);
  const overall = overallTier(nowPercentiles);

  return (
    <div className="space-y-5">
      {/* Header: overall level + stars */}
      <div className="rounded-xl border p-4 dark:border-neutral-800">
        <div className="text-xs uppercase tracking-wide text-neutral-400">
          Your strength level
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-3">
          <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {overall ? cap(overall) : "—"}
          </div>
          <Stars percentile={Number.isFinite(avgNow) ? avgNow : 0} />
        </div>
        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Across {axesWithData.length} of {RADAR_AXES.length} lift groups
          {age ? `, age ${age}` : ""} · {Math.round(bwNow)} kg bodyweight
        </div>
      </div>

      {/* Comparison controls */}
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          Compare to
          <span className="w-36">
            <Input
              type="date"
              value={pastDate}
              max={ymdFromDate(new Date())}
              onChange={(e) => setPastDate(e.target.value)}
            />
          </span>
        </label>
        <button
          type="button"
          onClick={() => setRefreshNonce((n) => n + 1)}
          className="rounded-lg border px-2.5 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          {error}
        </div>
      )}

      {/* Radar */}
      <div className="rounded-xl border p-2 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
        {loading && !data ? (
          <div className="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Loading strength standards…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="currentColor" opacity={0.2} />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fontSize: 11, fill: "currentColor" }}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: "currentColor", opacity: 0.5 }}
                axisLine={false}
              />
              {hasPast && (
                <Radar
                  name={pastDate}
                  dataKey="past"
                  stroke={PAST_COLOR}
                  fill={PAST_COLOR}
                  fillOpacity={0.15}
                  isAnimationActive={false}
                />
              )}
              <Radar
                name="Now"
                dataKey="now"
                stroke={NOW_COLOR}
                fill={NOW_COLOR}
                fillOpacity={0.3}
                isAnimationActive={false}
              />
              <Tooltip
                formatter={(v) => (v == null ? "—" : `${Math.round(v)}%`)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        )}
        <p className="px-2 pb-1 pt-2 text-center text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
          Each axis is your percentile against other{" "}
          {sex === "female" ? "women" : "men"} at ~{Math.round(bwNow)} kg
          bodyweight{age ? `, age ${age}` : ""} in the FitnessVolt gym dataset.
          A higher value means you out-lift more people; 50% is the median.
        </p>
      </div>

      {/* Per-axis breakdown */}
      <div className="overflow-hidden rounded-xl border text-sm dark:border-neutral-800">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 bg-neutral-50 px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-400 dark:bg-neutral-800/60">
          <span>Lift</span>
          <span className="text-right">Gym percentile</span>
          <span className="text-right">Verified</span>
        </div>
        <div className="divide-y dark:divide-neutral-800">
          {axesWithData.map((a) => {
            const gym = data.now[a.key];
            const past = data.past?.[a.key];
            const ver = data.verified?.[a.key];
            const tier = gym?.tier || percentileToTier(gym?.percentile);
            const delta =
              past?.percentile != null && gym?.percentile != null
                ? Math.round(gym.percentile - past.percentile)
                : null;
            return (
              <div
                key={a.key}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                    {a.label}
                  </div>
                  <div className="mt-0.5">
                    <TierBadge tier={tier} />
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div className="font-semibold">
                    {gym?.percentile != null
                      ? `${Math.round(gym.percentile)}%`
                      : "—"}
                  </div>
                  {delta != null && (
                    <div
                      className={`text-[11px] ${
                        delta >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {delta >= 0 ? "+" : ""}
                      {delta} vs {pastDate}
                    </div>
                  )}
                </div>
                <div className="text-right tabular-nums text-neutral-500 dark:text-neutral-400">
                  {ver?.percentile != null
                    ? `${Math.round(ver.percentile)}%`
                    : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lift-ratio balance (Symmetry Analyzer) */}
      <LiftRatioBalance
        e1rmBySlug={e1rmNow}
        bodyweight={bwNow}
        sex={sex}
        age={age}
        refreshNonce={refreshNonce}
      />

      <p className="px-1 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
        <a
          href={FV_ATTRIBUTION_URL}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Powered by FitnessVolt Strength Standards
        </a>
        {" · "}
        Gym = self-reported · Verified = OpenPowerlifting
      </p>
    </div>
  );
}
