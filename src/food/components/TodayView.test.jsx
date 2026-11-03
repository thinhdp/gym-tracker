import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { loadLS, saveLS } from "../../lib/storage";
import { FoodProvider } from "../context/FoodContext";
import { K_FOOD_ENTRIES, K_FOOD_MEALS, K_FOOD_TARGETS } from "../lib/keys";
import { formatDayHeader, todayLocal } from "../lib/localDate";
import { SLOTS } from "../lib/slots";
import TodayView from "./TodayView";

const PER100 = { kcal: 100, protein: 10, carb: 20, fat: 5 };

function entry(id, overrides = {}) {
  return {
    id,
    date: "2026-11-02",
    slot: "lunch",
    name: id,
    grams: 100,
    per100: PER100,
    food: { kind: "db", id: `food-${id}` },
    createdAt: 1000,
    ...overrides,
  };
}

function Harness({ start, onAddTo }) {
  const [date, setDate] = useState(start);
  return <TodayView date={date} onChangeDate={setDate} onAddTo={onAddTo} />;
}

function setup(start = "2026-11-02") {
  const onAddTo = vi.fn();
  const user = userEvent.setup();
  render(
    <ConfirmProvider>
      <FoodProvider>
        <Harness start={start} onAddTo={onAddTo} />
      </FoodProvider>
    </ConfirmProvider>,
  );
  return { onAddTo, user };
}

const slotRegion = (label) =>
  within(screen.getByRole("region", { name: label }));
const totals = () => within(screen.getByRole("group", { name: "Day totals" }));
const grams = () => screen.getByRole("spinbutton", { name: "Grams" });
const storedRow = (id) => loadLS(K_FOOD_ENTRIES).find((row) => row.id === id);

async function setGrams(user, value) {
  await user.clear(grams());
  await user.type(grams(), value);
}

