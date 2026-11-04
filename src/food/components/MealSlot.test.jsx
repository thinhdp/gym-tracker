import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MealSlot from "./MealSlot";

const entry = (id, per100, grams = 100) => ({
  id,
  name: id,
  grams,
  per100,
  slot: "lunch",
  createdAt: 1,
});

const ENTRIES = [
  entry("rice", { kcal: 130, protein: 2.7, carb: 28, fat: 0.3 }),
  entry("egg", { kcal: 150, protein: 12.5, carb: 1, fat: 10 }, 50),
];

function setup(props = {}) {
  const onToggle = vi.fn();
  const user = userEvent.setup();
  render(
    <MealSlot
      slot="lunch"
      entries={ENTRIES}
      expanded={false}
      onToggle={onToggle}
      onAdd={() => {}}
      onEdit={() => {}}
      {...props}
    />,
  );
  return { onToggle, user };
}

describe("MealSlot", () => {
  it("collapsed shows the kcal button with aria-expanded false and no macros", () => {
    setup();
    const button = screen.getByRole("button", { name: "Lunch totals" });
    expect(button).toHaveTextContent("205 kcal");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/P /)).toBeNull();
  });

  it("expanded shows the summed macros and each row's macro line", () => {
    setup({ expanded: true });
    expect(
      screen.getByRole("button", { name: "Lunch totals" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("P 9 g")).toBeVisible();
    expect(screen.getByText("C 28.5 g")).toBeVisible();
    expect(screen.getByText("F 5.3 g")).toBeVisible();
    expect(screen.getByText("P 2.7 · C 28 · F 0.3")).toBeVisible();
    expect(screen.getByText("P 6.3 · C 0.5 · F 5")).toBeVisible();
  });

  it("an empty slot expanded shows the zero line", () => {
    setup({ entries: [], expanded: true });
    expect(screen.getByText("P 0 g")).toBeVisible();
    expect(screen.getByText("C 0 g")).toBeVisible();
    expect(screen.getByText("F 0 g")).toBeVisible();
  });

  it("clicking the kcal button calls onToggle once", async () => {
    const { onToggle, user } = setup();
    await user.click(screen.getByRole("button", { name: "Lunch totals" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
