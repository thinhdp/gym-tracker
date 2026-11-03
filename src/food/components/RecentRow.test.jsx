import { act, fireEvent, render, screen } from "@testing-library/react";
import { loadLS, saveLS } from "../../lib/storage";
import { FoodProvider } from "../context/FoodContext";
import { K_FOOD_ENTRIES, K_FOOD_RECENT } from "../lib/keys";
import { normalizeEntry } from "../lib/normalize";
import RecentRow from "./RecentRow";

const PER100 = { kcal: 155, protein: 13, carb: 1.1, fat: 11 };

const recent = (id, name, overrides = {}) => ({
  food: { kind: "db", id },
  name,
  per100: PER100,
  portions: [{ label: "1 large egg", grams: 50, isDefault: true }],
  lastGrams: 100,
  lastAt: 1000,
  ...overrides,
});

const EGG = recent("egg", "Egg", {
  lastGrams: 50,
  lastPortionLabel: "1 large egg",
  lastAt: 2000,
});
const RICE = recent("rice", "Rice", { lastGrams: 200 });

function setup(rows = [EGG, RICE], date = "2026-10-20") {
  saveLS(K_FOOD_RECENT, rows);
  const onOpen = vi.fn();
  const view = render(
    <FoodProvider>
      <RecentRow date={date} onOpen={onOpen} />
    </FoodProvider>,
  );
  return { ...view, onOpen };
}

const chip = (name) => screen.getByRole("button", { name });
const tap = (name) => fireEvent.click(chip(name));
const storedEntries = () => loadLS(K_FOOD_ENTRIES);

describe("RecentRow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 3, 8, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("renders a chip per recent food, labelled by name and grams, in stored order", () => {
    setup();
    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels).toEqual(["Egg · 50 g", "…", "Rice · 200 g", "…"]);
  });

  it("renders nothing with no recent rows", () => {
    const { container } = setup([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("one tap logs lastGrams into the time-of-day slot on the given date", () => {
    setup();
    tap("Egg · 50 g");

    const [entry] = storedEntries();
    expect(entry).toMatchObject({
      date: "2026-10-20",
      slot: "breakfast",
      name: "Egg",
      grams: 50,
      per100: PER100,
      portionLabel: "1 large egg",
    });
    expect(entry).not.toHaveProperty("portions");
  });

  it("passes recent.food as the entry's food, so the entry passes normalizeEntry", () => {
    setup([recent("off", "Noodles", { food: EGG.food })]);
    tap("Noodles · 100 g");

    const [entry] = storedEntries();
    expect(entry.food).toStrictEqual(EGG.food);
    expect(normalizeEntry(entry)).not.toBeNull();
  });

  it("reads the slot at tap time, not at render time", () => {
    setup();
    vi.setSystemTime(new Date(2026, 10, 3, 18, 0));
    tap("Egg · 50 g");
    expect(storedEntries()[0].slot).toBe("dinner");
  });

  it("moves the tapped food to the front and keeps its portions", () => {
    setup();
    tap("Rice · 200 g");

    const stored = loadLS(K_FOOD_RECENT);
    expect(stored.map((row) => row.food.id)).toEqual(["rice", "egg"]);
    expect(stored[0].portions).toEqual(RICE.portions);
    expect(stored[0].lastGrams).toBe(200);
    expect(stored[0]).not.toHaveProperty("lastPortionLabel");
  });

  it("shows a toast and Undo removes that entry only; the recent row stays", () => {
    setup();
    tap("Rice · 200 g");
    act(() => vi.advanceTimersByTime(4000));
    tap("Egg · 50 g");
    expect(screen.getByRole("status")).toHaveTextContent("Logged Egg");

    fireEvent.click(chip("Undo"));

    expect(storedEntries().map((entry) => entry.name)).toEqual(["Rice"]);
    expect(screen.queryByRole("status")).toBeNull();
    expect(loadLS(K_FOOD_RECENT).map((row) => row.food.id)).toEqual([
      "egg",
      "rice",
    ]);
  });

  it("the toast goes after its time and the entry stays", () => {
    setup();
    tap("Egg · 50 g");
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).toBeNull();
    expect(storedEntries()).toHaveLength(1);
  });

  it("a second tap replaces the toast and restarts its timer; Undo removes the second entry", () => {
    setup();
    tap("Egg · 50 g");
    act(() => vi.advanceTimersByTime(2000));
    tap("Rice · 200 g");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Logged Rice");

    // Past the first tap's three seconds, inside the second tap's.
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("status")).toHaveTextContent("Logged Rice");

    fireEvent.click(chip("Undo"));
    expect(storedEntries().map((entry) => entry.name)).toEqual(["Egg"]);
  });

  it("a second tap on the same food restarts the timer too", () => {
    setup();
    tap("Egg · 50 g");
    act(() => vi.advanceTimersByTime(2000));
    tap("Egg · 50 g");
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("status")).toBeNull();
    expect(storedEntries()).toHaveLength(2);
  });

  it("the options button calls onOpen with the recent row and logs nothing", () => {
    const { onOpen } = setup();
    tap("Options for Rice");
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(RICE);
    expect(storedEntries()).toEqual([]);
  });
});
