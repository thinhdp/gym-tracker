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
    const d = decide(max753, A({ status: "OVER+4", pattern: "linear" }), {
      phase: "lean-bulk",
    });
    expect(d.action).toBe("PROGRESS");
    expect(d.newWeight).toBe(42.5);
  });
  it("HIT + linear + strong final -> PROGRESS", () => {
    const d = decide(
      max753,
      A({ status: "HIT", pattern: "linear", weakFinal: false }),
      { phase: "lean-bulk" },
    );
    expect(d.action).toBe("PROGRESS");
  });
  it("HIT + linear + weak final -> HOLD", () => {
    const d = decide(
      max753,
      A({ status: "HIT", pattern: "linear", weakFinal: true }),
      { phase: "lean-bulk" },
    );
    expect(d.action).toBe("HOLD");
  });
  it("HIT + steep -> HOLD", () => {
    expect(
      decide(max753, A({ pattern: "steep" }), { phase: "lean-bulk" }).action,
    ).toBe("HOLD");
  });
  it("severe UNDER -> DELOAD", () => {
    const d = decide(max753, A({ status: "UNDER-10", pattern: "linear" }), {
      phase: "lean-bulk",
    });
    expect(d.action).toBe("DELOAD");
    expect(d.newWeight).toBe(36); // 40 * 0.90
  });
  it("UNDER -4 + linear -> HOLD; + steep -> DELOAD", () => {
    expect(
      decide(max753, A({ status: "UNDER-4", pattern: "linear" }), {
        phase: "lean-bulk",
      }).action,
    ).toBe("HOLD");
    expect(
      decide(max753, A({ status: "UNDER-4", pattern: "steep" }), {
        phase: "lean-bulk",
      }).action,
    ).toBe("DELOAD");
  });
});

describe("short-circuits", () => {
  it("baseline -> BASELINE, weight unchanged", () => {
    const d = decide(max753, A({ isBaseline: true }), { phase: "lean-bulk" });
    expect(d.action).toBe("BASELINE");
    expect(d.newWeight).toBe(40);
  });
  it("incomplete -> HOLD", () => {
    expect(
      decide(max753, A({ pattern: "incomplete" }), { phase: "lean-bulk" })
        .action,
    ).toBe("HOLD");
  });
});

describe("abs rep-range model", () => {
  const abs = (reps) =>
    A({
      name: "Cable Crunch",
      bucketKind: "abs",
      status: null,
      pattern: "n/a",
      reps,
      expectedNSets: 3,
      repRangeMin: 15,
      repRangeMax: 20,
      increment: 2.5,
    });
  it("all sets at top of range -> PROGRESS", () => {
    expect(
      decide(max753, abs([20, 20, 20]), { phase: "lean-bulk" }).action,
    ).toBe("PROGRESS");
  });
  it("in range -> HOLD", () => {
    expect(
      decide(max753, abs([18, 16, 15]), { phase: "lean-bulk" }).action,
    ).toBe("HOLD");
  });
  it("below range -> DELOAD", () => {
    expect(
      decide(max753, abs([14, 12, 10]), { phase: "lean-bulk" }).action,
    ).toBe("DELOAD");
  });
});

describe("phase modifier", () => {
  it("cut downgrades a HIT-based PROGRESS to HOLD", () => {
    const d = decide(
      max753,
      A({ status: "HIT", pattern: "linear", weakFinal: false }),
      { phase: "cut" },
    );
    expect(d.action).toBe("HOLD");
  });
  it("cut keeps a clear OVER PROGRESS", () => {
    const d = decide(max753, A({ status: "OVER+4", pattern: "linear" }), {
      phase: "cut",
    });
    expect(d.action).toBe("PROGRESS");
  });
});

describe("front-delt caution", () => {
  it("shoulder press OVER+3 linear -> HOLD (needs OVER+5)", () => {
    const d = decide(
      max753,
      A({
        name: "Shoulder Press",
        status: "OVER+3",
        pattern: "linear",
        target: 50,
        setFloor: 7,
        increment: 2.5,
      }),
      { phase: "lean-bulk" },
    );
    expect(d.action).toBe("HOLD");
  });
  it("shoulder press OVER+5 linear strong final -> PROGRESS capped at 2.5", () => {
    const d = decide(
      max753,
      A({
        name: "Shoulder Press",
        status: "OVER+5",
        pattern: "linear",
        weakFinal: false,
        target: 50,
        setFloor: 7,
        increment: 2.5,
      }),
      { phase: "lean-bulk" },
    );
    expect(d.action).toBe("PROGRESS");
    expect(d.increment).toBe(2.5);
  });
  it("applies strict caution to the dumbbell shoulder press variant too", () => {
    const d = decide(
      max753,
      A({
        name: "Shoulder Press Dumbbell",
        status: "OVER+3",
        pattern: "linear",
        target: 50,
        setFloor: 7,
        increment: 2.5,
      }),
      { phase: "lean-bulk" },
    );
    expect(d.action).toBe("HOLD"); // needs OVER+5, same as the barbell variant
  });
});

