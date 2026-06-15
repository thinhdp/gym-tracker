import {
  isLogged,
  totalSets,
  completedSets,
  remapIndexAfterMove,
  formatClock,
  restRemaining,
} from "./liveSession";

describe("isLogged / completedSets", () => {
  it("treats a set with reps > 0 as logged", () => {
    expect(isLogged({ reps: 8 })).toBe(true);
    expect(isLogged({ reps: 0 })).toBe(false);
    expect(isLogged({})).toBe(false);
    expect(isLogged(null)).toBe(false);
  });

  it("counts logged sets across exercises", () => {
    const workout = {
      exercises: [
        { sets: [{ reps: 8 }, { reps: 0 }] },
        { sets: [{ reps: 5 }] },
      ],
    };
    expect(completedSets(workout)).toBe(2);
  });
});

describe("totalSets", () => {
  it("sums sets across exercises", () => {
    const workout = {
      exercises: [{ sets: [1, 2, 3] }, { sets: [1] }, { sets: [] }],
    };
    expect(totalSets(workout)).toBe(4);
  });

  it("is zero for an empty/absent workout", () => {
    expect(totalSets({ exercises: [] })).toBe(0);
    expect(totalSets(null)).toBe(0);
  });
});

describe("remapIndexAfterMove", () => {
  it("maps the moved exercise to its destination", () => {
    expect(remapIndexAfterMove(0, 0, 2)).toBe(2);
    expect(remapIndexAfterMove(3, 3, 1)).toBe(1);
  });

  it("shifts indices passed over by a downward move", () => {
    // move 0 -> 2: old 1 and 2 slide up to 0 and 1
    expect(remapIndexAfterMove(1, 0, 2)).toBe(0);
    expect(remapIndexAfterMove(2, 0, 2)).toBe(1);
    expect(remapIndexAfterMove(3, 0, 2)).toBe(3); // untouched
  });

  it("shifts indices passed over by an upward move", () => {
    // move 3 -> 1: old 1 and 2 slide down to 2 and 3
    expect(remapIndexAfterMove(1, 3, 1)).toBe(2);
    expect(remapIndexAfterMove(2, 3, 1)).toBe(3);
    expect(remapIndexAfterMove(0, 3, 1)).toBe(0); // untouched
  });

  it("handles an adjacent swap", () => {
    expect(remapIndexAfterMove(1, 1, 2)).toBe(2);
    expect(remapIndexAfterMove(2, 1, 2)).toBe(1);
  });
});

describe("restRemaining", () => {
  it("is null when idle", () => {
    expect(restRemaining(null, 1000)).toBe(null);
  });

  it("derives whole seconds left from the target instant", () => {
    expect(restRemaining(120_000, 0)).toBe(120);
    expect(restRemaining(120_000, 30_500)).toBe(89); // floors partial seconds
  });

  it("reflects real elapsed time after a frozen-timer gap, not tick count", () => {
    // Tab hidden ~91s with no ticks: the next `now` reading alone yields the
    // correct remaining time — no per-second decrements needed in between.
    const endsAt = 120_000; // started at now=0 with a 2-min rest
    expect(restRemaining(endsAt, 91_000)).toBe(29);
  });

  it("clamps to zero once elapsed", () => {
    expect(restRemaining(120_000, 120_000)).toBe(0);
    expect(restRemaining(120_000, 200_000)).toBe(0);
  });
});

describe("formatClock", () => {
  it("formats minutes and seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(75)).toBe("1:15");
  });

  it("adds an hours field past 3600s", () => {
    expect(formatClock(3661)).toBe("1:01:01");
  });

  it("clamps negatives to zero", () => {
    expect(formatClock(-5)).toBe("0:00");
  });
});
