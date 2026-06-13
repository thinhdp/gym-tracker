import {
  setKey,
  isSetDone,
  toggleDone,
  doneCount,
  totalSets,
  formatClock,
  remapIndexAfterMove,
  remapDoneAfterMove,
} from "./liveSession";

describe("done-map helpers", () => {
  it("keys by exercise:set", () => {
    expect(setKey(1, 2)).toBe("1:2");
  });

  it("toggles a set on and off immutably", () => {
    const a = toggleDone({}, 0, 0);
    expect(isSetDone(a, 0, 0)).toBe(true);
    const b = toggleDone(a, 0, 0);
    expect(isSetDone(b, 0, 0)).toBe(false);
    // original map untouched
    expect(isSetDone(a, 0, 0)).toBe(true);
  });

  it("counts done sets", () => {
    let done = {};
    done = toggleDone(done, 0, 0);
    done = toggleDone(done, 0, 1);
    expect(doneCount(done)).toBe(2);
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

describe("remapDoneAfterMove", () => {
  it("keeps done flags attached to their exercise after a swap", () => {
    // exercise 0 has set 0 done, exercise 1 has set 1 done; swap 0<->1
    const done = { "0:0": true, "1:1": true };
    expect(remapDoneAfterMove(done, 0, 1)).toEqual({
      "1:0": true,
      "0:1": true,
    });
  });

  it("leaves set indices untouched", () => {
    expect(remapDoneAfterMove({ "2:3": true }, 0, 1)).toEqual({ "2:3": true });
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
