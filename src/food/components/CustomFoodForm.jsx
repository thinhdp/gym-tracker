import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useFood } from "../context/FoodContext";
import { kcalFromMacros } from "../lib/macros";

// Form fields hold strings; an empty or blank field is NaN so validation blocks it.
const toNumber = (s) => (s.trim() === "" ? NaN : Number(s));
const asField = (value) =>
  value === undefined || value === null ? "" : String(value);
const isNonNegative = (n) => Number.isFinite(n) && n >= 0;
const isPositive = (n) => Number.isFinite(n) && n > 0;

const MACRO_FIELDS = [
  ["protein", "Protein (g)", "Protein"],
  ["carb", "Carbs (g)", "Carbs"],
  ["fat", "Fat (g)", "Fat"],
];

function startForm(initial) {
  const first = initial?.portions?.[0];
  return {
    name: asField(initial?.name),
    barcode: asField(initial?.barcode),
    kcal: asField(initial?.per100?.kcal),
    protein: asField(initial?.per100?.protein),
    carb: asField(initial?.per100?.carb),
    fat: asField(initial?.per100?.fat),
    portionLabel: asField(first?.label),
    portionGrams: asField(first?.grams),
  };
}

/** The portion rows after an edit: only the first one is the form's to change. */
function nextPortions(initial, form) {
  const label = form.portionLabel.trim();
  const others = Array.isArray(initial?.portions)
    ? initial.portions.slice(1)
    : [];
  return label === ""
    ? others
    : [{ label, grams: toNumber(form.portionGrams) }, ...others];
}

/** The row to save. Keeps every other field of `initial`, so id and createdAt stay. */
function buildRow(initial, form) {
  const macros = {
    protein: toNumber(form.protein),
    carb: toNumber(form.carb),
    fat: toNumber(form.fat),
  };
  const row = {
    ...initial,
    name: form.name.trim(),
    per100: {
      kcal:
        form.kcal.trim() === "" ? kcalFromMacros(macros) : toNumber(form.kcal),
      ...macros,
    },
  };
  const barcode = form.barcode.trim();
  if (barcode === "") delete row.barcode;
  else row.barcode = barcode;
  const portions = nextPortions(initial, form);
  if (portions.length === 0) delete row.portions;
  else row.portions = portions;
  return row;
}

function validate(form) {
  const messages = [];
  if (form.name.trim() === "") messages.push("Name is required");
  const barcode = form.barcode.trim();
  if (barcode !== "" && !/^\d+$/.test(barcode)) {
    messages.push("Barcode must be digits only");
  }
  if (form.kcal.trim() !== "" && !isNonNegative(toNumber(form.kcal))) {
    messages.push("Calories must be 0 or more");
  }
  for (const [key, , name] of MACRO_FIELDS) {
    if (!isNonNegative(toNumber(form[key]))) {
      messages.push(`${name} is required and must be 0 or more`);
    }
  }
  const hasLabel = form.portionLabel.trim() !== "";
  const hasGrams = form.portionGrams.trim() !== "";
  if (hasLabel !== hasGrams) {
    messages.push("Portion needs both a label and grams");
  }
  if (hasGrams && !isPositive(toNumber(form.portionGrams))) {
    messages.push("Portion grams must be above 0");
  }
  return messages;
}

/** Bottom sheet that creates a custom food, or edits `initial`, with per-100 g values. */
export default function CustomFoodForm({ initial, onSaved, onClose }) {
  const { upsertCustomFood } = useFood();
  const [form, setForm] = useState(() => startForm(initial));

  const setField = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const messages = validate(form);
  const gramsBad =
    (form.portionLabel.trim() !== "" || form.portionGrams.trim() !== "") &&
    !isPositive(toNumber(form.portionGrams));
  const title = initial?.id ? "Edit custom food" : "Create custom food";

  const save = () => {
    if (messages.length > 0) return;
    onSaved(upsertCustomFood(buildRow(initial, form)));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-100">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block">Name</span>
          <Input value={form.name} onChange={setField("name")} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Barcode</span>
          <Input
            inputMode="numeric"
            placeholder="Optional"
            value={form.barcode}
            onChange={setField("barcode")}
          />
        </label>

        <p className="text-sm font-medium">Per 100 g</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block">Calories</span>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="From macros"
              value={form.kcal}
              onChange={setField("kcal")}
            />
          </label>
          {MACRO_FIELDS.map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block">{label}</span>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={form[key]}
                onChange={setField(key)}
              />
            </label>
          ))}
        </div>

        <p className="text-sm font-medium">Portion (optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block">Portion label</span>
            <Input
              value={form.portionLabel}
              onChange={setField("portionLabel")}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block">Portion grams</span>
            <span
              className={`block rounded-xl ${gramsBad ? "ring-2 ring-red-500" : ""}`}
            >
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={form.portionGrams}
                onChange={setField("portionGrams")}
                aria-invalid={gramsBad}
              />
            </span>
          </label>
        </div>

        {messages.length > 0 && (
          <ul className="text-sm text-red-600 dark:text-red-400">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant="primary"
          className="w-full"
          disabled={messages.length > 0}
          onClick={save}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
