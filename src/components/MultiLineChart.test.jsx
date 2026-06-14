import React from "react";
import { render, screen } from "@testing-library/react";
import MultiLineChart from "./MultiLineChart";

vi.mock("recharts", async (importOriginal) => {
  const { withFixedResponsiveContainer } =
    await import("../test/rechartsTestUtils");
  return withFixedResponsiveContainer(await importOriginal());
});

describe("MultiLineChart", () => {
  it("shows an empty message without enough data", () => {
    render(
      <MultiLineChart series={[{ name: "a", points: [1] }]} labels={["x"]} />,
    );
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  it("draws one line per series", () => {
    const { container } = render(
      <MultiLineChart
        series={[
          { name: "a", color: "#111", points: [1, 2, 3] },
          { name: "b", color: "#222", points: [3, 2, 1] },
        ]}
        labels={["w1", "w2", "w3"]}
      />,
    );
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2);
  });

  it("renders an interactive legend for multiple series", () => {
    render(
      <MultiLineChart
        series={[
          { name: "Quads", color: "#111", points: [1, 2, 3] },
          { name: "Back", color: "#222", points: [3, 2, 1] },
        ]}
        labels={["w1", "w2", "w3"]}
      />,
    );
    expect(screen.getByText("Quads")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  it("renders rounded value labels for a single series when showValues is set", () => {
    const { container } = render(
      <MultiLineChart
        series={[{ name: "a", points: [10.4, 20.6] }]}
        labels={["w1", "w2"]}
        showValues
      />,
    );
    const texts = [...container.querySelectorAll("text")].map(
      (t) => t.textContent,
    );
    expect(texts).toContain("21"); // 20.6 rounded
    expect(texts).toContain("10"); // 10.4 rounded
  });
});
