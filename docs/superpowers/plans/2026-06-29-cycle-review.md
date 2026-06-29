# Cycle Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `weekly-workout-review` Max 7/5/3 skill into the app as an offline, in-app **Cycle Review** feature under More, with a swappable program-config module, a deterministic analysis engine, templated prose, and a downloadable HTML one-pager.

**Architecture:** Three layers. (1) A single program-definition module (`src/lib/review/programs/max753.js`) holding all program-specific data. (2) A pure, framework-free analysis engine (`src/lib/review/*.js`) that consumes that config plus live `workouts`/`weightLogs` and emits one structured `ReviewResult`. (3) A React sub-screen (`CycleReview.jsx`) wired into `MoreMenu.jsx` that renders the result and offers an HTML download.

**Tech Stack:** Vite 5 + React 18 (plain JSX, no TypeScript), Tailwind (inline classes only), Vitest + React Testing Library. No new runtime dependencies.

## Global Constraints

- **No TypeScript, no CSS files, no new runtime libraries.** Tailwind classes inline only.
- **Weights are stored in kg.** Convert to display only at the render boundary with `toDisplayWeight`/`fromDisplayWeight` (`src/lib/units.js`). The engine works entirely in kg.
- **Never call `localStorage` directly** — use `loadLS`/`saveLS` from `src/lib/storage.js`. Body-weight logs live under the exported key `K_WEIGHT_LOGS` (`"weightLogs"`).
- **Destructive actions use `useConfirm()`** — N/A here (this feature only reads data; it never mutates workouts).
- **Testing policy:** every `src/lib/review/*.js` gets a co-located `*.test.js`; `CycleReview.jsx` gets `CycleReview.test.jsx`. Vitest globals (`describe`/`it`/`expect`/`vi`) are enabled — do **not** import them.
- **Program-specific data lives only in `programs/max753.js`.** Engine modules must never hardcode dates, bucket targets, exercise names, or increments — they read them from the passed `config`.
- Pre-push gate: `npm run check` (lint + format + tests + build) must pass.
- Spec of record: `docs/superpowers/specs/2026-06-29-cycle-review-design.md`.

---

## File Structure

New (all under `src/lib/review/` unless noted):
- `programs/max753.js` — the swappable `ProgramConfig` (data only).
- `match.js` — `normalizeName`, `matchesAny` (name matching helpers).
- `cycles.js` — cycle/phase date math.
- `patterns.js` — rep cleaning, pattern/status classification, bucket selection.
- `analyzeExercise.js` — history building + per-exercise analysis.
- `decide.js` — progression decision matrix + all modifiers.
- `tonnage.js` — per-cycle tonnage summaries + multi-cycle history + by-pattern.
- `bodyweight.js` — cycle bodyweight average + phase evaluation.
- `review.js` — orchestrator → `ReviewResult`.
- `narrative.js` — templated headline/wins/concerns/volume verdict.
- `onePager.js` — self-contained HTML one-pager string builder.
- `src/components/CycleReview.jsx` — the More sub-screen.

Modified:
- `src/components/MoreMenu.jsx` — add the Cycle Review sub-screen entry.
- `ARCHITECTURE.md`, `docs/DATA-MODEL.md` — document the feature (no new persisted keys).

Each engine module is a separate task because a reviewer could reject one classifier while accepting its neighbor. The component + wiring are split from the engine because they fail/pass independently.

---

## Task 1: Program config module + name matchers

**Files:**
- Create: `src/lib/review/programs/max753.js`
- Create: `src/lib/review/match.js`
- Test: `src/lib/review/match.test.js`, `src/lib/review/programs/max753.test.js`

**Interfaces:**
- Produces: `max753` (default + named export) — the `ProgramConfig` object (shape per spec).
- Produces: `normalizeName(name) -> string`, `matchesAny(name, list) -> boolean` (exact, case-insensitive, trimmed equality against any list entry).

- [ ] **Step 1: Write the failing tests**

`src/lib/review/match.test.js`:
```js
import { normalizeName, matchesAny } from "./match";

describe("normalizeName", () => {
  it("trims and lowercases", () => {
    expect(normalizeName("  Shoulder Press  ")).toBe("shoulder press");
  });
  it("handles null/undefined", () => {
    expect(normalizeName(null)).toBe("");
    expect(normalizeName(undefined)).toBe("");
  });
});

describe("matchesAny", () => {
  it("matches case-insensitively on exact normalized equality", () => {
    expect(matchesAny("Deadlift", ["deadlift", "sumo deadlift"])).toBe(true);
    expect(matchesAny("DEADLIFT", ["deadlift"])).toBe(true);
  });
  it("does not match on substring (RDL is not a deadlift)", () => {
    expect(matchesAny("Romanian Deadlift", ["deadlift"])).toBe(false);
  });
  it("is safe with empty/missing lists", () => {
    expect(matchesAny("x", undefined)).toBe(false);
    expect(matchesAny("x", [])).toBe(false);
  });
});
```

`src/lib/review/programs/max753.test.js`:
```js
import max753 from "./max753";

describe("max753 program config", () => {
  it("has core sections the engine relies on", () => {
    expect(max753.cycle.lengthDays).toBe(8);
    expect(max753.cycle.startDate).toBe("2026-04-27");
    expect(max753.buckets.map((b) => b.target)).toEqual([30, 50, 70]);
    expect(max753.special.deadlift.nSets).toBe(3);
    expect(max753.special.abs.repRangeMin).toBe(15);
    expect(max753.special.abs.repRangeMax).toBe(20);
  });
  it("has chronological, non-overlapping phases", () => {
    const ph = max753.phases;
    for (let i = 1; i < ph.length; i++) {
      expect(ph[i].from > ph[i - 1].to).toBe(true);
    }
  });
  it("declares fatigue feedback keywords that map to hold", () => {
    expect(max753.feedbackRules.fatigue.keywords).toEqual(
      expect.arrayContaining(["heavy", "tired"]),
    );
    expect(max753.feedbackRules.fatigue.action).toBe("hold");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/lib/review/match.test.js src/lib/review/programs/max753.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `match.js`**

```js
// src/lib/review/match.js
// Exercise-name matching helpers for the review engine. Identity is the
// (trimmed, lowercased) name — the same case-insensitive convention the rest of
// the app uses. Matching is EXACT equality against a list entry (not substring)
// so e.g. "Romanian Deadlift" never matches the "deadlift" special bucket.

export function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

export function matchesAny(name, list) {
  const n = normalizeName(name);
  if (!n) return false;
  return (list || []).some((m) => normalizeName(m) === n);
}
```

- [ ] **Step 4: Implement `programs/max753.js`**

```js
// src/lib/review/programs/max753.js
// Program definition for SmallGym "Max 7/5/3" (original 5-set, 30/50/70 system).
//
// THIS IS THE ONLY FILE TO CHANGE WHEN THE PROGRAM CHANGES. The review engine
// (src/lib/review/*) is program-agnostic and consumes this shape. To swap
// programs, replace this object (keep the same field names) and import the new
// one in src/components/CycleReview.jsx.
//
// All weights/increments are in kg (the app's storage invariant).

export const max753 = {
  id: "max753",
  name: "Max 7/5/3",

  // 8-day microcycle: 3 train / 1 rest / 3 train / 1 rest. Cycle 1 starts here.
  cycle: { startDate: "2026-04-27", lengthDays: 8, expectedSessions: 6 },

  // Chronological, non-overlapping calendar phases. bodyweight pcts are per cycle.
  phases: [
    {
      id: "cut",
      from: "2026-04-27",
      to: "2026-05-23",
      bias: "conservative",
      bodyweight: { minPct: -0.7, maxPct: -0.4 },
    },
    {
      id: "maintenance",
      from: "2026-05-24",
      to: "2026-05-31",
      bias: "hold",
      bodyweight: { minPct: -0.3, maxPct: 0.3 },
      excludeFromAnalysis: true,
    },
    {
      id: "lean-bulk",
      from: "2026-06-01",
      to: "2026-07-26",
      bias: "normal",
      bodyweight: { minPct: 0.25, maxPct: 0.5 },
    },
  ],

  // Standard rep-total buckets (5 sets). set5Floor = min final-set reps for a
  // "strong final set"; increment = default kg bump on PROGRESS.
  buckets: [
    { target: 30, set5Floor: 4, label: "compound", increment: 2.5 },
    { target: 50, set5Floor: 7, label: "mid", increment: 2.5 },
    { target: 70, set5Floor: 10, label: "isolation", increment: 1.25 },
  ],
  tolerance: 2, // +/- this many reps from target counts as HIT
  overshoot: 3, // OVER when total >= target + this
  deloadUndershoot: 7, // severe UNDER when total <= target - (this + 1)

  special: {
    // Deadlift = half-compound: 3 sets, total 15.
    deadlift: {
      names: [
        "deadlift",
        "barbell deadlift",
        "conventional deadlift",
        "sumo deadlift",
        "trap bar deadlift",
      ],
      nSets: 3,
      target: 15,
      set3Floor: 3,
      increment: 2.5,
    },
    // Abs = per-set rep-RANGE model: 3 sets, each 15-20 reps. No drop-off
    // pattern; progression is range-based (see decide.js decideAbs).
    abs: {
      names: [
        "hanging leg raise",
        "leg raise",
        "cable crunch",
        "ab crunch machine",
        "decline crunch",
      ],
      nSets: 3,
      repRangeMin: 15,
      repRangeMax: 20,
      increment: 2.5,
    },
  },

  // normalized exercise name -> movement pattern (for tonnage-by-pattern).
  movementPatterns: {
    "v squat": "quad",
    "back squat": "quad",
    "front squat": "quad",
    "leg press": "quad",
    "leg extension": "quad",
    "hack squat": "quad",
    deadlift: "hinge",
    "romanian deadlift": "hinge",
    rdl: "hinge",
    "glute raise": "hinge",
    "seated leg curl": "hamstring",
    "lying leg curl": "hamstring",
    "bench press barbell": "horizontal_push",
    "bench press dumbbell": "horizontal_push",
    "chest press": "horizontal_push",
    "incline smith": "horizontal_push",
    "incline dumbbell bench press": "horizontal_push",
    "chest fly machine": "horizontal_push",
    "shoulder press": "vertical_push",
    "overhead press": "vertical_push",
    "lateral raise dumbbell": "side_delt",
    "lateral raise cable": "side_delt",
    "cable lateral raise": "side_delt",
    "rear delt raise machine": "rear_delt",
    "reverse pec deck": "rear_delt",
    "pull up": "vertical_pull",
    "lat pulldown": "vertical_pull",
    "bent-over row barbell": "horizontal_pull",
    "seated row machine": "horizontal_pull",
    "row machine": "horizontal_pull",
    "preacher curl": "biceps",
    "bayesian cable curl": "biceps",
    "hammer curl": "biceps",
    "barbell curl": "biceps",
    "dumbbell curl": "biceps",
    "triceps pushdown": "triceps",
    "overhead extension cable": "triceps",
    skullcrusher: "triceps",
    "seated calf raise machine": "calves",
    "standing calf raise": "calves",
    "hanging leg raise": "abs",
    "leg raise": "abs",
    "cable crunch": "abs",
    "ab crunch machine": "abs",
    "decline crunch": "abs",
  },

  baselineExercises: {
    names: [
      "romanian deadlift",
      "rdl",
      "hammer curl",
      "incline dumbbell bench press",
    ],
    sessionsRequired: 3,
  },

  // Front-delt caution tiers. discomfort = what an injury-keyword feedback does.
  cautionExercises: {
    strict: {
      names: ["shoulder press", "overhead press"],
      overshootMin: 5,
      maxIncrement: 2.5,
      discomfort: "deload",
    },
    moderate: {
      names: [
        "incline smith",
        "incline bench press",
        "incline dumbbell bench press",
      ],
      maxIncrement: 2.5,
      irregular: "hold",
      discomfort: "hold",
    },
    light: {
      names: ["bench press barbell", "overhead extension cable"],
      discomfort: "downgrade",
    },
  },

  // ex.feedback free-text scan. injury -> caution-tier behavior; fatigue -> HOLD.
  feedbackRules: {
    injury: {
      keywords: ["shoulder", "pain", "discomfort", "tweak", "hurt"],
      action: "caution",
    },
    fatigue: { keywords: ["heavy", "tired"], action: "hold" },
  },

  // Session-name -> block, for the "By block" plan grouping.
  blocks: [
    { id: "A", label: "Block A", sessions: ["quads", "push", "pull"] },
    { id: "B", label: "Block B", sessions: ["hamstrings", "push", "pull"] },
  ],
};

