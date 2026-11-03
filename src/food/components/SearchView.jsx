import { useEffect, useRef, useState } from "react";
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
import { slotForTime } from "../lib/slots";
import BarcodeScanner from "./BarcodeScanner";
import CustomFoodForm from "./CustomFoodForm";
import PortionSheet from "./PortionSheet";
import SavedMealsPanel from "./SavedMealsPanel";
import SearchResultRow from "./SearchResultRow";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

function errorLine(error) {
  if (error instanceof FoodApiError) {
    if (error.kind === "offline") return "Search needs a connection";
    if (error.kind === "rate_limited")
      return "Too many searches, wait a minute";
  }
  return "Search unavailable, try again";
}

/** Food search: debounced API lookup plus matching custom foods. */
export default function SearchView({ date, presetSlot, onLogged }) {
  const { customFoods, addEntry } = useFood();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [errorText, setErrorText] = useState(null);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createInitial, setCreateInitial] = useState(undefined);
  const [scanning, setScanning] = useState(false);
  const [mealsSlot, setMealsSlot] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
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

  const runSearch = async (q, controller) => {
    try {
      const found = await searchFoods(q, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setResults(found);
    } catch (error) {
      if (controller.signal.aborted || error?.name === "AbortError") return;
      setResults([]);
      setErrorText(errorLine(error));
    }
  };

  const changeQuery = (event) => {
    const text = event.target.value;
    dropLookup();
    setQuery(text);
    setErrorText(null);
    clearTimeout(pending.current.timer);
    pending.current.controller?.abort();

    const q = normaliseQuery(text);
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    pending.current.controller = controller;
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

  const dropLookup = () => {
    lookupToken.current += 1;
    setLookingUp(false);
  };

  const selectResult = (food) => {
    dropLookup();
    setSelected(food);
  };

  const openMeals = () => {
    dropLookup();
    setMealsSlot(presetSlot ?? slotForTime());
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
  const customRows =
    q.length < MIN_QUERY_LENGTH
      ? []
      : customFoods
          .filter((food) => normaliseQuery(food.name).includes(q))
          .map((food) => ({ ...food, source: "custom" }));

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
        />
        <Button type="button" aria-label="Scan barcode" onClick={openScanner}>
          Scan
        </Button>
      </div>

      {isFixtureMode() && <Badge>demo data</Badge>}

      {lookingUp && (
        <p role="status" className="text-sm text-neutral-500">
          Looking up barcode…
        </p>
      )}

      {errorText && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorText}</p>
      )}

      <div className="space-y-2">
        {[...customRows, ...results].map((food) => (
          <SearchResultRow
            key={`${food.source}:${food.id}`}
            food={food}
            onSelect={selectResult}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={openMeals}>
          Saved meals
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
          onAdd={addFromSheet}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
