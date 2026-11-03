import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useFood } from "../context/FoodContext";
import { recentKey } from "../lib/recent";
import { slotForTime } from "../lib/slots";
import Toast from "./Toast";

/** Horizontal chips of recent foods: one tap logs lastGrams, with an undo toast. */
export default function RecentRow({ date, onOpen }) {
  const { recent, addEntry, deleteEntry } = useFood();
  const [toast, setToast] = useState(null);

  const logAgain = (row) => {
    const entry = addEntry({
      date,
      slot: slotForTime(),
      name: row.name,
      grams: row.lastGrams,
      per100: row.per100,
      food: row.food,
      portionLabel: row.lastPortionLabel,
      portions: row.portions,
    });
    setToast({ entryId: entry.id, name: row.name });
  };

  return (
    <>
      {recent.length > 0 && (
        <div
          role="group"
          aria-label="Recent foods"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {recent.map((row) => (
            <div
              key={recentKey(row.food)}
              className="flex shrink-0 items-center rounded-xl border border-neutral-300 dark:border-neutral-700"
            >
              <Button
                type="button"
                variant="ghost"
                className="whitespace-nowrap"
                onClick={() => logAgain(row)}
              >
                {`${row.name} · ${row.lastGrams} g`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Options for ${row.name}`}
                onClick={() => onOpen(row)}
              >
                …
              </Button>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <Toast
          key={toast.entryId}
          message={`Logged ${toast.name}`}
          actionLabel="Undo"
          onAction={() => {
            deleteEntry(toast.entryId);
            setToast(null);
          }}
          onDone={() => setToast(null)}
        />
      )}
    </>
  );
}
