import pp21 from "../programs/pp21";
import fixture from "./fixture.pp21.json";
import {
  reviewProgram,
  nextSessionPlan,
  reviewRotation,
  loggedRotations,
} from "./engine";

// fixture.pp21.json: 4 rotations of sample sessions (28 Oct - 19 Nov) plus one
// pre-start Max 7/5/3 workout, covering every rule in docs/PP21-REVIEW.md.
const r = reviewProgram(fixture, pp21);
const ex = (id) => r.exercises.find((e) => e.exId === id);
const steps = (id) =>
  ex(id)
    .history.map((h) => h.decision)
    .join(" → ");
const codes = (id) => ex(id).flags.map((f) => f.code);

describe("pp21 config", () => {
  it("starts the day after Max 7/5/3 ended", () => {
    expect(pp21.startDate).toBe("2026-10-28");
    expect(pp21.sessionOrder).toEqual(["pushA", "pullA", "pushB", "pullB"]);
  });
  it("every session exercise is defined", () => {
    for (const s of Object.values(pp21.sessions))
      for (const id of s.exercises) expect(pp21.exercises[id]).toBeDefined();
  });
});

describe("reviewProgram: per-exercise decisions", () => {
  it("ignores workouts before the start date", () => {
    expect(r.sessions).toHaveLength(16);
    expect(r.firstDate).toBe("2026-10-28");
  });
  it("progresses the bench top set and detects warm-ups", () => {
    expect(steps("bench")).toBe("HOLD → HOLD → ADD → HOLD");
    expect([ex("bench").next.top, ex("bench").next.backoff]).toEqual([
      47.5, 42.5,
    ]);
    expect(ex("bench").last.warmups).toBe(2);
  });
  it("holds squat on a lower-back note and skips the back-off", () => {
    expect(steps("squat")).toBe("HOLD → ADD → HOLD → HOLD");
    expect(
      ex("squat").history[2].flags.some((f) => f.code === "LOWER_BACK"),
    ).toBe(true);
  });
  it("runs double progression", () => {
    expect(steps("legExt")).toBe("HOLD → HOLD → HOLD → ADD");
    expect(ex("legExt").next.weight).toBe(72.5);
    expect(steps("latRaiseDb")).toBe("HOLD → ADD → HOLD → HOLD");
  });
  it("reduces then swaps on repeated shoulder pain", () => {
    expect(steps("shoulderPress")).toBe("HOLD → ADD → REDUCE → SWAP");
    expect(ex("shoulderPress").next.swapTo).toBe("Shoulder Press Dumbbell");
    expect(
      ex("shoulderPress").history[2].flags.some(
        (f) => f.code === "SHOULDER_PAIN",
      ),
    ).toBe(true);
  });
  it("holds on fatigue and flags regression", () => {
    expect(steps("deadlift")).toBe("ADD → HOLD → HOLD → HOLD");
    expect(ex("deadlift").history[3].regressed).toBe(true);
  });
  it("resets after a 3-exposure stall", () => {
    expect(steps("pulldown")).toBe("HOLD → HOLD → HOLD → RESET");
    expect(ex("pulldown").next.weight).toBe(60);
  });
  it("keeps the pull-up back-off at bodyweight", () => {
    expect(ex("pullup").next.backoff).toBe(0);
  });
  it("blocks ADD on cheating, caps RPE, lowers confidence without RPE", () => {
    expect(ex("gluteRaise").history[1].decision).toBe("HOLD");
    expect(codes("lowHighFly")).toContain("RPE_CAP");
    expect(ex("preacher").confidence).toBe("low");
  });
});

