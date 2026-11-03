import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useFood } from "../context/FoodContext";
import { formatDayHeader } from "../lib/localDate";
import { sumMacros } from "../lib/macros";
import { slotLabel } from "../lib/slots";

const mealSummary = (meal) => {
  const count = meal.items.length;
  const items = count === 1 ? "1 item" : `${count} items`;
  return `${items} · ${sumMacros(meal.items).kcal} kcal`;
};

/** Bottom sheet that logs a saved meal into one slot, or saves that slot as a meal. */
export default function SavedMealsPanel({ date, slot, onLogged, onClose }) {
  const { entries, savedMeals, saveMealFromSlot, logSavedMeal } = useFood();
  const [name, setName] = useState("");

  const trimmed = name.trim();
  const slotHasEntries = entries.some(
    (entry) => entry.date === date && entry.slot === slot,
  );

  const log = (meal) => {
    logSavedMeal(meal.id, date, slot);
    onLogged();
  };

  const save = () => {
    saveMealFromSlot(trimmed, date, slot);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Saved meals"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold">Saved meals</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {`${slotLabel(slot)} · ${formatDayHeader(date)}`}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {savedMeals.length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            No saved meals yet
          </p>
        ) : (
          <div className="space-y-2">
            {savedMeals.map((meal) => (
              <button
                key={meal.id}
                type="button"
                className="block w-full rounded-xl border px-3 py-2 text-left text-sm dark:border-neutral-700"
                onClick={() => log(meal)}
              >
                <span className="block break-words font-medium">
                  {meal.name}
                </span>
                <span className="block text-neutral-600 dark:text-neutral-400">
                  {mealSummary(meal)}
                </span>
              </button>
            ))}
          </div>
        )}

        {slotHasEntries && (
          <div className="flex items-end gap-2">
            <label className="block min-w-0 flex-1 text-sm">
              <span className="mb-1 block">Save as meal</span>
              <Input
                placeholder="Meal name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="primary"
              disabled={trimmed === ""}
              onClick={save}
            >
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
