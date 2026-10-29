// src/lib/review/pp21/engine.js
// PP21 review engine: reviews the app's workouts against the Push·Pull 2-1
// program config (src/lib/review/programs/pp21.js). Pure, no storage, no React.
// Entry points: reviewProgram(data, program, opts?) and nextSessionPlan().
// Rules and output shape are documented in docs/PP21-REVIEW.md.
//
// Pipeline: normalise -> assign rotations -> build exposures -> replay each
// exercise -> session checks -> rotation checks -> global calls. Replaying the
// whole history means a review run "as of" any date gives the same answer.

const DAY = 86_400_000;
const toDay = (d) => Math.round(Date.parse(d + "T00:00:00Z") / DAY);
const fromDay = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const norm = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const roundTo = (x, step) => Math.round(x / step) * step;
const floorTo = (x, step) => Math.floor(x / step + 1e-9) * step;
const fix = (x) => Math.round(x * 100) / 100;
const epley = (w, r) => w * (1 + r / 30);
const num = (x) => Number(x) || 0;

function buildNameIndex(p) {
  const idx = new Map();
  for (const [id, ex] of Object.entries(p.exercises)) {
    for (const n of [ex.name, ...(ex.aliases || [])]) {
      const k = norm(n);
      if (!idx.has(k)) idx.set(k, id); // first definition wins; keep aliases unique in config
    }
  }
  return idx;
}

function noteFlags(text, p) {
  if (!text) return [];
  const t = text.toLowerCase();
  return Object.entries(p.noteFlags)
    .filter(([, re]) => new RegExp(re, "i").test(t))
    .map(([k]) => k);
}

// Split logged sets into warm-ups, the working sets, and extras, following the
// exercise's scheme. Reps of 0 are unfilled routine slots; x.5 reps are a
// bad-form rep (floored, counted as partial).
function extractWorking(sets, ex, th) {
  const valid = (sets || [])
    .filter((s) => num(s.reps) > 0)
    .map((s) => {
      const reps = num(s.reps);
      return {
        weight: num(s.weight),
        reps: Math.floor(reps),
        partial: reps !== Math.floor(reps),
      };
    });
  const partialReps = valid.filter((s) => s.partial).length;
  if (!valid.length)
    return { working: [], warmups: 0, extra: 0, partialReps, top: undefined };

  const maxW = Math.max(...valid.map((s) => s.weight));
  let i = 0;
  // leading sets clearly lighter than the heaviest set are warm-ups
  while (
    i < valid.length - 1 &&
    maxW > 0 &&
    valid[i].weight < th.warmupBelowPctOfTop * maxW
  )
    i++;
  const warmups = i;
  const rest = valid.slice(i);

  if (ex.scheme === "top_backoff") {
    const topIdx = rest.findIndex((s) => s.weight === maxW);
    const top = rest[topIdx];
    const backoff = rest[topIdx + 1];
    const working = backoff ? [top, backoff] : [top];
    return {
      working,
      warmups: warmups + topIdx,
      extra: Math.max(0, rest.length - topIdx - 2),
      partialReps,
      top,
      backoff,
    };
  }
  const working = rest.slice(0, 2);
  return {
    working,
    warmups,
    extra: Math.max(0, rest.length - 2),
    partialReps,
    top: working[0],
    backoff: undefined,
  };
}

/* ── step 1: normalise workouts ── */