export default max753;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- src/lib/review/match.test.js src/lib/review/programs/max753.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/review/match.js src/lib/review/match.test.js src/lib/review/programs/max753.js src/lib/review/programs/max753.test.js
git commit -m "feat(review): add Max 7/5/3 program config + name matchers"
```

---

## Task 2: Cycle/phase date math (`cycles.js`)

**Files:**
- Create: `src/lib/review/cycles.js`
- Test: `src/lib/review/cycles.test.js`

**Interfaces:**
- Consumes: a `config` with `cycle.{startDate,lengthDays}` and `phases[]`.
- Produces:
  - `parseYMD(str) -> Date|null`, `ymd(date) -> "YYYY-MM-DD"`
  - `cycleForDate(config, dateStr) -> number|null` (1-indexed; null if before start)
  - `cycleDates(config, n) -> { start, end }` (inclusive YMD strings)
  - `phaseForDate(config, dateStr) -> "pre-program"|phaseId|"post-program"|null`
  - `dayPhases(config, n) -> string[]` (length `lengthDays`)
  - `phaseForCycle(config, n) -> string` (majority days; ties → later phase)
  - `mostRecentCompletedCycle(config, workouts, today?) -> number|null`
  - `loggedCycles(config, workouts) -> number[]` (descending)

- [ ] **Step 1: Write the failing test**

`src/lib/review/cycles.test.js`:
```js
import max753 from "./programs/max753";
import {
  cycleForDate,
  cycleDates,
  phaseForDate,
  dayPhases,
  phaseForCycle,
  mostRecentCompletedCycle,
  loggedCycles,
} from "./cycles";

const wo = (date) => ({ id: date, date, name: date, exercises: [] });

describe("cycleForDate / cycleDates", () => {
  it("cycle 1 is the 8 days from the start date", () => {
    expect(cycleForDate(max753, "2026-04-27")).toBe(1);
    expect(cycleForDate(max753, "2026-05-04")).toBe(1);
    expect(cycleForDate(max753, "2026-05-05")).toBe(2);
    expect(cycleDates(max753, 1)).toEqual({ start: "2026-04-27", end: "2026-05-04" });
    expect(cycleDates(max753, 2)).toEqual({ start: "2026-05-05", end: "2026-05-12" });
  });
  it("returns null before program start", () => {
    expect(cycleForDate(max753, "2026-04-20")).toBeNull();
  });
});

describe("phaseForDate / phaseForCycle", () => {
  it("classifies dates into calendar phases", () => {
    expect(phaseForDate(max753, "2026-05-01")).toBe("cut");
    expect(phaseForDate(max753, "2026-05-26")).toBe("maintenance");
    expect(phaseForDate(max753, "2026-06-10")).toBe("lean-bulk");
    expect(phaseForDate(max753, "2026-08-01")).toBe("post-program");
    expect(phaseForDate(max753, "2026-04-20")).toBe("pre-program");
  });
  it("uses majority days for a cycle, later phase breaking ties", () => {
    // Cycle 4 = 18-25 May: 6 cut days + 2 maintenance -> cut
    expect(phaseForCycle(max753, 4)).toBe("cut");
    expect(dayPhases(max753, 4)).toHaveLength(8);
  });
});

