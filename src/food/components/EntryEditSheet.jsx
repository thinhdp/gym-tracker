import { useState } from "react";
import { useConfirm } from "../../components/ConfirmDialog";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import Segmented from "../../components/ui/Segmented";
import { formatDayHeader } from "../lib/localDate";
import { SLOTS } from "../lib/slots";

const SLOT_OPTIONS = SLOTS.map((slot) => [slot.id, slot.label]);

/** Bottom sheet that changes one logged entry's grams and slot, or deletes it. */
export default function EntryEditSheet({ entry, onSave, onDelete, onClose }) {
  const confirm = useConfirm();
  const [grams, setGrams] = useState(String(entry.grams));
  const [slot, setSlot] = useState(entry.slot);

  const amount = Number(grams);
  const valid = Number.isFinite(amount) && amount > 0;

  const save = () => {
    const patch = { grams: amount, slot };
    // A label such as "1 large egg" no longer describes a changed amount.
    if (amount !== entry.grams) patch.portionLabel = undefined;
    onSave(patch);
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Delete this entry?",
      message: `${entry.name} will be removed from this day.`,
      confirmText: "Delete",
      tone: "destructive",
    });
    if (ok) onDelete();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={entry.name}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words font-semibold">{entry.name}</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {formatDayHeader(entry.date)}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block">Grams</span>
          <span
            className={`block rounded-xl ${valid ? "" : "ring-2 ring-red-500"}`}
          >
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={grams}
              onChange={(event) => setGrams(event.target.value)}
              aria-invalid={!valid}
            />
          </span>
        </label>

        <Segmented
          options={SLOT_OPTIONS}
          value={slot}
          onChange={setSlot}
          className="flex-wrap"
        />

        <div className="flex gap-2">
          <Button type="button" className="flex-1" onClick={remove}>
            Delete
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            disabled={!valid}
            onClick={save}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
