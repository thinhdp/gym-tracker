import { useEffect, useRef, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useFood } from "../context/FoodContext";
import {
  FoodApiError,
  isFixtureMode,
  normaliseQuery,
  searchFoods,
} from "../lib/foodApi";
import { slotForTime } from "../lib/slots";
import PortionSheet from "./PortionSheet";
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
export default function SearchView({ date, presetSlot, onLogged, onScan }) {
  const { customFoods, addEntry } = useFood();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [errorText, setErrorText] = useState(null);
  const [selected, setSelected] = useState(null);
  const pending = useRef({ timer: null, controller: null });

  // On unmount, drop the waiting debounce and the request in flight.
  useEffect(() => {
    const current = pending.current;
    return () => {
      clearTimeout(current.timer);
      current.controller?.abort();
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
        {onScan && (
          <Button type="button" aria-label="Scan barcode" onClick={onScan}>
            Scan
          </Button>
        )}
      </div>

      {isFixtureMode() && <Badge>demo data</Badge>}

      {errorText && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorText}</p>
      )}

      <div className="space-y-2">
        {[...customRows, ...results].map((food) => (
          <SearchResultRow
            key={`${food.source}:${food.id}`}
            food={food}
            onSelect={setSelected}
          />
        ))}
      </div>

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
