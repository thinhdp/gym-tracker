import { describe, it, expect } from "vitest";
import max753 from "./review/programs/max753";
import { cycleMuscleSeries, CATEGORY_NAMES } from "./cycleMuscleStats";

// Cycle 1 = 2026-04-27..2026-05-04, cycle 2 = 2026-05-05..2026-05-12 (8-day
// cycles; cycle 10 stretches to 18 Jul, cycle 11 re-anchors to 19 Jul).

const db = [
  { name: "Bench Press", mainMuscle: "Chest" },
  { name: "Pushdown", mainMuscle: "Triceps" },
  { name: "Lat Pulldown", mainMuscle: "Back (Lats)" },
  { name: "Back Squat", mainMuscle: "Quads" },
  { name: "Plank", mainMuscle: "Abs" },
];

const wo = (date, exercises) => ({ id: date, date, exercises });
const ex = (exerciseName, sets) => ({ exerciseName, sets });
const s = (weight, reps, set = 1) => ({ set, weight, reps });

describe("cycleMuscleSeries", () => {
  it("exposes the three categories", () => {
    expect(CATEGORY_NAMES).toEqual(["Push", "Pull", "Legs"]);
  });

  it("returns empty result for no workouts", () => {
    const r = cycleMuscleSeries(max753, [], db, "Push", "sets");
    expect(r.cycles).toEqual([]);
    expect(r.muscles).toEqual([]);
  });

  it("ignores pre-program workouts", () => {
    const r = cycleMuscleSeries(
      max753,
      [wo("2026-04-20", [ex("Bench Press", [s(60, 8)])])],
      db,
      "Push",
      "sets",
    );
    expect(r.cycles).toEqual([]);
  });

  it("buckets workouts into cycles with one series per muscle of the category", () => {
    const r = cycleMuscleSeries(
      max753,
      [
        wo("2026-04-27", [
          ex("Bench Press", [s(60, 8), s(60, 7)]),
          ex("Pushdown", [s(25, 12)]),
          ex("Lat Pulldown", [s(50, 10)]), // Pull — not in Push
        ]),
        wo("2026-05-05", [ex("Bench Press", [s(60, 8)])]),
      ],
      db,
      "Push",
      "sets",
    );
    expect(r.cycles.map((c) => c.n)).toEqual([1, 2]);
    expect(r.cycles[0]).toMatchObject({
      n: 1,
      start: "2026-04-27",
      end: "2026-05-04",
    });
    const byName = Object.fromEntries(r.muscles.map((m) => [m.name, m.points]));
    expect(byName).toEqual({ Chest: [2, 1], Triceps: [1, 0] });
  });

  it("omits category muscles with no data at all", () => {
    const r = cycleMuscleSeries(
      max753,
      [wo("2026-04-27", [ex("Bench Press", [s(60, 8)])])],
      db,
      "Push",
      "sets",
    );
    expect(r.muscles.map((m) => m.name)).toEqual(["Chest"]);
  });

  it("fills gap cycles with zeros so the x-axis is contiguous", () => {
    const r = cycleMuscleSeries(
      max753,
      [
        wo("2026-04-27", [ex("Bench Press", [s(60, 8)])]),
        wo("2026-05-13", [ex("Bench Press", [s(60, 8)])]), // cycle 3
      ],
      db,
      "Push",
      "sets",
    );
    expect(r.cycles.map((c) => c.n)).toEqual([1, 2, 3]);
    expect(r.muscles[0].points).toEqual([1, 0, 1]);
  });

  it("excludes non-category muscles and unknown exercises", () => {
    const r = cycleMuscleSeries(
      max753,
      [
        wo("2026-04-27", [
          ex("Plank", [s(0, 30)]),
          ex("Mystery Machine", [s(30, 10)]),
        ]),
      ],
      db,
      "Push",
      "sets",
    );
    expect(r.cycles).toEqual([]);
    expect(r.muscles).toEqual([]);
  });

  it("counts only sets with reps > 0 for the sets metric", () => {
    const r = cycleMuscleSeries(
      max753,
      [wo("2026-04-27", [ex("Bench Press", [s(60, 8), s(60, 0)])])],
      db,
      "Push",
      "sets",
    );
    expect(r.muscles[0].points).toEqual([1]);
  });

  it("sums reps for the reps metric and weight×reps for tonnage (kg)", () => {
    const workouts = [
      wo("2026-04-27", [ex("Bench Press", [s(60, 8), s(60, 6)])]),
    ];
    const reps = cycleMuscleSeries(max753, workouts, db, "Push", "reps");
    expect(reps.muscles[0].points).toEqual([14]);
    const ton = cycleMuscleSeries(max753, workouts, db, "Push", "tonnage");
    expect(ton.muscles[0].points).toEqual([60 * 8 + 60 * 6]);
  });

  it("matches exercise names case-insensitively", () => {
    const r = cycleMuscleSeries(
      max753,
      [wo("2026-04-27", [ex("bench press", [s(60, 8)])])],
      db,
      "Push",
      "sets",
    );
    expect(r.muscles[0].points).toEqual([1]);
  });

  it("respects the cycle-11 re-anchor (19 Jul)", () => {
    const r = cycleMuscleSeries(
      max753,
      [
        wo("2026-07-16", [ex("Bench Press", [s(60, 8)])]), // stretched cycle 10
        wo("2026-07-19", [ex("Bench Press", [s(60, 8)])]), // cycle 11
      ],
      db,
      "Push",
      "sets",
    );
    expect(r.cycles.map((c) => c.n)).toEqual([10, 11]);
    expect(r.cycles[1].start).toBe("2026-07-19");
  });
});
