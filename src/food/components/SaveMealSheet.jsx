import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useFood } from "../context/FoodContext";
import { formatDayHeader } from "../lib/localDate";
import { slotLabel } from "../lib/slots";

/** Bottom sheet that saves one slot's entries as a new named meal. */
export default function SaveMealSheet({ date, slot, onClose }) {
  const { saveMealFromSlot } = useFood();
  const [name, setName] = useState("");

  const trimmed = name.trim();

  const save = () => {
    saveMealFromSlot(trimmed, date, slot);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save meal"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold">Save as meal</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {`${slotLabel(slot)} · ${formatDayHeader(date)}`}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

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
      </div>
    </div>
  );
}
