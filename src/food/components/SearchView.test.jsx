import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadLS, saveLS } from "../../lib/storage";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { FoodProvider } from "../context/FoodContext";
import {
  K_FOOD_CUSTOM,
  K_FOOD_ENTRIES,
  K_FOOD_MEALS,
  K_FOOD_RECENT,
} from "../lib/keys";
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

    it("adds the scanned food with the barcode on its FoodRef", async () => {
      lookupBarcode.mockResolvedValueOnce(
        food("off-1", "Instant noodles", {
          barcode: CODE,
          source: "open_food_facts",
        }),
      );
      const { user, onLogged } = setup();
      await enterCode(user);
      const sheet = await screen.findByRole("dialog", {
        name: "Instant noodles",
      });
      await user.click(within(sheet).getByRole("button", { name: "Add" }));

      const [entry] = loadLS(K_FOOD_ENTRIES);
      expect(entry.food.barcode).toBe(CODE);
      expect(normalizeEntry(entry)).not.toBeNull();
      expect(onLogged).toHaveBeenCalledTimes(1);
    });

    it("on not_found saves a custom food that keeps the prefilled barcode", async () => {
      lookupBarcode.mockRejectedValueOnce(new FoodApiError("not_found"));
      const { user } = setup();
      await enterCode(user);
      const form = within(
        await screen.findByRole("dialog", { name: "Create custom food" }),
      );
      await user.type(form.getByLabelText("Name"), "Noodles");
      await user.type(form.getByLabelText("Protein (g)"), "10");
      await user.type(form.getByLabelText("Carbs (g)"), "60");
      await user.type(form.getByLabelText("Fat (g)"), "12");
      await user.click(form.getByRole("button", { name: "Save" }));

      const [saved] = loadLS(K_FOOD_CUSTOM);
      expect(saved.name).toBe("Noodles");
      expect(saved.barcode).toBe(CODE);
    });

    it("shows a status line while the lookup runs and clears it when it settles", async () => {
      const lookup = deferred();
      lookupBarcode.mockReturnValueOnce(lookup.promise);
      const { user } = setup();
      await enterCode(user);

      expect(screen.getByRole("status")).toHaveTextContent(
        "Looking up barcode…",
      );
      expect(box()).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Scan barcode" }),
      ).toBeEnabled();

      await settle(() => lookup.reject(new FoodApiError("offline")));
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getByText("Search needs a connection")).toBeInTheDocument();
    });

    it("ignores a lookup that settles after a newer scan started", async () => {
      const first = deferred();
      const second = deferred();
      lookupBarcode
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { user } = setup();
      await enterCode(user, CODE);
      await enterCode(user, "12345678");

      await settle(() =>
        first.resolve(food("old", "Old food", { barcode: CODE })),
      );
      expect(screen.queryByRole("dialog", { name: "Old food" })).toBeNull();
      expect(screen.getByRole("status")).toBeInTheDocument();

      await settle(() =>
        second.resolve(food("new", "New food", { barcode: "12345678" })),
      );
      expect(
        screen.getByRole("dialog", { name: "New food" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "Old food" })).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("ignores a lookup that settles after Create custom food was opened", async () => {
      const lookup = deferred();
      lookupBarcode.mockReturnValueOnce(lookup.promise);
      const { user } = setup();
      await enterCode(user);
      await user.click(
        screen.getByRole("button", { name: "Create custom food" }),
      );

      await settle(() =>
        lookup.resolve(food("late", "Late food", { barcode: CODE })),
      );
      expect(screen.queryByRole("dialog", { name: "Late food" })).toBeNull();
      expect(
        screen.getByRole("dialog", { name: "Create custom food" }),
      ).toBeInTheDocument();
    });
  });

  describe("barcode lookup superseded by another action", () => {
    const CODE = "8934563138165";
    const late = () => food("late", "Late food", { barcode: CODE });

    async function enterCode(user, code = CODE) {
      await user.click(screen.getByRole("button", { name: "Scan barcode" }));
      const scanner = within(
        screen.getByRole("dialog", { name: "Scan barcode" }),
      );
      await user.type(await scanner.findByLabelText("Barcode"), code);
      await user.click(scanner.getByRole("button", { name: "Use" }));
    }

    it("tapping a search result keeps its sheet when the lookup settles later", async () => {
      searchFoods.mockResolvedValueOnce([food("egg", "Egg")]);
      const lookup = deferred();
      lookupBarcode.mockReturnValueOnce(lookup.promise);
      const { user } = setup();
      await user.type(box(), "eg");
      await tick(300);
      await enterCode(user);
      await user.click(rowButton(/Egg/));
      expect(screen.queryByRole("status")).toBeNull();

      await settle(() => lookup.resolve(late()));
      expect(screen.getByRole("dialog", { name: "Egg" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "Late food" })).toBeNull();
    });

    it("opening Saved meals keeps a late lookup from opening a sheet over it", async () => {
      const lookup = deferred();
      lookupBarcode.mockReturnValueOnce(lookup.promise);
      const { user } = setup();
      await enterCode(user);
      await user.click(screen.getByRole("button", { name: "Saved meals" }));
      expect(screen.queryByRole("status")).toBeNull();

      await settle(() => lookup.resolve(late()));
      expect(screen.queryByRole("dialog", { name: "Late food" })).toBeNull();
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(
        screen.getByRole("dialog", { name: "Saved meals" }),
      ).toBeInTheDocument();
    });

    it("typing a query clears the status line and the late lookup opens nothing", async () => {
      const lookup = deferred();
      lookupBarcode.mockReturnValueOnce(lookup.promise);
      const { user } = setup();
      await enterCode(user);
      expect(screen.getByRole("status")).toBeInTheDocument();

      await user.type(box(), "e");
      expect(screen.queryByRole("status")).toBeNull();
      await settle(() => lookup.resolve(late()));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("a not_found that settles after a newer scan started opens no form", async () => {
      const first = deferred();
      const second = deferred();
      lookupBarcode
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { user } = setup();
      await enterCode(user, CODE);
      await enterCode(user, "12345678");

      await settle(() => first.reject(new FoodApiError("not_found")));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("pressing Scan again drops the lookup in flight", async () => {
      const lookup = deferred();
      lookupBarcode.mockReturnValueOnce(lookup.promise);
      const { user } = setup();
      await enterCode(user);
      await user.click(screen.getByRole("button", { name: "Scan barcode" }));
      expect(screen.queryByRole("status")).toBeNull();

      await settle(() => lookup.resolve(late()));
      expect(screen.queryByRole("dialog", { name: "Late food" })).toBeNull();
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(
        screen.getByRole("dialog", { name: "Scan barcode" }),
      ).toBeInTheDocument();
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
      expect(box()).toBeDisabled();
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

  describe("loading line", () => {
    const CODE = "8934563138165";
    const LINE = "Searching…";
    const NO_MATCH = "No match. Create a custom food?";
    const fire = (name) =>
      act(async () => {
        window.dispatchEvent(new Event(name));
      });

    it("shows during the debounce and during the request", async () => {
      searchFoods.mockReturnValueOnce(deferred().promise);
      const { user } = setup();
      await user.type(box(), "ch");
      expect(screen.getByText(LINE)).toBeInTheDocument();
      await tick(300);
      expect(searchFoods).toHaveBeenCalledTimes(1);
      expect(screen.getByText(LINE)).toBeInTheDocument();
    });

    it("clears after results resolve", async () => {
      const search = deferred();
      searchFoods.mockReturnValueOnce(search.promise);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      await settle(() => search.resolve([food("f1", "Chicken breast")]));
      expect(screen.queryByText(LINE)).toBeNull();
      expect(screen.getByText("Chicken breast")).toBeInTheDocument();
    });

    it("clears after the request fails and the error line shows", async () => {
      const search = deferred();
      searchFoods.mockReturnValueOnce(search.promise);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      await settle(() => search.reject(new FoodApiError("unavailable")));
      expect(screen.getByText("Search unavailable, try again")).toBeVisible();
      expect(screen.queryByText(LINE)).toBeNull();
    });

    it("clears on an offline event", async () => {
      searchFoods.mockReturnValueOnce(deferred().promise);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(screen.getByText(LINE)).toBeInTheDocument();
      await fire("offline");
      expect(screen.queryByText(LINE)).toBeNull();
    });

    it("shows during the re-run after coming back online", async () => {
      const rerun = deferred();
      searchFoods.mockResolvedValueOnce([]);
      searchFoods.mockReturnValueOnce(rerun.promise);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(screen.getByText(NO_MATCH)).toBeInTheDocument();
      expect(screen.queryByText(LINE)).toBeNull();

      await fire("offline");
      await fire("online");
      expect(searchFoods).toHaveBeenCalledTimes(2);
      expect(screen.getByText(LINE)).toBeInTheDocument();
      expect(screen.queryByText(NO_MATCH)).toBeNull();

      await settle(() => rerun.resolve([]));
      expect(screen.queryByText(LINE)).toBeNull();
      expect(screen.getByText(NO_MATCH)).toBeInTheDocument();
    });

    it("clears when the query drops under two characters", async () => {
      const { user } = setup();
      await user.type(box(), "ch");
      expect(screen.getByText(LINE)).toBeInTheDocument();
      await user.type(box(), "{Backspace}");
      expect(screen.queryByText(LINE)).toBeNull();
    });

    it("never shows together with the no-match line", async () => {
      const search = deferred();
      searchFoods.mockReturnValueOnce(search.promise);
      searchFoods.mockReturnValueOnce(deferred().promise);
      const { user } = setup();
      await user.type(box(), "zz");
      await tick(300);
      await settle(() => search.resolve([]));
      expect(screen.getByText(NO_MATCH)).toBeInTheDocument();
      expect(screen.queryByText(LINE)).toBeNull();

      await user.type(box(), "z");
      expect(screen.queryByText(NO_MATCH)).toBeNull();
      expect(screen.getByText(LINE)).toBeInTheDocument();
    });

    it("clears after a failed search and a barcode lookup that finds nothing", async () => {
      searchFoods.mockRejectedValueOnce(new FoodApiError("unavailable"));
      const lookup = deferred();
      lookupBarcode.mockReturnValueOnce(lookup.promise);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(screen.getByText("Search unavailable, try again")).toBeVisible();

      await user.click(screen.getByRole("button", { name: "Scan barcode" }));
      const scanner = within(
        screen.getByRole("dialog", { name: "Scan barcode" }),
      );
      await user.type(await scanner.findByLabelText("Barcode"), CODE);
      await user.click(scanner.getByRole("button", { name: "Use" }));
      await settle(() => lookup.reject(new FoodApiError("not_found")));

      expect(screen.queryByText(LINE)).toBeNull();
      expect(searchFoods).toHaveBeenCalledTimes(1);
    });

    it("leaves one status line, the barcode one, when a lookup and a search overlap", async () => {
      searchFoods.mockReturnValueOnce(deferred().promise);
      lookupBarcode.mockReturnValueOnce(deferred().promise);
      const { user } = setup();
      await user.type(box(), "ch");
      await user.click(screen.getByRole("button", { name: "Scan barcode" }));
      const scanner = within(
        screen.getByRole("dialog", { name: "Scan barcode" }),
      );
      await user.type(await scanner.findByLabelText("Barcode"), CODE);
      await user.click(scanner.getByRole("button", { name: "Use" }));

      const statuses = screen.getAllByRole("status");
      expect(statuses).toHaveLength(1);
      expect(statuses[0]).toHaveTextContent("Looking up barcode…");
    });
  });

  describe("no match line", () => {
    const LINE = "No match. Create a custom food?";
    const line = () => screen.queryByText(LINE);

    it("shows only after the search for the current query finished empty", async () => {
      const search = deferred();
      searchFoods.mockReturnValueOnce(search.promise);
      const { user } = setup();
      await user.type(box(), "zz");
      expect(line()).toBeNull();
      await tick(299);
      expect(line()).toBeNull();
      await tick(1);
      expect(line()).toBeNull();

      await settle(() => search.resolve([]));
      expect(line()).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: "Create custom food" }),
      ).toHaveLength(1);
    });

    it("hides again when the query changes, and while the next search is pending", async () => {
      searchFoods.mockResolvedValueOnce([]);
      searchFoods.mockReturnValueOnce(deferred().promise);
      const { user } = setup();
      await user.type(box(), "zz");
      await tick(300);
      expect(line()).toBeInTheDocument();

      await user.type(box(), "z");
      expect(line()).toBeNull();
      await tick(300);
      expect(line()).toBeNull();
    });

    it("does not return for an earlier query typed back during the debounce", async () => {
      searchFoods.mockResolvedValueOnce([]);
      const { user } = setup();
      await user.type(box(), "zz");
      await tick(300);
      expect(line()).toBeInTheDocument();

      await user.type(box(), "z");
      await user.type(box(), "{Backspace}");
      expect(box()).toHaveValue("zz");
      expect(line()).toBeNull();
    });

    it("does not show below two characters", async () => {
      const { user } = setup();
      await user.type(box(), "z");
      await tick(1000);
      expect(line()).toBeNull();
    });

    it("does not show with API results", async () => {
      searchFoods.mockResolvedValueOnce([food("a", "API chicken")]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(line()).toBeNull();
    });

    it("does not show when a custom food matches", async () => {
      saveLS(K_FOOD_CUSTOM, [CUSTOM]);
      const { user } = setup();
      await user.type(box(), "chicken");
      await tick(300);
      expect(screen.getByText("Chicken Salad")).toBeInTheDocument();
      expect(line()).toBeNull();
    });

    it("does not show after an error", async () => {
      searchFoods.mockRejectedValueOnce(new FoodApiError("unavailable"));
      const { user } = setup();
      await user.type(box(), "zz");
      await tick(300);
      expect(
        screen.getByText("Search unavailable, try again"),
      ).toBeInTheDocument();
      expect(line()).toBeNull();
    });

    it("does not show for an aborted search that resolves late", async () => {
      const first = deferred();
      searchFoods.mockReturnValueOnce(first.promise);
      searchFoods.mockReturnValueOnce(deferred().promise);
      const { user } = setup();
      await user.type(box(), "zz");
      await tick(300);
      await user.type(box(), "y");
      await settle(() => first.resolve([]));
      expect(line()).toBeNull();
    });

    it("does not show offline", async () => {
      searchFoods.mockResolvedValueOnce([]);
      const { user } = setup();
      await user.type(box(), "zz");
      await tick(300);
      expect(line()).toBeInTheDocument();
      await act(async () => {
        window.dispatchEvent(new Event("offline"));
      });
      expect(line()).toBeNull();
    });
  });

  describe("custom foods shortcut", () => {
    const shortcut = () => screen.getByRole("button", { name: "Custom foods" });

    it("shows No custom foods yet in the opened list when there are none", async () => {
      const { user } = setup();
      expect(screen.queryByText("No custom foods yet")).toBeNull();
      await user.click(shortcut());
      expect(screen.getByText("No custom foods yet")).toBeInTheDocument();
    });

    it("lists the shortcuts in the order the spec gives", () => {
      setup();
      const names = screen
        .getAllByRole("button")
        .map((button) => button.textContent)
        .filter((text) => text !== "Scan");
      expect(names).toEqual([
        "Saved meals",
        "Custom foods",
        "Create custom food",
      ]);
    });

    it("toggles the list of all custom foods online, and a tap opens the sheet", async () => {
      saveLS(K_FOOD_CUSTOM, [CUSTOM]);
      const { user } = setup();
      expect(screen.queryByText("Chicken Salad")).toBeNull();

      await user.click(shortcut());
      expect(shortcut()).toHaveAttribute("aria-pressed", "true");
      const row = rowButton(/Chicken Salad/);
      expect(within(row).getByText("Custom")).toBeInTheDocument();

      await user.click(shortcut());
      expect(screen.queryByText("Chicken Salad")).toBeNull();

      await user.click(shortcut());
      await user.click(rowButton(/Chicken Salad/));
      expect(
        screen.getByRole("dialog", { name: "Chicken Salad" }),
      ).toBeInTheDocument();
    });

    it("drops a barcode lookup in flight", async () => {
      const lookup = deferred();
      lookupBarcode.mockReturnValueOnce(lookup.promise);
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Scan barcode" }));
      const scanner = within(
        screen.getByRole("dialog", { name: "Scan barcode" }),
      );
      await user.type(await scanner.findByLabelText("Barcode"), "12345678");
      await user.click(scanner.getByRole("button", { name: "Use" }));
      expect(screen.getByRole("status")).toBeInTheDocument();

      await user.click(shortcut());
      expect(screen.queryByRole("status")).toBeNull();
      await settle(() => lookup.resolve(food("late", "Late food")));
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("offline", () => {
    const NOTE = "Search needs a connection";
    const RECENT_DB = {
      food: { kind: "db", id: "egg", barcode: "8934563138165" },
      name: "Boiled egg",
      per100: { kcal: 155, protein: 13, carb: 1.1, fat: 11 },
      portions: [
        { label: "1 egg", grams: 50, isDefault: true },
        { label: "2 eggs", grams: 100 },
      ],
      lastGrams: 100,
      lastPortionLabel: "2 eggs",
      lastAt: 2000,
    };
    const RECENT_CUSTOM = {
      food: { kind: "custom", id: "custom-1" },
      name: "Old salad name",
      per100: CUSTOM.per100,
      portions: CUSTOM.portions,
      lastGrams: 300,
      lastAt: 1000,
    };

    const setOnLine = (value) =>
      Object.defineProperty(navigator, "onLine", {
        value,
        configurable: true,
      });
    const fire = (name) =>
      act(async () => {
        window.dispatchEvent(new Event(name));
      });
    const scanButton = () =>
      screen.queryByRole("button", { name: "Scan barcode" });
    const tryAgain = () => screen.getByRole("button", { name: "Try again" });
    const expectOffline = () => {
      expect(screen.getByText(NOTE)).toBeInTheDocument();
      expect(box()).toBeDisabled();
      expect(scanButton()).toBeNull();
    };
    const expectOnline = () => {
      expect(screen.queryByText(NOTE)).toBeNull();
      expect(box()).toBeEnabled();
      expect(scanButton()).not.toBeNull();
    };

    async function enterCode(user, code = "12345678") {
      await user.click(screen.getByRole("button", { name: "Scan barcode" }));
      const scanner = within(
        screen.getByRole("dialog", { name: "Scan barcode" }),
      );
      await user.type(await scanner.findByLabelText("Barcode"), code);
      await user.click(scanner.getByRole("button", { name: "Use" }));
    }

    afterEach(() => {
      delete navigator.onLine;
    });

    it("starts offline from navigator.onLine, with the note, disabled input and no Scan", () => {
      setOnLine(false);
      setup();
      expectOffline();
    });

    it("starts online when navigator.onLine is true", () => {
      setOnLine(true);
      setup();
      expectOnline();
    });

    it("lists recent foods and custom foods, and keeps the shortcuts", () => {
      setOnLine(false);
      saveLS(K_FOOD_RECENT, [RECENT_DB]);
      saveLS(K_FOOD_CUSTOM, [CUSTOM]);
      setup();
      expect(
        screen.getByRole("heading", { name: "Recent" }),
      ).toBeInTheDocument();
      expect(rowButton(/Boiled egg/)).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Custom foods" }),
      ).toBeInTheDocument();
      expect(rowButton(/Chicken Salad/)).toBeInTheDocument();
      for (const name of [
        "Saved meals",
        "Custom foods",
        "Create custom food",
      ]) {
        expect(screen.getByRole("button", { name })).toBeEnabled();
      }
    });

    it("shows an empty line for Recent and for Custom foods with none", () => {
      setOnLine(false);
      setup();
      expect(screen.getByText("No recent foods yet")).toBeInTheDocument();
      expect(screen.getByText("No custom foods yet")).toBeInTheDocument();
    });

    it("shows no empty line for a list that has rows", () => {
      setOnLine(false);
      saveLS(K_FOOD_RECENT, [RECENT_DB]);
      saveLS(K_FOOD_CUSTOM, [CUSTOM]);
      setup();
      expect(screen.queryByText("No recent foods yet")).toBeNull();
      expect(screen.queryByText("No custom foods yet")).toBeNull();
    });

    it("the custom list stays while offline when the shortcut is pressed", async () => {
      setOnLine(false);
      saveLS(K_FOOD_CUSTOM, [CUSTOM]);
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Custom foods" }));
      expect(rowButton(/Chicken Salad/)).toBeInTheDocument();
    });

    it("a recent food opens the sheet at lastGrams and logs with its FoodRef and the preset slot", async () => {
      setOnLine(false);
      saveLS(K_FOOD_RECENT, [RECENT_DB]);
      const { user, onLogged } = setup();
      await user.click(rowButton(/Boiled egg/));

      const sheet = within(screen.getByRole("dialog", { name: "Boiled egg" }));
      expect(sheet.getByRole("spinbutton", { name: "Grams" })).toHaveValue(100);
      expect(sheet.getByRole("button", { name: "2 eggs" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(sheet.getByRole("button", { name: "Lunch" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await user.click(sheet.getByRole("button", { name: "Add" }));

      const [entry] = loadLS(K_FOOD_ENTRIES);
      expect(entry.food).toStrictEqual(RECENT_DB.food);
      expect(entry.grams).toBe(100);
      expect(entry.date).toBe("2026-11-03");
      expect(normalizeEntry(entry)).not.toBeNull();
      expect(onLogged).toHaveBeenCalledTimes(1);
      expect(loadLS(K_FOOD_RECENT)[0].portions).toEqual(RECENT_DB.portions);
    });

    it("a recent custom food keeps kind custom", async () => {
      setOnLine(false);
      saveLS(K_FOOD_RECENT, [RECENT_CUSTOM]);
      const { user } = setup();
      const row = rowButton(/Old salad name/);
      expect(within(row).getByText("Custom")).toBeInTheDocument();
      await user.click(row);
      expect(screen.getByRole("spinbutton", { name: "Grams" })).toHaveValue(
        300,
      );
      await user.click(screen.getByRole("button", { name: "Add" }));
      expect(loadLS(K_FOOD_ENTRIES)[0].food).toStrictEqual(RECENT_CUSTOM.food);
    });

    it("a custom food opens the sheet at its default portion, without another food's lastGrams", async () => {
      setOnLine(false);
      saveLS(K_FOOD_RECENT, [RECENT_DB]);
      saveLS(K_FOOD_CUSTOM, [CUSTOM]);
      const { user } = setup();
      await user.click(rowButton(/Boiled egg/));
      await user.click(screen.getByRole("button", { name: "Close" }));
      await user.click(rowButton(/Chicken Salad/));
      expect(screen.getByRole("spinbutton", { name: "Grams" })).toHaveValue(
        250,
      );
      await user.click(screen.getByRole("button", { name: "Add" }));
      expect(loadLS(K_FOOD_ENTRIES)[0].food).toStrictEqual({
        kind: "custom",
        id: "custom-1",
      });
    });

    it("Saved meals stays usable", async () => {
      setOnLine(false);
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Saved meals" }));
      expect(
        screen.getByRole("dialog", { name: "Saved meals" }),
      ).toBeInTheDocument();
    });

    it("Create custom food stays usable", async () => {
      setOnLine(false);
      const { user } = setup();
      await user.click(
        screen.getByRole("button", { name: "Create custom food" }),
      );
      expect(
        screen.getByRole("dialog", { name: "Create custom food" }),
      ).toBeInTheDocument();
    });

    it("a window offline event hides API results and drops the waiting debounce", async () => {
      searchFoods.mockResolvedValueOnce([food("a", "API chicken")]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(screen.getByText("API chicken")).toBeInTheDocument();

      await user.type(box(), "i");
      await fire("offline");
      expectOffline();
      expect(screen.queryByText("API chicken")).toBeNull();

      await tick(1000);
      expect(searchFoods).toHaveBeenCalledTimes(1);
    });

    it("a window offline event aborts the search in flight, and its late result stays hidden", async () => {
      const pending = deferred();
      searchFoods.mockReturnValueOnce(pending.promise);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      const { signal } = searchFoods.mock.calls[0][1];

      await fire("offline");
      expect(signal.aborted).toBe(true);
      await settle(() => pending.resolve([food("a", "late result")]));
      expect(screen.queryByText("late result")).toBeNull();
    });

    it("a window offline event drops a barcode lookup in flight", async () => {
      const lookup = deferred();
      lookupBarcode.mockReturnValueOnce(lookup.promise);
      const { user } = setup();
      await enterCode(user);
      expect(screen.getByRole("status")).toBeInTheDocument();

      await fire("offline");
      expect(screen.queryByRole("status")).toBeNull();
      await settle(() => lookup.resolve(food("late", "Late food")));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("FoodApiError offline from search sets the state", async () => {
      searchFoods.mockRejectedValueOnce(new FoodApiError("offline"));
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expectOffline();
    });

    it("FoodApiError offline from a barcode lookup sets the state", async () => {
      lookupBarcode.mockRejectedValueOnce(new FoodApiError("offline"));
      const { user } = setup();
      await enterCode(user);
      expectOffline();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("a superseded search that fails with offline does not set the state", async () => {
      const first = deferred();
      searchFoods.mockReturnValueOnce(first.promise);
      searchFoods.mockResolvedValueOnce([food("b", "second result")]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      await user.type(box(), "i");
      await tick(300);
      await settle(() => first.reject(new FoodApiError("offline")));

      expectOnline();
      expect(screen.getByText("second result")).toBeInTheDocument();
    });

    it("a superseded lookup that fails with offline does not set the state", async () => {
      const first = deferred();
      lookupBarcode.mockReturnValueOnce(first.promise);
      const { user } = setup();
      await enterCode(user);
      await user.click(screen.getByRole("button", { name: "Saved meals" }));
      await settle(() => first.reject(new FoodApiError("offline")));
      expectOnline();
    });

    it("a window online event clears the state, keeps the query and re-runs the search", async () => {
      searchFoods.mockRejectedValueOnce(new FoodApiError("offline"));
      searchFoods.mockResolvedValueOnce([food("a", "API chicken")]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expectOffline();

      await fire("online");
      expectOnline();
      expect(box()).toHaveValue("ch");
      expect(searchFoods).toHaveBeenCalledTimes(2);
      expect(searchFoods.mock.calls[1][0]).toBe("ch");
      expect(screen.getByText("API chicken")).toBeInTheDocument();
    });

    it("Try again clears the state and re-runs the latest query", async () => {
      searchFoods.mockResolvedValueOnce([]);
      searchFoods.mockRejectedValueOnce(new FoodApiError("offline"));
      searchFoods.mockResolvedValueOnce([food("a", "API chicken")]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      await user.type(box(), "ick");
      await tick(300);
      expectOffline();

      await user.click(tryAgain());
      expectOnline();
      expect(box()).toHaveValue("chick");
      expect(searchFoods.mock.calls.at(-1)[0]).toBe("chick");
      expect(screen.getByText("API chicken")).toBeInTheDocument();
    });

    it("the online listener re-runs the query typed last, not an earlier one", async () => {
      searchFoods.mockResolvedValue([]);
      const { user } = setup();
      await user.type(box(), "chicken");
      await fire("offline");
      expect(searchFoods).not.toHaveBeenCalled();
      await fire("online");
      expect(searchFoods).toHaveBeenCalledTimes(1);
      expect(searchFoods.mock.calls[0][0]).toBe("chicken");
    });

    it("clearing with a short query clears the state and searches nothing", async () => {
      const { user } = setup();
      await fire("offline");
      await user.click(tryAgain());
      expectOnline();
      expect(searchFoods).not.toHaveBeenCalled();
    });

    it("the state returns when the re-run fails with offline", async () => {
      searchFoods.mockRejectedValue(new FoodApiError("offline"));
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expectOffline();

      await user.click(tryAgain());
      expect(searchFoods).toHaveBeenCalledTimes(2);
      expectOffline();
    });

    it("a re-run superseded by going offline again does not surface its result", async () => {
      const rerun = deferred();
      searchFoods.mockRejectedValueOnce(new FoodApiError("offline"));
      searchFoods.mockReturnValueOnce(rerun.promise);
      // Stays pending: a settled third search would hide a late result.
      searchFoods.mockReturnValueOnce(deferred().promise);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      await user.click(tryAgain());
      await fire("offline");

      await settle(() => rerun.resolve([food("a", "late result")]));
      await fire("online");
      expect(screen.queryByText("late result")).toBeNull();
    });

    it("typing during a re-run aborts it, so its offline failure does not set the state", async () => {
      const rerun = deferred();
      searchFoods.mockRejectedValueOnce(new FoodApiError("offline"));
      searchFoods.mockReturnValueOnce(rerun.promise);
      searchFoods.mockResolvedValueOnce([food("b", "newer result")]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      await user.click(tryAgain());
      const { signal } = searchFoods.mock.calls[1][1];

      await user.type(box(), "i");
      expect(signal.aborted).toBe(true);
      await tick(300);
      await settle(() => rerun.reject(new FoodApiError("offline")));

      expectOnline();
      expect(box()).toHaveValue("chi");
      expect(screen.getByText("newer result")).toBeInTheDocument();
    });

    it("going offline then online does not show the no-match line while the re-run is in flight", async () => {
      searchFoods.mockResolvedValueOnce([]);
      searchFoods.mockReturnValueOnce(deferred().promise);
      const { user } = setup();
      await user.type(box(), "zz");
      await tick(300);
      expect(screen.getByText("No match. Create a custom food?")).toBeTruthy();

      await fire("offline");
      await fire("online");
      expect(searchFoods).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("No match. Create a custom food?")).toBeNull();
    });

    it("a barcode lookup failing after a finished empty search shows the error without the no-match line", async () => {
      searchFoods.mockResolvedValueOnce([]);
      lookupBarcode.mockRejectedValueOnce(new FoodApiError("unavailable"));
      const { user } = setup();
      await user.type(box(), "zz");
      await tick(300);
      expect(screen.getByText("No match. Create a custom food?")).toBeTruthy();

      await enterCode(user);
      expect(
        screen.getByText("Search unavailable, try again"),
      ).toBeInTheDocument();
      expect(screen.queryByText("No match. Create a custom food?")).toBeNull();
    });

    it("typing during a re-run keeps its late results off the newer query", async () => {
      const rerun = deferred();
      searchFoods.mockRejectedValueOnce(new FoodApiError("offline"));
      searchFoods.mockReturnValueOnce(rerun.promise);
      searchFoods.mockResolvedValueOnce([food("b", "newer result")]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      await user.click(tryAgain());

      await user.type(box(), "i");
      await tick(300);
      await settle(() => rerun.resolve([food("a", "late result")]));

      expect(screen.queryByText("late result")).toBeNull();
      expect(screen.getByText("newer result")).toBeInTheDocument();
    });

    it("the Recent list shows only while offline", async () => {
      setOnLine(true);
      saveLS(K_FOOD_RECENT, [RECENT_DB]);
      setup();
      const recentHeading = () =>
        screen.queryByRole("heading", { name: "Recent" });
      expect(recentHeading()).toBeNull();
      expect(screen.queryByRole("button", { name: /Boiled egg/ })).toBeNull();

      await fire("offline");
      expect(recentHeading()).toBeInTheDocument();
      expect(rowButton(/Boiled egg/)).toBeInTheDocument();

      await fire("online");
      expect(recentHeading()).toBeNull();
      expect(screen.queryByRole("button", { name: /Boiled egg/ })).toBeNull();
    });

    it("hides Try again while navigator.onLine is false; the online event still clears the state", async () => {
      setOnLine(false);
      setup();
      expect(screen.getByText(NOTE)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

      setOnLine(true);
      await fire("online");
      expectOnline();
    });

    it("shows Try again when the browser reports a connection but a request failed offline", async () => {
      searchFoods.mockRejectedValueOnce(new FoodApiError("offline"));
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(tryAgain()).toBeInTheDocument();
    });

    it("an offline event closes an open scanner", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Scan barcode" }));
      expect(
        screen.getByRole("dialog", { name: "Scan barcode" }),
      ).toBeInTheDocument();

      await fire("offline");
      expect(screen.queryByRole("dialog", { name: "Scan barcode" })).toBeNull();
      expectOffline();
    });

    it("a lookup that fails with unavailable after going offline shows no error once back online", async () => {
      const lookup = deferred();
      lookupBarcode.mockReturnValueOnce(lookup.promise);
      const { user } = setup();
      await enterCode(user);
      await fire("offline");
      await settle(() => lookup.reject(new FoodApiError("unavailable")));
      await fire("online");
      expect(screen.queryByText("Search unavailable, try again")).toBeNull();
    });

    it("a second online event after the state cleared does not search again", async () => {
      const { user } = setup();
      await user.type(box(), "chicken");
      await fire("offline");
      await fire("online");
      expect(searchFoods).toHaveBeenCalledTimes(1);

      await fire("online");
      expect(searchFoods).toHaveBeenCalledTimes(1);
    });

    it("going offline empties the results, so they do not return while a re-run is pending", async () => {
      searchFoods.mockResolvedValueOnce([food("a", "API chicken")]);
      searchFoods.mockReturnValueOnce(deferred().promise);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(screen.getByText("API chicken")).toBeInTheDocument();

      await fire("offline");
      await fire("online");
      expect(screen.queryByText("API chicken")).toBeNull();
    });

    it("an error line from before going offline is gone after coming back online", async () => {
      searchFoods.mockRejectedValueOnce(new FoodApiError("unavailable"));
      searchFoods.mockReturnValueOnce(deferred().promise);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      const line = () => screen.queryByText("Search unavailable, try again");
      expect(line()).toBeInTheDocument();

      await fire("offline");
      expect(line()).toBeNull();
      await fire("online");
      expect(line()).toBeNull();
    });

    it("pressing Custom foods while offline does not change the online list state", async () => {
      setOnLine(false);
      saveLS(K_FOOD_CUSTOM, [CUSTOM]);
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Custom foods" }));

      setOnLine(true);
      await fire("online");
      expect(screen.queryByText("Chicken Salad")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Custom foods" }),
      ).toHaveAttribute("aria-pressed", "false");
    });

    it("an online event while online changes nothing", async () => {
      searchFoods.mockResolvedValueOnce([food("a", "API chicken")]);
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);

      await fire("online");
      expect(searchFoods).toHaveBeenCalledTimes(1);
      expect(screen.getByText("API chicken")).toBeInTheDocument();
    });

    it("rate_limited keeps its line and leaves the input enabled", async () => {
      searchFoods.mockRejectedValueOnce(new FoodApiError("rate_limited"));
      const { user } = setup();
      await user.type(box(), "ch");
      await tick(300);
      expect(
        screen.getByText("Too many searches, wait a minute"),
      ).toBeInTheDocument();
      expectOnline();
    });

    it("unavailable keeps its line and leaves the input enabled", async () => {
      lookupBarcode.mockRejectedValueOnce(new FoodApiError("unavailable"));
      const { user } = setup();
      await enterCode(user);
      expect(
        screen.getByText("Search unavailable, try again"),
      ).toBeInTheDocument();
      expectOnline();
    });

    it("removes the window listeners on unmount", () => {
      const add = vi.spyOn(window, "addEventListener");
      const remove = vi.spyOn(window, "removeEventListener");
      const { unmount } = setup();
      const listenerFor = (spy, name) =>
        spy.mock.calls.find(([event]) => event === name)?.[1];
      const added = {
        offline: listenerFor(add, "offline"),
        online: listenerFor(add, "online"),
      };
      expect(added.offline).toBeInstanceOf(Function);
      expect(added.online).toBeInstanceOf(Function);

      unmount();
      expect(listenerFor(remove, "offline")).toBe(added.offline);
      expect(listenerFor(remove, "online")).toBe(added.online);
      add.mockRestore();
      remove.mockRestore();
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
