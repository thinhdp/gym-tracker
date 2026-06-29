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
      bodyweight: {
        minPct: -0.7,
        maxPct: -0.4,
        tooFastPct: -1.0,
        tooSlowPct: -0.2,
      },
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
      bodyweight: { minPct: 0.25, maxPct: 0.5, tooFastPct: 0.7 },
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
      // Any exercise whose database mainMuscle is one of these uses the abs
      // rep-range model, so ab movements not in `names` (e.g. "Crunch") still
      // resolve correctly. Matched case-insensitively against exercise.mainMuscle.
      mainMuscles: ["abs"],
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
    // App exercise-database ab movements (exercises_seed.json).
    crunch: "abs",
    "sit-ups": "abs",
    "bicycle crunch": "abs",
    "leg raises (lying, hanging)": "abs",
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
  // Block `sessions` names must be lowercase (the engine matches them case-insensitively against normalized workout names).
  blocks: [
    { id: "A", label: "Block A", sessions: ["quads", "push", "pull"] },
    { id: "B", label: "Block B", sessions: ["hamstrings", "push", "pull"] },
  ],
};

export default max753;
