import { describe, it, expect } from "vitest";
import max753 from "./review/programs/max753";
import { cycleMuscleGroupSeries, GROUP_NAMES } from "./cycleMuscleStats";

// Cycle 1 = 2026-04-27..2026-05-04, cycle 2 = 2026-05-05..2026-05-12 (8-day
// cycles; cycle 10 stretches to 18 Jul, cycle 11 re-anchors to 19 Jul).

const db = [
  { name: "Bench Press", mainMuscle: "Chest" },
  { name: "Lat Pulldown", mainMuscle: "Back (Lats)" },
  { name: "Back Squat", mainMuscle: "Quads" },
  { name: "Plank", mainMuscle: "Abs" },
  { name: "Calf Raise", mainMuscle: "Calves" },
];

const wo = (date, exercises) => ({ id: date, date, exercises });
const ex = (exerciseName, sets) => ({ exerciseName, sets });
const s = (weight, reps, set = 1) => ({ set, weight, reps });

describe("cycleMuscleGroupSeries", () => {
  it("returns empty result for no workouts", () => {
    const r = cycleMuscleGroupSeries(max753, [], db, "sets");
    expect(r.cycles).toEqual([]);
    expect(r.groups).toEqual([]);
  });

  it("ignores pre-program workouts", () => {
    const r = cycleMuscleGroupSeries(
      max753,
      [wo("2026-04-20", [ex("Bench Press", [s(60, 8)])])],
      db,
      "sets",
    );
    expect(r.cycles).toEqual([]);
  });

  it("buckets workouts into cycles and groups muscles push/pull/legs", () => {
    const r = cycleMuscleGroupSeries(
      max753,
      [
        wo("2026-04-27", [
          ex("Bench Press", [s(60, 8), s(60, 7)]),
          ex("Lat Pulldown", [s(50, 10)]),
        ]),
        wo("2026-05-05", [ex("Back Squat", [s(100, 5), s(100, 5), s(100, 4)])]),
      ],
      db,
      "sets",
    );
    expect(r.cycles.map((c) => c.n)).toEqual([1, 2]);
    expect(r.cycles[0]).toMatchObject({
      n: 1,
      start: "2026-04-27",
      end: "2026-05-04",
    });
    const byName = Object.fromEntries(r.groups.map((g) => [g.name, g.points]));
    expect(Object.keys(byName)).toEqual([...GROUP_NAMES]);
    expect(byName.Push).toEqual([2, 0]);
    expect(byName.Pull).toEqual([1, 0]);
    expect(byName.Legs).toEqual([0, 3]);
  });

  it("fills gap cycles with zeros so the x-axis is contiguous", () => {
    const r = cycleMuscleGroupSeries(
      max753,
      [
        wo("2026-04-27", [ex("Bench Press", [s(60, 8)])]),
        wo("2026-05-13", [ex("Bench Press", [s(60, 8)])]), // cycle 3
      ],
      db,
      "sets",
    );
    expect(r.cycles.map((c) => c.n)).toEqual([1, 2, 3]);
    const push = r.groups.find((g) => g.name === "Push");
    expect(push.points).toEqual([1, 0, 1]);
  });

  it("excludes non-grouped muscles and unknown exercises", () => {
    const r = cycleMuscleGroupSeries(
      max753,
      [
        wo("2026-04-27", [
          ex("Plank", [s(0, 30)]),
          ex("Calf Raise", [s(40, 15)]),
          ex("Mystery Machine", [s(30, 10)]),
        ]),
      ],
      db,
      "sets",
    );
    expect(r.cycles).toEqual([]);
    expect(r.groups).toEqual([]);
  });

  it("counts only sets with reps > 0 for the sets metric", () => {
    const r = cycleMuscleGroupSeries(
      max753,
      [wo("2026-04-27", [ex("Bench Press", [s(60, 8), s(60, 0)])])],
      db,
      "sets",
    );
    expect(r.groups.find((g) => g.name === "Push").points).toEqual([1]);
  });

  it("sums reps for the reps metric and weight×reps for tonnage (kg)", () => {
    const workouts = [
      wo("2026-04-27", [ex("Bench Press", [s(60, 8), s(60, 6)])]),
    ];
    const reps = cycleMuscleGroupSeries(max753, workouts, db, "reps");
    expect(reps.groups.find((g) => g.name === "Push").points).toEqual([14]);
    const ton = cycleMuscleGroupSeries(max753, workouts, db, "tonnage");
    expect(ton.groups.find((g) => g.name === "Push").points).toEqual([
      60 * 8 + 60 * 6,
    ]);
  });

  it("matches exercise names case-insensitively", () => {
    const r = cycleMuscleGroupSeries(
      max753,
      [wo("2026-04-27", [ex("bench press", [s(60, 8)])])],
      db,
      "sets",
    );
    expect(r.groups.find((g) => g.name === "Push").points).toEqual([1]);
  });

  it("respects the cycle-11 re-anchor (19 Jul)", () => {
    const r = cycleMuscleGroupSeries(
      max753,
      [
        wo("2026-07-16", [ex("Bench Press", [s(60, 8)])]), // stretched cycle 10
        wo("2026-07-19", [ex("Bench Press", [s(60, 8)])]), // cycle 11
      ],
      db,
      "sets",
    );
    expect(r.cycles.map((c) => c.n)).toEqual([10, 11]);
    expect(r.cycles[1].start).toBe("2026-07-19");
  });
});