describe("reviewProgram: sessions, rotations, global calls", () => {
  it("matches an unnamed workout by exercise overlap", () => {
    expect(r.sessions.find((s) => s.date === "2026-11-10").matchedBy).toBe(
      "overlap",
    );
  });
  it("flags extra and missing exercises", () => {
    expect(r.sessions[1].flags.some((f) => f.code === "EXTRA_EXERCISES")).toBe(
      true,
    );
    expect(r.sessions.find((s) => s.date === "2026-11-07").missing).toContain(
      "Face pull",
    );
  });
  it("calls a deload after 2 regressed compounds in rotation 4", () => {
    expect(r.rotations).toHaveLength(4);
    expect([...r.rotations[3].regressedCompounds].sort()).toEqual([
      "Deadlift",
      "Leg press",
    ]);
    expect(r.global.deload.due).toBe(true);
    expect(r.global.deload.activeNow).toBe(true);
  });
  it("plans the next session after a rest day", () => {
    expect(r.global.nextSession).toBe("pushA");
    expect(r.global.restDayFirst).toBe(true);
    expect(r.global.nextSessionDate).toBe("2026-11-21");
  });
  it("prompts a size check and tracks chest frequency and schedule", () => {
    expect(r.global.sizeCheckDue).toBe(true);
    expect(r.global.chest.minPer7Days).toBeGreaterThanOrEqual(3);
    expect(r.global.schedule.longStreaks).toHaveLength(0);
  });
  it("prescribes 1 set per exercise at RPE 7 during a deload", () => {
    const plan = nextSessionPlan(r, pp21);
    expect(plan.routineName).toBe("Push A");
    expect(plan.deload).toBe(true);
    for (const e of plan.exercises) expect(e.sets).toHaveLength(1);
  });
  it("returns an empty review with no in-program workouts", () => {
    const empty = reviewProgram({ workouts: [] }, pp21);
    expect(empty.rotations).toEqual([]);
    expect(empty.global.nextSession).toBe("pushA");
    expect(ex("bench").exposures).toBeGreaterThan(0);
    expect(empty.exercises.find((e) => e.exId === "bench").decision).toBe(
      "START",
    );
  });
});

describe("two sessions on one day", () => {
  const w = (id, date, name) => ({ id, date, name, exercises: [] });
  it("keeps the session order whatever the ids say", () => {
    // ids sort Push B before Pull A; dates alone can't order them
    const rv = reviewProgram(
      {
        workouts: [
          w("z", "2026-10-28", "Push A"),
          w("b", "2026-10-31", "Pull A"),
          w("a", "2026-10-31", "Push B"),
          w("c", "2026-11-01", "Pull B"),
          w("d", "2026-11-04", "Push A"),
        ],
      },
      pp21,
    );
    expect(rv.sessions.map((s) => [s.sessionId, s.rotation])).toEqual([
      ["pushA", 1],
      ["pullA", 1],
      ["pushB", 1],
      ["pullB", 1],
      ["pushA", 2],
    ]);
    expect(rv.rotations[0].complete).toBe(true);
  });
});

describe("schedule checks", () => {
  const w = (id, date, name) => ({ id, date, name, exercises: [] });
  it("flags 3+ days in a row, including a run that ends the log", () => {
    const rv = reviewProgram(
      {
        workouts: [
          w("a", "2026-10-28", "Push A"),
          w("b", "2026-10-29", "Pull A"),
          w("c", "2026-10-30", "Push B"),
        ],
      },
      pp21,
    );
    expect(rv.global.schedule.longStreaks).toEqual([
      "2026-10-28 → 2026-10-30 (3 days)",
    ]);
  });
  it("flags gaps over 2 rest days", () => {
    const rv = reviewProgram(
      {
        workouts: [
          w("a", "2026-10-28", "Push A"),
          w("b", "2026-11-01", "Pull A"),
        ],
      },
      pp21,
    );
    expect(rv.global.schedule.longGaps).toEqual([
      "2026-10-28 → 2026-11-01 (3 rest days)",
    ]);
    expect(rv.global.schedule.longStreaks).toEqual([]);
  });
});

