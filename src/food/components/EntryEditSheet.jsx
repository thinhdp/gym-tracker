import { useState } from "react";
import { useConfirm } from "../../components/ConfirmDialog";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import Segmented from "../../components/ui/Segmented";
import { formatDayHeader } from "../lib/localDate";
import { SLOTS } from "../lib/slots";

const SLOT_OPTIONS = SLOTS.map((slot) => [slot.id, slot.label]);

/**
 * Bottom sheet that changes one logged entry's portion, grams and slot, or
 * deletes it. `portions` are the food's known portions; the entry's own
 * portion label is always shown even when the food has no matching portion.
 */
export default function EntryEditSheet({
  entry,
  portions = [],
  onSave,
  onDelete,
  onClose,
}) {
  const confirm = useConfirm();
  const [chips] = useState(() =>
    entry.portionLabel &&
    !portions.some((portion) => portion.label === entry.portionLabel)
      ? [...portions, { label: entry.portionLabel, grams: entry.grams }]
      : portions,
  );
  const [chip, setChip] = useState(
    () => chips.find((portion) => portion.label === entry.portionLabel) ?? null,
  );
  const [grams, setGrams] = useState(String(entry.grams));
  const [slot, setSlot] = useState(entry.slot);

  const amount = Number(grams);
  const valid = Number.isFinite(amount) && amount > 0;

  const pickChip = (portion) => {
    setChip(portion);
    setGrams(String(portion.grams));
  };

  const typeGrams = (event) => {
    const text = event.target.value;
    setGrams(text);
    if (chip && Number(text) !== chip.grams) setChip(null);
  };

  const save = () => {
    onSave({ grams: amount, slot, portionLabel: chip?.label });
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

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((portion, index) => (
              <Button
                key={`${portion.label}-${index}`}
                type="button"
                size="sm"
                variant={portion === chip ? "primary" : "secondary"}
                aria-pressed={portion === chip}
                onClick={() => pickChip(portion)}
              >
                {portion.label}
              </Button>
            ))}
          </div>
        )}

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
              onChange={typeGrams}
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
