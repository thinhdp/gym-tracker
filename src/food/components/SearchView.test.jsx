import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadLS, saveLS } from "../../lib/storage";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { FoodProvider } from "../context/FoodContext";
import { K_FOOD_CUSTOM, K_FOOD_ENTRIES } from "../lib/keys";
import { FoodApiError, isFixtureMode, searchFoods } from "../lib/foodApi";
import SearchView from "./SearchView";

vi.mock("../lib/foodApi", async (importActual) => ({
  ...(await importActual()),
  searchFoods: vi.fn(),
  isFixtureMode: vi.fn(() => false),
}));

const food = (id, name, extra = {}) => ({
  id,
  name,
  prepState: null,
  source: "usda_fdc",
  isVerified: true,
  barcode: null,
  per100: { kcal: 165, protein: 31, carb: 0, fat: 3.6 },
  portions: [{ label: "1 piece", grams: 100, isDefault: true }],
  ...extra,
});

const CUSTOM = {
  id: "custom-1",
  name: "Chicken Salad",
  per100: { kcal: 120, protein: 15, carb: 3, fat: 5 },
  portions: [{ label: "1 bowl", grams: 250 }],
  createdAt: 1,
};

/** A promise the test settles by hand. */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(props = {}) {
  const onLogged = vi.fn();
  const view = render(
    <ConfirmProvider>
      <FoodProvider>
        <SearchView
          date="2026-11-03"
          presetSlot="lunch"
          onLogged={onLogged}
          {...props}
        />
      </FoodProvider>
    </ConfirmProvider>,
  );
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  return { ...view, onLogged, user };
}

const box = () => screen.getByRole("searchbox");
const tick = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));
const rowButton = (name) => screen.getByRole("button", { name });
const settle = (run) =>
  act(async () => {
    run();
  });

