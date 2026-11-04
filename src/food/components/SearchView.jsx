import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useFood } from "../context/FoodContext";
import {
  FoodApiError,
  isFixtureMode,
  lookupBarcode,
  normaliseQuery,
  searchFoods,
} from "../lib/foodApi";
import { recentToFood } from "../lib/recent";
import { slotForTime } from "../lib/slots";
import BarcodeScanner from "./BarcodeScanner";
import CustomFoodForm from "./CustomFoodForm";
import PortionSheet from "./PortionSheet";
import SavedMealsPanel from "./SavedMealsPanel";
import SearchResultRow from "./SearchResultRow";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

const OFFLINE_NOTE = "Search needs a connection";

function errorLine(error) {
  if (error instanceof FoodApiError && error.kind === "rate_limited") {
    return "Too many searches, wait a minute";
  }
  return "Search unavailable, try again";
}

const isOfflineError = (error) =>
  error instanceof FoodApiError && error.kind === "offline";

/** A titled list of foods, or its empty line when there are none. */
function FoodList({ title, foods, emptyText, onSelect }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {foods.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {emptyText}
        </p>
      )}
      {foods.map((food) => (
        <SearchResultRow
          key={`${food.source}:${food.id}`}
          food={food}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}

/** Food search: debounced API lookup plus matching custom foods. */
export default function SearchView({ date, presetSlot, onLogged }) {
  const { customFoods, recent, addEntry } = useFood();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [errorText, setErrorText] = useState(null);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createInitial, setCreateInitial] = useState(undefined);
  const [scanning, setScanning] = useState(false);
  const [mealsSlot, setMealsSlot] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [offline, setOffline] = useState(() => navigator.onLine === false);
  const [showCustom, setShowCustom] = useState(false);
  // The normalised query whose search finished, not aborted and without an error.
  const [searchedQuery, setSearchedQuery] = useState(null);
  // True from scheduling a search until it ends, aborted ones excepted.
  const [searching, setSearching] = useState(false);
  // What the window listeners and a settling request read: never a closure's copy.
  const offlineNow = useRef(offline);
  const latestQuery = useRef("");
  const pending = useRef({ timer: null, controller: null });
  // Bumped whenever a barcode lookup in flight stops being the latest one.
  const lookupToken = useRef(0);

  // On unmount, drop the waiting debounce, the request in flight and any
  // barcode lookup in flight.
  useEffect(() => {
    const current = pending.current;
    const token = lookupToken;
    return () => {
      clearTimeout(current.timer);
      current.controller?.abort();
      token.current += 1;
    };
  }, []);

  const dropLookup = useCallback(() => {
    lookupToken.current += 1;
    setLookingUp(false);
  }, []);

  const goOffline = useCallback(() => {
    offlineNow.current = true;
    setOffline(true);
    clearTimeout(pending.current.timer);
    pending.current.controller?.abort();
    dropLookup();
    setScanning(false);
    setResults([]);
    setSearchedQuery(null);
    setSearching(false);
    setErrorText(null);
  }, [dropLookup]);

  const runSearch = useCallback(
    async (q, controller) => {
      try {
        const found = await searchFoods(q, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setResults(found);
        setSearchedQuery(q);
        setSearching(false);
      } catch (error) {
        if (controller.signal.aborted || error?.name === "AbortError") return;
        setSearching(false);
        if (isOfflineError(error)) {
          goOffline();
          return;
        }
        setResults([]);
        setErrorText(errorLine(error));
      }
    },
    [goOffline],
  );

  const clearOffline = useCallback(() => {
    if (!offlineNow.current) return;
    offlineNow.current = false;
    setOffline(false);
    setErrorText(null);
    const q = normaliseQuery(latestQuery.current);
    if (q.length < MIN_QUERY_LENGTH) return;
    const controller = new AbortController();
    pending.current.controller = controller;
    setSearching(true);
    runSearch(q, controller);
  }, [runSearch]);

  useEffect(() => {
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", clearOffline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", clearOffline);
    };
  }, [goOffline, clearOffline]);

  const changeQuery = (event) => {
    const text = event.target.value;
    dropLookup();
    latestQuery.current = text;
    setQuery(text);
    setErrorText(null);
    setSearchedQuery(null);
    clearTimeout(pending.current.timer);
    pending.current.controller?.abort();

    const q = normaliseQuery(text);
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    pending.current.controller = controller;
    setSearching(true);
    pending.current.timer = setTimeout(
      () => runSearch(q, controller),
      DEBOUNCE_MS,
    );
  };

  const addFromSheet = (payload) => {
    addEntry({ ...payload, date });
    setSelected(null);
    onLogged();
  };

  const logMeal = () => {
    setMealsSlot(null);
    onLogged();
  };

  const openCreate = (initial) => {
    setCreateInitial(initial);
    setCreating(true);
  };

  const closeCreate = () => {
    setCreating(false);
    setCreateInitial(undefined);
  };

  const selectResult = (food) => {
    dropLookup();
    setSelected(food);
  };

  const openMeals = () => {
    dropLookup();
    setMealsSlot(presetSlot ?? slotForTime());
  };

  const toggleCustomList = () => {
    dropLookup();
    if (!offline) setShowCustom((shown) => !shown);
  };

  const openScanner = () => {
    dropLookup();
    setScanning(true);
  };

  const cancelScanner = () => {
    dropLookup();
    setScanning(false);
  };

  const lookupScanned = async (code) => {
    lookupToken.current += 1;
    const token = lookupToken.current;
    setScanning(false);
    setErrorText(null);
    setLookingUp(true);
    let found;
    try {
      found = await lookupBarcode(code);
    } catch (error) {
      if (lookupToken.current !== token) return;
      setLookingUp(false);
      if (error instanceof FoodApiError && error.kind === "not_found") {
        openCreate({ barcode: code });
        return;
      }
      if (isOfflineError(error)) {
        goOffline();
        return;
      }
      setErrorText(errorLine(error));
      return;
    }
    if (lookupToken.current !== token) return;
    setLookingUp(false);
    setSelected(found);
  };

  const openCreated = (saved) => {
    closeCreate();
    setSelected({ ...saved, source: "custom" });
  };

  const q = normaliseQuery(query);
  const allCustomRows = customFoods.map((food) => ({
    ...food,
    source: "custom",
  }));
  const customRows =
    q.length < MIN_QUERY_LENGTH
      ? []
      : allCustomRows.filter((food) => normaliseQuery(food.name).includes(q));
  const customListShown = offline || showCustom;
  const noMatch =
    q.length >= MIN_QUERY_LENGTH &&
    searchedQuery === q &&
    results.length === 0 &&
    customRows.length === 0 &&
    !errorText &&
    !offline;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          type="search"
          autoFocus
          aria-label="Search foods"
          placeholder="Search foods"
          value={query}
          onChange={changeQuery}
          disabled={offline}
        />
        {!offline && (
          <Button type="button" aria-label="Scan barcode" onClick={openScanner}>
            Scan
          </Button>
        )}
      </div>

      {isFixtureMode() && <Badge>demo data</Badge>}

      {lookingUp && (
        <p role="status" className="text-sm text-neutral-500">
          Looking up barcode…
        </p>
      )}

      {searching && !lookingUp && (
        <p role="status" className="text-sm text-neutral-500">
          Searching…
        </p>
      )}

      {offline && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-red-600 dark:text-red-400">
            {OFFLINE_NOTE}
          </p>
          {navigator.onLine !== false && (
            <Button type="button" size="sm" onClick={clearOffline}>
              Try again
            </Button>
          )}
        </div>
      )}

      {errorText && !offline && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorText}</p>
      )}

      {!offline && (
        <div className="space-y-2">
          {[...customRows, ...results].map((food) => (
            <SearchResultRow
              key={`${food.source}:${food.id}`}
              food={food}
              onSelect={selectResult}
            />
          ))}
        </div>
      )}

      {noMatch && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No match. Create a custom food?
        </p>
      )}

      {offline && (
        <FoodList
          title="Recent"
          emptyText="No recent foods yet"
          foods={recent.map((row) => ({
            ...recentToFood(row),
            defaultGrams: row.lastGrams,
          }))}
          onSelect={selectResult}
        />
      )}

      {customListShown && (
        <FoodList
          title="Custom foods"
          emptyText="No custom foods yet"
          foods={allCustomRows}
          onSelect={selectResult}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={openMeals}>
          Saved meals
        </Button>
        <Button
          type="button"
          aria-pressed={customListShown}
          onClick={toggleCustomList}
        >
          Custom foods
        </Button>
        <Button
          type="button"
          onClick={() => {
            dropLookup();
            openCreate(undefined);
          }}
        >
          Create custom food
        </Button>
      </div>

      {mealsSlot && (
        <SavedMealsPanel
          date={date}
          slot={mealsSlot}
          onLogged={logMeal}
          onClose={() => setMealsSlot(null)}
        />
      )}

      {scanning && (
        <BarcodeScanner onDetected={lookupScanned} onCancel={cancelScanner} />
      )}

      {creating && (
        <CustomFoodForm
          initial={createInitial}
          onSaved={openCreated}
          onClose={closeCreate}
        />
      )}

      {selected && (
        <PortionSheet
          key={`${selected.source}:${selected.id}`}
          food={selected}
          date={date}
          defaultSlot={presetSlot ?? slotForTime()}
          defaultGrams={selected.defaultGrams}
          onAdd={addFromSheet}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
