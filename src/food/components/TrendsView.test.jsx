import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { K_UNIT, K_WEIGHT_LOGS, saveLS } from "../../lib/storage";
import { FoodProvider } from "../context/FoodContext";
import { K_FOOD_ENTRIES } from "../lib/keys";
import { addDays, todayLocal } from "../lib/localDate";
import { weeklyIntake } from "../lib/trends";
import TrendsView from "./TrendsView";

vi.mock("recharts", async (importOriginal) => {
  const { withFixedResponsiveContainer } =
    await import("../../test/rechartsTestUtils");
  return withFixedResponsiveContainer(await importOriginal());
});

const mondayOfWeek = (weeksBack) =>
  weeklyIntake([], {}, { weeks: 4 })[3 - weeksBack].from;

function entry(id, date, per100) {
  return {
    id,
    date,
    slot: "lunch",
    name: id,
    grams: 100,
    per100,
    food: { kind: "db", id },
    createdAt: 1000,
  };
}

const kcal = (k, p = 10) => ({ kcal: k, protein: p, carb: 0, fat: 0 });

function setup(entries, { logs, unit } = {}) {
  saveLS(K_FOOD_ENTRIES, entries);
  if (logs) saveLS(K_WEIGHT_LOGS, logs);
  if (unit) saveLS(K_UNIT, unit);
  return render(
    <FoodProvider>
      <TrendsView />
    </FoodProvider>,
  );
}

const barHeights = (container) =>
  [...container.querySelectorAll(".recharts-bar-rectangle path")].map((p) =>
    Number(p.getAttribute("height")),
  );

const bodyRows = () =>
  within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("TrendsView", () => {
  it("renders one bar per logged week and switches the bars with the metric", async () => {
    const user = userEvent.setup();
    const w0 = mondayOfWeek(0);
    const w1 = mondayOfWeek(1);
    const { container } = setup([
      entry("a", w1, kcal(2000)),
      entry("b", w0, kcal(1000)),
    ]);
    // Calories: 2000 vs 1000, so the bars differ by a factor of two.
    let [h1, h0] = barHeights(container);
    expect(h1).toBeGreaterThan(0);
    expect(h1 / h0).toBeCloseTo(2, 1);

    await user.click(screen.getByRole("button", { name: "Protein" }));
    // Protein is 10 in both weeks, so the bars are equal.
    [h1, h0] = barHeights(container);
    expect(h1).toBeGreaterThan(0);
    expect(h1).toBe(h0);
  });

  it("draws no bar for a week with nothing logged", () => {
    const { container } = setup([entry("a", mondayOfWeek(0), kcal(1500))]);
    expect(barHeights(container)).toHaveLength(1);
    expect(bodyRows()).toHaveLength(4);
  });

  it("changes the row count with the range", async () => {
    const user = userEvent.setup();
    setup([entry("a", addDays(todayLocal(), -70), kcal(1500))]);
    expect(bodyRows()).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: "12w" }));
    expect(bodyRows()).toHaveLength(12);
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(bodyRows().length).toBeGreaterThanOrEqual(10);
  });

  it("shows a dash for a null bodyweight and a null delta", () => {
    setup([entry("a", mondayOfWeek(0), kcal(1500))]);
    const cells = within(bodyRows()[3]).getAllByRole("cell");
    expect(cells[6]).toHaveTextContent("—");
    expect(cells[7]).toHaveTextContent("—");
    expect(cells[5]).toHaveTextContent("1/7");
  });

  it("shows stored weights unconverted with the stored unit label and signed delta", () => {
    const w0 = mondayOfWeek(0);
    setup([], {
      unit: "lb",
      logs: { [addDays(w0, -7)]: 180, [w0]: 182.5 },
    });
    const cells = within(bodyRows()[3]).getAllByRole("cell");
    expect(cells[6]).toHaveTextContent("182.5");
    expect(cells[7]).toHaveTextContent("+2.5");
    expect(screen.getByText("Weight (lb)")).toBeInTheDocument();
  });

  it("does not throw on All with no entries", async () => {
    const user = userEvent.setup();
    setup([]);
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.queryAllByRole("row")).toHaveLength(1);
  });
});