describe("TodayView", () => {
  it("renders the six slots in order and places entries by slot", () => {
    saveLS(K_FOOD_ENTRIES, [
      entry("rice", { slot: "lunch" }),
      entry("yoghurt", { slot: "snack3" }),
    ]);
    setup();
    expect(
      screen
        .getAllByRole("region")
        .map((region) => region.getAttribute("aria-label")),
    ).toEqual(SLOTS.map((slot) => slot.label));
    expect(slotRegion("Lunch").getByText("rice")).toBeVisible();
    expect(slotRegion("Lunch").queryByText("yoghurt")).toBeNull();
    expect(slotRegion("Evening snack").getByText("yoghurt")).toBeVisible();
    expect(
      slotRegion("Breakfast").queryByRole("button", { name: /rice/ }),
    ).toBeNull();
  });

  it("shows the slot kcal total and a row's name, amount and kcal", () => {
    saveLS(K_FOOD_ENTRIES, [
      entry("rice", { grams: 150 }),
      entry("egg", { grams: 50, portionLabel: "1 large egg" }),
    ]);
    setup();
    const lunch = slotRegion("Lunch");
    expect(lunch.getByRole("button", { name: /rice/ })).toHaveTextContent(
      "rice150 g150 kcal",
    );
    expect(lunch.getByRole("button", { name: /egg/ })).toHaveTextContent(
      "egg1 large egg50 kcal",
    );
    expect(lunch.getByText("200 kcal")).toBeVisible();
    expect(slotRegion("Dinner").getByText("0 kcal")).toBeVisible();
  });

  it("orders a slot's rows by createdAt and keeps stored order on a tie", () => {
    saveLS(K_FOOD_ENTRIES, [
      entry("late", { createdAt: 3000 }),
      entry("tie-first", { createdAt: 2000 }),
      entry("early", { createdAt: 1000 }),
      entry("tie-second", { createdAt: 2000 }),
    ]);
    setup();
    const names = slotRegion("Lunch")
      .getAllByRole("button", { name: /early|tie|late/ })
      .map((row) => row.textContent.split("100 g")[0]);
    expect(names).toEqual(["early", "tie-first", "tie-second", "late"]);
  });

  it("sums only the selected date and navigates days", async () => {
    saveLS(K_FOOD_ENTRIES, [
      entry("monday", { date: "2026-11-02", grams: 100 }),
      entry("tuesday", { date: "2026-11-03", grams: 300 }),
    ]);
    const { user } = setup("2026-11-02");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      formatDayHeader("2026-11-02"),
    );
    expect(totals().getByText("100 kcal")).toBeVisible();
    expect(screen.getByRole("button", { name: /monday/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /tuesday/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next day" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      formatDayHeader("2026-11-03"),
    );
    expect(totals().getByText("300 kcal")).toBeVisible();
    expect(screen.getByRole("button", { name: /tuesday/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /monday/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Previous day" }));
    expect(totals().getByText("100 kcal")).toBeVisible();
  });

  it("shows the Today button only away from today, and it returns to today", async () => {
    const { user } = setup(todayLocal());
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Previous day" }));
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      formatDayHeader(todayLocal()),
    );
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
  });

  it("shows plain totals and no bars with no target row", () => {
    saveLS(K_FOOD_ENTRIES, [entry("rice", { grams: 200 })]);
    setup();
    expect(totals().getByText("200 kcal")).toBeVisible();
    expect(screen.queryByTestId("macro-bar-kcal")).toBeNull();
  });

  it("uses the target row in force on the viewed date", async () => {
    saveLS(K_FOOD_TARGETS, [
      { from: "2026-11-03", kcal: 2000, protein: 100, carb: 200, fat: 50 },
    ]);
    const { user } = setup("2026-11-02");
    expect(screen.queryByTestId("macro-bar-kcal")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next day" }));
    expect(screen.getByTestId("macro-bar-kcal")).toBeInTheDocument();
    expect(totals().getByText("0 / 2000 kcal")).toBeVisible();
  });

  it("edits grams and slot through the sheet", async () => {
    saveLS(K_FOOD_ENTRIES, [entry("rice", { grams: 100 })]);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /rice/ }));
    const sheet = within(screen.getByRole("dialog", { name: "rice" }));
    await setGrams(user, "250");
    await user.click(sheet.getByRole("button", { name: "Dinner" }));
    await user.click(sheet.getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(storedRow("rice").grams).toBe(250);
    expect(storedRow("rice").slot).toBe("dinner");
    expect(
      slotRegion("Dinner").getByRole("button", { name: /rice/ }),
    ).toHaveTextContent("250 kcal");
    expect(slotRegion("Lunch").queryByText("rice")).toBeNull();
  });

  it("clears portionLabel when grams change and leaves per100, food and date", async () => {
    const row = entry("egg", { grams: 50, portionLabel: "1 large egg" });
    saveLS(K_FOOD_ENTRIES, [row]);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /egg/ }));
    await setGrams(user, "60");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const expected = { ...row, grams: 60 };
    delete expected.portionLabel;
    expect(storedRow("egg")).toEqual(expected);
    expect(storedRow("egg")).not.toHaveProperty("portionLabel");
    expect(screen.getByRole("button", { name: /egg/ })).toHaveTextContent(
      "60 g",
    );
  });

  it("keeps portionLabel when grams are unchanged", async () => {
    const row = entry("egg", { grams: 50, portionLabel: "1 large egg" });
    saveLS(K_FOOD_ENTRIES, [row]);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /egg/ }));
    await setGrams(user, "50");
    await user.click(screen.getByRole("button", { name: "Dinner" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(storedRow("egg")).toEqual({ ...row, slot: "dinner" });
  });

  it("keeps portionLabel when the grams text changes but the number does not", async () => {
    const row = entry("egg", { grams: 50, portionLabel: "1 large egg" });
    saveLS(K_FOOD_ENTRIES, [row]);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /egg/ }));
    // fireEvent: user.type on a controlled number input normalises "50.0" to "50".
    fireEvent.change(grams(), { target: { value: "50.0" } });
    expect(grams()).toHaveValue(50);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(storedRow("egg")).toEqual(row);
  });

  it.each([["0"], ["-5"]])(
    "disables Save on invalid grams %s",
    async (value) => {
      saveLS(K_FOOD_ENTRIES, [entry("rice")]);
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: /rice/ }));
      await setGrams(user, value);
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(grams()).toHaveAttribute("aria-invalid", "true");
    },
  );

  it("disables Save on empty grams", async () => {
    saveLS(K_FOOD_ENTRIES, [entry("rice")]);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /rice/ }));
    await user.clear(grams());
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("offers no portion picker in the sheet", async () => {
    saveLS(K_FOOD_ENTRIES, [entry("egg", { portionLabel: "1 large egg" })]);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /egg/ }));
    const sheet = within(screen.getByRole("dialog", { name: "egg" }));
    expect(sheet.queryByRole("button", { name: "1 large egg" })).toBeNull();
  });

  it("Close leaves the entry unchanged", async () => {
    const row = entry("rice");
    saveLS(K_FOOD_ENTRIES, [row]);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /rice/ }));
    await setGrams(user, "999");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(storedRow("rice")).toEqual(row);
  });

  it("deletes only after confirm", async () => {
    const row = entry("rice");
    saveLS(K_FOOD_ENTRIES, [row]);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /rice/ }));
    const sheet = within(screen.getByRole("dialog", { name: "rice" }));
    await user.click(sheet.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(storedRow("rice")).toEqual(row);
    expect(screen.getByRole("dialog", { name: "rice" })).toBeVisible();

    await user.click(sheet.getByRole("button", { name: "Delete" }));
    // The sheet's button comes first in the DOM, the confirm dialog's last.
    await user.click(screen.getAllByRole("button", { name: "Delete" }).at(-1));
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: /rice/ })).toBeNull();
  });

  it("+ on a slot calls onAddTo with that slot id", async () => {
    const { onAddTo, user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Add to Afternoon snack" }),
    );
    expect(onAddTo).toHaveBeenCalledTimes(1);
    expect(onAddTo).toHaveBeenCalledWith("snack2");
  });

  describe("slot menu and saved meals", () => {
    const MEAL = {
      id: "m1",
      name: "Rice bowl",
      items: [
        {
          name: "rice",
          grams: 200,
          per100: PER100,
          food: { kind: "db", id: "food-rice" },
        },
      ],
      createdAt: 500,
    };
    const menu = (label) => screen.getByRole("dialog", { name: label });
    const panel = () => screen.getByRole("dialog", { name: "Saved meals" });
    const sheet = () => screen.getByRole("dialog", { name: "Save meal" });

    it("the options button opens a menu for that slot, not the panel", async () => {
      const { user } = setup();
      const options = screen.getByRole("button", { name: "Lunch options" });
      expect(options).toBeEnabled();
      expect(screen.queryByRole("dialog")).toBeNull();

      await user.click(options);

      expect(menu("Lunch options")).toBeVisible();
      expect(screen.queryByRole("dialog", { name: "Saved meals" })).toBeNull();
    });

    it("the menu shows both actions when the slot has entries", async () => {
      saveLS(K_FOOD_ENTRIES, [entry("rice", { slot: "lunch" })]);
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Lunch options" }));
      const m = within(menu("Lunch options"));
      expect(m.getByRole("button", { name: "Save as meal" })).toBeVisible();
      expect(m.getByRole("button", { name: "Log saved meal" })).toBeVisible();
      expect(m.getByRole("button", { name: "Close" })).toBeVisible();
    });

    it("the menu hides Save as meal when the slot is empty on the viewed day", async () => {
      saveLS(K_FOOD_ENTRIES, [
        entry("rice", { slot: "lunch" }),
        entry("old", { slot: "dinner", date: "2026-11-01" }),
      ]);
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Dinner options" }));
      const m = within(menu("Dinner options"));
      expect(m.queryByRole("button", { name: "Save as meal" })).toBeNull();
      expect(m.getByRole("button", { name: "Log saved meal" })).toBeVisible();
    });

    it("Close on the menu closes it and changes nothing", async () => {
      const entries = [entry("rice", { slot: "lunch" })];
      saveLS(K_FOOD_ENTRIES, entries);
      saveLS(K_FOOD_MEALS, [MEAL]);
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Lunch options" }));
      await user.click(
        within(menu("Lunch options")).getByRole("button", { name: "Close" }),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(loadLS(K_FOOD_ENTRIES)).toEqual(entries);
      expect(loadLS(K_FOOD_MEALS)).toEqual([MEAL]);
    });

    it.each([
      ["lunch", "Lunch", "rice"],
      ["dinner", "Dinner", "fish"],
    ])(
      "Save as meal on %s stores that slot's entries only",
      async (_slot, label, food) => {
        saveLS(K_FOOD_ENTRIES, [
          entry("rice", { slot: "lunch" }),
          entry("fish", { slot: "dinner" }),
        ]);
        const { user } = setup();
        await user.click(
          screen.getByRole("button", { name: `${label} options` }),
        );
        await user.click(
          within(menu(`${label} options`)).getByRole("button", {
            name: "Save as meal",
          }),
        );
        expect(
          within(sheet()).getByText(new RegExp(`^${label} ·`)),
        ).toBeVisible();
        await user.type(within(sheet()).getByLabelText("Save as meal"), "M");
        await user.click(within(sheet()).getByRole("button", { name: "Save" }));

        const meals = loadLS(K_FOOD_MEALS);
        expect(meals).toHaveLength(1);
        expect(meals[0].items.map((item) => item.name)).toEqual([food]);
      },
    );

    it.each([
      ["lunch", "Lunch"],
      ["dinner", "Dinner"],
    ])(
      "Log saved meal on %s stores the entries in that slot",
      async (slot, label) => {
        saveLS(K_FOOD_MEALS, [MEAL]);
        const { user } = setup();
        await user.click(
          screen.getByRole("button", { name: `${label} options` }),
        );
        await user.click(
          within(menu(`${label} options`)).getByRole("button", {
            name: "Log saved meal",
          }),
        );
        await user.click(
          within(panel()).getByRole("button", { name: /Rice bowl/ }),
        );

        const stored = loadLS(K_FOOD_ENTRIES);
        expect(stored).toHaveLength(1);
        expect(stored[0].slot).toBe(slot);
      },
    );

    it("logging after changing the day stores entries on the new day", async () => {
      saveLS(K_FOOD_MEALS, [MEAL]);
      const { user } = setup("2026-11-02");
      await user.click(screen.getByRole("button", { name: "Next day" }));
      await user.click(screen.getByRole("button", { name: "Lunch options" }));
      await user.click(
        within(menu("Lunch options")).getByRole("button", {
          name: "Log saved meal",
        }),
      );
      await user.click(
        within(panel()).getByRole("button", { name: /Rice bowl/ }),
      );
      expect(loadLS(K_FOOD_ENTRIES).map((row) => row.date)).toEqual([
        "2026-11-03",
      ]);

      await user.click(screen.getByRole("button", { name: "Previous day" }));
      await user.click(screen.getByRole("button", { name: "Previous day" }));
      await user.click(screen.getByRole("button", { name: "Lunch options" }));
      await user.click(
        within(menu("Lunch options")).getByRole("button", {
          name: "Log saved meal",
        }),
      );
      await user.click(
        within(panel()).getByRole("button", { name: /Rice bowl/ }),
      );
      expect(
        loadLS(K_FOOD_ENTRIES)
          .map((row) => row.date)
          .sort(),
      ).toEqual(["2026-11-01", "2026-11-03"]);
    });

    it("Log saved meal closes the menu and opens the panel for that slot and date", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Dinner options" }));
      await user.click(
        within(menu("Dinner options")).getByRole("button", {
          name: "Log saved meal",
        }),
      );

      expect(
        screen.queryByRole("dialog", { name: "Dinner options" }),
      ).toBeNull();
      expect(
        within(panel()).getByText(`Dinner · ${formatDayHeader("2026-11-02")}`),
      ).toBeVisible();
      expect(within(panel()).queryByLabelText("Save as meal")).toBeNull();
    });

    it("Save as meal closes the menu and opens the sheet for that slot and date", async () => {
      saveLS(K_FOOD_ENTRIES, [entry("rice", { slot: "lunch" })]);
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Lunch options" }));
      await user.click(
        within(menu("Lunch options")).getByRole("button", {
          name: "Save as meal",
        }),
      );

      expect(
        screen.queryByRole("dialog", { name: "Lunch options" }),
      ).toBeNull();
      expect(
        within(sheet()).getByText(`Lunch · ${formatDayHeader("2026-11-02")}`),
      ).toBeVisible();
    });

    it("saving from Today stores a meal and closes the sheet", async () => {
      saveLS(K_FOOD_ENTRIES, [entry("rice", { slot: "lunch" })]);
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Lunch options" }));
      await user.click(
        within(menu("Lunch options")).getByRole("button", {
          name: "Save as meal",
        }),
      );
      await user.type(
        within(sheet()).getByLabelText("Save as meal"),
        "Usual lunch",
      );
      await user.click(within(sheet()).getByRole("button", { name: "Save" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(loadLS(K_FOOD_MEALS).map((meal) => meal.name)).toEqual([
        "Usual lunch",
      ]);
    });

    it("logging a meal on a viewed past day stores entries on that day and closes the panel", async () => {
      saveLS(K_FOOD_MEALS, [MEAL]);
      const { user } = setup("2026-10-20");
      await user.click(screen.getByRole("button", { name: "Dinner options" }));
      await user.click(
        within(menu("Dinner options")).getByRole("button", {
          name: "Log saved meal",
        }),
      );
      await user.click(
        within(panel()).getByRole("button", { name: /Rice bowl/ }),
      );

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(slotRegion("Dinner").getByText("rice")).toBeVisible();
      const stored = loadLS(K_FOOD_ENTRIES);
      expect(stored).toHaveLength(1);
      expect(stored[0].date).toBe("2026-10-20");
      expect(stored[0].slot).toBe("dinner");
    });

    it("Close on the panel leaves nothing changed", async () => {
      saveLS(K_FOOD_MEALS, [MEAL]);
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Lunch options" }));
      await user.click(
        within(menu("Lunch options")).getByRole("button", {
          name: "Log saved meal",
        }),
      );
      await user.click(within(panel()).getByRole("button", { name: "Close" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(loadLS(K_FOOD_ENTRIES)).toEqual([]);
      expect(loadLS(K_FOOD_MEALS)).toEqual([MEAL]);
    });
  });
});