// "[LV] Push A" contains "push a" as a whole phrase; "Push AB" does not.
const hasPhrase = (text, phrase) => {
  const esc = norm(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`).test(text);
};

function matchSession(w, ids, p) {
  const name = norm(w.name);
  if (name) {
    for (const [sid, s] of Object.entries(p.sessions)) {
      if (s.routineNames.some((r) => hasPhrase(name, r)))
        return { sessionId: sid, matchedBy: "routineName" };
    }
  }
  // fallback: the session that owns the largest share of the logged exercises
  let best = { sid: "unplanned", score: 0 };
  for (const [sid, s] of Object.entries(p.sessions)) {
    const hit = ids.filter((id) => s.exercises.includes(id)).length;
    const score =
      hit /
      Math.max(1, s.exercises.filter((e) => !p.exercises[e].optional).length);
    if (score > best.score) best = { sid, score };
  }
  return best.score >= 0.5
    ? { sessionId: best.sid, matchedBy: "overlap" }
    : { sessionId: "unplanned", matchedBy: "none" };
}

// Map a workout's logged exercises to program slots, in passes:
// 1. name/alias -> a slot of this session; 2. catalog mainMuscle -> the next
// unfilled slot of this session with that muscle ("substituted"); 3. name/alias
// -> a slot of another session ("moved", e.g. abductor done on Push A instead
// of Pull A). Anything left is an extra. Muscle matching stays within the
// session so add-on work never feeds another day's progression.
function mapExercises(exs, sessionId, p, idx, muscleOf) {
  const slots = p.sessions[sessionId]?.exercises ?? [];
  const filled = new Set();
  const res = exs.map(() => null);
  const pass = (how, pick) =>
    exs.forEach((ex, i) => {
      if (res[i]) return;
      const id = pick(ex);
      if (id && !filled.has(id)) {
        res[i] = { exId: id, ex, how };
        filled.add(id);
      }
    });
  pass("name", (ex) => {
    const id = idx.get(norm(ex.exerciseName));
    return slots.includes(id) ? id : null;
  });
  pass("muscle", (ex) => {
    const m = muscleOf(ex.exerciseName);
    if (!m) return null;
    return slots.find(
      (id) =>
        !filled.has(id) &&
        (p.exercises[id].mainMuscles || []).some((x) => norm(x) === m),
    );
  });
  pass("moved", (ex) => idx.get(norm(ex.exerciseName)));
  return {
    mapped: res.filter(Boolean),
    extras: exs.filter((_, i) => !res[i]).map((ex) => ex.exerciseName),
  };
}

function normalise(data, p, asOf) {
  const idx = buildNameIndex(p);
  // logged exercise name -> catalog mainMuscle (both normalised)
  const muscles = new Map();
  for (const e of data.exercises || [])
    if (e?.name && e.mainMuscle) muscles.set(norm(e.name), norm(e.mainMuscle));
  const muscleOf = (name) => muscles.get(norm(name));
  const start = toDay(p.startDate),
    end = toDay(asOf);
  const deloadRe = new RegExp(p.noteFlags.deload ?? "deload", "i");
  return (data.workouts || [])
    .filter((w) => w.date && toDay(w.date) >= start && toDay(w.date) <= end)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        String(a.id).localeCompare(String(b.id)),
    )
    .map((w) => {
      const exs = w.exercises || [];
      const byName = exs
        .map((ex) => idx.get(norm(ex.exerciseName)))
        .filter(Boolean);
      const { sessionId, matchedBy } = matchSession(w, byName, p);
      const { mapped, extras } = mapExercises(exs, sessionId, p, idx, muscleOf);
      const deloadNotes = exs.filter((e) =>
        deloadRe.test(e.feedback ?? ""),
      ).length;
      const deload =
        deloadRe.test(w.name ?? "") ||
        (exs.length > 0 && deloadNotes >= exs.length / 2);
      return { w, exs, sessionId, matchedBy, deload, mapped, extras };
    });
}

// Saved workouts carry a date but no time, and ids are random, so two
// sessions on one day (e.g. Pull A + Push B) have no recorded order. Order each
// same-day group to continue the session order from the previous workout;
// unplanned workouts go last.
function orderSameDay(ws, p) {
  const n = p.sessionOrder.length;
  const out = [];
  let lastPos = -1;
  for (let i = 0; i < ws.length; ) {
    let j = i;
    while (j < ws.length && ws[j].w.date === ws[i].w.date) j++;
    const day = ws.slice(i, j);
    const dist = (nw) => {
      const pos = p.sessionOrder.indexOf(nw.sessionId);
      return pos === -1 ? Infinity : (pos - lastPos - 1 + n) % n;
    };
    day.sort((a, b) => dist(a) - dist(b));
    for (const nw of day) {
      const pos = p.sessionOrder.indexOf(nw.sessionId);
      if (pos !== -1) lastPos = pos;
      out.push(nw);
    }
    i = j;
  }
  return out;
}

/* ── step 2: rotations ── */

// A new rotation starts whenever the session order wraps (e.g. Pull B -> Push
// A), so a skipped session doesn't shift later rotations.
function assignRotations(ws, p) {
  const rot = new Map();
  let r = 0,
    lastPos = Infinity;
  for (const nw of ws) {
    const pos = p.sessionOrder.indexOf(nw.sessionId);
    if (pos === -1) {
      rot.set(nw.w.id, Math.max(r, 1));
      continue;
    }
    if (pos <= lastPos) r++;
    lastPos = pos;
    rot.set(nw.w.id, r);
  }
  return rot;
}

/* ── step 3: per-exercise decisions ── */

function buildPrescription(ex, w, target, extra = {}) {
  // null weight = not known yet (no recent history): the lifter picks it
  const kg = (x) => (x == null ? null : fix(x));
  const sets =
    ex.scheme === "top_backoff"
      ? [
          { set: 1, weight: kg(w.top), reps: 0, targetReps: target[0] },
          ...(extra.skipBackoff
            ? []
            : [
                {
                  set: 2,
                  weight: kg(w.backoff),
                  reps: 0,
                  targetReps: target[1],
                },
              ]),
        ]
      : [
          { set: 1, weight: kg(w.weight), reps: 0, targetReps: target[0] },
          { set: 2, weight: kg(w.weight), reps: 0, targetReps: target[1] },
        ];
  return {
    ...(ex.scheme === "top_backoff"
      ? { top: kg(w.top), backoff: kg(w.backoff) }
      : { weight: kg(w.weight) }),
    repRange: ex.reps,
    rpe: ex.rpe,
    routineSets: sets,
    ...extra,
  };
}

// Best recent set of this exercise from any workout (before the program too),
// matched by name/alias: { e1rm, weight, reps, date, weeksAgo } or null. Looks
// at the last SEED_WINDOW_DAYS; with nothing there, falls back to the most
// recent session of it ever (weeksAgo says how stale). Bodyweight-mode lifts
// log added weight, so for them the heaviest added weight that reached the
// bottom of the rep range is kept instead of an e1RM.
const SEED_WINDOW_DAYS = 56;
const SEED_MAX_REPS = 20; // Epley drifts past this; high-rep ranges go to 20
function seedFromHistory(exId, data, p, asOf, idx) {
  const ex = p.exercises[exId];
  const to = toDay(asOf);
  const sets = [];
  for (const w of data.workouts || []) {
    if (!w.date || toDay(w.date) > to) continue;
    for (const we of w.exercises || []) {
      if (idx.get(norm(we.exerciseName)) !== exId) continue;
      for (const s of we.sets || []) {
        const reps = Math.floor(num(s.reps));
        const weight = num(s.weight);
        if (reps < 1 || reps > SEED_MAX_REPS) continue;
        if (ex.backoffMode === "bodyweight" ? reps < ex.reps[0] : weight <= 0)
          continue;
        sets.push({ weight, reps, date: w.date, day: toDay(w.date) });
      }
    }
  }
  if (!sets.length) return null;
  const recent = sets.filter((s) => s.day >= to - SEED_WINDOW_DAYS);
  const lastDay = Math.max(...sets.map((s) => s.day));
  const pool = recent.length ? recent : sets.filter((s) => s.day === lastDay);
  const score = (s) =>
    ex.backoffMode === "bodyweight" ? s.weight : epley(s.weight, s.reps);
  const best = pool.reduce((a, s) => (score(s) > score(a) ? s : a));
  return {
    e1rm: ex.backoffMode === "bodyweight" ? null : score(best),
    weight: best.weight,
    reps: best.reps,
    date: best.date,
    weeksAgo: Math.floor((to - best.day) / 7),
  };
}

// Start prescription for an exercise with no in-program sessions. With a
// recent best set: the weight for the first target reps at the low end of the
// RPE target (reps + reps in reserve as a rep max, from the e1RM), minus
// seedSafetyPct, floored to the step. Without one: weights are left null.
function startPrescription(ex, th, seed) {
  const lo = ex.reps[0];
  const rpeLow = ex.scheme === "top_backoff" ? ex.rpe.top[0] : ex.rpe.set1;
  const repMax = lo + Math.max(0, 10 - rpeLow);
  let w = null;
  if (seed && ex.backoffMode === "bodyweight") w = seed.weight;
  else if (seed) {
    const est = floorTo(
      (seed.e1rm / (1 + repMax / 30)) * (1 - th.seedSafetyPct),
      ex.step,
    );
    w = est > 0 ? est : null;
  }
  if (ex.scheme === "top_backoff") {
    const backoff =
      ex.backoffMode === "bodyweight"
        ? 0
        : w == null
          ? null
          : roundTo(w * th.backoffPct, ex.step);
    return buildPrescription(ex, { top: w, backoff }, [lo, lo + 2]);
  }
  return buildPrescription(ex, { weight: w }, [lo, lo]);
}

function startReason(seed, ex) {
  if (!seed)
    return `No recent history. Pick a weight for ${ex.reps[0]} reps at the target RPE.`;
  const set = `${seed.weight === 0 ? "BW" : seed.weight}×${seed.reps}`;
  return seed.weeksAgo * 7 > SEED_WINDOW_DAYS
    ? `Estimated from your last session of it (${set} on ${seed.date}, ${seed.weeksAgo} weeks ago).`
    : `Estimated from your best recent set (${set} on ${seed.date}).`;
}

// Did this exposure beat the previous one? Weight up, or same weight with more reps.
function compareToPrev(cur, prev, ex) {
  if (!prev || !cur.top || !prev.top)
    return { progressed: null, weightDropped: false };
  const cw = cur.top.weight,
    pw = prev.top.weight;
  if (cw < pw) return { progressed: false, weightDropped: true };
  if (cw > pw) return { progressed: true, weightDropped: false };
  const reps = (e) =>
    ex.scheme === "top_backoff"
      ? e.top.reps
      : e.working.reduce((a, s) => a + s.reps, 0);
  return { progressed: reps(cur) > reps(prev), weightDropped: false };
}

function baseDecision(e, ex, th) {
  const [lo, hi] = ex.reps;
  const flags = [];
  const reasons = [];

  if (ex.scheme === "top_backoff") {
    const top = e.top;
    const [rLo, rHi] = ex.rpe.top;
    const rpe = e.rpe;
    if (!e.backoff)
      flags.push({
        code: "NO_BACKOFF",
        severity: "info",
        message: "No back-off set logged.",
      });
    else if (ex.backoffMode !== "bodyweight" && top.weight > 0) {
      const pct = e.backoff.weight / top.weight;
      if (pct < th.backoffTolerance[0] || pct > th.backoffTolerance[1])
        flags.push({
          code: "BACKOFF_PCT",
          severity: "info",
          message: `Back-off at ${Math.round(pct * 100)}% of top set (target ${Math.round(th.backoffPct * 100)}%).`,
        });
    }
    if (rpe != null && rpe > rHi + th.rpeOvershoot)
      flags.push({
        code: "RPE_OVER",
        severity: "warn",
        message: `Top set RPE ${rpe}, target ${rLo}–${rHi}.`,
      });
    if (rpe != null && rpe < rLo - th.rpeUndershoot)
      flags.push({
        code: "RPE_UNDER",
        severity: "info",
        message: `Top set RPE ${rpe}, target ${rLo}–${rHi}. Push closer next time.`,
      });

    if (top.reps >= hi && (rpe == null || rpe <= rHi)) {
      reasons.push(
        `Top set ${top.weight}×${top.reps} hit the top of ${lo}–${hi}.`,
      );
      return { decision: "ADD", reasons, flags };
    }
    if (top.reps >= hi) {
      reasons.push(
        `Reps there but RPE ${rpe} is above ${rHi}. Own it before adding.`,
      );
      return { decision: "HOLD", reasons, flags };
    }
    if (top.reps < lo && (rpe == null || rpe >= 10)) {
      reasons.push(
        `Top set ${top.reps} reps, under ${lo} at max effort. Weight too heavy.`,
      );
      return { decision: "REDUCE", reasons, flags };
    }
    if (top.reps < lo) {
      flags.push({
        code: "UNDER_RANGE",
        severity: "info",
        message: `Top set under ${lo} reps at RPE ${rpe}.`,
      });
      reasons.push(
        `Top set ${top.weight}×${top.reps}, under ${lo} but not at failure. Hold and aim for ${lo}+.`,
      );
      return { decision: "HOLD", reasons, flags };
    }
    reasons.push(
      `Top set ${top.weight}×${top.reps}, inside ${lo}–${hi}. Add reps.`,
    );
    return { decision: "HOLD", reasons, flags };
  }

  // double progression
  const s = e.working;
  const target2 = ex.rpe.set2;
  const capped = target2 < 10;
  if (s.length < 2)
    flags.push({
      code: "SET_COUNT",
      severity: "info",
      message: `${s.length} working set logged, plan is 2.`,
    });
  if (e.rpe != null && capped && e.rpe > target2 + th.rpeOvershoot)
    flags.push({
      code: "RPE_CAP",
      severity: "warn",
      message: `RPE ${e.rpe} above the cap of ${target2} for this exercise.`,
    });
  if (e.rpe != null && !capped && e.rpe < 9)
    flags.push({
      code: "RPE_UNDER",
      severity: "info",
      message: `Last set RPE ${e.rpe}. This one goes to failure.`,
    });

  if (
    s.length >= 2 &&
    s.every((x) => x.reps >= hi) &&
    (e.rpe == null || !capped || e.rpe <= target2)
  ) {
    reasons.push(
      `Both sets at ${hi}+ reps (${s.map((x) => x.reps).join(", ")}).`,
    );
    return { decision: "ADD", reasons, flags };
  }
  if (s[0] && s[0].reps < lo) {
    reasons.push(`Set 1 at ${s[0].reps} reps, under ${lo}. Weight too heavy.`);
    return { decision: "REDUCE", reasons, flags };
  }
  reasons.push(
    `Reps ${s.map((x) => x.reps).join(", ")} at ${s[0]?.weight} kg. Add reps until both sets reach ${hi}.`,
  );
  return { decision: "HOLD", reasons, flags };
}

function nextTargets(e, ex, d) {
  const [lo, hi] = ex.reps;
  const cap = (n) => Math.min(hi, Math.max(lo, n));
  if (ex.scheme === "top_backoff") {
    const t =
      d === "ADD"
        ? lo
        : d === "HOLD"
          ? cap(e.top.reps + 1)
          : cap(e.top.reps + 2);
    const b = e.backoff
      ? d === "HOLD"
        ? e.backoff.reps + 1
        : e.backoff.reps
      : t + 2;
    return [t, b];
  }
  return [0, 1].map((i) => {
    const r = e.working[i]?.reps ?? lo;
    return d === "ADD" ? lo : d === "HOLD" ? cap(r + 1) : cap(r + 2);
  });
}

function reviewExercise(exId, exps, p, seed) {
  const ex = p.exercises[exId],
    th = p.thresholds;
  const st = {
    prev: undefined,
    stallCount: 0,
    resets: 0,
    prevShoulderPain: false,
    swapUntilRotation: 0,
    next: startPrescription(ex, th, seed),
  };
  const history = [];
  let lastDecision = "START",
    lastReasons = [startReason(seed, ex)],
    lastFlags = [];
  let confidence = "high";

  for (const e of exps) {
    if (e.deload) {
      history.push({
        date: e.date,
        rotation: e.rotation,
        decision: "DELOAD_DONE",
        reasons: ["Deload exposure. Not counted for progression."],
        flags: [],
        progressed: null,
        stallCount: st.stallCount,
        regressed: false,
      });
      lastDecision = "DELOAD_DONE";
      lastReasons = [
        "Last exposure was a deload. Return to the pre-deload prescription.",
      ];
      lastFlags = [];
      continue;
    }
    if (!e.top) continue;

    // a different logged exercise in this slot restarts the comparison:
    // 20 kg dumbbells vs a 45 kg barbell says nothing about progress
    const switched =
      !!st.prev && norm(st.prev.loggedName) !== norm(e.loggedName);
    if (switched) st.stallCount = 0;
    const cmp = switched
      ? { progressed: null, weightDropped: false }
      : compareToPrev(e, st.prev, ex);
    if (cmp.progressed === true || cmp.weightDropped) st.stallCount = 0;
    else if (cmp.progressed === false) st.stallCount++;

    const regressed =
      !switched &&
      !!st.prev?.top &&
      e.top.weight >= st.prev.top.weight &&
      e.e1rm < st.prev.e1rm * (1 - th.regressPct);
    const base = baseDecision(e, ex, th);
    // a missing back-off is expected when the previous review said to skip it
    const flags = base.flags.filter(
      (f) => !(f.code === "NO_BACKOFF" && st.next.skipBackoff),
    );
    const reasons = [...base.reasons];
    let decision = base.decision;
    let dropTo;
    let swapTo;
    let skipBackoff = false;

    const has = (f) => e.noteFlags.includes(f);
    const blockAdd = (why) => {
      if (decision === "ADD") {
        decision = "HOLD";
        reasons.push(why);
      }
    };

    if (switched)
      flags.push({
        code: "SWITCHED",
        severity: "info",
        message: `Switched from ${st.prev.loggedName} to ${e.loggedName}. Progression restarts from this session.`,
      });
    if (e.partialReps)
      flags.push({
        code: "PARTIAL_REPS",
        severity: "info",
        message: `${e.partialReps} set(s) with a bad-form rep (x.5).`,
      });
    if (e.extraSets)
      flags.push({
        code: "EXTRA_SETS",
        severity: "info",
        message: `${e.extraSets} extra set(s) beyond the plan.`,
      });
    if (has("myo"))
      flags.push({
        code: "MYO",
        severity: "info",
        message: "Myo-reps noted. Set count rules relaxed.",
      });
    if (has("cutShort"))
      flags.push({
        code: "CUT_SHORT",
        severity: "info",
        message: "Session cut short.",
      });
    if (regressed)
      flags.push({
        code: "REGRESSED",
        severity: "warn",
        message: `Performance dropped over ${Math.round(th.regressPct * 100)}% at the same or higher weight.`,
      });
    confidence = e.rpe == null ? "low" : "high";

    // safety overrides (highest priority first)
    if (has("shoulder") && ex.rules.includes("shoulder")) {
      if (st.prevShoulderPain && ex.alt) {
        decision = "SWAP";
        swapTo = ex.alt;
        st.swapUntilRotation = e.rotation + th.swapRotations;
        flags.push({
          code: "SHOULDER_PAIN",
          severity: "alert",
          message: `Shoulder pain two sessions in a row. Swap to ${ex.alt} for ${th.swapRotations} rotations.`,
        });
      } else {
        decision = "REDUCE";
        dropTo = Math.max(0, e.top.weight - th.shoulderDropKg);
        flags.push({
          code: "SHOULDER_PAIN",
          severity: "alert",
          message: `Shoulder pain noted. Drop ${th.shoulderDropKg} kg next time.`,
        });
      }
    } else if (
      has("shoulder") ||
      has("elbow") ||
      has("wrist") ||
      has("knee") ||
      (has("pain") && !has("lowerBack"))
    ) {
      blockAdd("Pain noted. Hold the weight.");
      flags.push({
        code: "PAIN",
        severity: "alert",
        message: `Pain noted: "${e.note}". Hold weight; swap the exercise for the day if it repeats.`,
      });
    }
    if (has("lowerBack")) {
      blockAdd("Lower back flagged. No increase.");
      if (ex.rules.includes("lowerBack") && ex.scheme === "top_backoff")
        skipBackoff = true;
      flags.push({
        code: "LOWER_BACK",
        severity: "alert",
        message:
          ex.scheme === "top_backoff"
            ? "Lower back flagged. Skip the back-off set next time."
            : "Lower back flagged. Stop the exercise if it tightens again.",
      });
    }
    if (has("fatigue")) {
      blockAdd("Fatigue noted. Hold.");
      flags.push({
        code: "FATIGUE",
        severity: "warn",
        message: `Fatigue noted: "${e.note}".`,
      });
    }
    if (has("form") || (ex.rules.includes("form") && e.partialReps > 0)) {
      blockAdd("Form broke. Hold until the reps are clean.");
      flags.push({
        code: "FORM",
        severity: "warn",
        message: "Form or cheating noted.",
      });
    }

    // stall handling (only if no safety override already lowered or swapped)
    if (
      st.stallCount >= th.stallExposures &&
      decision !== "SWAP" &&
      dropTo === undefined
    ) {
      if (st.resets >= th.resetsBeforeSwap) {
        decision = "SWAP";
        swapTo = ex.alt;
        reasons.push(
          `Stalled again after ${st.resets} resets. Swap the variation${ex.alt ? ` (${ex.alt})` : ""} or add a 3rd set.`,
        );
        st.resets = 0;
      } else {
        decision = "RESET";
        st.resets++;
        dropTo = floorTo(e.top.weight * (1 - th.resetPct), ex.step);
        reasons.push(
          `No progress for ${st.stallCount} exposures. Drop ${Math.round(th.resetPct * 100)}% and build back.`,
        );
      }
      st.stallCount = 0;
    }

    // next prescription
    let w = e.top.weight;
    if (decision === "ADD") w = w + ex.step;
    else if (decision === "REDUCE") w = dropTo ?? Math.max(0, w - ex.step);
    else if (decision === "RESET") w = dropTo;
    const targets = nextTargets(e, ex, decision);
    st.next =
      ex.scheme === "top_backoff"
        ? buildPrescription(
            ex,
            {
              top: w,
              backoff:
                ex.backoffMode === "bodyweight"
                  ? 0
                  : roundTo(w * th.backoffPct, ex.step),
            },
            targets,
            { skipBackoff, swapTo },
          )
        : buildPrescription(ex, { weight: w }, targets, { swapTo });

    st.prevShoulderPain = has("shoulder");
    st.prev = e;
    history.push({
      date: e.date,
      rotation: e.rotation,
      decision,
      reasons,
      flags,
      progressed: cmp.progressed,
      stallCount: st.stallCount,
      regressed,
    });
    lastDecision = decision;
    lastReasons = reasons;
    lastFlags = flags;
  }

  const lastReal = [...exps].reverse().find((e) => !e.deload);
  return {
    exId,
    name: ex.name,
    // the exercise actually logged in this slot, when it isn't the planned one
    loggedAs:
      lastReal && norm(lastReal.loggedName) !== norm(ex.name)
        ? lastReal.loggedName
        : null,
    session: ex.session,
    exposures: exps.filter((e) => !e.deload).length,
    last: exps[exps.length - 1],
    decision: lastDecision,
    reasons: lastReasons,
    flags: lastFlags,
    stallCount: st.stallCount,
    resets: st.resets,
    confidence: exps.length ? confidence : "high",
    next: st.next,
    history,
  };
}

/* ── step 4: program review ── */

export function reviewProgram(data, p, opts = {}) {
  const th = p.thresholds;
  const lastLogged =
    (data.workouts || [])
      .map((w) => w.date)
      .filter(Boolean)
      .sort()
      .pop() ?? p.startDate;
  const asOf = opts.asOf ?? lastLogged;
  const ws = orderSameDay(normalise(data, p, asOf), p);
  const rot = assignRotations(ws, p);

  // exposures
  const exps = Object.fromEntries(Object.keys(p.exercises).map((k) => [k, []]));
  for (const nw of ws) {
    for (const { exId, ex } of nw.mapped) {
      const cfg = p.exercises[exId];
      const x = extractWorking(ex.sets, cfg, th);
      if (!x.top) continue;
      const nf = noteFlags(ex.feedback ?? "", p);
      exps[exId].push({
        exId,
        date: nw.w.date,
        workoutId: nw.w.id,
        sessionId: nw.sessionId,
        rotation: rot.get(nw.w.id) ?? 0,
        deload: nw.deload || nf.includes("deload"),
        loggedName: ex.exerciseName,
        working: x.working,
        warmups: x.warmups,
        extraSets: x.extra,
        top: x.top,
        backoff: x.backoff,
        rpe: typeof ex.rpe === "number" ? ex.rpe : null,
        note: (ex.feedback ?? "").trim(),
        noteFlags: nf,
        partialReps: x.partialReps,
        e1rm: epley(x.top.weight, x.top.reps),
      });
    }
  }
  const nameIdx = buildNameIndex(p);
  const exercises = Object.keys(p.exercises).map((id) =>
    reviewExercise(
      id,
      exps[id],
      p,
      exps[id].length ? null : seedFromHistory(id, data, p, asOf, nameIdx),
    ),
  );

  // sessions. A slot counts as done if any workout of the same rotation
  // filled it, so an exercise moved to another day isn't reported missing.
  const doneInRotation = new Map();
  for (const nw of ws) {
    const r = rot.get(nw.w.id) ?? 0;
    if (!doneInRotation.has(r)) doneInRotation.set(r, new Set());
    for (const m of nw.mapped) doneInRotation.get(r).add(m.exId);
  }
  const lastOrder = p.sessionOrder[p.sessionOrder.length - 1];
  const latestRot = Math.max(0, ...rot.values());
  const latestOpen = !ws.some(
    (nw) => rot.get(nw.w.id) === latestRot && nw.sessionId === lastOrder,
  );
  const sessions = ws.map((nw) => {
    const s = p.sessions[nw.sessionId];
    const r = rot.get(nw.w.id) ?? 0;
    const done = doneInRotation.get(r) ?? new Set();
    const missing = s
      ? s.exercises
          .filter((id) => !p.exercises[id].optional && !done.has(id))
          .map((id) => p.exercises[id].name)
      : [];
    const pending = r === latestRot && latestOpen;
    const substituted = nw.mapped.filter((m) => m.how === "muscle");
    const moved = nw.mapped.filter((m) => m.how === "moved");
    let main = 0,
      opt = 0,
      rpeLogged = 0;
    for (const { exId, ex } of nw.mapped) {
      const n = extractWorking(ex.sets, p.exercises[exId], th).working.length;
      if (p.exercises[exId].optional) opt += n;
      else main += n;
      if (typeof ex.rpe === "number") rpeLogged++;
    }
    const extraSets = nw.exs
      .filter((e) => nw.extras.includes(e.exerciseName))
      .reduce(
        (a, e) => a + (e.sets || []).filter((x) => num(x.reps) > 0).length,
        0,
      );
    const flags = [];
    if (nw.sessionId === "unplanned")
      flags.push({
        code: "UNPLANNED",
        severity: "info",
        message:
          "Workout does not match a planned session. Excluded from rotation order.",
      });
    if (nw.matchedBy === "overlap")
      flags.push({
        code: "NAME_MISMATCH",
        severity: "info",
        message: `Matched by exercises. Put "${s?.routineNames[0]}" in the workout name for exact matching.`,
      });
    if (substituted.length)
      flags.push({
        code: "SUBSTITUTED",
        severity: "info",
        message: `Matched by muscle: ${substituted.map((m) => `${m.ex.exerciseName} → ${p.exercises[m.exId].name}`).join(", ")}.`,
      });
    if (moved.length)
      flags.push({
        code: "MOVED",
        severity: "info",
        message: `From another day: ${moved.map((m) => `${m.ex.exerciseName} (${p.sessions[p.exercises[m.exId].session].name})`).join(", ")}.`,
      });
    if (missing.length)
      flags.push(
        pending
          ? {
              code: "NOT_YET_DONE",
              severity: "info",
              message: `Not done yet this rotation: ${missing.join(", ")}.`,
            }
          : {
              code: "MISSING_EXERCISES",
              severity: "warn",
              message: `Skipped this rotation: ${missing.join(", ")}.`,
            },
      );
    if (main + extraSets > th.maxWorkingSets)
      flags.push({
        code: "VOLUME_HIGH",
        severity: "warn",
        message: `${main + extraSets} working sets, cap is ${th.maxWorkingSets} (${th.maxWorkingSetsWithOptional} with optional work).`,
      });
    if (main + opt + extraSets > th.maxWorkingSetsWithOptional)
      flags.push({
        code: "VOLUME_HIGH_TOTAL",
        severity: "warn",
        message: `${main + opt + extraSets} total sets including optional work.`,
      });
    if (nw.extras.length)
      flags.push({
        code: "EXTRA_EXERCISES",
        severity: "info",
        message: `Not in plan: ${nw.extras.join(", ")}.`,
      });
    return {
      workoutId: nw.w.id,
      date: nw.w.date,
      name: nw.w.name || "",
      sessionId: nw.sessionId,
      matchedBy: nw.matchedBy,
      rotation: rot.get(nw.w.id) ?? 0,
      deload: nw.deload,
      workingSets: main + extraSets,
      workingSetsOptional: opt,
      missing,
      extras: nw.extras,
      rpeLogged,
      rpeExpected: nw.mapped.length,
      flags,
    };
  });

  // rotations
  const rotNums = [
    ...new Set(
      sessions
        .filter((s) => s.sessionId !== "unplanned")
        .map((s) => s.rotation),
    ),
  ].sort((a, b) => a - b);
  const allExps = Object.values(exps).flat();
  const rotations = rotNums.map((r, i) => {
    const ss = sessions.filter(
      (s) => s.rotation === r && s.sessionId !== "unplanned",
    );
    const done = ss.map((s) => s.sessionId);
    const rotExps = allExps.filter((e) => e.rotation === r);
    const inRot = (x, h) =>
      rotExps.some((e) => e.exId === x.exId && e.date === h.date);
    const regressedCompounds = exercises
      .filter((x) => p.exercises[x.exId].compound)
      .filter((x) => x.history.some((h) => h.regressed && inRot(x, h)))
      .map((x) => x.name);
    const fatigueSignals =
      rotExps.filter((e) => e.noteFlags.includes("fatigue")).length +
      exercises.reduce(
        (a, x) =>
          a +
          x.history.filter(
            (h) =>
              inRot(x, h) &&
              h.flags.some(
                (f) => f.code === "RPE_OVER" || f.code === "RPE_CAP",
              ),
          ).length,
        0,
      );
    const directSetsByMuscle = {};
    for (const e of rotExps) {
      if (e.deload) continue;
      const m = p.exercises[e.exId].muscles[0];
      directSetsByMuscle[m] = (directSetsByMuscle[m] ?? 0) + e.working.length;
    }
    return {
      rotation: r,
      start: ss[0]?.date ?? "",
      end: ss[ss.length - 1]?.date ?? "",
      sessions: done,
      missingSessions: p.sessionOrder.filter((s) => !done.includes(s)),
      complete:
        i < rotNums.length - 1 ||
        done.includes(p.sessionOrder[p.sessionOrder.length - 1]),
      deload:
        ss.length > 0 && ss.filter((s) => s.deload).length >= ss.length / 2,
      regressedCompounds,
      fatigueSignals,
      directSetsByMuscle,
    };
  });

  // global: next session
  const planned = sessions.filter((s) => s.sessionId !== "unplanned");
  const last = planned[planned.length - 1];
  const nextIdx = last
    ? (p.sessionOrder.indexOf(last.sessionId) + 1) % p.sessionOrder.length
    : 0;
  const restDayFirst = !!last && p.restAfter.includes(last.sessionId);
  const nextSessionDate = last
    ? fromDay(toDay(last.date) + (restDayFirst ? 2 : 1))
    : p.startDate;

  // global: deload
  const completed = rotations.filter((r) => r.complete);
  const lastDeloadIdx = completed.map((r) => r.deload).lastIndexOf(true);
  const sinceDeload = completed.slice(lastDeloadIdx + 1).length;
  const deloadReasons = [];
  const upcomingIsNewRotation = nextIdx === 0;
  if (upcomingIsNewRotation && sinceDeload >= th.deloadEveryRotations - 1)
    deloadReasons.push(
      `Scheduled: rotation ${sinceDeload + 1} since the last deload.`,
    );
  const lastRot = rotations[rotations.length - 1];
  const deloadInProgress = !!lastRot && !lastRot.complete && lastRot.deload;
  if (deloadInProgress)
    deloadReasons.push("Deload rotation in progress. Finish it at RPE 7.");
  if (
    lastRot &&
    !lastRot.deload &&
    lastRot.regressedCompounds.length >= th.regressCompoundsForDeload
  )
    deloadReasons.push(
      `${lastRot.regressedCompounds.length} compounds regressed this rotation: ${lastRot.regressedCompounds.join(", ")}.`,
    );
  if (
    lastRot &&
    !lastRot.deload &&
    lastRot.fatigueSignals >= th.fatigueSignalsForEarlyDeload
  )
    deloadReasons.push(
      `${lastRot.fatigueSignals} fatigue or RPE-overshoot signals this rotation.`,
    );

  // global: chest frequency (rolling 7 days, full windows only)
  const chestDays = new Set();
  for (const nw of ws) {
    if (
      nw.mapped.some((m) =>
        p.exercises[m.exId].muscles.some((mu) => p.chestMuscles.includes(mu)),
      )
    )
      chestDays.add(toDay(nw.w.date));
  }
  const startD = toDay(p.startDate),
    lastD = ws.length ? toDay(ws[ws.length - 1].w.date) : startD;
  let minChest = null;
  const shortWindows = [];
  for (let d = startD + 6; d <= lastD; d++) {
    let n = 0;
    for (let k = d - 6; k <= d; k++) if (chestDays.has(k)) n++;
    minChest = minChest === null ? n : Math.min(minChest, n);
    if (n < th.chestMinPer7Days)
      shortWindows.push(`${fromDay(d - 6)} → ${fromDay(d)}: ${n}`);
  }

  // global: schedule
  const days = [...new Set(ws.map((nw) => toDay(nw.w.date)))].sort(
    (a, b) => a - b,
  );
  const longStreaks = [],
    longGaps = [];
  const endRun = (start, end) => {
    if (end - start + 1 > th.maxConsecutiveTrainingDays)
      longStreaks.push(
        `${fromDay(start)} → ${fromDay(end)} (${end - start + 1} days)`,
      );
  };
  let runStart = days[0],
    prev = days[0];
  for (let i = 1; i < days.length; i++) {
    const d = days[i];
    if (d === prev + 1) {
      prev = d;
      continue;
    }
    endRun(runStart, prev);
    if (d - prev - 1 > th.maxGapDays)
      longGaps.push(
        `${fromDay(prev)} → ${fromDay(d)} (${d - prev - 1} rest days)`,
      );
    runStart = d;
    prev = d;
  }
  if (days.length) endRun(runStart, prev);

  const gFlags = [];
  if (deloadReasons.length)
    gFlags.push({
      code: "DELOAD_DUE",
      severity: "warn",
      message: `${upcomingIsNewRotation || deloadInProgress ? "Deload now." : "Deload from the next Push A."} ${deloadReasons.join(" ")}`,
    });
  if (shortWindows.length)
    gFlags.push({
      code: "CHEST_FREQ",
      severity: "info",
      message: `${shortWindows.length} seven-day window(s) with fewer than ${th.chestMinPer7Days} chest days.`,
    });
  if (longStreaks.length)
    gFlags.push({
      code: "NO_REST",
      severity: "warn",
      message: `Trained more than ${th.maxConsecutiveTrainingDays} days in a row: ${longStreaks.join("; ")}.`,
    });
  if (longGaps.length)
    gFlags.push({
      code: "GAP",
      severity: "info",
      message: `Long breaks: ${longGaps.join("; ")}.`,
    });
  const sizeCheckDue =
    completed.length > 0 &&
    completed.length % th.sizeCheckEveryRotations === 0 &&
    upcomingIsNewRotation;
  if (sizeCheckDue)
    gFlags.push({
      code: "SIZE_CHECK",
      severity: "info",
      message:
        "Size check: if a muscle is not growing while lifts move, add a 3rd set to its isolation.",
    });

  return {
    programId: p.id,
    asOf,
    firstDate: ws[0]?.w.date,
    lastDate: ws[ws.length - 1]?.w.date,
    sessions,
    rotations,
    exercises,
    global: {
      nextSession: p.sessionOrder[nextIdx],
      nextSessionDate,
      restDayFirst,
      deload: {
        due: deloadReasons.length > 0,
        activeNow:
          deloadInProgress ||
          (deloadReasons.length > 0 && upcomingIsNewRotation),
        reasons: deloadReasons,
        rotationsSinceDeload: sinceDeload,
      },
      sizeCheckDue,
      // the latest rotation while it's still open: slots done so far
      openRotation: latestOpen
        ? {
            rotation: latestRot,
            done: [...(doneInRotation.get(latestRot) ?? [])],
            // slots done on another session's day: { exId, doneIn }
            swaps: ws
              .filter((nw) => rot.get(nw.w.id) === latestRot)
              .flatMap((nw) =>
                nw.mapped
                  .filter((m) => m.how === "moved")
                  .map((m) => ({ exId: m.exId, doneIn: nw.sessionId })),
              ),
          }
        : null,
      chest: { minPer7Days: minChest, shortWindows },
      schedule: { longStreaks, longGaps },
      flags: gFlags,
    },
  };
}

// Next-session card: the planned exercises for one session with their
// prescriptions, ready to prefill a routine.
export function nextSessionPlan(
  review,
  p,
  sessionId = review.global.nextSession,
) {
  const deload = review.global.deload.activeNow;
  const slots = p.sessions[sessionId].exercises;
  // Swaps inside an open rotation: a slot of this session already done on an
  // earlier day is marked doneEarlier, and the slot it displaced on that day
  // (still not done) is carried in: abductor on Push A -> adductor on Pull A.
  const open = review.global.openRotation;
  const done = new Set(open?.done ?? []);
  const carried = [];
  for (const sw of open?.swaps ?? []) {
    if (!slots.includes(sw.exId)) continue;
    const displaced = p.sessions[sw.doneIn]?.exercises.find(
      (id) =>
        !p.exercises[id].optional &&
        !done.has(id) &&
        !slots.includes(id) &&
        !carried.includes(id),
    );
    if (displaced) carried.push(displaced);
  }
  return {
    sessionId,
    name: p.sessions[sessionId].name,
    routineName: p.sessions[sessionId].routineNames[0],
    deload,
    exercises: [...slots, ...carried].map((id) => {
      const x = review.exercises.find((e) => e.exId === id);
      // deload: 1 set at the same weight, stop around 3 reps short of failure
      const sets = done.has(id)
        ? []
        : deload
          ? x.next.routineSets.slice(0, 1)
          : x.next.routineSets;
      return {
        exId: id,
        doneEarlier: done.has(id),
        carriedFrom: carried.includes(id)
          ? p.sessions[p.exercises[id].session].name
          : null,
        exerciseName: x.next.swapTo ?? x.loggedAs ?? x.name,
        slotName: x.name,
        optional: p.exercises[id].optional,
        decision: x.decision,
        sets,
        rpe: deload ? { note: "RPE 7" } : x.next.rpe,
        reasons: x.reasons,
        flags: x.flags,
      };
    }),
  };
}

// Cycle-by-cycle view: the review as it stood at the end of rotation n
// (asOf = its last session date), plus what happened inside that rotation.
// Returns null when rotation n doesn't exist.
export function reviewRotation(data, p, n) {
  const full = reviewProgram(data, p);
  const rotation = full.rotations.find((r) => r.rotation === n);
  if (!rotation) return null;
  const review = reviewProgram(data, p, { asOf: rotation.end });
  const sessions = review.sessions.filter((s) => s.rotation === n);
  const exercises = review.exercises.map((x) => ({
    ...x,
    step: [...x.history].reverse().find((h) => h.rotation === n) ?? null,
  }));
  return {
    rotation: review.rotations.find((r) => r.rotation === n),
    isLatest: n === full.rotations[full.rotations.length - 1].rotation,
    sessions,
    exercises,
    global: review.global,
    next: nextSessionPlan(review, p),
    asOf: review.asOf,
  };
}

// Rotation numbers that have at least one planned session, newest first.
export function loggedRotations(data, p) {
  return reviewProgram(data, p)
    .rotations.map((r) => ({
      rotation: r.rotation,
      start: r.start,
      end: r.end,
    }))
    .reverse();
}

// Rotation numbering for the Strength tab's per-cycle chart (see
// src/lib/cycleMuscleStats.js): rotations are assigned over the whole log, so
// filtering the chart to a date range doesn't renumber them.
export function rotationCycler(data, p) {
  const r = reviewProgram(data, p);
  const byWorkout = new Map(r.sessions.map((s) => [s.workoutId, s.rotation]));
  const ranges = new Map(r.rotations.map((x) => [x.rotation, x]));
  return {
    cycleOf: (w) => byWorkout.get(w.id) ?? null,
    range: (n) => ({
      start: ranges.get(n)?.start ?? "",
      end: ranges.get(n)?.end ?? "",
    }),
  };
}
