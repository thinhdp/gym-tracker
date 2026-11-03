import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { K_UNIT, K_WEIGHT_LOGS, saveLS } from "../../lib/storage";
import { FoodProvider } from "../context/FoodContext";
import { K_FOOD_ENTRIES } from "../lib/keys";
import { addDays, localDateFromYmd, todayLocal } from "../lib/localDate";
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
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows No food logged yet with no entries, and keeps the chart and table on 4w", () => {
    const { container } = setup([]);
    expect(screen.getByText("No food logged yet")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(container.querySelector(".recharts-surface")).not.toBeNull();
  });

  it("hides the line once there is an entry", () => {
    setup([entry("a", mondayOfWeek(0), kcal(1500))]);
    expect(screen.queryByText("No food logged yet")).toBeNull();
  });

  it("hides the chart and table when there are no weekly rows, and keeps the controls", async () => {
    const user = userEvent.setup();
    const { container } = setup([]);
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("No food logged yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(container.querySelector(".recharts-surface")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Calories" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4w" })).toBeInTheDocument();
  });
});

describe("TrendsView chart internals", () => {
  const dots = (c) => [...c.querySelectorAll(".recharts-line-dots circle")];
  const cy = (d) => Number(d.getAttribute("cy"));
  const ticks = () =>
    [...document.querySelectorAll(".recharts-xAxis-tick-labels text")].map(
      (t) => t.textContent,
    );

  it("plots bodyweight on its own axis and breaks the line at a null week", () => {
    const w0 = mondayOfWeek(0);
    const { container } = setup([entry("a", w0, kcal(1500))], {
      logs: { [w0]: 80, [addDays(w0, -21)]: 70, [addDays(w0, -7)]: 75 },
    });
    const points = dots(container);
    expect(points).toHaveLength(3);
    // 70 and 80 sit near the opposite ends of the weight axis. On the
    // 0-2000 intake axis they would be a few pixels apart.
    const ys = points.map(cy);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(100);
    // Week 2 has no weight: the curve is two separate segments.
    const d = container.querySelector(".recharts-line-curve").getAttribute("d");
    expect(d.match(/M/g)).toHaveLength(2);
  });

  it("labels every week tick with a short date and the logged-day count", () => {
    const w0 = mondayOfWeek(0);
    setup([entry("a", w0, kcal(1500)), entry("b", addDays(w0, 1), kcal(1500))]);
    const labels = ticks();
    expect(labels).toHaveLength(4);
    labels.forEach((t) => expect(t).not.toMatch(/\d{4}-\d{2}-\d{2}/));
    const expected = weeklyIntake([], {}, { weeks: 4 }).map((r, i) => {
      const days = [0, 0, 0, 2][i];
      const date = localDateFromYmd(r.from).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
      return `${date} (${days}/7)`;
    });
    expect(labels).toEqual(expected);
  });

  it("rotates the week tick labels", () => {
    setup([entry("a", mondayOfWeek(0), kcal(1500))]);
    const texts = [
      ...document.querySelectorAll(".recharts-xAxis-tick-labels text"),
    ];
    expect(texts).toHaveLength(4);
    texts.forEach((t) =>
      expect(t.getAttribute("transform")).toContain("rotate(-45"),
    );
  });

  it("maps Carbs and Fat to their own values", async () => {
    const user = userEvent.setup();
    const w0 = mondayOfWeek(0);
    const w1 = mondayOfWeek(1);
    const { container } = setup([
      entry("a", w1, { kcal: 100, protein: 1, carb: 40, fat: 10 }),
      entry("b", w0, { kcal: 100, protein: 1, carb: 20, fat: 30 }),
    ]);
    await user.click(screen.getByRole("button", { name: "Carbs" }));
    let [h1, h0] = barHeights(container);
    expect(h1 / h0).toBeCloseTo(2, 1);
    await user.click(screen.getByRole("button", { name: "Fat" }));
    [h1, h0] = barHeights(container);
    expect(h0 / h1).toBeCloseTo(3, 1);
  });

  it("puts each macro in its own table column", () => {
    setup([
      entry("a", mondayOfWeek(0), {
        kcal: 1500,
        protein: 11,
        carb: 22,
        fat: 33,
      }),
    ]);
    const cells = within(bodyRows()[3]).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("1500");
    expect(cells[2]).toHaveTextContent("11");
    expect(cells[3]).toHaveTextContent("22");
    expect(cells[4]).toHaveTextContent("33");
  });
});