describe("reviewRotation (cycle by cycle)", () => {
  it("lists rotations newest first", () => {
    expect(loggedRotations(fixture, pp21).map((x) => x.rotation)).toEqual([
      4, 3, 2, 1,
    ]);
  });
  it("reviews rotation 3 as it stood at its last session", () => {
    const rr = reviewRotation(fixture, pp21, 3);
    expect(rr.asOf).toBe(rr.rotation.end);
    expect(rr.isLatest).toBe(false);
    expect(rr.sessions.every((s) => s.rotation === 3)).toBe(true);
    // bench's rotation-3 exposure was the ADD; next is the added weight
    const bench = rr.exercises.find((e) => e.exId === "bench");
    expect(bench.step.decision).toBe("ADD");
    expect(bench.next.top).toBe(47.5);
    // calls are made per rotation: rotation 3's 3 fatigue signals already
    // trigger an early deload, while rotation 2 called none
    expect(rr.global.deload.reasons).toEqual([
      "3 fatigue or RPE-overshoot signals this rotation.",
    ]);
    expect(reviewRotation(fixture, pp21, 2).global.deload.due).toBe(false);
  });
  it("matches the full review for the latest rotation", () => {
    const rr = reviewRotation(fixture, pp21, 4);
    expect(rr.isLatest).toBe(true);
    expect(rr.global.deload.activeNow).toBe(true);
    expect(rr.next.deload).toBe(true);
  });
  it("returns null for an unknown rotation", () => {
    expect(reviewRotation(fixture, pp21, 9)).toBeNull();
  });
});