describe("RPE modifier", () => {
  it("last-set RPE 10 caps PROGRESS at HOLD", () => {
    const d = decide(
      max753,
      A({ status: "OVER+4", pattern: "linear", rpe: 10 }),
      { phase: "lean-bulk" },
    );
    expect(d.action).toBe("HOLD");
  });
  it("RPE 6 upgrades a HOLD to PROGRESS on an ambiguous (linear) hit", () => {
    const d = decide(
      max753,
      A({ status: "HIT", pattern: "linear", weakFinal: true, rpe: 6 }),
      { phase: "lean-bulk" },
    );
    expect(d.action).toBe("PROGRESS");
  });
  it("RPE 6 does NOT upgrade a steep HOLD", () => {
    const d = decide(max753, A({ status: "HIT", pattern: "steep", rpe: 6 }), {
      phase: "lean-bulk",
    });
    expect(d.action).toBe("HOLD");
  });
});

describe("feedback rules", () => {
  it("'felt heavy' caps action at HOLD", () => {
    const d = decide(
      max753,
      A({ status: "OVER+4", pattern: "linear", feedback: "felt heavy today" }),
      { phase: "lean-bulk" },
    );
    expect(d.action).toBe("HOLD");
  });
  it("'shoulder pain' on a strict-caution lift -> DELOAD", () => {
    const d = decide(
      max753,
      A({
        name: "Shoulder Press",
        status: "HIT",
        pattern: "linear",
        feedback: "shoulder pain",
        target: 50,
        setFloor: 7,
      }),
      { phase: "lean-bulk" },
    );
    expect(d.action).toBe("DELOAD");
  });
});

describe("conservatism guards — DELOAD never downgraded to HOLD", () => {
  it("strict caution + severe undershoot + steep stays DELOAD", () => {
    expect(
      decide(
        max753,
        A({
          name: "Shoulder Press",
          status: "UNDER-10",
          pattern: "steep",
          target: 50,
          setFloor: 7,
        }),
        { phase: "lean-bulk" },
      ).action,
    ).toBe("DELOAD");
  });

  it("first bulk session forces HOLD on a normal progression", () => {
    expect(
      decide(max753, A({ status: "OVER+4", pattern: "linear" }), {
        phase: "lean-bulk",
        isFirstBulkSession: true,
      }).action,
    ).toBe("HOLD");
  });

  it("first bulk session still honors a deload", () => {
    expect(
      decide(max753, A({ status: "UNDER-10", pattern: "linear" }), {
        phase: "lean-bulk",
        isFirstBulkSession: true,
      }).action,
    ).toBe("DELOAD");
  });

  it("HIT + flat doubles the increment", () => {
    const d = decide(max753, A({ status: "HIT", pattern: "flat" }), {
      phase: "lean-bulk",
    });
    expect(d.action).toBe("PROGRESS");
    expect(d.newWeight).toBe(45);
  });

  it("OVER + flat -> PROGRESS", () => {
    expect(
      decide(max753, A({ status: "OVER+4", pattern: "flat" }), {
        phase: "lean-bulk",
      }).action,
    ).toBe("PROGRESS");
  });
});

describe("RPE conservatism guards", () => {
  it("does not let RPE re-promote a first-bulk recalibration hold", () => {
    const d = decide(
      max753,
      A({ status: "OVER+4", pattern: "linear", rpe: 6 }),
      { phase: "lean-bulk", isFirstBulkSession: true },
    );
    expect(d.action).toBe("HOLD");
  });
  it("does not let RPE re-promote a cut borderline hold", () => {
    const d = decide(
      max753,
      A({
        status: "HIT",
        pattern: "linear",
        weakFinal: false,
        rpe: 6,
      }),
      { phase: "cut" },
    );
    expect(d.action).toBe("HOLD");
  });
  it("does not let RPE re-promote a strict-caution hold on a linear hit", () => {
    const d = decide(
      max753,
      A({
        name: "Shoulder Press",
        status: "HIT",
        pattern: "linear",
        weakFinal: false,
        target: 50,
        setFloor: 7,
        rpe: 6,
      }),
      { phase: "lean-bulk" },
    );
    expect(d.action).toBe("HOLD");
  });
});

describe("stall counter", () => {
  it("3rd consecutive hold escalates to DELOAD", () => {
    const d = decide(max753, A({ status: "UNDER-4", pattern: "linear" }), {
      phase: "lean-bulk",
      stallCount: 2,
    });
    expect(d.action).toBe("DELOAD");
  });
});