describe("mostRecentCompletedCycle / loggedCycles", () => {
  const workouts = [wo("2026-05-06"), wo("2026-06-09"), wo("2026-06-10")];
  it("finds the latest cycle containing a session", () => {
    expect(mostRecentCompletedCycle(max753, workouts)).toBe(
      cycleForDate(max753, "2026-06-10"),
    );
  });
  it("lists logged cycles descending", () => {
    const cs = loggedCycles(max753, workouts);
    expect(cs[0]).toBeGreaterThan(cs[cs.length - 1]);
    expect(cs).toContain(cycleForDate(max753, "2026-05-06"));
  });
  it("returns null when there are no workouts", () => {
    expect(mostRecentCompletedCycle(max753, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/review/cycles.test.js`
Expected: FAIL — `cycles` not found.

- [ ] **Step 3: Implement `cycles.js`**

```js
// src/lib/review/cycles.js
// Cycle + phase date math for the review engine. A "cycle" is the program's
// microcycle (config.cycle.lengthDays); cycle 1 starts at config.cycle.startDate.
// Dates are "YYYY-MM-DD" strings; we parse to local-midnight Dates so day diffs
// are DST-safe, and rely on lexical ordering of zero-padded YMD for comparisons.

const MS_PER_DAY = 86400000;

export function parseYMD(str) {
  if (!str) return null;
  const [y, m, d] = String(str).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function cycleForDate(config, dateStr) {
  const start = parseYMD(config.cycle.startDate);
  const d = parseYMD(dateStr);
  if (!start || !d || d < start) return null;
  const days = Math.round((d - start) / MS_PER_DAY);
  return Math.floor(days / config.cycle.lengthDays) + 1;
}

export function cycleDates(config, n) {
  const start = parseYMD(config.cycle.startDate);
  const s = addDays(start, (n - 1) * config.cycle.lengthDays);
  const e = addDays(s, config.cycle.lengthDays - 1);
  return { start: ymd(s), end: ymd(e) };
}

export function phaseForDate(config, dateStr) {
  const d = parseYMD(dateStr);
  if (!d) return null;
  const start = parseYMD(config.cycle.startDate);
  if (start && d < start) return "pre-program";
  for (const ph of config.phases) {
    if (dateStr >= ph.from && dateStr <= ph.to) return ph.id;
  }
  return "post-program";
}

export function dayPhases(config, n) {
  const { start } = cycleDates(config, n);
  const s = parseYMD(start);
  const out = [];
  for (let i = 0; i < config.cycle.lengthDays; i++) {
    out.push(phaseForDate(config, ymd(addDays(s, i))));
  }
  return out;
}

const PHASE_ORDER = [
  "pre-program",
  "cut",
  "maintenance",
  "lean-bulk",
  "post-program",
];

export function phaseForCycle(config, n) {
  const counts = new Map();
  for (const p of dayPhases(config, n)) counts.set(p, (counts.get(p) || 0) + 1);
  let best = null;
  let bestCount = -1;
  let bestOrder = -1;
  for (const [p, c] of counts) {
    const order = PHASE_ORDER.indexOf(p);
    if (c > bestCount || (c === bestCount && order > bestOrder)) {
      best = p;
      bestCount = c;
      bestOrder = order;
    }
  }
  return best;
}

export function mostRecentCompletedCycle(config, workouts, today = null) {
  const dates = (workouts || []).map((w) => w.date).filter(Boolean);
  if (!dates.length) return null;
  const ref = today || dates.reduce((a, b) => (a > b ? a : b));
  let n = cycleForDate(config, ref);
  if (n == null) return null;
  while (n >= 1) {
    const { start, end } = cycleDates(config, n);
    if ((workouts || []).some((w) => w.date >= start && w.date <= end)) return n;
    n -= 1;
  }
  return null;
}

export function loggedCycles(config, workouts) {
  const set = new Set();
  for (const w of workouts || []) {
    const n = cycleForDate(config, w.date);
    if (n != null) set.add(n);
  }
  return [...set].sort((a, b) => b - a);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/review/cycles.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/cycles.js src/lib/review/cycles.test.js
git commit -m "feat(review): add cycle and phase date math"
```

---

## Task 3: Rep cleaning, pattern/status classification, bucket selection (`patterns.js`)

**Files:**
- Create: `src/lib/review/patterns.js`
- Test: `src/lib/review/patterns.test.js`

**Interfaces:**
- Consumes: `config` (buckets/tolerance/overshoot/deloadUndershoot/special), `matchesAny` from `./match`.
- Produces:
  - `cleanReps(reps) -> { cleaned: number[], nPartials: number }` (floors partials; counts non-integers)
  - `classifyPattern(reps, expectedNSets=5) -> "linear"|"flat"|"steep"|"irregular"|"incomplete"`
  - `classifyStatus(total, target, config) -> "HIT"|"OVER+N"|"UNDER-N"`
  - `closestTarget(total, config) -> number`
  - `isDeadlift(config, name) -> boolean`, `isAbs(config, name) -> boolean`
  - `bucketFor(config, name, total) -> { kind, target, expectedNSets, setFloor, increment, repRangeMin?, repRangeMax? }`

- [ ] **Step 1: Write the failing test**

`src/lib/review/patterns.test.js`:
```js
import max753 from "./programs/max753";
import {
  cleanReps,
  classifyPattern,
  classifyStatus,
  closestTarget,
  bucketFor,
  isDeadlift,
  isAbs,
} from "./patterns";

describe("cleanReps", () => {
  it("floors partials and counts them", () => {
    expect(cleanReps([8.5, 7, 6])).toEqual({ cleaned: [8, 7, 6], nPartials: 1 });
    expect(cleanReps([10, 10])).toEqual({ cleaned: [10, 10], nPartials: 0 });
  });
});

describe("classifyPattern (5-set)", () => {
  it("linear: steady ~1-2 rep drop", () => {
    expect(classifyPattern([18, 16, 14, 12, 10])).toBe("linear");
    expect(classifyPattern([8, 7, 6, 5, 4])).toBe("linear");
  });
  it("flat: barely drops", () => {
    expect(classifyPattern([8, 8, 8, 8, 7])).toBe("flat");
  });
  it("steep: big early drop", () => {
    expect(classifyPattern([8, 5, 4, 3, 2])).toBe("steep");
  });
  it("irregular: a later set exceeds an earlier one", () => {
    expect(classifyPattern([12, 10, 10, 8, 10])).toBe("irregular");
  });
  it("incomplete: fewer than expected sets", () => {
    expect(classifyPattern([11, 9, 7, 5])).toBe("incomplete");
  });
});

describe("classifyPattern (3-set deadlift thresholds)", () => {
  it("6/5/4 is linear, 8/4/3 is steep, 5/3/7 is irregular", () => {
    expect(classifyPattern([6, 5, 4], 3)).toBe("linear");
    expect(classifyPattern([8, 4, 3], 3)).toBe("steep");
    expect(classifyPattern([5, 3, 7], 3)).toBe("irregular");
  });
});

describe("classifyStatus", () => {
  it("classifies HIT / OVER / UNDER vs target", () => {
    expect(classifyStatus(31, 30, max753)).toBe("HIT");
    expect(classifyStatus(34, 30, max753)).toBe("OVER+4");
    expect(classifyStatus(26, 30, max753)).toBe("UNDER-4");
    expect(classifyStatus(20, 30, max753)).toBe("UNDER-10");
  });
});

describe("closestTarget / bucketFor", () => {
  it("picks the nearest standard bucket", () => {
    expect(closestTarget(48, max753)).toBe(50);
    expect(closestTarget(33, max753)).toBe(30);
  });
  it("routes deadlift to the 3-set/15 bucket", () => {
    expect(isDeadlift(max753, "Deadlift")).toBe(true);
    const b = bucketFor(max753, "Deadlift", 15);
    expect(b.kind).toBe("deadlift");
    expect(b.expectedNSets).toBe(3);
    expect(b.setFloor).toBe(3);
  });
  it("routes abs to the rep-range bucket", () => {
    expect(isAbs(max753, "Cable Crunch")).toBe(true);
    const b = bucketFor(max753, "Cable Crunch", 54);
    expect(b.kind).toBe("abs");
    expect(b.repRangeMin).toBe(15);
    expect(b.repRangeMax).toBe(20);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/review/patterns.test.js`
Expected: FAIL — `patterns` not found.

- [ ] **Step 3: Implement `patterns.js`**

```js
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
  const rangeDrop = reps[0] - reps[reps.length - 1];
  if (rangeDrop <= 1) return "flat";
  if (expectedNSets === 3) {
    if (maxDrop >= 3 || (rangeDrop > 5 && avgDrop > 2)) return "steep";
  } else if (maxDrop >= 4 || (rangeDrop > 8 && avgDrop > 2.5)) {
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/review/patterns.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/patterns.js src/lib/review/patterns.test.js
git commit -m "feat(review): add rep pattern/status classification and bucketing"
```

---

## Task 4: Per-exercise analysis + history (`analyzeExercise.js`)

**Files:**
- Create: `src/lib/review/analyzeExercise.js`
- Test: `src/lib/review/analyzeExercise.test.js`

**Interfaces:**
- Consumes: `config`; `cleanReps`/`classifyPattern`/`classifyStatus`/`bucketFor` from `./patterns`; `normalizeName`/`matchesAny` from `./match`.
- Produces:
  - `buildExerciseHistory(workouts) -> Map<normName, {date, sets, rpe, feedback}[]>` (each list sorted by date asc)
  - `findPriorSession(history, name, beforeDate) -> {date,sets,rpe,feedback}|null`
  - `analyzeExercise(config, ex, prior, history, dateStr) -> Analysis` with fields:
    `name, weight, weightConsistent, reps, rawReps, nPartials, nSets, expectedNSets, bucketKind, target, setFloor, increment, repRangeMin?, repRangeMax?, totalReps, status, pattern, weakFinal, priorComparison, sessionsToDate, isBaseline, movementPattern, rpe, feedback`
  - `priorComparison` shape: `{ date, weight, nSets, total, loadDelta, repDelta, flags: string[] } | null`

- [ ] **Step 1: Write the failing test**

`src/lib/review/analyzeExercise.test.js`:
```js
import max753 from "./programs/max753";
import {
  buildExerciseHistory,
  findPriorSession,
  analyzeExercise,
} from "./analyzeExercise";

const sets = (...reps) => reps.map((r, i) => ({ set: i + 1, weight: 40, reps: r }));

const workouts = [
  {
    id: "a",
    date: "2026-06-02",
    name: "Push",
    exercises: [{ exerciseName: "Bench Press Barbell", sets: sets(8, 7, 6, 5, 4) }],
  },
  {
    id: "b",
    date: "2026-06-10",
    name: "Push",
    exercises: [
      { exerciseName: "Bench Press Barbell", sets: sets(9, 8, 7, 6, 5), rpe: 8, feedback: "felt good" },
    ],
  },
];

describe("buildExerciseHistory / findPriorSession", () => {
  it("indexes sessions by normalized name, sorted ascending", () => {
    const h = buildExerciseHistory(workouts);
    expect(h.get("bench press barbell")).toHaveLength(2);
    const prior = findPriorSession(h, "Bench Press Barbell", "2026-06-10");
    expect(prior.date).toBe("2026-06-02");
  });
});

describe("analyzeExercise", () => {
  const h = buildExerciseHistory(workouts);
  it("computes bucket/status/pattern and prior comparison", () => {
    const ex = workouts[1].exercises[0];
    const prior = findPriorSession(h, ex.exerciseName, "2026-06-10");
    const a = analyzeExercise(max753, ex, prior, h, "2026-06-10");
    expect(a.totalReps).toBe(35);
    expect(a.target).toBe(30);
    expect(a.status).toBe("OVER+5");
    expect(a.pattern).toBe("linear");
    expect(a.rpe).toBe(8);
    expect(a.priorComparison.loadDelta).toBe(0);
    expect(a.priorComparison.repDelta).toBe(5);
  });
  it("flags baseline exercises below the session threshold", () => {
    const ex = { exerciseName: "Hammer Curl", sets: sets(20, 18, 16, 14, 12) };
    const h2 = buildExerciseHistory([{ id: "x", date: "2026-06-10", name: "Pull", exercises: [ex] }]);
    const a = analyzeExercise(max753, ex, null, h2, "2026-06-10");
    expect(a.isBaseline).toBe(true);
  });
  it("marks abs as the rep-range bucket with no pattern/status", () => {
    const ex = { exerciseName: "Cable Crunch", sets: sets(20, 18, 16) };
    const h2 = buildExerciseHistory([{ id: "x", date: "2026-06-10", name: "Push", exercises: [ex] }]);
    const a = analyzeExercise(max753, ex, null, h2, "2026-06-10");
    expect(a.bucketKind).toBe("abs");
    expect(a.status).toBeNull();
    expect(a.pattern).toBe("n/a");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/review/analyzeExercise.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `analyzeExercise.js`**

```js
// src/lib/review/analyzeExercise.js
// Builds per-exercise history and the per-session analysis object the decision
// matrix consumes. RPE is read from the structured ex.rpe field (the app stores
// one RPE per exercise) as the last-set proxy; ex.feedback is carried through
// for the feedback keyword rules in decide.js.

import { normalizeName, matchesAny } from "./match";
import {
  cleanReps,
  classifyPattern,
  classifyStatus,
  bucketFor,
} from "./patterns";

export function buildExerciseHistory(workouts) {
  const hist = new Map();
  for (const w of workouts || []) {
    for (const ex of w.exercises || []) {
      const key = normalizeName(ex.exerciseName);
      if (!key) continue;
      if (!hist.has(key)) hist.set(key, []);
      hist.get(key).push({
        date: w.date,
        sets: ex.sets || [],
        rpe: ex.rpe ?? null,
        feedback: ex.feedback || "",
      });
    }
  }
  for (const arr of hist.values()) {
    arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  return hist;
}

export function findPriorSession(history, name, beforeDate) {
  const arr = history.get(normalizeName(name)) || [];
  const prior = arr.filter((s) => s.date < beforeDate);
  return prior.length ? prior[prior.length - 1] : null;
}

export function analyzeExercise(config, ex, prior, history, dateStr) {
  const name = ex.exerciseName;
  const sets = ex.sets || [];
  const rawReps = sets.map((s) => Number(s.reps) || 0);
  const { cleaned: reps, nPartials } = cleanReps(rawReps);
  const weights = sets.map((s) => Number(s.weight) || 0);
  const weight = weights.length ? weights[0] : 0;
  const weightConsistent = weights.every((w) => w === weight);
  const totalReps = reps.reduce((a, b) => a + b, 0);

  const bucket = bucketFor(config, name, totalReps);
  const isAbsKind = bucket.kind === "abs";
  const status = isAbsKind
    ? null
    : classifyStatus(totalReps, bucket.target, config);
  const pattern = isAbsKind
    ? "n/a"
    : classifyPattern(reps, bucket.expectedNSets);
  const weakFinal =
    !isAbsKind &&
    reps.length >= bucket.expectedNSets &&
    reps[reps.length - 1] < bucket.setFloor;

  let priorComparison = null;
  if (prior) {
    const priorWeight = prior.sets.length ? Number(prior.sets[0].weight) || 0 : 0;
    const priorTotal = prior.sets.reduce(
      (acc, s) => acc + (Number(s.reps) || 0),
      0,
    );
    const flags = [];
    if (prior.date < config.cycle.startDate) flags.push("PRE-PROGRAM");
    if (prior.sets.length !== sets.length) {
      flags.push(`different-set-count(${prior.sets.length}vs${sets.length})`);
    }
    priorComparison = {
      date: prior.date,
      weight: priorWeight,
      nSets: prior.sets.length,
      total: priorTotal,
      loadDelta: weight - priorWeight,
      repDelta: totalReps - priorTotal,
      flags,
    };
  }

  const sessionsToDate = (history.get(normalizeName(name)) || []).filter(
    (s) => s.date <= dateStr,
  ).length;
  const isBaseline =
    matchesAny(name, config.baselineExercises?.names) &&
    sessionsToDate < config.baselineExercises.sessionsRequired;

  return {
    name,
    weight,
    weightConsistent,
    reps,
    rawReps,
    nPartials,
    nSets: sets.length,
    expectedNSets: bucket.expectedNSets,
    bucketKind: bucket.kind,
    target: bucket.target,
    setFloor: bucket.setFloor,
    increment: bucket.increment,
    repRangeMin: bucket.repRangeMin,
    repRangeMax: bucket.repRangeMax,
    totalReps,
    status,
    pattern,
    weakFinal,
    priorComparison,
    sessionsToDate,
    isBaseline,
    movementPattern:
      config.movementPatterns[normalizeName(name)] || "uncategorized",
    rpe: ex.rpe ?? null,
    feedback: ex.feedback || "",
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/review/analyzeExercise.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/analyzeExercise.js src/lib/review/analyzeExercise.test.js
git commit -m "feat(review): add per-exercise analysis and history indexing"
```

---

## Task 5: Progression decision matrix + modifiers (`decide.js`)

**Files:**
- Create: `src/lib/review/decide.js`
- Test: `src/lib/review/decide.test.js`

**Interfaces:**
- Consumes: `config`; an `Analysis` from Task 4; a `context = { phase, stallCount, isFirstBulkSession }`. `matchesAny` from `./match`.
- Produces: `decide(config, analysis, context={}) -> Decision` where
  `Decision = { action, newWeight, increment, reason, badgeLabel, flags: string[] }`
  and `action ∈ {"PROGRESS","HOLD","DELOAD","BASELINE","REP_BUMP"}`.
  - `newWeight` is in kg, rounded to 0.5. PROGRESS = weight+increment; DELOAD = round(weight*(1+pct)); HOLD/BASELINE/REP_BUMP = weight.
  - `badgeLabel`: PROGRESS → `+Xkg`; HOLD → `HOLD`; DELOAD → `DELOAD`; BASELINE → `BASELINE`; REP_BUMP → `+1 REP`.

**Decision precedence** (later steps override earlier): base matrix → phase modifier → caution override → RPE modifier → feedback rule → stall counter. BASELINE and INCOMPLETE and ABS short-circuit before the matrix. Conflicts resolve to the more conservative action (per spec).

- [ ] **Step 1: Write the failing test**

`src/lib/review/decide.test.js`:
```js
import max753 from "./programs/max753";
import { decide } from "./decide";

// Minimal analysis factory with sensible defaults.
const A = (over) => ({
  name: "Bench Press Barbell",
  weight: 40,
  reps: [],
  nSets: 5,
  expectedNSets: 5,
  bucketKind: "30-bucket",
  target: 30,
  setFloor: 4,
  increment: 2.5,
  totalReps: 30,
  status: "HIT",
  pattern: "linear",
  weakFinal: false,
  isBaseline: false,
  sessionsToDate: 5,
  rpe: null,
  feedback: "",
  ...over,
});

describe("base matrix", () => {
  it("OVER + linear -> PROGRESS", () => {
    const d = decide(max753, A({ status: "OVER+4", pattern: "linear" }), { phase: "lean-bulk" });
    expect(d.action).toBe("PROGRESS");
    expect(d.newWeight).toBe(42.5);
  });
  it("HIT + linear + strong final -> PROGRESS", () => {
    const d = decide(max753, A({ status: "HIT", pattern: "linear", weakFinal: false }), { phase: "lean-bulk" });
    expect(d.action).toBe("PROGRESS");
  });
  it("HIT + linear + weak final -> HOLD", () => {
    const d = decide(max753, A({ status: "HIT", pattern: "linear", weakFinal: true }), { phase: "lean-bulk" });
    expect(d.action).toBe("HOLD");
  });
  it("HIT + steep -> HOLD", () => {
    expect(decide(max753, A({ pattern: "steep" }), { phase: "lean-bulk" }).action).toBe("HOLD");
  });
  it("severe UNDER -> DELOAD", () => {
    const d = decide(max753, A({ status: "UNDER-10", pattern: "linear" }), { phase: "lean-bulk" });
    expect(d.action).toBe("DELOAD");
    expect(d.newWeight).toBe(36); // 40 * 0.90
  });
  it("UNDER -4 + linear -> HOLD; + steep -> DELOAD", () => {
    expect(decide(max753, A({ status: "UNDER-4", pattern: "linear" }), { phase: "lean-bulk" }).action).toBe("HOLD");
    expect(decide(max753, A({ status: "UNDER-4", pattern: "steep" }), { phase: "lean-bulk" }).action).toBe("DELOAD");
  });
});

describe("short-circuits", () => {
  it("baseline -> BASELINE, weight unchanged", () => {
    const d = decide(max753, A({ isBaseline: true }), { phase: "lean-bulk" });
    expect(d.action).toBe("BASELINE");
    expect(d.newWeight).toBe(40);
  });
  it("incomplete -> HOLD", () => {
    expect(decide(max753, A({ pattern: "incomplete" }), { phase: "lean-bulk" }).action).toBe("HOLD");
  });
});

describe("abs rep-range model", () => {
  const abs = (reps) => A({ name: "Cable Crunch", bucketKind: "abs", status: null, pattern: "n/a", reps, expectedNSets: 3, repRangeMin: 15, repRangeMax: 20, increment: 2.5 });
  it("all sets at top of range -> PROGRESS", () => {
    expect(decide(max753, abs([20, 20, 20]), { phase: "lean-bulk" }).action).toBe("PROGRESS");
  });
  it("in range -> HOLD", () => {
    expect(decide(max753, abs([18, 16, 15]), { phase: "lean-bulk" }).action).toBe("HOLD");
  });
  it("below range -> DELOAD", () => {
    expect(decide(max753, abs([14, 12, 10]), { phase: "lean-bulk" }).action).toBe("DELOAD");
  });
});

describe("phase modifier", () => {
  it("cut downgrades a HIT-based PROGRESS to HOLD", () => {
    const d = decide(max753, A({ status: "HIT", pattern: "linear", weakFinal: false }), { phase: "cut" });
    expect(d.action).toBe("HOLD");
  });
  it("cut keeps a clear OVER PROGRESS", () => {
    const d = decide(max753, A({ status: "OVER+4", pattern: "linear" }), { phase: "cut" });
    expect(d.action).toBe("PROGRESS");
  });
});

describe("front-delt caution", () => {
  it("shoulder press OVER+3 linear -> HOLD (needs OVER+5)", () => {
    const d = decide(max753, A({ name: "Shoulder Press", status: "OVER+3", pattern: "linear", target: 50, setFloor: 7, increment: 2.5 }), { phase: "lean-bulk" });
    expect(d.action).toBe("HOLD");
  });
  it("shoulder press OVER+5 linear strong final -> PROGRESS capped at 2.5", () => {
    const d = decide(max753, A({ name: "Shoulder Press", status: "OVER+5", pattern: "linear", weakFinal: false, target: 50, setFloor: 7, increment: 2.5 }), { phase: "lean-bulk" });
    expect(d.action).toBe("PROGRESS");
    expect(d.increment).toBe(2.5);
  });
});

describe("RPE modifier", () => {
  it("last-set RPE 10 caps PROGRESS at HOLD", () => {
    const d = decide(max753, A({ status: "OVER+4", pattern: "linear", rpe: 10 }), { phase: "lean-bulk" });
    expect(d.action).toBe("HOLD");
  });
  it("RPE 6 upgrades a HOLD to PROGRESS on an ambiguous (linear) hit", () => {
    const d = decide(max753, A({ status: "HIT", pattern: "linear", weakFinal: true, rpe: 6 }), { phase: "lean-bulk" });
    expect(d.action).toBe("PROGRESS");
  });
  it("RPE 6 does NOT upgrade a steep HOLD", () => {
    const d = decide(max753, A({ status: "HIT", pattern: "steep", rpe: 6 }), { phase: "lean-bulk" });
    expect(d.action).toBe("HOLD");
  });
});

describe("feedback rules", () => {
  it("'felt heavy' caps action at HOLD", () => {
    const d = decide(max753, A({ status: "OVER+4", pattern: "linear", feedback: "felt heavy today" }), { phase: "lean-bulk" });
    expect(d.action).toBe("HOLD");
  });
  it("'shoulder pain' on a strict-caution lift -> DELOAD", () => {
    const d = decide(max753, A({ name: "Shoulder Press", status: "HIT", pattern: "linear", feedback: "shoulder pain", target: 50, setFloor: 7 }), { phase: "lean-bulk" });
    expect(d.action).toBe("DELOAD");
  });
});

describe("stall counter", () => {
  it("3rd consecutive hold escalates to DELOAD", () => {
    const d = decide(max753, A({ status: "UNDER-4", pattern: "linear" }), { phase: "lean-bulk", stallCount: 2 });
    expect(d.action).toBe("DELOAD");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/review/decide.test.js`
Expected: FAIL — `decide` not found.

- [ ] **Step 3: Implement `decide.js`**

```js
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
    if ((rule.keywords || []).some((k) => fb.includes(String(k).toLowerCase()))) {
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
      return { action: "PROGRESS", increment: inc, reason: `overshot ${a.target} by ${num}, ${p} drop` };
    if (p === "steep")
      return { action: "HOLD", increment: inc, reason: "overshot but steep — investigate pacing" };
    return { action: "HOLD", increment: inc, reason: "overshot but irregular — check setup" };
  }
  if (isHit) {
    if (p === "linear")
      return a.weakFinal
        ? { action: "HOLD", increment: inc, reason: "hit target, weak final set — push +1 rep" }
        : { action: "PROGRESS", increment: inc, reason: `hit ${a.target}, strong final set` };
    if (p === "flat")
      return { action: "PROGRESS", increment: inc * 2, reason: `hit ${a.target} easily, flat — bigger step` };
    if (p === "steep")
      return { action: "HOLD", increment: inc, reason: "at ceiling for this bucket" };
    return { action: "HOLD", increment: inc, reason: "irregular pattern — flag" };
  }
  if (isUnder) {
    if (severeUnder)
      return { action: "DELOAD", increment: inc, deloadPct: -0.1, reason: `undershot ${a.target} by ${num} — rebuild` };
    if (p === "linear")
      return { action: "HOLD", increment: inc, reason: `undershot ${a.target} by ${num} — one more try` };
    return { action: "DELOAD", increment: inc, deloadPct: -0.075, reason: `undershot with ${p} pattern` };
  }
  return { action: "HOLD", increment: inc, reason: "hold" };
}

function decideAbs(config, a) {
  const allTop = a.reps.length >= a.expectedNSets && a.reps.every((r) => r >= a.repRangeMax);
  const anyBelow = a.reps.some((r) => r < a.repRangeMin);
  if (allTop)
    return finalize("PROGRESS", a.weight, a.increment, 0, `all sets at ${a.repRangeMax} — +${a.increment}kg`, ["abs"]);
  if (anyBelow)
    return finalize("DELOAD", a.weight, a.increment, -0.1, `below ${a.repRangeMin}-rep range — drop load`, ["abs"]);
  return finalize("HOLD", a.weight, a.increment, 0, `in ${a.repRangeMin}-${a.repRangeMax} range — push reps`, ["abs"]);
}

export function decide(config, a, context = {}) {
  const flags = [];

  // --- Short-circuits ---
  if (a.isBaseline) {
    const need = config.baselineExercises.sessionsRequired;
    return finalize("BASELINE", a.weight, a.increment, 0, `establish baseline (session ${a.sessionsToDate} of ${need})`, ["BASELINE"]);
  }
  if (a.pattern === "incomplete") {
    return finalize("HOLD", a.weight, a.increment, 0, "incomplete — fewer sets than expected", ["incomplete"]);
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

  // --- Phase modifier ---
  const phase = config.phases.find((ph) => ph.id === context.phase);
  if (context.isFirstBulkSession) {
    action = "HOLD";
    reason = "first bulk session — hold to recalibrate";
  } else if (phase?.bias === "conservative" && action === "PROGRESS" && a.status === "HIT") {
    action = "HOLD";
    reason = "cut — hold borderline progress";
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
      }
      if (a.pattern === "steep" || a.pattern === "irregular") {
        action = "HOLD";
        reason = "caution: non-linear on shoulder lift";
      }
    } else if (caution.tier === "moderate" && a.pattern === "irregular") {
      action = "HOLD";
      reason = "caution: irregular on incline";
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
    } else if (rpe <= 7 && action === "HOLD") {
      // Only upgrade when the pattern is load-ambiguous (linear/flat).
      if (a.pattern === "linear" || a.pattern === "flat") {
        action = "PROGRESS";
        increment = caution ? Math.min(a.increment, caution.maxIncrement ?? a.increment) : a.increment;
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
        action = "HOLD";
        reason = "feedback: discomfort — hold";
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/review/decide.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/decide.js src/lib/review/decide.test.js
git commit -m "feat(review): add progression decision matrix and modifiers"
```

---

## Task 6: Tonnage summaries + multi-cycle history (`tonnage.js`)

**Files:**
- Create: `src/lib/review/tonnage.js`
- Test: `src/lib/review/tonnage.test.js`

**Interfaces:**
- Consumes: `config`; `cleanReps`/`classifyPattern`/`isDeadlift`/`isAbs` from `./patterns`; `normalizeName` from `./match`; `cycleDates`/`parseYMD`/`ymd` from `./cycles`.
- Produces:
  - `weeklySummary(config, workouts) -> { tonnage, totalReps, nSessions, patternCounts, patternQualityPct, nPartialReps }`
  - `tonnageByPattern(config, workouts) -> { [movementPattern]: number }`
  - `collectHistory(config, workouts, cycleN, nWindows) -> Window[]` where each `Window = { label, cycle, start, end, windowDays, isInProgram, phase, tonnage, totalReps, nSessions, patternQualityPct, deltaPct|null }` (oldest first; deltaPct only between consecutive in-program cycles)

- [ ] **Step 1: Write the failing test**

`src/lib/review/tonnage.test.js`:
```js
import max753 from "./programs/max753";
import { weeklySummary, tonnageByPattern, collectHistory } from "./tonnage";

const ex = (name, ...reps) => ({ exerciseName: name, sets: reps.map((r, i) => ({ set: i + 1, weight: 100, reps: r })) });
const wo = (date, ...exercises) => ({ id: date, date, name: "S", exercises });

describe("weeklySummary", () => {
  it("sums tonnage and reps (flooring partials) and rates pattern quality", () => {
    const s = weeklySummary(max753, [wo("2026-06-09", ex("Leg Press", 13, 11, 10, 9, 7))]);
    expect(s.tonnage).toBe(100 * (13 + 11 + 10 + 9 + 7));
    expect(s.totalReps).toBe(50);
    expect(s.nSessions).toBe(1);
    expect(s.patternQualityPct).toBe(100); // one linear exercise
  });
});

describe("tonnageByPattern", () => {
  it("buckets tonnage by movement pattern", () => {
    const t = tonnageByPattern(max753, [wo("2026-06-09", ex("Leg Press", 10, 10, 10, 10, 10))]);
    expect(t.quad).toBe(100 * 50);
  });
});

describe("collectHistory", () => {
  it("returns nWindows windows oldest-first with deltas between cycles", () => {
    const workouts = [
      wo("2026-06-02", ex("Leg Press", 10, 10, 10, 10, 10)), // some cycle
      wo("2026-06-10", ex("Leg Press", 11, 11, 11, 11, 11)), // next cycle
    ];
    const target = 9; // arbitrary in-program cycle
    const wins = collectHistory(max753, workouts, target, 3);
    expect(wins).toHaveLength(3);
    expect(wins[0].cycle).toBe(target - 2);
    expect(wins[wins.length - 1].cycle).toBe(target);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/review/tonnage.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tonnage.js`**

```js
// src/lib/review/tonnage.js
// Per-cycle tonnage aggregates, movement-pattern tonnage, and the multi-cycle
// trend used by the volume section. Tonnage floors partial reps (a half-rep is
// bad-form effort, not a clean rep). Pattern quality = % of complete exercises
// with a linear or flat drop-off.

import { cleanReps, classifyPattern, isDeadlift, isAbs } from "./patterns";
import { normalizeName } from "./match";
import { cycleDates, parseYMD, ymd } from "./cycles";

function expectedSets(config, name) {
  if (isDeadlift(config, name)) return config.special.deadlift.nSets;
  if (isAbs(config, name)) return config.special.abs.nSets;
  return 5;
}

export function weeklySummary(config, workouts) {
  let tonnage = 0;
  let totalReps = 0;
  let nPartialReps = 0;
  let nComplete = 0;
  const patternCounts = { linear: 0, flat: 0, steep: 0, irregular: 0, incomplete: 0, "n/a": 0 };

  for (const w of workouts || []) {
    for (const exr of w.exercises || []) {
      const raw = (exr.sets || []).map((s) => Number(s.reps) || 0);
      const { cleaned, nPartials } = cleanReps(raw);
      nPartialReps += nPartials;
      for (const s of exr.sets || []) {
        const reps = Math.floor(Number(s.reps) || 0);
        tonnage += (Number(s.weight) || 0) * reps;
        totalReps += reps;
      }
      const pattern = isAbs(config, exr.exerciseName)
        ? "n/a"
        : classifyPattern(cleaned, expectedSets(config, exr.exerciseName));
      patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
      if (pattern !== "incomplete" && pattern !== "n/a") nComplete += 1;
    }
  }

  const good = patternCounts.linear + patternCounts.flat;
  const patternQualityPct = nComplete > 0 ? (good / nComplete) * 100 : null;
  return {
    tonnage,
    totalReps,
    nSessions: (workouts || []).length,
    patternCounts,
    patternQualityPct,
    nPartialReps,
  };
}

export function tonnageByPattern(config, workouts) {
  const out = {};
  for (const w of workouts || []) {
    for (const exr of w.exercises || []) {
      const mp = config.movementPatterns[normalizeName(exr.exerciseName)] || "uncategorized";
      for (const s of exr.sets || []) {
        out[mp] = (out[mp] || 0) + (Number(s.weight) || 0) * Math.floor(Number(s.reps) || 0);
      }
    }
  }
  return out;
}

function workoutsInRange(workouts, start, end) {
  return (workouts || []).filter((w) => w.date >= start && w.date <= end);
}

export function collectHistory(config, workouts, cycleN, nWindows) {
  const start0 = parseYMD(config.cycle.startDate);
  const windows = [];
  for (let offset = nWindows - 1; offset >= 0; offset--) {
    const n = cycleN - offset;
    let summary;
    let win;
    if (n >= 1) {
      const { start, end } = cycleDates(config, n);
      summary = weeklySummary(config, workoutsInRange(workouts, start, end));
      win = {
        label: `W${n}`,
        cycle: n,
        start,
        end,
        windowDays: config.cycle.lengthDays,
        isInProgram: true,
        phase: undefined, // filled by review.js if needed; not required for trend
      };
    } else {
      // Pre-program: a labeled 7-day window before the program start (context only).
      const isoOffset = 1 - n;
      const s = new Date(start0);
      s.setDate(s.getDate() - 7 * isoOffset);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      summary = weeklySummary(config, workoutsInRange(workouts, ymd(s), ymd(e)));
      win = {
        label: `${ymd(s)} (pre)`,
        cycle: null,
        start: ymd(s),
        end: ymd(e),
        windowDays: 7,
        isInProgram: false,
        phase: "pre-program",
      };
    }
    windows.push({ ...win, ...summary, deltaPct: null });
  }
  // Δton only between consecutive in-program cycles.
  let prevTon = null;
  for (const w of windows) {
    if (w.isInProgram) {
      if (prevTon != null && prevTon > 0) {
        w.deltaPct = ((w.tonnage - prevTon) / prevTon) * 100;
      }
      prevTon = w.tonnage;
    }
  }
  return windows;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/review/tonnage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/tonnage.js src/lib/review/tonnage.test.js
git commit -m "feat(review): add tonnage summaries and multi-cycle trend"
```

---

## Task 7: Bodyweight average + phase evaluation (`bodyweight.js`)

**Files:**
- Create: `src/lib/review/bodyweight.js`
- Test: `src/lib/review/bodyweight.test.js`

**Interfaces:**
- Consumes: `config`.
- Produces:
  - `cycleAverage(weightLogs, startStr, endStr) -> { avg: number|null, n: number }`
  - `evaluate(config, phaseId, deltaPct) -> string` (verdict text; `""` when not evaluable)

- [ ] **Step 1: Write the failing test**

`src/lib/review/bodyweight.test.js`:
```js
import max753 from "./programs/max753";
import { cycleAverage, evaluate } from "./bodyweight";

describe("cycleAverage", () => {
  const logs = { "2026-06-02": 70.0, "2026-06-05": 70.4, "2026-05-20": 71.0 };
  it("averages weigh-ins within the inclusive range", () => {
    const r = cycleAverage(logs, "2026-06-01", "2026-06-08");
    expect(r.n).toBe(2);
    expect(r.avg).toBeCloseTo(70.2, 5);
  });
  it("returns null when no weigh-ins fall in range", () => {
    expect(cycleAverage(logs, "2026-07-01", "2026-07-08")).toEqual({ avg: null, n: 0 });
  });
});

describe("evaluate", () => {
  it("cut on-target band", () => {
    expect(evaluate(max753, "cut", -0.5)).toMatch(/ON TARGET/);
  });
  it("cut too fast", () => {
    expect(evaluate(max753, "cut", -1.4)).toMatch(/TOO FAST/);
  });
  it("lean-bulk on-target band", () => {
    expect(evaluate(max753, "lean-bulk", 0.4)).toMatch(/ON TARGET/);
  });
  it("returns empty for unknown/missing data", () => {
    expect(evaluate(max753, "post-program", 0.2)).toBe("");
    expect(evaluate(max753, "cut", null)).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/review/bodyweight.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `bodyweight.js`**

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/review/bodyweight.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/bodyweight.js src/lib/review/bodyweight.test.js
git commit -m "feat(review): add bodyweight average and phase evaluation"
```

---

## Task 8: Review orchestrator (`review.js`)

**Files:**
- Create: `src/lib/review/review.js`
- Test: `src/lib/review/review.test.js`

**Interfaces:**
- Consumes: all prior engine modules + `narrative.js` (Task 9 — see note).
- Produces: `buildCycleReview(config, { workouts, weightLogs, exercises }, cycleNumber?) -> ReviewResult` (shape per spec). Default `cycleNumber` = `mostRecentCompletedCycle`.
- `stallCount` for an exercise = number of consecutive prior logged sessions whose top-set weight equals the current weight (deterministic proxy for consecutive HOLDs).
- `isFirstBulkSession`: true only for the first session, in the first lean-bulk-majority cycle, on/after the first lean-bulk calendar date.

> **Note on ordering:** This task imports `buildNarrative` from `narrative.js` (Task 9). Implement Task 9 first if executing strictly in order, OR stub `narrative` in this task's first commit and wire it in Task 9. Recommended: do Task 9 before Task 8. The plan lists 8 before 9 for readability; **execute 9, then 8.**

- [ ] **Step 1: Write the failing test**

`src/lib/review/review.test.js`:
```js
import max753 from "./programs/max753";
import { buildCycleReview } from "./review";

const sets = (w, ...reps) => reps.map((r, i) => ({ set: i + 1, weight: w, reps: r }));

// One Push session inside a known lean-bulk cycle (2026-06-09).
const data = {
  exercises: [],
  weightLogs: { "2026-06-02": 71.0, "2026-06-09": 71.3 },
  workouts: [
    {
      id: "p1",
      date: "2026-06-02",
      name: "Push",
      exercises: [{ exerciseName: "Bench Press Barbell", sets: sets(40, 8, 7, 6, 5, 4) }],
    },
    {
      id: "p2",
      date: "2026-06-09",
      name: "Push",
      exercises: [
        { exerciseName: "Bench Press Barbell", sets: sets(40, 9, 8, 7, 6, 5) },
        { exerciseName: "Triceps Pushdown", sets: sets(20, 18, 16, 14, 12, 10) },
      ],
    },
  ],
};

describe("buildCycleReview", () => {
  it("reviews the most recent cycle and emits structured sections", () => {
    const r = buildCycleReview(max753, data);
    // 2026-06-09 is the latest session; cycle 6 of the 8-day program.
    expect(r.cycle.number).toBe(6);
    expect(r.cycle.phase).toBe("lean-bulk");
    expect(r.sessions.length).toBeGreaterThan(0);
    expect(r.exercises.length).toBeGreaterThan(0);
    expect(r.plan.bySession.length).toBeGreaterThan(0);
    expect(r.plan.byBlock.length).toBeGreaterThan(0);
    expect(r.narrative.headline).toMatch(/Week/);
    expect(Array.isArray(r.warnings)).toBe(true);
  });

  it("produces a PROGRESS decision for the overshoot lift", () => {
    const r = buildCycleReview(max753, data, /* cycle of 2026-06-09 */ undefined);
    const bench = r.exercises.find((e) => e.name === "Bench Press Barbell" && e.date === "2026-06-09");
    expect(bench.decision.action).toBe("PROGRESS");
  });

  it("warns when the selected cycle has no sessions", () => {
    const r = buildCycleReview(max753, data, 1);
    expect(r.warnings.some((w) => /no sessions/i.test(w))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/review/review.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `review.js`**

```js
// src/lib/review/review.js
// Orchestrates the engine into one ReviewResult for a chosen cycle. Pure: no
// storage, no React. Reads live workouts/weightLogs/exercises passed in.

import {
  cycleDates,
  cycleForDate,
  phaseForCycle,
  dayPhases,
  mostRecentCompletedCycle,
} from "./cycles";
import { buildExerciseHistory, findPriorSession, analyzeExercise } from "./analyzeExercise";
import { decide } from "./decide";
import { weeklySummary, tonnageByPattern, collectHistory } from "./tonnage";
import { cycleAverage, evaluate } from "./bodyweight";
import { normalizeName } from "./match";
import { buildNarrative } from "./narrative";

const HISTORY_WINDOWS = 6;

function consecutiveSameWeight(history, name, beforeDate, weight) {
  const arr = (history.get(normalizeName(name)) || []).filter((s) => s.date < beforeDate);
  let count = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    const w = arr[i].sets.length ? Number(arr[i].sets[0].weight) || 0 : 0;
    if (w === weight) count += 1;
    else break;
  }
  return count;
}

function firstBulkCycle(config) {
  // First cycle whose majority phase is lean-bulk.
  for (let n = 1; n <= 60; n++) {
    if (phaseForCycle(config, n) === "lean-bulk") return n;
  }
  return null;
}

function groupBySession(lines) {
  const map = new Map();
  for (const l of lines) {
    if (!map.has(l.session)) map.set(l.session, []);
    map.get(l.session).push(l);
  }
  return [...map.entries()].map(([group, ls]) => ({ group, lines: ls }));
}

function groupByBlock(config, lines) {
  const blockOf = (sessionName) => {
    const n = normalizeName(sessionName);
    const b = (config.blocks || []).find((bl) => bl.sessions.includes(n));
    return b ? b.label : "Other";
  };
  const map = new Map();
  for (const l of lines) {
    const g = blockOf(l.session);
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(l);
  }
  return [...map.entries()].map(([group, ls]) => ({ group, lines: ls }));
}

export function buildCycleReview(config, data, cycleNumber) {
  const workouts = data.workouts || [];
  const weightLogs = data.weightLogs || {};
  const warnings = [];

  const number = cycleNumber ?? mostRecentCompletedCycle(config, workouts);
  if (number == null) {
    return emptyResult(config, warnings.concat("No in-program workouts found."));
  }

  const { start, end } = cycleDates(config, number);
  const phase = phaseForCycle(config, number);
  const phases = dayPhases(config, number);
  const straddles = new Set(phases).size > 1;

  const cycleWorkouts = workouts
    .filter((w) => w.date >= start && w.date <= end)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (!cycleWorkouts.length) {
    warnings.push(`Cycle ${number} has no sessions logged.`);
  }
  if (phase === "maintenance") {
    warnings.push("Maintenance/travel cycle — sessions are environmentally confounded and excluded from progression analysis.");
  }
  if (phase === "post-program") {
    warnings.push("This cycle is past the program's end date — consider a continuation phase.");
  }
  if (cycleWorkouts.length && cycleWorkouts.length < config.cycle.expectedSessions) {
    warnings.push(`Partial cycle: ${cycleWorkouts.length} of ${config.cycle.expectedSessions} expected sessions.`);
  }

  const history = buildExerciseHistory(workouts);
  const fbCycle = firstBulkCycle(config);
  const firstSessionDate = cycleWorkouts.length ? cycleWorkouts[0].date : null;
  const firstBulkPhaseDate = (config.phases.find((p) => p.id === "lean-bulk") || {}).from;

  const sessions = cycleWorkouts.map((w) => {
    const day = cycleForDate(config, w.date); // not day-in-cycle; see dayInCycle below
    return {
      date: w.date,
      dayInCycle: dayIndex(config, number, w.date),
      name: w.name || w.date,
      nExercises: (w.exercises || []).length,
      nSets: (w.exercises || []).reduce((acc, e) => acc + (e.sets || []).length, 0),
    };
  });

  const exercises = [];
  const planLines = [];
  for (const w of cycleWorkouts) {
    for (const ex of w.exercises || []) {
      if (!ex.exerciseName) continue;
      const prior = findPriorSession(history, ex.exerciseName, w.date);
      const a = analyzeExercise(config, ex, prior, history, w.date);
      const stallCount = consecutiveSameWeight(history, ex.exerciseName, w.date, a.weight);
      const isFirstBulkSession =
        number === fbCycle &&
        w.date === firstSessionDate &&
        firstBulkPhaseDate != null &&
        w.date >= firstBulkPhaseDate;
      const decision =
        phase === "maintenance"
          ? { action: "HOLD", newWeight: a.weight, increment: 0, reason: "maintenance — hold", badgeLabel: "HOLD", flags: ["maintenance"] }
          : decide(config, a, { phase, stallCount, isFirstBulkSession });
      exercises.push({ ...a, date: w.date, session: w.name || w.date, decision });
      planLines.push({
        session: w.name || w.date,
        exercise: a.name,
        newWeight: decision.newWeight,
        weightLabel: a.weight === 0 ? "BW" : `${decision.newWeight}`,
        action: decision.action,
        badgeLabel: decision.badgeLabel,
        reason: decision.reason,
      });
    }
  }

  const tonnageTrend = collectHistory(config, workouts, number, HISTORY_WINDOWS).map((win) => ({
    ...win,
    phase: win.cycle != null ? phaseForCycle(config, win.cycle) : win.phase,
  }));

  const priorDates = number >= 2 ? cycleDates(config, number - 1) : null;
  const thisBW = cycleAverage(weightLogs, start, end);
  const priorBW = priorDates ? cycleAverage(weightLogs, priorDates.start, priorDates.end) : { avg: null, n: 0 };
  let bodyweight = { thisAvg: thisBW.avg, thisN: thisBW.n, priorAvg: priorBW.avg, priorN: priorBW.n, deltaKg: null, deltaPct: null, evaluation: "" };
  if (thisBW.avg != null && priorBW.avg != null && priorBW.avg > 0) {
    const deltaKg = thisBW.avg - priorBW.avg;
    const deltaPct = (deltaKg / priorBW.avg) * 100;
    bodyweight = { ...bodyweight, deltaKg, deltaPct, evaluation: evaluate(config, phase, deltaPct) };
  }

  const thisTn = tonnageByPattern(config, cycleWorkouts);
  const priorTn = priorDates ? tonnageByPattern(config, workouts.filter((w) => w.date >= priorDates.start && w.date <= priorDates.end)) : {};
  const byPattern = [...new Set([...Object.keys(thisTn), ...Object.keys(priorTn)])]
    .sort()
    .map((p) => ({ pattern: p, thisTonnage: thisTn[p] || 0, priorTonnage: priorTn[p] || 0, delta: (thisTn[p] || 0) - (priorTn[p] || 0) }));

  const plan = { bySession: groupBySession(planLines), byBlock: groupByBlock(config, planLines) };

  const result = {
    program: { id: config.id, name: config.name },
    cycle: { number, start, end, phase, dayPhases: phases, straddles, partial: cycleWorkouts.length > 0 && cycleWorkouts.length < config.cycle.expectedSessions },
    sessions,
    exercises,
    tonnageTrend,
    bodyweight,
    byPattern,
    plan,
    warnings,
  };
  result.narrative = buildNarrative(result);
  return result;
}

function dayIndex(config, n, dateStr) {
  const { start } = cycleDates(config, n);
  const a = new Date(start);
  const b = new Date(dateStr);
  return Math.round((b - a) / 86400000) + 1;
}

function emptyResult(config, warnings) {
  return {
    program: { id: config.id, name: config.name },
    cycle: null,
    sessions: [],
    exercises: [],
    tonnageTrend: [],
    bodyweight: { thisAvg: null, thisN: 0, priorAvg: null, priorN: 0, deltaKg: null, deltaPct: null, evaluation: "" },
    byPattern: [],
    plan: { bySession: [], byBlock: [] },
    warnings,
    narrative: { headline: "No data to review yet.", wins: [], concerns: [], volumeVerdict: "" },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/review/review.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/review.js src/lib/review/review.test.js
git commit -m "feat(review): add cycle review orchestrator"
```

---

## Task 9: Templated narrative (`narrative.js`)

> **Execute this task BEFORE Task 8** (Task 8 imports `buildNarrative`).

**Files:**
- Create: `src/lib/review/narrative.js`
- Test: `src/lib/review/narrative.test.js`

**Interfaces:**
- Consumes: a partially-built `ReviewResult` (everything except `.narrative`).
- Produces: `buildNarrative(result) -> { headline, wins: string[], concerns: Concern[], volumeVerdict: string }` where `Concern = { title, action }`.
- Concern ranking: injury/3-strike first, then DELOADs, then irregular/incomplete. Cap 3.

- [ ] **Step 1: Write the failing test**

`src/lib/review/narrative.test.js`:
```js
import { buildNarrative } from "./narrative";

const base = {
  cycle: { number: 7, start: "2026-06-09", end: "2026-06-16", phase: "lean-bulk" },
  sessions: [{ date: "2026-06-09" }, { date: "2026-06-10" }],
  exercises: [
    { name: "Bench Press Barbell", decision: { action: "PROGRESS", badgeLabel: "+2.5kg" }, flags: [] },
    { name: "Deadlift", decision: { action: "DELOAD", reason: "irregular" }, flags: [] },
    { name: "Shoulder Press", decision: { action: "HOLD", reason: "feedback: discomfort — hold", flags: ["3-strike"] }, flags: ["3-strike"] },
  ],
  tonnageTrend: [
    { cycle: 6, tonnage: 1000, patternQualityPct: 80, deltaPct: null, isInProgram: true },
    { cycle: 7, tonnage: 1020, patternQualityPct: 80, deltaPct: 2.0, isInProgram: true },
  ],
  bodyweight: { deltaPct: 0.4, evaluation: "ON TARGET (lean bulk band)" },
};

describe("buildNarrative", () => {
  it("writes a headline with cycle, phase, sessions, progressions, concerns", () => {
    const n = buildNarrative(base);
    expect(n.headline).toMatch(/Week 7/);
    expect(n.headline).toMatch(/lean-bulk/);
  });
  it("lists progressions as wins", () => {
    const n = buildNarrative(base);
    expect(n.wins.join(" ")).toMatch(/Bench Press Barbell/);
  });
  it("ranks injury/3-strike and deload concerns, capped at 3", () => {
    const n = buildNarrative(base);
    expect(n.concerns.length).toBeLessThanOrEqual(3);
    expect(n.concerns[0].title).toMatch(/Shoulder Press|Deadlift/);
  });
  it("derives a volume verdict from tonnage + pattern quality", () => {
    const n = buildNarrative(base);
    expect(typeof n.volumeVerdict).toBe("string");
    expect(n.volumeVerdict.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/review/narrative.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `narrative.js`**

```js
// src/lib/review/narrative.js
// Templated prose for the review (replaces the skill's LLM-authored sections).
// Everything is derived deterministically from the structured ReviewResult.

function fmtDate(str) {
  const [y, m, d] = str.split("-").map(Number);
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
    `${result.sessions.length} sessions, ${progressions.length} progressions, ${concerns.length} concerns.`;

  const wins = [];
  for (const e of progressions.slice(0, 4)) {
    wins.push(`${e.name} — ${e.decision.badgeLabel} (${e.decision.reason}).`);
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/review/narrative.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/narrative.js src/lib/review/narrative.test.js
git commit -m "feat(review): add templated narrative generation"
```

---

## Task 10: HTML one-pager builder (`onePager.js`)

**Files:**
- Create: `src/lib/review/onePager.js`
- Test: `src/lib/review/onePager.test.js`

**Interfaces:**
- Consumes: a full `ReviewResult` and a `grouping` (`"bySession"|"byBlock"`, default `"bySession"`).
- Produces: `buildOnePager(result, grouping="bySession") -> string` (a complete self-contained HTML document) and `onePagerFilename(result) -> string` (e.g. `cycle_07_plan.html`).

- [ ] **Step 1: Write the failing test**

`src/lib/review/onePager.test.js`:
```js
import { buildOnePager, onePagerFilename } from "./onePager";

const result = {
  program: { name: "Max 7/5/3" },
  cycle: { number: 7, start: "2026-06-09", end: "2026-06-16", phase: "lean-bulk" },
  narrative: { headline: "Week 7 — steady cycle.", concerns: [{ title: "Deadlift", action: "DELOAD" }], volumeVerdict: "On point." },
  tonnageTrend: [{ label: "W7", tonnage: 1020, totalReps: 300, deltaPct: 2.0, isInProgram: true }],
  bodyweight: { thisAvg: 71.2, thisN: 5, deltaPct: 0.4, evaluation: "ON TARGET" },
  plan: {
    bySession: [{ group: "Push", lines: [{ exercise: "Bench Press Barbell", weightLabel: "42.5", action: "PROGRESS", badgeLabel: "+2.5kg", reason: "overshot 30" }] }],
    byBlock: [{ group: "Block A", lines: [{ exercise: "Bench Press Barbell", weightLabel: "42.5", action: "PROGRESS", badgeLabel: "+2.5kg", reason: "overshot 30" }] }],
  },
};

describe("buildOnePager", () => {
  it("returns a self-contained HTML document with the week and a plan row", () => {
    const html = buildOnePager(result);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toMatch(/Week 7/);
    expect(html).toMatch(/Bench Press Barbell/);
    expect(html).toMatch(/badge progress/);
    expect(html).not.toMatch(/<script/i); // no external/active content
  });
  it("escapes HTML in user-provided text", () => {
    const r = { ...result, plan: { bySession: [{ group: "Push", lines: [{ exercise: "A<b>", weightLabel: "1", action: "HOLD", badgeLabel: "HOLD", reason: "x & y" }] }], byBlock: [] } };
    const html = buildOnePager(r);
    expect(html).toMatch(/A&lt;b&gt;/);
    expect(html).toMatch(/x &amp; y/);
  });
  it("names the file by cycle number, zero-padded", () => {
    expect(onePagerFilename(result)).toBe("cycle_07_plan.html");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/review/onePager.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `onePager.js`**

```js
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
  const [y, m, d] = str.split("-").map(Number);
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
  const bwNote = bw.thisAvg != null ? `${bw.thisAvg.toFixed(1)}kg (${bw.thisN} weigh-ins). ${esc(bw.evaluation || "")}` : "no weigh-ins";

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/review/onePager.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/onePager.js src/lib/review/onePager.test.js
git commit -m "feat(review): add downloadable HTML one-pager builder"
```

---

## Task 11: CycleReview component

**Files:**
- Create: `src/components/CycleReview.jsx`
- Test: `src/components/CycleReview.test.jsx`

**Interfaces:**
- Consumes: `useApp()` (`workouts`, `exercises`); `loadLS`/`K_WEIGHT_LOGS` from `../lib/storage`; `buildCycleReview` from `../lib/review/review`; `loggedCycles` from `../lib/review/cycles`; `buildOnePager`/`onePagerFilename` from `../lib/review/onePager`; `max753` from `../lib/review/programs/max753`; `Segmented` from `./ui/Segmented`.
- Produces: default-exported `CycleReview` component. Internal state: `selectedCycle` (default latest logged), `grouping` (`bySession`|`byBlock`).
- Download: builds the one-pager HTML, creates a Blob (`type: "text/html"`), and triggers an `<a download>` click.

- [ ] **Step 1: Write the failing test**

`src/components/CycleReview.test.jsx`:
```js
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { K_WO } from "../lib/storage";
import CycleReview from "./CycleReview";

const sets = (w, ...reps) => reps.map((r, i) => ({ set: i + 1, weight: w, reps: r }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    K_WO,
    JSON.stringify([
      {
        id: "p2",
        date: "2026-06-09",
        name: "Push",
        exercises: [{ exerciseName: "Bench Press Barbell", sets: sets(40, 9, 8, 7, 6, 5) }],
      },
    ]),
  );
});

const renderReview = () =>
  render(
    <AppProvider>
      <CycleReview />
    </AppProvider>,
  );

describe("CycleReview", () => {
  it("renders the headline and the next-cycle plan", () => {
    renderReview();
    expect(screen.getByText(/Week/)).toBeInTheDocument();
    expect(screen.getByText("Bench Press Barbell")).toBeInTheDocument();
  });

  it("switches plan grouping between session and block", async () => {
    const user = userEvent.setup();
    renderReview();
    expect(screen.getByText("Push")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Block/i }));
    expect(screen.getByText(/Block A/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no workouts", () => {
    localStorage.setItem(K_WO, JSON.stringify([]));
    renderReview();
    expect(screen.getByText(/No .*review/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/CycleReview.test.jsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `CycleReview.jsx`**

```jsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/components/CycleReview.test.jsx`
Expected: PASS.

> If the empty-state test fails because `AppProvider` seeds default workouts, set `K_WO` to `[]` (as the test does) — the provider reads from localStorage first. If `loggedCycles` still returns nothing, `review.cycle` is null and the empty state shows.

- [ ] **Step 5: Commit**

```bash
git add src/components/CycleReview.jsx src/components/CycleReview.test.jsx
git commit -m "feat(review): add Cycle Review screen with plan + download"
```

---

## Task 12: Wire Cycle Review into MoreMenu

**Files:**
- Modify: `src/components/MoreMenu.jsx`
- Test: `src/components/MoreMenu.test.jsx` (extend existing)

**Interfaces:**
- Consumes: `CycleReview` from `./CycleReview`.
- Produces: a new `view === "cycleReview"` sub-screen and a menu row that opens it, following the existing Notepad/Lift-sources pattern.

- [ ] **Step 1: Write the failing test (extend the existing file)**

Add to `src/components/MoreMenu.test.jsx`:
```js
vi.mock("./CycleReview", () => ({ default: () => <div>CYCLE_REVIEW</div> }));

it("opens the cycle review as a sub-screen and returns", async () => {
  const user = userEvent.setup();
  renderMore();
  await user.click(screen.getByRole("button", { name: /Cycle Review/i }));
  expect(screen.getByText("CYCLE_REVIEW")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /More/ }));
  expect(screen.getByRole("heading", { name: "More" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/MoreMenu.test.jsx`
Expected: FAIL — no "Cycle Review" button.

- [ ] **Step 3: Implement the wiring**

In `src/components/MoreMenu.jsx`:

a) Add the import near the other component imports:
```js
import CycleReview from "./CycleReview";
```

b) Add a sub-screen branch alongside the existing `view === "notepad"` / `view === "liftSources"` blocks (place it before the `liftSources` block or after — order is cosmetic):
```jsx
  if (view === "cycleReview") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setView("menu")}
          className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400"
        >
          <span aria-hidden>←</span> More
        </button>
        <CycleReview />
      </div>
    );
  }
```

c) Add a row inside the existing **Content** section's card (next to Notepad), so the card holds two buttons:
```jsx
        <div className={`${card} divide-y dark:divide-neutral-800`}>
          <button
            type="button"
            onClick={() => setView("notepad")}
            className="flex w-full items-center justify-between px-3 py-3 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <span className={rowText}>Notepad</span>
            <span aria-hidden className="text-neutral-400 dark:text-neutral-500">›</span>
          </button>
          <button
            type="button"
            onClick={() => setView("cycleReview")}
            className="flex w-full items-center justify-between px-3 py-3 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <div>
              <div className={rowText}>Cycle Review</div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Max 7/5/3 review + next-cycle plan
              </div>
            </div>
            <span aria-hidden className="text-neutral-400 dark:text-neutral-500">›</span>
          </button>
        </div>
```
(Replace the existing single-button Content card with this two-button card; keep the surrounding `<div><SectionLabel>Content</SectionLabel>…` wrapper.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/components/MoreMenu.test.jsx`
Expected: PASS (existing 3 + new 1).

- [ ] **Step 5: Commit**

```bash
git add src/components/MoreMenu.jsx src/components/MoreMenu.test.jsx
git commit -m "feat(review): add Cycle Review entry to the More menu"
```

---

## Task 13: Documentation + full gate

**Files:**
- Modify: `ARCHITECTURE.md`, `docs/DATA-MODEL.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Update `ARCHITECTURE.md`**

Add `CycleReview.jsx` to the component list and the MoreMenu line in the component hierarchy (under `[tab="more"] MoreMenu`, add `CycleReview` sub-screen). Add a short subsection under the directory tree noting `src/lib/review/` as the offline Max 7/5/3 analysis engine with the swappable `programs/max753.js` config. State explicitly: **the review is computed on the fly from `workouts` + `weightLogs`; it persists nothing and adds no localStorage keys.**

- [ ] **Step 2: Update `docs/DATA-MODEL.md`**

In "Derived / computed (not stored)", add a bullet: **Cycle Review** — `src/lib/review/*` computes an 8-day-cycle `ReviewResult` (per-exercise progression decisions, tonnage trend, bodyweight evaluation, next-cycle plan) from `workouts` + `weightLogs`; not persisted. Note it reads bodyweight via `K_WEIGHT_LOGS` and adds no new keys.

- [ ] **Step 3: Run the full gate**

Run: `npm run check`
Expected: lint clean, format clean, **all tests pass** (existing 300 + new), build succeeds.

If format fails, run `npm run format` and re-run `npm run check`.

- [ ] **Step 4: Commit**

```bash
git add ARCHITECTURE.md docs/DATA-MODEL.md
git commit -m "docs(review): document the Cycle Review feature and engine"
```

---

## Self-Review (completed during planning)

**Spec coverage:**
- Offline/templated prose → Task 9 (`narrative.js`). ✓
- Swappable program config → Task 1 (`programs/max753.js`), consumed by all engine tasks. ✓
- More sub-screen → Tasks 11–12. ✓
- Tonnage + bodyweight trends → Tasks 6, 7; rendered in 11. ✓
- Wins/concerns → Task 9; rendered in 11. ✓
- Downloadable one-pager → Task 10 (builder) + Task 11 (Blob download). ✓
- Cycle picker → Task 11. ✓
- Deadlift 3-set/15, abs rep-range, front-delt caution, RPE modifier, fatigue feedback, stall counter, phase modifier → Tasks 3, 5. ✓
- RPE from structured field; no NL parsing → Tasks 4, 5. ✓
- Plan grouping By session / By block → Task 8 (`groupBySession`/`groupByBlock`) + Task 11 toggle. ✓
- Edge cases (no cycle, maintenance, partial, post-program, baseline, incomplete) → Tasks 8, 5; surfaced as warnings/badges. ✓
- No new persisted keys → Task 13 documents this. ✓

**Type consistency:** `Decision` fields (`action`/`newWeight`/`increment`/`reason`/`badgeLabel`/`flags`) are produced in Task 5 and consumed identically in Tasks 8–11. `ReviewResult.plan.{bySession,byBlock}[].{group,lines}` and `PlanLine.{exercise,weightLabel,action,badgeLabel,reason}` are consistent across Tasks 8, 10, 11. `buildNarrative(result)` signature matches between Tasks 8 and 9. `bucketFor` return fields match between Tasks 3 and 4.

**Ordering note:** Execute **Task 9 before Task 8** (Task 8 imports `buildNarrative`). All other tasks are in dependency order.

**Placeholder scan:** none — every code step contains full implementations and tests.
