import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import Segmented from "../../components/ui/Segmented";
import { formatDayHeader } from "../lib/localDate";
import { scaleMacros } from "../lib/macros";
import { SLOTS } from "../lib/slots";

const SLOT_OPTIONS = SLOTS.map((slot) => [slot.id, slot.label]);

/** The starting chip and grams text for a food. */
function startValues(portions, defaultGrams) {
  const defaultPortion =
    portions.find((portion) => portion.isDefault) ?? portions[0] ?? null;
  if (defaultGrams === undefined) {
    return {
      chip: defaultPortion,
      grams: defaultPortion ? String(defaultPortion.grams) : "",
    };
  }
  const chip =
    [defaultPortion, ...portions].find(
      (portion) => portion?.grams === defaultGrams,
    ) ?? null;
  return { chip, grams: String(defaultGrams) };
}

/** Bottom sheet that picks the amount and slot for one food, then adds it. */
export default function PortionSheet({
  food,
  date,
  defaultSlot,
  defaultGrams,
  onAdd,
  onClose,
}) {
  const portions = food.portions ?? [];
  const [start] = useState(() => startValues(portions, defaultGrams));
  const [chip, setChip] = useState(start.chip);
  const [grams, setGrams] = useState(start.grams);
  const [slot, setSlot] = useState(defaultSlot);

  const amount = Number(grams);
  const valid = Number.isFinite(amount) && amount > 0;
  const macros = scaleMacros(food.per100, valid ? amount : 0);

  const pickChip = (portion) => {
    setChip(portion);
    setGrams(String(portion.grams));
  };

  const typeGrams = (event) => {
    const text = event.target.value;
    setGrams(text);
    if (chip && Number(text) !== chip.grams) setChip(null);
  };

  const add = () => {
    const { kcal, protein, carb, fat } = food.per100;
    const ref = {
      kind: food.source === "custom" ? "custom" : "db",
      id: food.id,
    };
    if (food.barcode) ref.barcode = food.barcode;
    onAdd({
      name: food.name,
      grams: amount,
      per100: { kcal, protein, carb, fat },
      food: ref,
      portionLabel: chip?.label,
      slot,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={food.name}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words font-semibold">{food.name}</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {formatDayHeader(date)}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {portions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {portions.map((portion, index) => (
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

        <p className="text-sm">
          {`${macros.kcal} kcal · P ${macros.protein} g · C ${macros.carb} g · F ${macros.fat} g`}
        </p>

        <Segmented
          options={SLOT_OPTIONS}
          value={slot}
          onChange={setSlot}
          className="flex-wrap"
        />

        <Button
          type="button"
          variant="primary"
          className="w-full"
          disabled={!valid}
          onClick={add}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
