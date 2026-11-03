import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "../components/ConfirmDialog";
import { loadLS, saveLS } from "../lib/storage";
import { K_FOOD_ENTRIES, K_FOOD_TAB, K_FOOD_TARGETS } from "./lib/keys";
import { addDays, formatDayHeader, todayLocal } from "./lib/localDate";
import FoodApp from "./FoodApp";

function heading() {
  return screen.getByRole("heading", { level: 1 });
}

function navButton(name) {
  return within(screen.getByRole("navigation", { name: "Food" })).getByRole(
    "button",
    { name },
  );
}

describe("FoodApp", () => {
  const originalTitle = document.title;
  afterEach(() => {
    document.title = originalTitle;
  });

  it("defaults to Today and stores that tab when nothing is stored", () => {
    render(<FoodApp />);
    expect(heading()).toHaveTextContent("Today");
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(loadLS(K_FOOD_TAB)).toBe("today");
  });

  it("switches tab on click and persists it", async () => {
    const user = userEvent.setup();
    render(<FoodApp />);
    await user.click(screen.getByRole("button", { name: "Trends" }));
    expect(heading()).toHaveTextContent("Trends");
    expect(screen.getByRole("button", { name: "Trends" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Today" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(loadLS(K_FOOD_TAB)).toBe("trends");
  });

  it("renders the trends view on the Trends tab", async () => {
    const user = userEvent.setup();
    render(<FoodApp />);
    await user.click(screen.getByRole("button", { name: "Trends" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("restores a stored tab", () => {
    saveLS(K_FOOD_TAB, "settings");
    render(
      <ConfirmProvider>
        <FoodApp />
      </ConfirmProvider>,
    );
    expect(heading()).toHaveTextContent("Settings");
    expect(screen.getByRole("button", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it.each([["bogus"], ["constructor"], [["trends"]]])(
    "falls back to Today and rewrites storage on an invalid stored tab %j",
    (stored) => {
      saveLS(K_FOOD_TAB, stored);
      render(<FoodApp />);
      expect(heading()).toHaveTextContent("Today");
      expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(loadLS(K_FOOD_TAB)).toBe("today");
    },
  );

  it("sets the page title to Food Tracker", () => {
    document.title = "Gym Tracker";
    render(<FoodApp />);
    expect(document.title).toBe("Food Tracker");
  });

  it("mounts FoodProvider, which replaces corrupt entries with an empty list", () => {
    saveLS(K_FOOD_ENTRIES, { not: "an array" });
    render(<FoodApp />);
    expect(heading()).toHaveTextContent("Today");
    expect(loadLS(K_FOOD_ENTRIES)).toEqual([]);
  });

  describe("dropped-row note", () => {
    const note = () => screen.queryByText(/damaged food row/);

    it("uses the singular wording for one row", () => {
      saveLS(K_FOOD_ENTRIES, [null]);
      render(<FoodApp />);
      expect(screen.getByRole("status")).toHaveTextContent(
        /^Removed 1 damaged food row from this device\. A backup can restore them\.$/,
      );
    });

    it("uses the plural wording and the count summed over the lists", () => {
      saveLS(K_FOOD_ENTRIES, [null, { id: "bad" }]);
      saveLS(K_FOOD_TARGETS, [null]);
      render(<FoodApp />);
      expect(screen.getByRole("status")).toHaveTextContent(
        /^Removed 3 damaged food rows from this device\. A backup can restore them\.$/,
      );
    });

    it("stays on every tab, above the tab content", async () => {
      const user = userEvent.setup();
      saveLS(K_FOOD_ENTRIES, [null]);
      render(
        <ConfirmProvider>
          <FoodApp />
        </ConfirmProvider>,
      );
      for (const tab of ["Search", "Trends", "Settings", "Today"]) {
        await user.click(navButton(tab));
        expect(heading()).toHaveTextContent(tab);
        expect(note()).toBeInTheDocument();
      }
      await user.click(navButton("Trends"));
      expect(
        note().compareDocumentPosition(screen.getByRole("table")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("is absent with clean storage", () => {
      render(<FoodApp />);
      expect(note()).toBeNull();
    });

    it("is absent for a stored non-array", () => {
      saveLS(K_FOOD_ENTRIES, { not: "an array" });
      render(<FoodApp />);
      expect(note()).toBeNull();
    });

    it("is absent on the next mount, and stores nothing about itself", () => {
      saveLS(K_FOOD_ENTRIES, [null]);
      const { unmount } = render(<FoodApp />);
      expect(note()).toBeInTheDocument();
      unmount();
      expect(loadLS(K_FOOD_ENTRIES)).toEqual([]);
      render(<FoodApp />);
      expect(note()).toBeNull();
    });
  });

  it("links back to the gym app", () => {
    render(<FoodApp />);
    expect(screen.getByRole("link", { name: "Gym" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("renders the search view below the heading on the search tab only", async () => {
    const user = userEvent.setup();
    render(<FoodApp />);
    expect(screen.queryByRole("searchbox")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(heading()).toHaveTextContent("Search");
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("renders the targets editor on the settings tab", () => {
    saveLS(K_FOOD_TAB, "settings");
    render(
      <ConfirmProvider>
        <FoodApp />
      </ConfirmProvider>,
    );
    expect(screen.getByLabelText("Calories")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Gym" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("logs today's date and switches to the today tab after Add", async () => {
    saveLS(K_FOOD_TAB, "search");
    const user = userEvent.setup();
    render(<FoodApp />);

    await user.type(screen.getByRole("searchbox"), "banana");
    await user.click(await screen.findByRole("button", { name: /banana/ }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(heading()).toHaveTextContent("Today");
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(loadLS(K_FOOD_TAB)).toBe("today");
    const entries = loadLS(K_FOOD_ENTRIES);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe(todayLocal());
    expect(entries[0].name).toBe("banana, raw");
  });

  it("shows the day log on the today tab", () => {
    render(<FoodApp />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      formatDayHeader(todayLocal()),
    );
    expect(screen.getByRole("region", { name: "Lunch" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Day totals" })).toBeVisible();
  });

  describe("local day", () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    });

    // Search through the nav and add the first banana row at its default amount.
    const logBanana = async (user) => {
      await user.click(navButton("Search"));
      await user.type(screen.getByRole("searchbox"), "banana");
      await user.click(await screen.findByRole("button", { name: /banana/ }));
      await user.click(screen.getByRole("button", { name: "Add" }));
    };

    it("opens on the local day and logs to it before 07:00 in UTC+7", async () => {
      vi.stubEnv("TZ", "Asia/Ho_Chi_Minh");
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-02T23:30:00Z")); // 06:30 on 3 Nov local
      const user = userEvent.setup();
      render(<FoodApp />);

      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        formatDayHeader("2026-11-03"),
      );

      await logBanana(user);
      expect(loadLS(K_FOOD_ENTRIES)[0].date).toBe("2026-11-03");
    });

    it("opens on the local day late in the evening west of UTC", () => {
      vi.stubEnv("TZ", "America/New_York");
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-03T03:00:00Z")); // 22:00 on 2 Nov local
      render(<FoodApp />);

      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        formatDayHeader("2026-11-02"),
      );
    });
  });

  describe("adding to a slot", () => {
    // Noon, so a Search with no preset opens on Lunch; the tests tap Dinner.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 10, 3, 12, 0));
    });
    afterEach(() => vi.useRealTimers());

    const openBananaSheet = async (user) => {
      await user.type(screen.getByRole("searchbox"), "banana");
      await user.click(await screen.findByRole("button", { name: /banana/ }));
      return within(screen.getByRole("dialog"));
    };

    const expectSlotSelected = (sheet, label) => {
      expect(sheet.getByRole("button", { name: label })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    };

    it("+ on a slot opens Search with that slot selected", async () => {
      const user = userEvent.setup();
      render(<FoodApp />);

      await user.click(screen.getByRole("button", { name: "Add to Dinner" }));
      expect(heading()).toHaveTextContent("Search");
      expect(loadLS(K_FOOD_TAB)).toBe("search");

      const sheet = await openBananaSheet(user);
      expectSlotSelected(sheet, "Dinner");
    });

    it("logs to the viewed past day and returns to it", async () => {
      const user = userEvent.setup();
      render(<FoodApp />);
      const yesterday = addDays(todayLocal(), -1);

      await user.click(screen.getByRole("button", { name: "Previous day" }));
      expect(heading()).toHaveTextContent("Today");
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        formatDayHeader(yesterday),
      );

      await user.click(screen.getByRole("button", { name: "Add to Dinner" }));
      const sheet = await openBananaSheet(user);
      await user.click(sheet.getByRole("button", { name: "Add" }));

      const entries = loadLS(K_FOOD_ENTRIES);
      expect(entries).toHaveLength(1);
      expect(entries[0].date).toBe(yesterday);
      expect(entries[0].slot).toBe("dinner");

      expect(heading()).toHaveTextContent("Today");
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        formatDayHeader(yesterday),
      );
      expect(
        within(screen.getByRole("region", { name: "Dinner" })).getByRole(
          "button",
          { name: /banana/ },
        ),
      ).toBeVisible();
    });

    it("drops the slot after a log", async () => {
      const user = userEvent.setup();
      render(<FoodApp />);

      await user.click(screen.getByRole("button", { name: "Add to Dinner" }));
      const first = await openBananaSheet(user);
      await user.click(first.getByRole("button", { name: "Add" }));
      expect(heading()).toHaveTextContent("Today");

      await user.click(navButton("Search"));
      const second = await openBananaSheet(user);
      expectSlotSelected(second, "Lunch");
    });

    it.each([["Today"], ["Trends"], ["Settings"], ["Search"]])(
      "drops the slot when the %s tab is picked from the nav",
      async (tabName) => {
        const user = userEvent.setup();
        render(
          <ConfirmProvider>
            <FoodApp />
          </ConfirmProvider>,
        );

        await user.click(screen.getByRole("button", { name: "Add to Dinner" }));
        await user.click(navButton(tabName));
        await user.click(navButton("Search"));

        const sheet = await openBananaSheet(user);
        expectSlotSelected(sheet, "Lunch");
      },
    );
  });
});
