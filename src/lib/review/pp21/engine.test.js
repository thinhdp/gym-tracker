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
    expect(plan.routineName).toBe("[PP21] Push A");
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
