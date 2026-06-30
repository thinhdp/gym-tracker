import max753 from "./programs/max753";
import {
  cycleForDate,
  cycleDates,
  phaseForDate,
  dayPhases,
  phaseForCycle,
  mostRecentCompletedCycle,
  loggedCycles,
} from "./cycles";

const wo = (date) => ({ id: date, date, name: date, exercises: [] });

describe("cycleForDate / cycleDates", () => {
  it("cycle 1 is the 8 days from the start date", () => {
    expect(cycleForDate(max753, "2026-04-27")).toBe(1);
    expect(cycleForDate(max753, "2026-05-04")).toBe(1);
    expect(cycleForDate(max753, "2026-05-05")).toBe(2);
    expect(cycleDates(max753, 1)).toEqual({
      start: "2026-04-27",
      end: "2026-05-04",
    });
    expect(cycleDates(max753, 2)).toEqual({
      start: "2026-05-05",
      end: "2026-05-12",
    });
  });
  it("returns null before program start", () => {
    expect(cycleForDate(max753, "2026-04-20")).toBeNull();
  });
});

describe("phaseForDate / phaseForCycle", () => {
  it("classifies dates into calendar phases", () => {
    expect(phaseForDate(max753, "2026-05-01")).toBe("cut");
    expect(phaseForDate(max753, "2026-05-26")).toBe("maintenance");
    expect(phaseForDate(max753, "2026-06-10")).toBe("lean-bulk");
    expect(phaseForDate(max753, "2026-08-01")).toBe("post-program");
    expect(phaseForDate(max753, "2026-04-20")).toBe("pre-program");
  });
  it("uses majority days for a cycle, later phase breaking ties", () => {
    // Cycle 4 = 21-28 May: 3 cut days + 5 maintenance days -> majority wins
    expect(phaseForCycle(max753, 4)).toBe("maintenance");
    expect(dayPhases(max753, 4)).toHaveLength(8);
  });
});

describe("mostRecentCompletedCycle / loggedCycles", () => {
  const workouts = [wo("2026-05-06"), wo("2026-06-09"), wo("2026-06-10")];
  it("finds the latest cycle containing a session", () => {
    expect(mostRecentCompletedCycle(max753, workouts)).toBe(
      cycleForDate(max753, "2026-06-10"),
    );
  });
  it("lists logged cycles descending", () => {
    const cs = loggedCycles(max753, workouts);
    expect(cs[0]).toBeGreaterThan(cs[cs.length - 1]);
    expect(cs).toContain(cycleForDate(max753, "2026-05-06"));
  });
  it("returns null when there are no workouts", () => {
    expect(mostRecentCompletedCycle(max753, [])).toBeNull();
  });
});