// Real-log shape: the routine is "[LV] Push A", a chest press machine fills
// the incline DB slot (both Chest), and the abductor (planned on Pull A) replaced the
// adductor because the machine was taken.
describe("matching by name phrase and main muscle", () => {
  const catalog = [
    { name: "Bench Press Barbell", mainMuscle: "Chest" },
    { name: "Chest Press Machine", mainMuscle: "Chest" },
    { name: "Leg extension", mainMuscle: "Quads" },
    { name: "Lateral Raise Dumbbell", mainMuscle: "Shoulders (side)" },
    { name: "Overhead Extension Cable", mainMuscle: "Triceps" },
    { name: "Back Squat", mainMuscle: "Quads" },
    { name: "Hip Abduction Machine", mainMuscle: "Abductors" },
    { name: "Adductor Machine", mainMuscle: "Adductors" },
    { name: "Deadlift", mainMuscle: "Glutes, Hamstrings" },
    { name: "Biceps Curl Dumbbell", mainMuscle: "Biceps" },
  ];
  const e = (exerciseName, ...sets) => ({
    exerciseName,
    sets: sets.map(([weight, reps], i) => ({ set: i + 1, weight, reps })),
    rpe: 9,
    feedback: "",
  });
  const pushA = {
    id: "w1",
    date: "2026-10-28",
    name: "[LV] Push A",
    exercises: [
      e("Bench Press Barbell", [45, 5], [40, 6]),
      e("Back Squat", [95, 6], [85, 10]),
      e("Chest Press Machine", [50, 9], [50, 8]),
      e("Leg extension", [70, 15], [70, 13]),
      e("Lateral Raise Dumbbell", [10, 20], [10, 20]),
      e("Overhead Extension Cable", [32.5, 15], [32.5, 13]),
      e("Hip Abduction Machine", [95, 20], [95, 20]),
      e("Biceps Curl Dumbbell", [12, 12]),
    ],
  };
  const pullA = {
    id: "w2",
    date: "2026-10-29",
    name: "[LV] Pull A",
    exercises: [
      e("Deadlift", [120, 5], [110, 6]),
      e("Adductor Machine", [40, 12], [40, 11]),
    ],
  };
  const one = { workouts: [pushA], exercises: catalog };
  const two = { workouts: [pushA, pullA], exercises: catalog };
  const byId = (rv, id) => rv.exercises.find((x) => x.exId === id);

  it("matches a session when its name contains the routine phrase", () => {
    const rv = reviewProgram(one, pp21);
    expect(rv.sessions[0].sessionId).toBe("pushA");
    expect(rv.sessions[0].matchedBy).toBe("routineName");
    const pushAB = { ...pushA, name: "Push AB" };
    expect(
      reviewProgram({ workouts: [pushAB], exercises: catalog }, pp21)
        .sessions[0].matchedBy,
    ).not.toBe("routineName");
  });

  it("fills a slot by main muscle when the name differs", () => {
    const rv = reviewProgram(one, pp21);
    expect(byId(rv, "inclineDb").loggedAs).toBe("Chest Press Machine");
    expect(byId(rv, "inclineDb").last.top).toEqual({
      weight: 50,
      reps: 9,
      partial: false,
    });
    expect(byId(rv, "bench").loggedAs).toBeNull();
    const codes = rv.sessions[0].flags.map((f) => f.code);
    expect(codes).toContain("SUBSTITUTED");
  });

  it("prefers this session's muscle slot over another day's exact name", () => {
    // the [LV] Push A routine puts Low to High Cable Fly (Pull B's exercise)
    // in the incline DB slot: it fills Push A's chest slot, not Pull B's
    const fly = {
      ...pushA,
      exercises: [
        e("Bench Press Barbell", [45, 5], [40, 6]),
        e("Low to High Cable Fly", [15, 12], [15, 12]),
      ],
    };
    const catalogFly = [
      ...catalog,
      { name: "Low to High Cable Fly", mainMuscle: "Chest" },
    ];
    const rv = reviewProgram({ workouts: [fly], exercises: catalogFly }, pp21);
    expect(byId(rv, "inclineDb").loggedAs).toBe("Low to High Cable Fly");
    expect(byId(rv, "lowHighFly").exposures).toBe(0);
  });

  it("keeps muscle matching within the session", () => {
    // the curl (Biceps) is a Pull-day muscle: an extra, not a Bayesian exposure
    const rv = reviewProgram(one, pp21);
    expect(rv.sessions[0].extras).toEqual(["Biceps Curl Dumbbell"]);
    expect(byId(rv, "bayesian").exposures).toBe(0);
  });

  it("credits an exercise moved from another day to its own slot", () => {
    const rv = reviewProgram(one, pp21);
    expect(byId(rv, "abductor").exposures).toBe(1);
    expect(byId(rv, "abductor").decision).toBe("ADD");
    const flags = rv.sessions[0].flags;
    expect(flags.find((f) => f.code === "MOVED").message).toMatch(
      /Hip Abduction Machine \(Pull A\)/,
    );
    // adductor isn't missing yet: Pull A can still pick it up
    expect(flags.find((f) => f.code === "NOT_YET_DONE").message).toMatch(
      /Adductor Machine/,
    );
    expect(flags.some((f) => f.code === "MISSING_EXERCISES")).toBe(false);
  });

  it("plans the swap into the next session", () => {
    const plan = nextSessionPlan(reviewProgram(one, pp21), pp21);
    expect(plan.sessionId).toBe("pullA");
    const abd = plan.exercises.find((x) => x.exId === "abductor");
    expect(abd.doneEarlier).toBe(true);
    expect(abd.sets).toEqual([]);
    const add = plan.exercises.find((x) => x.exId === "adductor");
    expect(add.carriedFrom).toBe("Push A");
  });

  it("clears the pending note once the swap is done", () => {
    const rv = reviewProgram(two, pp21);
    expect(byId(rv, "adductor").exposures).toBe(1);
    const pushFlags = rv.sessions[0].flags.map((f) => f.code);
    expect(pushFlags).not.toContain("NOT_YET_DONE");
    expect(pushFlags).not.toContain("MISSING_EXERCISES");
  });

  it("restarts progression when a different exercise fills the slot", () => {
    const later = {
      ...pushA,
      id: "w3",
      date: "2026-11-02",
      exercises: [e("Incline Press Dumbbell", [22.5, 8], [22.5, 8])],
    };
    const rv = reviewProgram(
      { workouts: [pushA, pullA, later], exercises: catalog },
      pp21,
    );
    const step = byId(rv, "inclineDb").history[1];
    expect(step.progressed).toBeNull();
    expect(step.flags.map((f) => f.code)).toContain("SWITCHED");
    expect(byId(rv, "inclineDb").loggedAs).toBeNull();
  });
});
