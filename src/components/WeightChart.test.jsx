import React from "react";
import { render, screen } from "@testing-library/react";
import WeightChart from "./WeightChart";

vi.mock("recharts", async (importOriginal) => {
  const { withFixedResponsiveContainer } =
    await import("../test/rechartsTestUtils");
  return withFixedResponsiveContainer(await importOriginal());
});

const day = (d) => new Date(2026, 0, d); // Jan 2026

describe("WeightChart", () => {
  it("shows the empty state when a single day can't form a line", () => {
    render(
      <WeightChart logs={{ "2026-01-01": 80 }} from={day(1)} to={day(1)} />,
    );
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  it("plots the body-weight series across the range", () => {
    const logs = { "2026-01-01": 80, "2026-01-03": 81 };
    const { container } = render(
      <WeightChart logs={logs} from={day(1)} to={day(3)} view="daily" />,
    );
    // One line is drawn for the weight series.
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(1);
    // Days without a log carry the prior weight forward (Jan 2 == 80).
    const texts = [...container.querySelectorAll("text")].map(
      (t) => t.textContent,
    );
    expect(texts).toContain("80");
    expect(texts).toContain("81");
  });
});
