import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadLS, saveLS } from "../../lib/storage";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { FoodProvider } from "../context/FoodContext";
import { K_FOOD_CUSTOM, K_FOOD_ENTRIES, K_FOOD_MEALS } from "../lib/keys";
import {
  FoodApiError,
  isFixtureMode,
  lookupBarcode,
  searchFoods,
} from "../lib/foodApi";
import { formatDayHeader } from "../lib/localDate";
import { normalizeEntry } from "../lib/normalize";
import SearchView from "./SearchView";

vi.mock("../lib/foodApi", async (importActual) => ({
  ...(await importActual()),
  searchFoods: vi.fn(),
  lookupBarcode: vi.fn(),
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
    lookupBarcode.mockReset();
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

    it("the Scan button opens the barcode scanner", async () => {
      const { user } = setup();
      expect(screen.queryByRole("dialog")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Scan barcode" }));
      const scanner = screen.getByRole("dialog", { name: "Scan barcode" });
      expect(
        await within(scanner).findByText("Camera unavailable"),
      ).toBeInTheDocument();
    });
  });

  describe("barcode scan", () => {
    const CODE = "8934563138165";

    // jsdom has no navigator.mediaDevices, so the scanner shows its manual field.
    async function enterCode(user, code = CODE) {
      await user.click(screen.getByRole("button", { name: "Scan barcode" }));
      const scanner = within(
        screen.getByRole("dialog", { name: "Scan barcode" }),
      );
      await user.type(await scanner.findByLabelText("Barcode"), code);
      await user.click(scanner.getByRole("button", { name: "Use" }));
    }

    it("looks up the code and opens the portion sheet for the food found", async () => {
      lookupBarcode.mockResolvedValueOnce(
        food("off-1", "Instant noodles", {
          barcode: CODE,
          source: "open_food_facts",
        }),
      );
      const { user } = setup();
      await enterCode(user);

      expect(lookupBarcode).toHaveBeenCalledWith(CODE);
      expect(
        await screen.findByRole("dialog", { name: "Instant noodles" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "Scan barcode" })).toBeNull();
    });

    it("on not_found opens the custom food form with the barcode prefilled", async () => {
      lookupBarcode.mockRejectedValueOnce(new FoodApiError("not_found"));
      const { user } = setup();
      await enterCode(user);

      const form = await screen.findByRole("dialog", {
        name: "Create custom food",
      });
      expect(within(form).getByLabelText("Barcode")).toHaveValue(CODE);
      expect(screen.queryByRole("dialog", { name: "Scan barcode" })).toBeNull();
    });

    it("on another error shows the search error line and opens nothing", async () => {
      lookupBarcode.mockRejectedValueOnce(new FoodApiError("offline"));
      const { user } = setup();
      await enterCode(user);

      expect(
        await screen.findByText("Search needs a connection"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).toBeNull();
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

    it("logs a custom food so the stored entry passes normalizeEntry", async () => {
      const { user } = setup();
      await user.type(box(), "chi");
      await user.click(rowButton(/Chicken Salad/));
      await user.click(screen.getByRole("button", { name: "Add" }));

      const normalized = normalizeEntry(loadLS(K_FOOD_ENTRIES)[0]);
      expect(normalized).not.toBeNull();
      expect(normalized.food).toStrictEqual({ kind: "custom", id: "custom-1" });
    });
  });

  describe("create custom food", () => {
    const createButton = () =>
      screen.getByRole("button", { name: "Create custom food" });
    const formDialog = () =>
      screen.getByRole("dialog", { name: "Create custom food" });

    async function fillForm(user) {
      const form = within(formDialog());
      await user.type(form.getByLabelText("Name"), "Oat bar");
      await user.type(form.getByLabelText("Protein (g)"), "10");
      await user.type(form.getByLabelText("Carbs (g)"), "60");
      await user.type(form.getByLabelText("Fat (g)"), "12");
    }

    it("stays visible below the results, whatever the query", async () => {
      searchFoods.mockResolvedValueOnce([food("a", "chicken")]);
      const { user } = setup();
      expect(createButton()).toBeVisible();

      await user.type(box(), "ch");
      await tick(300);
      const result = rowButton(/chicken/);
      expect(
        result.compareDocumentPosition(createButton()) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      await user.clear(box());
      expect(createButton()).toBeVisible();
    });

    it("opens the form empty, without the query as the name", async () => {
      const { user } = setup();
      await user.type(box(), "chi");
      await user.click(createButton());
      expect(within(formDialog()).getByLabelText("Name")).toHaveValue("");
    });

    it("Close returns to Search with the query intact and writes nothing", async () => {
      const { user } = setup();
      await user.type(box(), "chi");
      await user.click(createButton());
      await user.click(
        within(formDialog()).getByRole("button", { name: "Close" }),
      );

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(box()).toHaveValue("chi");
      expect(loadLS(K_FOOD_CUSTOM)).toEqual([]);
    });

    it("after Save, closes the form and opens the portion sheet; Add stores a custom entry that passes normalizeEntry", async () => {
      const { user, onLogged } = setup();
      await user.click(createButton());
      await fillForm(user);
      await user.click(
        within(formDialog()).getByRole("button", { name: "Save" }),
      );

      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      const sheet = screen.getByRole("dialog", { name: "Oat bar" });
      expect(onLogged).not.toHaveBeenCalled();
      expect(loadLS(K_FOOD_ENTRIES)).toEqual([]);

      await user.type(within(sheet).getByRole("spinbutton"), "45");
      await user.click(within(sheet).getByRole("button", { name: "Add" }));

      const [saved] = loadLS(K_FOOD_CUSTOM);
      const [entry] = loadLS(K_FOOD_ENTRIES);
      expect(entry.food).toStrictEqual({ kind: "custom", id: saved.id });
      expect(entry.per100).toEqual(saved.per100);
      expect(entry.date).toBe("2026-11-03");
      expect(normalizeEntry(entry)).not.toBeNull();
      expect(onLogged).toHaveBeenCalledTimes(1);
    });

    it("a food saved here then matches the query at the top with its badge", async () => {
      searchFoods.mockResolvedValue([food("a", "oat from the API")]);
      const { user } = setup();
      await user.type(box(), "oat");
      await tick(300);
      await user.click(createButton());
      await fillForm(user);
      await user.click(
        within(formDialog()).getByRole("button", { name: "Save" }),
      );
      await user.click(screen.getByRole("button", { name: "Close" }));

      expect(box()).toHaveValue("oat");
      const rows = screen
        .getAllByRole("button")
        .filter((b) => /kcal \/ 100 g/.test(b.textContent));
      expect(rows[0]).toHaveTextContent("Oat bar");
      expect(within(rows[0]).getByText("Custom")).toBeInTheDocument();
    });
  });

  describe("saved meals shortcut", () => {
    const MEAL = {
      id: "m1",
      name: "Rice bowl",
      items: [
        {
          name: "rice",
          grams: 200,
          per100: { kcal: 130, protein: 2.7, carb: 28, fat: 0.3 },
          food: { kind: "db", id: "rice" },
        },
      ],
      createdAt: 1,
    };
    const open = (user) => user.click(rowButton("Saved meals"));
    const panel = () => screen.getByRole("dialog", { name: "Saved meals" });
    const day = formatDayHeader("2026-11-03");

    it("opens the panel on presetSlot", async () => {
      // Time of day would give dinner, so seeing Lunch proves the preset wins.
      vi.setSystemTime(new Date(2026, 10, 3, 18, 0));
      const { user } = setup();
      expect(screen.queryByRole("dialog")).toBeNull();
      await open(user);
      expect(within(panel()).getByText(`Lunch · ${day}`)).toBeVisible();
    });

    it("opens the panel on the time-of-day slot when no slot is preset", async () => {
      vi.setSystemTime(new Date(2026, 10, 3, 18, 0));
      const { user } = setup({ presetSlot: undefined });
      await open(user);
      expect(within(panel()).getByText(`Dinner · ${day}`)).toBeVisible();
    });

    it("logging a meal closes the panel and calls onLogged", async () => {
      saveLS(K_FOOD_MEALS, [MEAL]);
      const { user, onLogged } = setup();
      await open(user);
      await user.click(
        within(panel()).getByRole("button", { name: /Rice bowl/ }),
      );

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(onLogged).toHaveBeenCalledTimes(1);
      const stored = loadLS(K_FOOD_ENTRIES);
      expect(stored).toHaveLength(1);
      expect(stored[0].date).toBe("2026-11-03");
      expect(stored[0].slot).toBe("lunch");
    });

    it("logs onto the viewed day when it is not today", async () => {
      vi.setSystemTime(new Date(2026, 10, 3, 12, 0));
      saveLS(K_FOOD_MEALS, [MEAL]);
      const { user } = setup({ date: "2026-10-20" });
      await open(user);
      expect(
        within(panel()).getByText(`Lunch · ${formatDayHeader("2026-10-20")}`),
      ).toBeVisible();
      await user.click(
        within(panel()).getByRole("button", { name: /Rice bowl/ }),
      );

      const stored = loadLS(K_FOOD_ENTRIES);
      expect(stored).toHaveLength(1);
      expect(stored[0].date).toBe("2026-10-20");
    });

    it("offers no Save as meal field from Search, even when the slot has entries", async () => {
      saveLS(K_FOOD_ENTRIES, [
        {
          id: "e1",
          date: "2026-11-03",
          slot: "lunch",
          name: "rice",
          grams: 200,
          per100: MEAL.items[0].per100,
          food: MEAL.items[0].food,
          createdAt: 1,
        },
      ]);
      const { user } = setup();
      await open(user);
      expect(panel()).toBeVisible();
      expect(screen.queryByLabelText("Save as meal")).toBeNull();
      expect(
        screen.queryByRole("button", { name: /^save( as meal)?$/i }),
      ).toBeNull();
    });

    it("Close does not call onLogged", async () => {
      const { user, onLogged } = setup();
      await open(user);
      await user.click(within(panel()).getByRole("button", { name: "Close" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(onLogged).not.toHaveBeenCalled();
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

    it('logs a database food with food.kind "db" so the stored entry passes normalizeEntry', async () => {
      searchFoods.mockResolvedValueOnce([food("a", "chicken")]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      await user.click(rowButton(/chicken/));
      await user.click(screen.getByRole("button", { name: "Add" }));

      const normalized = normalizeEntry(loadLS(K_FOOD_ENTRIES)[0]);
      expect(normalized).not.toBeNull();
      expect(normalized.food).toStrictEqual({ kind: "db", id: "a" });
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
