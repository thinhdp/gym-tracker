import {
  setKey,
  isSetDone,
  toggleDone,
  doneCount,
  totalSets,
  formatClock,
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