describe("SearchView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // RTL drains user-event calls with a setTimeout, and advances it only
    // through a global named `jest`.
    vi.stubGlobal("jest", {
      advanceTimersByTime: vi.advanceTimersByTime.bind(vi),
    });
    searchFoods.mockReset();
    searchFoods.mockResolvedValue([]);
    isFixtureMode.mockReset();
    isFixtureMode.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("debounce", () => {
    it("autofocuses the text box", () => {
      setup();
      expect(box()).toHaveFocus();
    });

    it("does not search below two characters and debounces", async () => {
      const { user } = setup();
      await user.type(box(), "c");
      await tick(1000);
      expect(searchFoods).not.toHaveBeenCalled();

      await user.type(box(), "h");
      await tick(299);
      expect(searchFoods).not.toHaveBeenCalled();
      await tick(1);
      expect(searchFoods).toHaveBeenCalledTimes(1);
      expect(searchFoods.mock.calls[0][0]).toBe("ch");
      expect(searchFoods.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it("sends one request for several fast keystrokes", async () => {
      const { user } = setup();
      await user.type(box(), "chi");
      await tick(100);
      await user.type(box(), "ck");
      await tick(300);
      expect(searchFoods).toHaveBeenCalledTimes(1);
      expect(searchFoods.mock.calls[0][0]).toBe("chick");
    });

    it("counts two characters after normalising, so spaces do not search", async () => {
      const { user } = setup();
      await user.type(box(), "c  ");
      await tick(1000);
      expect(searchFoods).not.toHaveBeenCalled();
    });
  });

  describe("stale requests", () => {
    it("aborts the previous request when the query changes and ignores stale results", async () => {
      const first = deferred();
      const second = deferred();
      searchFoods
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { user } = setup();

      await user.type(box(), "ch");
      await tick(300);
      const firstSignal = searchFoods.mock.calls[0][1].signal;
      expect(firstSignal.aborted).toBe(false);

      await user.type(box(), "i");
      expect(firstSignal.aborted).toBe(true);
      await tick(300);
      const secondSignal = searchFoods.mock.calls[1][1].signal;
      expect(secondSignal.aborted).toBe(false);

      // The newer request answers first; the older one lands on top of it.
      await settle(() => second.resolve([food("b", "second result")]));
      await settle(() => first.resolve([food("a", "first result")]));

      expect(screen.getByText("second result")).toBeInTheDocument();
      expect(screen.queryByText("first result")).toBeNull();
    });

    it("ignores the error of an aborted request", async () => {
      const first = deferred();
      const second = deferred();
      searchFoods
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { user } = setup();

      await user.type(box(), "ch");
      await tick(300);
      await user.type(box(), "i");
      await tick(300);
      await settle(() => second.resolve([food("b", "second result")]));
      await settle(() => first.reject(new FoodApiError("rate_limited")));

      expect(screen.getByText("second result")).toBeInTheDocument();
      expect(screen.queryByText("Too many searches, wait a minute")).toBeNull();
    });

    it("ignores an AbortError", async () => {
      searchFoods.mockRejectedValueOnce(
        new DOMException("Aborted", "AbortError"),
      );
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(screen.queryByText("Search unavailable, try again")).toBeNull();
    });
  });

  describe("below two characters", () => {
    it("aborts the in-flight request and clears the results and error", async () => {
      searchFoods.mockResolvedValueOnce([food("a", "first result")]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(screen.getByText("first result")).toBeInTheDocument();

      await user.keyboard("{Backspace}");
      expect(screen.queryByText("first result")).toBeNull();

      searchFoods.mockRejectedValueOnce(new FoodApiError("unavailable"));
      await user.type(box(), "h");
      await tick(300);
      expect(
        screen.getByText("Search unavailable, try again"),
      ).toBeInTheDocument();

      await user.keyboard("{Backspace}");
      expect(screen.queryByText("Search unavailable, try again")).toBeNull();

      const pending = deferred();
      searchFoods.mockReturnValueOnce(pending.promise);
      await user.type(box(), "h");
      await tick(300);
      const signal = searchFoods.mock.calls.at(-1)[1].signal;
      await user.keyboard("{Backspace}");
      expect(signal.aborted).toBe(true);
      await settle(() => pending.resolve([food("z", "late result")]));
      expect(screen.queryByText("late result")).toBeNull();
    });

    it("cancels the pending debounce", async () => {
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(100);
      await user.keyboard("{Backspace}");
      await tick(1000);
      expect(searchFoods).not.toHaveBeenCalled();
    });
  });

  describe("unmount", () => {
    it("aborts the in-flight request", async () => {
      searchFoods.mockReturnValueOnce(deferred().promise);
      const { user, unmount } = setup();
      await user.type(box(), "ch");
      await tick(300);
      const { signal } = searchFoods.mock.calls[0][1];
      unmount();
      expect(signal.aborted).toBe(true);
    });

    it("clears the pending debounce", async () => {
      const { user, unmount } = setup();
      await user.type(box(), "ch");
      unmount();
      await tick(1000);
      expect(searchFoods).not.toHaveBeenCalled();
    });
  });

  describe("badges and buttons", () => {
    it("shows the demo data badge in fixture mode", () => {
      isFixtureMode.mockReturnValue(true);
      setup();
      expect(screen.getByText("demo data")).toBeInTheDocument();
      expect(isFixtureMode).toHaveBeenCalledWith();
    });

    it("hides the demo data badge outside fixture mode", () => {
      setup();
      expect(screen.queryByText("demo data")).toBeNull();
    });

    it("shows the camera button only when onScan is provided", async () => {
      const { unmount } = setup();
      expect(screen.queryByRole("button", { name: "Scan barcode" })).toBeNull();
      unmount();

      const onScan = vi.fn();
      const { user } = setup({ onScan });
      await user.click(screen.getByRole("button", { name: "Scan barcode" }));
      expect(onScan).toHaveBeenCalledTimes(1);
    });
  });

  describe("errors", () => {
    it("shows the rate-limited message on FoodApiError('rate_limited')", async () => {
      searchFoods.mockRejectedValueOnce(new FoodApiError("rate_limited"));
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(
        screen.getByText("Too many searches, wait a minute"),
      ).toBeInTheDocument();
    });

    it.each([
      ["offline", new FoodApiError("offline"), "Search needs a connection"],
      [
        "unavailable",
        new FoodApiError("unavailable"),
        "Search unavailable, try again",
      ],
      [
        "not_found",
        new FoodApiError("not_found"),
        "Search unavailable, try again",
      ],
      ["invalid", new FoodApiError("invalid"), "Search unavailable, try again"],
      ["any other failure", new Error("boom"), "Search unavailable, try again"],
    ])("maps %s to one line", async (_label, error, line) => {
      searchFoods.mockRejectedValueOnce(error);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(screen.getByText(line)).toBeInTheDocument();
    });

    it("clears the error line when a new query starts", async () => {
      searchFoods.mockRejectedValueOnce(new FoodApiError("rate_limited"));
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(
        screen.getByText("Too many searches, wait a minute"),
      ).toBeInTheDocument();

      await user.type(box(), "i");
      expect(screen.queryByText("Too many searches, wait a minute")).toBeNull();
    });

    it("removes the previous query's API results when a search fails", async () => {
      searchFoods.mockResolvedValueOnce([food("a", "first result")]);
      searchFoods.mockRejectedValueOnce(new FoodApiError("unavailable"));
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(screen.getByText("first result")).toBeInTheDocument();

      await user.type(box(), "i");
      await tick(300);
      expect(screen.queryByText("first result")).toBeNull();
    });
  });

  describe("result rows", () => {
    it("shows name, prepState, kcal per 100 g and the source badge", async () => {
      searchFoods.mockResolvedValueOnce([
        food("a", "chicken, breast", { prepState: "roasted" }),
        food("b", "chicken noodles", {
          source: "open_food_facts",
          per100: { kcal: 467, protein: 8.5, carb: 60, fat: 21 },
        }),
      ]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);

      const usda = rowButton(/chicken, breast · roasted/);
      expect(within(usda).getByText("165 kcal / 100 g")).toBeInTheDocument();
      expect(within(usda).getByText("USDA")).toBeInTheDocument();

      const product = rowButton(/chicken noodles/);
      expect(product).not.toHaveTextContent("·");
      expect(within(product).getByText("467 kcal / 100 g")).toBeInTheDocument();
      expect(within(product).getByText("Product")).toBeInTheDocument();
    });
  });

  describe("custom foods", () => {
    beforeEach(() => {
      saveLS(K_FOOD_CUSTOM, [
        CUSTOM,
        { ...CUSTOM, id: "custom-2", name: "Oat bar" },
      ]);
    });

    it("lists matching custom foods above API results, case-insensitively", async () => {
      searchFoods.mockResolvedValueOnce([food("a", "chicken from the API")]);
      const { user } = setup();
      await user.type(box(), "CH");
      await tick(300);

      const rows = screen
        .getAllByRole("button")
        .filter((b) => /kcal \/ 100 g/.test(b.textContent));
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent("Chicken Salad");
      expect(within(rows[0]).getByText("Custom")).toBeInTheDocument();
      expect(rows[1]).toHaveTextContent("chicken from the API");
      expect(screen.queryByText("Oat bar")).toBeNull();
    });

    it("normalises the query before matching", async () => {
      const { user } = setup();
      await user.type(box(), "CHICKEN   sal");
      expect(screen.getByText("Chicken Salad")).toBeInTheDocument();
    });

    it("hides custom foods below two characters", async () => {
      const { user } = setup();
      await user.type(box(), "c");
      expect(screen.queryByText("Chicken Salad")).toBeNull();
    });

    it("still shows custom foods when the API call fails", async () => {
      searchFoods.mockRejectedValueOnce(new FoodApiError("offline"));
      const { user } = setup();
      await user.type(box(), "chi");
      await tick(300);
      expect(screen.getByText("Search needs a connection")).toBeInTheDocument();
      expect(screen.getByText("Chicken Salad")).toBeInTheDocument();
    });

    it("logs a custom food with a custom FoodRef", async () => {
      const { user, onLogged } = setup();
      await user.type(box(), "chi");
      await user.click(rowButton(/Chicken Salad/));
      expect(screen.getByRole("spinbutton", { name: "Grams" })).toHaveValue(
        250,
      );
      await user.click(screen.getByRole("button", { name: "Add" }));

      const [entry] = loadLS(K_FOOD_ENTRIES);
      expect(entry.food).toStrictEqual({ kind: "custom", id: "custom-1" });
      expect(entry.portionLabel).toBe("1 bowl");
      expect(onLogged).toHaveBeenCalledTimes(1);
    });
  });

  describe("logging", () => {
    it("opens the portion sheet on row tap and adds an entry to the preset slot", async () => {
      const per100 = { kcal: 165, protein: 31, carb: 0, fat: 3.6 };
      searchFoods.mockResolvedValueOnce([
        food("a", "chicken", {
          per100,
          portions: [{ label: "1 breast", grams: 172, isDefault: true }],
        }),
      ]);
      const { user, onLogged } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(screen.queryByRole("dialog")).toBeNull();

      await user.click(rowButton(/chicken/));
      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByRole("button", { name: "Lunch" }),
      ).toHaveAttribute("aria-pressed", "true");
      await user.click(within(dialog).getByRole("button", { name: "Add" }));

      const entries = loadLS(K_FOOD_ENTRIES);
      expect(entries).toHaveLength(1);
      expect(entries[0].slot).toBe("lunch");
      expect(entries[0].date).toBe("2026-11-03");
      expect(entries[0].name).toBe("chicken");
      expect(entries[0].grams).toBe(172);
      expect(entries[0].per100).toEqual(per100);
      expect(entries[0].food).toEqual({ kind: "db", id: "a" });
      expect(entries[0].portionLabel).toBe("1 breast");
      expect(onLogged).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("preselects the slot by time of day when no slot is preset", async () => {
      vi.setSystemTime(new Date(2026, 10, 3, 8, 0));
      searchFoods.mockResolvedValueOnce([food("a", "chicken")]);
      const { user } = setup({ presetSlot: null });
      await user.type(box(), "ch");
      await tick(300);
      await user.click(rowButton(/chicken/));
      expect(screen.getByRole("button", { name: "Breakfast" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("resets the sheet when another row is activated while it is open", async () => {
      searchFoods.mockResolvedValueOnce([
        food("a", "alpha", {
          portions: [{ label: "1 a", grams: 10, isDefault: true }],
        }),
        food("b", "beta", {
          portions: [{ label: "1 b", grams: 500, isDefault: true }],
        }),
      ]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);

      await user.click(rowButton(/alpha/));
      await user.click(rowButton(/beta/));
      const dialog = screen.getByRole("dialog", { name: "beta" });
      expect(
        within(dialog).getByRole("button", { name: "1 b" }),
      ).toHaveAttribute("aria-pressed", "true");
      await user.click(within(dialog).getByRole("button", { name: "Add" }));

      const [entry] = loadLS(K_FOOD_ENTRIES);
      expect(entry.name).toBe("beta");
      expect(entry.grams).toBe(500);
      expect(entry.portionLabel).toBe("1 b");
    });

    it("closes the sheet without logging", async () => {
      searchFoods.mockResolvedValueOnce([food("a", "chicken")]);
      const { user, onLogged } = setup();
      await user.type(box(), "ch");
      await tick(300);
      await user.click(rowButton(/chicken/));
      await user.click(screen.getByRole("button", { name: "Close" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(loadLS(K_FOOD_ENTRIES)).toEqual([]);
      expect(onLogged).not.toHaveBeenCalled();
    });
  });
});
