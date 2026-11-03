import { SLOTS, SLOT_IDS, slotForTime, slotLabel } from "./slots";

describe("SLOTS", () => {
  it("lists the six slots in the fixed order with their labels", () => {
    expect(SLOTS).toEqual([
      { id: "breakfast", label: "Breakfast" },
      { id: "snack1", label: "Morning snack" },
      { id: "lunch", label: "Lunch" },
      { id: "snack2", label: "Afternoon snack" },
      { id: "dinner", label: "Dinner" },
      { id: "snack3", label: "Evening snack" },
    ]);
  });
});

describe("SLOT_IDS", () => {
  it("lists the ids in slot order", () => {
    expect(SLOT_IDS).toEqual([
      "breakfast",
      "snack1",
      "lunch",
      "snack2",
      "dinner",
      "snack3",
    ]);
  });
});

describe("slotLabel", () => {
  it("returns the label for a known id", () => {
    expect(slotLabel("snack2")).toBe("Afternoon snack");
  });

  it("returns undefined for an unknown id", () => {
    expect(slotLabel("brunch")).toBeUndefined();
  });
});

describe("slotForTime", () => {
  afterEach(() => vi.useRealTimers());

  it("matches the plan's boundaries", () => {
    expect(slotForTime(new Date(2026, 10, 2, 9, 59))).toBe("breakfast");
    expect(slotForTime(new Date(2026, 10, 2, 10, 0))).toBe("snack1");
    expect(slotForTime(new Date(2026, 10, 2, 20, 30))).toBe("snack3");
  });

  it.each([
    [9, 59, "breakfast"],
    [10, 0, "snack1"],
    [11, 29, "snack1"],
    [11, 30, "lunch"],
    [13, 59, "lunch"],
    [14, 0, "snack2"],
    [16, 59, "snack2"],
    [17, 0, "dinner"],
    [20, 29, "dinner"],
    [20, 30, "snack3"],
  ])("at %i:%i gives %s", (hour, minute, id) => {
    expect(slotForTime(new Date(2026, 10, 2, hour, minute))).toBe(id);
  });

  it("uses the current time when called with no argument", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 12, 0));
    expect(slotForTime()).toBe("lunch");
  });
});
