import { render, screen, within } from "@testing-library/react";
import MacroBars from "./MacroBars";

const TARGET = {
  from: "2026-11-01",
  kcal: 1000,
  protein: 100,
  carb: 200,
  fat: 50,
};

const totals = (overrides = {}) => ({
  kcal: 0,
  protein: 0,
  carb: 0,
  fat: 0,
  ...overrides,
});

const bar = (key) => screen.getByTestId(`macro-bar-${key}`);
const rowText = () => screen.getByRole("group", { name: "Day totals" });

describe("MacroBars", () => {
  it.each([
    [890, "89%", "bg-blue-600"],
    [900, "90%", "bg-amber-500"],
    [1000, "100%", "bg-amber-500"],
    [1010, "100%", "bg-red-600"],
  ])(
    "renders eaten/target and the tone class at %i of 1000 kcal",
    (kcal, width, tone) => {
      render(<MacroBars totals={totals({ kcal })} target={TARGET} />);
      expect(within(rowText()).getByText(`${kcal} / 1000 kcal`)).toBeVisible();
      expect(bar("kcal")).toHaveStyle({ width });
      expect(bar("kcal")).toHaveClass(tone);
    },
  );

  it("renders the four rows with their units against the target", () => {
    render(
      <MacroBars
        totals={{ kcal: 500, protein: 25.5, carb: 40, fat: 10 }}
        target={TARGET}
      />,
    );
    const group = within(rowText());
    expect(group.getByText("Calories")).toBeVisible();
    expect(group.getByText("500 / 1000 kcal")).toBeVisible();
    expect(group.getByText("Protein")).toBeVisible();
    expect(group.getByText("25.5 / 100 g")).toBeVisible();
    expect(group.getByText("Carbs")).toBeVisible();
    expect(group.getByText("40 / 200 g")).toBeVisible();
    expect(group.getByText("Fat")).toBeVisible();
    expect(group.getByText("10 / 50 g")).toBeVisible();
    expect(bar("protein")).toHaveStyle({ width: "25.5%" });
    expect(bar("carb")).toHaveStyle({ width: "20%" });
    expect(bar("fat")).toHaveStyle({ width: "20%" });
  });

  it("renders plain totals and no bars without a target", () => {
    render(
      <MacroBars
        totals={{ kcal: 500, protein: 25.5, carb: 40, fat: 10 }}
        target={null}
      />,
    );
    const group = within(rowText());
    expect(group.getByText("500 kcal")).toBeVisible();
    expect(group.getByText("25.5 g")).toBeVisible();
    expect(group.getByText("40 g")).toBeVisible();
    expect(group.getByText("10 g")).toBeVisible();
    for (const key of ["kcal", "protein", "carb", "fat"]) {
      expect(screen.queryByTestId(`macro-bar-${key}`)).toBeNull();
    }
    expect(screen.queryByText(/ \/ /)).toBeNull();
  });

  it("shows a zero macro target with width 0 and the ok tone", () => {
    render(
      <MacroBars totals={totals({ fat: 12 })} target={{ ...TARGET, fat: 0 }} />,
    );
    expect(screen.getByText("12 / 0 g")).toBeVisible();
    expect(bar("fat")).toHaveStyle({ width: "0%" });
    expect(bar("fat")).toHaveClass("bg-blue-600");
  });
});
